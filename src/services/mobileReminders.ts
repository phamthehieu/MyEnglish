import { cancel, isPermissionGranted, pending, requestPermission } from "@tauri-apps/plugin-notification";
import { isMobilePlatform } from "@/lib/platform";
import { getReminderSettings, NIGHT_QUIET_END, NIGHT_QUIET_START, type ReminderSettings } from "./reminderSettings";
import { ANCHOR_TIMES } from "./reminderMoments";
import { getActivityLogs, getDailyGoal, getLocalDateString } from "./streak";
import { countTodayWork } from "./todayWork";
import { getDueWordsLite, getWordsLite } from "./db";
import { selectMicroQuizQuestion, type MicroQuizQuestion } from "./duoMotivation";
import { buildFlashQuizSession } from "./flashQuizSession";

const DAYS_AHEAD = 3;
const MAX_ENTRIES = 60;
const OLD_PLUGIN_ID_BASE = 71_000_000;
const OLD_PLUGIN_ID_SPAN = 1000;
const PLAN_KEY = "myenglish_mobile_reminders_v2";
const ASKED_KEY = "myenglish_notification_permission_asked_v1";
const HANDLED_KEY = "myenglish_mobile_reminder_handled_v1";
const OPEN_WINDOW_MS = 15 * 60 * 1000;
const MIN_SPACING_MS = 3 * 60 * 1000;

const TITLE = "MyEnglish • Đến giờ ôn từ 🦉";
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
  canDrawOverlays?(): boolean;
  requestOverlayPermission?(): boolean;
  testFloatingNudge?(title: string, body: string, dueCount: number, quizJson: string): boolean;
  testFloatingNudgeIn?(seconds: number, title: string, body: string, dueCount: number, quizJson: string): boolean;
  getPendingQuizAnswers?(): string;
  clearPendingQuizAnswers?(): void;
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
    /* private mode / storage full */
  }
}

/** Check if the app is allowed to display floating popups over other apps */
export function canDrawOverlays(): boolean {
  const b = bridge();
  return b ? !!b.canDrawOverlays?.() : false;
}

/** Ask Android system to open the "Display over other apps" settings screen */
export function requestOverlayPermission(): boolean {
  const b = bridge();
  return b ? !!b.requestOverlayPermission?.() : false;
}

/** Test floating nudge / flash-quiz popup directly */
export async function testMobileFloatingNudge(sampleQuiz?: MicroQuizQuestion | null): Promise<boolean> {
  const b = bridge();
  if (!b?.testFloatingNudge) return false;
  if (!sampleQuiz && cachedQuizzes.length === 0) {
    await refreshDue().catch(() => {});
  }
  const q = sampleQuiz || cachedQuizzes[0] || {
    wordId: "demo-quiz-1",
    word: "discourse",
    phonetic: "/dɪsˈkɔːrs/",
    targetMeaning: "cuộc đàm luận, diễn ngôn",
    promptTitle: "discourse",
    direction: "recognition" as const,
    options: [
      { id: "opt_1", text: "cuộc đàm luận, diễn ngôn", isCorrect: true },
      { id: "opt_2", text: "sự phá hủy, tàn phá", isCorrect: false },
      { id: "opt_3", text: "lòng trung thành, tận tụy", isCorrect: false },
    ],
  };
  return b.testFloatingNudge(
    TITLE,
    `Có ${dueToday || 5} từ cần bạn điểm danh, khoảng 4 phút.`,
    dueToday || 5,
    JSON.stringify(q)
  );
}

/** Test floating nudge / flash-quiz popup after N seconds so user can switch away to home screen */
export async function testMobileFloatingNudgeIn(seconds: number = 5, sampleQuiz?: MicroQuizQuestion | null): Promise<boolean> {
  const b = bridge();
  if (!b?.testFloatingNudgeIn) return false;
  if (!sampleQuiz && cachedQuizzes.length === 0) {
    await refreshDue().catch(() => {});
  }
  const q = sampleQuiz || cachedQuizzes[0] || {
    wordId: "demo-quiz-1",
    word: "discourse",
    phonetic: "/dɪsˈkɔːrs/",
    targetMeaning: "cuộc đàm luận, diễn ngôn",
    promptTitle: "discourse",
    direction: "recognition" as const,
    options: [
      { id: "opt_1", text: "cuộc đàm luận, diễn ngôn", isCorrect: true },
      { id: "opt_2", text: "sự phá hủy, tàn phá", isCorrect: false },
      { id: "opt_3", text: "lòng trung thành, tận tụy", isCorrect: false },
    ],
  };
  return b.testFloatingNudgeIn(
    seconds,
    TITLE,
    `Có ${dueToday || 5} từ cần bạn điểm danh, khoảng 4 phút.`,
    dueToday || 5,
    JSON.stringify(q)
  );
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
      for (let t = day === 0 ? Math.max(dayStart, now.getTime() + gapMs) : dayStart; t < dayEnd; t += gapMs) {
        times.push(t);
      }
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

/** The rule behind a plan, for Android to keep planning with after the plan runs out */
export function reminderRule(settings: ReminderSettings): Record<string, unknown> | null {
  if (!settings.enabled) return null;
  const gap = reminderGapMinutes(settings);
  const anchors = settings.anchors.map((a) => ANCHOR_TIMES[a]).filter(Boolean).map((a) => [a.hour, a.minute]);
  if (gap === 0 && anchors.length === 0) return null;
  const { startHour, endHour } = reminderWindow(settings);
  return { title: TITLE, bodies: MESSAGES, gapMin: gap, startHour, endHour, cap: settings.maxNudgesPerDay, anchors };
}

/** Ask for the notification permission once */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    if (localStorage.getItem(ASKED_KEY)) return false;
    localStorage.setItem(ASKED_KEY, "1");
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

// Pre-cached data for handoff to Android background alarms
let dueToday = 0;
let cachedQuizzes: MicroQuizQuestion[] = [];
/** Today's words + forgotten words: a whole Flash-Quiz session, sent as a JSON array in the "quiz" field */
let sessionQuizzes: MicroQuizQuestion[] = [];

/** The quiz of the reminder at `idx`: the session (rotated, so each reminder starts on another word) or one due word */
function quizFor(idx: number): string {
  if (sessionQuizzes.length > 0) {
    const start = idx % sessionQuizzes.length;
    return JSON.stringify([...sessionQuizzes.slice(start), ...sessionQuizzes.slice(0, start)]);
  }
  return cachedQuizzes.length > 0 ? JSON.stringify(cachedQuizzes[idx % cachedQuizzes.length]) : "";
}

async function refreshDue(): Promise<void> {
  try {
    dueToday = (await countTodayWork()).total;
    const [dueWords, allWords] = await Promise.all([getDueWordsLite(), getWordsLite()]);
    sessionQuizzes = await buildFlashQuizSession(allWords).catch(() => []);
    const sourceWords = dueWords.length > 0 ? dueWords : allWords;
    if (sourceWords.length > 0) {
      cachedQuizzes = [];
      for (let i = 0; i < 5; i++) {
        const q = selectMicroQuizQuestion(sourceWords, allWords);
        if (q) cachedQuizzes.push(q);
      }
    }
  } catch {
    /* the last known number stays */
  }
}

/** The next reminder handed to Android (epoch ms), or 0 when none is planned. */
export function nextPlannedReminder(now: number = Date.now()): number {
  return readJson<number[]>(PLAN_KEY, []).find((t) => t > now) ?? 0;
}

/** Hand the plan to Android with attached micro-quiz questions. Synchronous on purpose. */
export function scheduleForBackground(now: Date = new Date()): void {
  const android = bridge();
  if (!android || !android.canNotify()) return;
  const goalMetToday = (getActivityLogs()[getLocalDateString(now)] || 0) >= getDailyGoal();
  const settings = getReminderSettings();
  const plan = planReminders(now, settings, { goalMetToday, dueToday });
  android.setPlan(
    JSON.stringify(
      plan.map((p, idx) => ({
        at: p.at,
        title: TITLE,
        body: p.body,
        dueCount: dueToday,
        quiz: quizFor(idx),
      }))
    ),
    JSON.stringify(reminderRule(settings))
  );
  writeJson(PLAN_KEY, plan.map((p) => p.at));
}

/** The app came to the front right after a reminder was due */
function openReviewIfFromReminder(): void {
  // Do not pop up unsolicited review modals when learner opens or resumes the app.
  // The learner is already in the app and can start reviewing whenever they choose from Today/Review tabs.
  const now = Date.now();
  const times = readJson<number[]>(PLAN_KEY, []);
  const handled = readJson<number>(HANDLED_KEY, 0);
  const hit = times.filter((t) => t <= now && now - t <= OPEN_WINDOW_MS && t > handled).sort((a, b) => b - a)[0];
  if (hit !== undefined) {
    writeJson(HANDLED_KEY, hit);
  }
}

/** Sync any micro-quiz answers completed while on the floating overlay outside the app */
export async function syncPendingMobileQuizResults(): Promise<void> {
  const android = bridge();
  if (!android || !android.getPendingQuizAnswers) return;
  try {
    const raw = android.getPendingQuizAnswers();
    if (!raw || raw === "[]") return;
    const results = JSON.parse(raw) as Array<{
      wordId: string;
      isCorrect: boolean;
      responseTimeMs: number;
    }>;
    if (!Array.isArray(results) || results.length === 0) return;

    const { evaluateMicroQuizAnswer } = await import("@/services/duoMotivation");
    for (const res of results) {
      if (res.wordId) {
        await evaluateMicroQuizAnswer({
          wordId: res.wordId,
          selectedChoiceId: res.isCorrect ? "opt_c" : "opt_w",
          options: [
            { id: "opt_c", text: "", isCorrect: true },
            { id: "opt_w", text: "", isCorrect: false },
          ],
          targetMeaning: "",
          responseTimeMs: res.responseTimeMs || 2000,
        }).catch(() => {});
      }
    }
    android.clearPendingQuizAnswers?.();
  } catch (err) {
    console.warn("Failed to sync mobile quiz results:", err);
  }
}

/** Drop old notification plugin items */
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
  refreshDue().then(() => {
    scheduleForBackground();
  });
  syncPendingMobileQuizResults();

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
      syncPendingMobileQuizResults();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onSettingsUpdated = () => {
    refreshDue().then(() => scheduleForBackground());
  };
  window.addEventListener("myenglish-reminder-settings-updated", onSettingsUpdated);

  return () => {
    started = false;
    window.clearTimeout(launchTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("myenglish-reminder-settings-updated", onSettingsUpdated);
  };
}
