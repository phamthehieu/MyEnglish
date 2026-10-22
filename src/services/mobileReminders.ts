import { cancel, isPermissionGranted, pending, requestPermission } from "@tauri-apps/plugin-notification";
import { isMobilePlatform } from "@/lib/platform";
import { getReminderSettings, NIGHT_QUIET_END, NIGHT_QUIET_START, type ReminderSettings } from "./reminderSettings";
import { ANCHOR_TIMES } from "./reminderMoments";
import { getActivityLogs, getDailyGoal, getLocalDateString } from "./streak";
import { countTodayWork } from "./todayWork";

/**
 * Study reminders on a phone.
 *
 * The desktop reminders count down inside the page. Android freezes the page as soon as the learner leaves the
 * app, so nothing would ever fire. Instead, the moment the app goes to the background the plan for the next
 * days is handed to Android in ONE call (AndroidReminders, see Reminders.kt), whose alarms fire with the app
 * closed. While the app is open the plan is renewed from now (the first reminder is a whole gap away), so a
 * session shorter than that is never interrupted, and an app killed while open still leaves reminders behind.
 *
 * A call per notification was tried first and is not safe: the page can be frozen between two calls, leaving
 * half a plan or none.
 */

const DAYS_AHEAD = 3;
const MAX_ENTRIES = 60;
/** Ids of the notifications an earlier version scheduled through the notification plugin (cleaned up once) */
const OLD_PLUGIN_ID_BASE = 71_000_000;
const OLD_PLUGIN_ID_SPAN = 1000;
const PLAN_KEY = "myenglish_mobile_reminders_v2";
const ASKED_KEY = "myenglish_notification_permission_asked_v1";
const HANDLED_KEY = "myenglish_mobile_reminder_handled_v1";
/** Opening the app this soon after a reminder counts as tapping it: land on the review */
const OPEN_WINDOW_MS = 15 * 60 * 1000;
/** Two reminders closer than this are one too many */
const MIN_SPACING_MS = 20 * 60 * 1000;

const TITLE = "MyEnglish • Đến giờ ôn từ";
const MESSAGES = [
  "Vài phút ôn từ hôm nay giúp bạn nhớ lâu hơn.",
  "Giữ chuỗi ngày học nhé: chỉ cần vài câu thôi.",
  "Ôn đúng lúc sắp quên là cách nhớ lâu nhất.",
  "Mở MyEnglish và làm một phiên ngắn nào.",
];

/** The page-facing side of Reminders.kt */
interface RemindersBridge {
  setPlan(planJson: string, ruleJson: string): boolean;
  clear(): void;
  canNotify(): boolean;
}

function bridge(): RemindersBridge | null {
  try {
    return (window as unknown as { AndroidReminders?: RemindersBridge }).AndroidReminders ?? null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full: the reminders still fire, only the "open on tap" shortcut is lost */
  }
}

/** Hours of the day a reminder may be planned in: the night quiet hours are left out */
export function reminderWindow(settings: Pick<ReminderSettings, "nightQuiet">): { startHour: number; endHour: number } {
  return settings.nightQuiet ? { startHour: NIGHT_QUIET_END, endHour: NIGHT_QUIET_START } : { startHour: 6, endHour: 23 };
}

/**
 * Minutes between two planned reminders, or 0 when the automatic reminders are off. The learner's interval,
 * but never so short that the daily limit would be used up in the first hours of the morning: the limit is
 * spread over the day.
 */
export function reminderGapMinutes(settings: ReminderSettings): number {
  if (!settings.enabled || settings.intervalMinutes === 0) return 0;
  const { startHour, endHour } = reminderWindow(settings);
  const spread = settings.maxNudgesPerDay > 0 ? Math.ceil(((endHour - startHour) * 60) / settings.maxNudgesPerDay) : 0;
  return Math.max(settings.intervalMinutes, spread);
}

export interface PlannedReminder {
  at: number;
  body: string;
}

/**
 * Reminders for the next days: pure, so it can be tested. Today's start counting from `now` (the learner has
 * just left the app, like the countdown on the desktop), the other days from the morning.
 */
export function planReminders(
  now: Date,
  settings: ReminderSettings,
  opts: { goalMetToday: boolean; dueToday: number }
): PlannedReminder[] {
  if (!settings.enabled) return [];
  const gapMs = reminderGapMinutes(settings) * 60_000;
  const { startHour, endHour } = reminderWindow(settings);
  const cap = settings.maxNudgesPerDay > 0 ? settings.maxNudgesPerDay : Infinity;
  const plan: PlannedReminder[] = [];

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const at = (hour: number, minute = 0) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute, 0, 0).getTime();
    const dayStart = at(startHour);
    const dayEnd = at(endHour);

    let times: number[] = [];
    if (gapMs > 0) {
      for (let t = day === 0 ? Math.max(dayStart, now.getTime() + gapMs) : dayStart; t < dayEnd; t += gapMs) times.push(t);
    }
    // The study times the learner chose ("after lunch") are reminded too
    for (const anchor of settings.anchors) {
      const a = ANCHOR_TIMES[anchor];
      if (a) times.push(at(a.hour, a.minute));
    }
    times = times.filter((t) => t >= dayStart && t < dayEnd && t > now.getTime() + 60_000).sort((x, y) => x - y);
    times = times.filter((t, i) => i === 0 || t - times[i - 1] >= MIN_SPACING_MS);
    times = times.slice(0, cap);

    // Nothing to do today: no reminder for the rest of today (the other days are planned as usual)
    if (day === 0 && settings.stopAfterGoal && opts.goalMetToday) times = [];
    if (day === 0 && settings.triggerCondition === "due_only" && opts.dueToday === 0) times = [];
    if (settings.snoozedUntil) times = times.filter((t) => t >= settings.snoozedUntil!);

    for (const t of times) {
      const body =
        day === 0 && opts.dueToday > 0
          ? `Hôm nay còn ${opts.dueToday} thẻ cần ôn. Chỉ vài phút thôi!`
          : MESSAGES[(day + plan.length) % MESSAGES.length];
      plan.push({ at: t, body });
    }
  }
  return plan.slice(0, MAX_ENTRIES);
}

/** The rule behind a plan, for Android to keep planning with after the plan runs out (see Reminders.kt) */
export function reminderRule(settings: ReminderSettings): Record<string, unknown> | null {
  if (!settings.enabled) return null;
  const gap = reminderGapMinutes(settings);
  const anchors = settings.anchors.map((a) => ANCHOR_TIMES[a]).filter(Boolean).map((a) => [a.hour, a.minute]);
  if (gap === 0 && anchors.length === 0) return null;
  const { startHour, endHour } = reminderWindow(settings);
  return { title: TITLE, bodies: MESSAGES, gapMin: gap, startHour, endHour, cap: settings.maxNudgesPerDay, anchors };
}

/** Ask for the notification permission once (Android 13+ shows a prompt; older versions grant it silently) */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    // Already refused once: asking again every launch would nag; the system settings are the way back
    if (localStorage.getItem(ASKED_KEY)) return false;
    localStorage.setItem(ASKED_KEY, "1");
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

// What the plan needs and the page cannot read in the instant the app is being left: refreshed while it is open
let dueToday = 0;

async function refreshDue(): Promise<void> {
  try {
    dueToday = (await countTodayWork()).total;
  } catch {
    /* the last known number stays */
  }
}

/** The next reminder handed to Android (epoch ms), or 0 when none is planned. What the settings screen shows. */
export function nextPlannedReminder(now: number = Date.now()): number {
  return readJson<number[]>(PLAN_KEY, []).find((t) => t > now) ?? 0;
}

/** Hand the plan to Android. Synchronous on purpose: the page may be frozen right after. */
export function scheduleForBackground(now: Date = new Date()): void {
  const android = bridge();
  if (!android || !android.canNotify()) return;
  const goalMetToday = (getActivityLogs()[getLocalDateString(now)] || 0) >= getDailyGoal();
  const settings = getReminderSettings();
  const plan = planReminders(now, settings, { goalMetToday, dueToday });
  android.setPlan(
    JSON.stringify(plan.map((p) => ({ at: p.at, title: TITLE, body: p.body }))),
    JSON.stringify(reminderRule(settings))
  );
  writeJson(PLAN_KEY, plan.map((p) => p.at));
}

/** The app came to the front right after a reminder was due: take the learner to the review, once per reminder */
function openReviewIfFromReminder(): void {
  const now = Date.now();
  const times = readJson<number[]>(PLAN_KEY, []);
  const handled = readJson<number>(HANDLED_KEY, 0);
  const hit = times.filter((t) => t <= now && now - t <= OPEN_WINDOW_MS && t > handled).sort((a, b) => b - a)[0];
  if (hit === undefined) return;
  writeJson(HANDLED_KEY, hit);
  // The quick quiz (a few cards in a box over the screen), not the review tab: that is what the reminder promises
  window.dispatchEvent(new CustomEvent("open-review-popup-preview"));
}

/** Reminders an earlier version scheduled through the notification plugin would now come on top of these */
async function dropOldPluginReminders(): Promise<void> {
  try {
    const ids = (await pending()).map((p) => p.id).filter((id) => id >= OLD_PLUGIN_ID_BASE && id < OLD_PLUGIN_ID_BASE + OLD_PLUGIN_ID_SPAN);
    if (ids.length) await cancel(ids);
  } catch {
    /* nothing of the sort */
  }
}

let started = false;

/** Start the phone reminders (main window, Android only). Safe to call more than once. */
export function startMobileReminders(): () => void {
  if (started || !isMobilePlatform() || !bridge()) return () => {};
  started = true;

  ensureNotificationPermission();
  dropOldPluginReminders();
  refreshDue();

  // The page that registers the "open-review-popup-preview" listener is mounted a moment after the first paint
  const launchTimer = window.setTimeout(() => {
    openReviewIfFromReminder();
    scheduleForBackground();
  }, 2000);

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      scheduleForBackground();
    } else {
      openReviewIfFromReminder();
      scheduleForBackground();
      refreshDue();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    started = false;
    window.clearTimeout(launchTimer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
