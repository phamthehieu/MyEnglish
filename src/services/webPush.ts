/**
 * Study reminders in the web app: the browser's push notifications, sent by the Edge Function send-reminders at the
 * learner's study times (supabase/migrations/0010_web_push.sql). The app and its service worker need not be open.
 *
 * On an iPhone, Safari only allows them for the web app added to the home screen (iOS 16.4 and later).
 */
import { isWeb } from "@/lib/platform";
import { NIGHT_QUIET_END, NIGHT_QUIET_START } from "./reminderSettings";

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type WebPushState =
  /** Not in this browser (no push, or this build has no server or key) */
  | "unsupported"
  /** iPhone / iPad Safari: add the web app to the home screen first */
  | "needs-install"
  /** The learner refused notifications for the site */
  | "blocked"
  | "off"
  | "on";

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const installed = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The study times sent to the server: night hours left out when the learner keeps nights quiet (as the apps do) */
export function timesToSend(times: readonly string[], nightQuiet: boolean): string[] {
  return [...new Set(times)]
    .filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    .filter((t) => {
      if (!nightQuiet) return true;
      const hour = Number(t.slice(0, 2));
      return hour < NIGHT_QUIET_START && hour >= NIGHT_QUIET_END;
    })
    .sort()
    .slice(0, 6);
}

function keyBytes(base64url: string): ArrayBuffer {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

async function serverReady() {
  const { getSupabase } = await import("./supabase");
  return getSupabase();
}

export async function webPushState(): Promise<WebPushState> {
  if (!isWeb() || !PUBLIC_KEY || typeof window === "undefined") return "unsupported";
  if (isIos() && !installed()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!(await serverReady())) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

async function save(sub: PushSubscription, times: string[]): Promise<void> {
  const client = await serverReady();
  if (!client) throw new Error("Bản web này chưa kết nối máy chủ.");
  const json = sub.toJSON();
  const { getDeviceId } = await import("./sync/state");
  const { error } = await client.rpc("save_push_subscription", {
    p_device: await getDeviceId(),
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_times: times,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
  });
  if (error) throw new Error("Chưa lưu được giờ nhắc. Bạn kiểm tra mạng rồi thử lại nhé.");
}

/** Ask for notifications (needs a tap) and register this browser with the study times */
export async function enableWebReminders(times: string[]): Promise<WebPushState> {
  if (!PUBLIC_KEY) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  await save(sub, times);
  return "on";
}

/** New study times for a browser already registered (nothing to do when reminders are off) */
export async function updateWebReminderTimes(times: string[]): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await save(sub, times);
}

/** The local day this browser last told the server the goal was reached */
const STUDIED_MARK_KEY = "myenglish_push_studied_on_v1";

/**
 * Once today's goal is reached, the server is told so (0012_push_studied.sql): the rest of today's reminders are
 * not sent. Watches the learner's activity; nothing to do when reminders are off.
 */
export function watchGoalForWebReminders(): () => void {
  if (!isWeb() || !PUBLIC_KEY || !("serviceWorker" in navigator)) return () => {};
  let busy = false;
  const check = async () => {
    if (busy) return;
    busy = true;
    try {
      const { getActivityLogs, getDailyGoal, getLocalDateString } = await import("./streak");
      const today = getLocalDateString();
      if (localStorage.getItem(STUDIED_MARK_KEY) === today) return;
      if ((getActivityLogs()[today] || 0) < getDailyGoal()) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const client = sub ? await serverReady() : null;
      if (!sub || !client) return;
      const { error } = await client.rpc("mark_push_studied", {
        p_endpoint: sub.endpoint,
        p_day: today,
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
      });
      // Not marked (offline, or the server not updated yet): tried again on the next answer
      if (!error) localStorage.setItem(STUDIED_MARK_KEY, today);
    } catch {
      /* tried again on the next answer */
    } finally {
      busy = false;
    }
  };
  const onActivity = () => void check();
  window.addEventListener("myenglish-activity-updated", onActivity);
  void check();
  return () => window.removeEventListener("myenglish-activity-updated", onActivity);
}

export async function disableWebReminders(): Promise<WebPushState> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const client = await serverReady();
    await client?.rpc("remove_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return "off";
}
