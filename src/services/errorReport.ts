/**
 * Errors met on the learner's device, sent to the developer: the Supabase table `client_errors` through
 * report_errors (migration 0009). Only errors nothing handled (an uncaught exception, a rejected promise nobody
 * awaited, a screen that crashed), never study data: the message and stack with addresses, keys and e-mails taken
 * out, the app version, the platform and where it happened.
 *
 * Errors wait in localStorage (so a crash or no network loses nothing) and leave in batches a few seconds later;
 * the same error twice is one entry with a count.
 */
import { platformKind } from "@/lib/platform";

const QUEUE_KEY = "myenglish_error_queue_v1";
const MAX_QUEUE = 20;
const SEND_DELAY_MS = 5000;
const MESSAGE_MAX = 500;
const STACK_MAX = 4000;
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export interface QueuedError {
  fingerprint: string;
  message: string;
  stack?: string;
  count: number;
  context: { version: string; platform: string; where: string };
}

/** Noise, not bugs: the browser's own warnings, cancelled requests, scripts of other origins (extensions) */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i, /The operation was aborted/i, /chrome-extension:\/\//i, /moz-extension:\/\//i];

export function shouldIgnore(message: string): boolean {
  return !message.trim() || IGNORED.some((re) => re.test(message));
}

/** What must not leave the device: e-mail addresses, keys and tokens, the query part of addresses */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\b(AIza[\w-]{20,}|gh[opsu]_\w{20,}|sk-[\w-]{20,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})/g, "<key>")
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1")
    .replace(/\b\d{6,}:[\w-]{30,}\b/g, "<key>");
}

/** The same error on every device and build: digits and the bundle's line numbers do not count */
export function fingerprintOf(message: string, stack?: string): string {
  const firstFrame = (stack ?? "").split("\n").find((l) => /^\s*at\s|@/.test(l)) ?? "";
  const basis = `${message.replace(/\d+/g, "#")}|${firstFrame.replace(/:\d+(:\d+)?/g, "").replace(/\?[^)\s]*/g, "").trim()}`;
  // FNV-1a, 32 bits: short and stable, not a security hash
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** An error, a rejection reason or anything thrown, as a queue entry (null when it is noise) */
export function toQueued(error: unknown, where: string): QueuedError | null {
  const err = error instanceof Error ? error : null;
  const raw = err ? `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message}` : typeof error === "string" ? error : JSON.stringify(error) ?? String(error);
  const message = scrub(String(raw)).slice(0, MESSAGE_MAX);
  if (shouldIgnore(message)) return null;
  const stack = err?.stack ? scrub(err.stack).slice(0, STACK_MAX) : undefined;
  return {
    fingerprint: fingerprintOf(message, stack),
    message,
    ...(stack ? { stack } : {}),
    count: 1,
    context: { version: APP_VERSION, platform: platformKind(), where: where.slice(0, 80) },
  };
}

/** The queue with one more error: an error already waiting only counts up; the oldest go when it is full */
export function addToQueue(queue: QueuedError[], item: QueuedError): QueuedError[] {
  const same = queue.find((q) => q.fingerprint === item.fingerprint);
  if (same) return queue.map((q) => (q === same ? { ...q, count: Math.min(q.count + item.count, 1000) } : q));
  return [...queue, item].slice(-MAX_QUEUE);
}

function readQueue(): QueuedError[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as QueuedError[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedError[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage full or off: the error is lost, the app goes on */
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;

/** Keep an error to send (where: "window", "promise", "render:main"...) */
export function recordError(error: unknown, where: string): void {
  try {
    const item = toQueued(error, where);
    if (!item) return;
    writeQueue(addToQueue(readQueue(), item));
    clearTimeout(timer);
    timer = setTimeout(() => void flushErrors(), SEND_DELAY_MS);
  } catch {
    /* reporting must never become an error of its own */
  }
}

/** Send what waits. Kept for later when there is no server or no network; dropped when the server refuses it. */
export async function flushErrors(): Promise<void> {
  if (sending) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  sending = true;
  try {
    const [{ getSupabase }, { getDeviceId }] = await Promise.all([import("./supabase"), import("./sync/state")]);
    const client = getSupabase();
    if (!client) {
      writeQueue([]); // this build has no server: nothing will ever take them
      return;
    }
    const { error } = await client.rpc("report_errors", { p_device: await getDeviceId(), p_items: queue });
    if (!error || /errors_invalid/.test(error.message)) {
      // Errors recorded while this was on the way stay for the next batch
      const sent = new Set(queue.map((q) => q.fingerprint));
      writeQueue(readQueue().filter((q) => !sent.has(q.fingerprint)));
    }
  } catch {
    /* offline or the server is down: try again later */
  } finally {
    sending = false;
  }
}

let installed = false;

/** Catch what nothing else handles, and send what an earlier run left behind */
export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => recordError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => recordError(e.reason, "promise"));
  window.addEventListener("online", () => void flushErrors());
  timer = setTimeout(() => void flushErrors(), SEND_DELAY_MS);
}
