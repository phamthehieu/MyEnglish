import { getLocalDateString } from "@/services/streak";
import { TALK_UPDATED_EVENT } from "./progress";

/**
 * Sentences of the conversations that the learner missed (a wrong answer, or the answer was shown), brought back
 * on a schedule: a few days apart, longer after each right answer, until they are known. A simple box system
 * (Leitner): a miss puts the line in box 0, each right answer moves it up one box, a wrong answer sends it back,
 * and past the last box it is done. Kept in localStorage like the rest of the talk progress.
 */
const KEY = "myenglish_talk_review_v1";
/** Days until the next review, by box */
export const BOX_DAYS = [1, 2, 4, 7, 15, 30];

interface Entry {
  box: number;
  /** Day (YYYY-MM-DD) it is due */
  due: string;
}

function load(): Record<string, Entry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Record<string, Entry>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(TALK_UPDATED_EVENT));
  } catch {
    /* not remembered */
  }
}

/** The day `days` after `from`, as YYYY-MM-DD */
export function dayAfter(from: Date, days: number): string {
  return getLocalDateString(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}

/** A line was missed: it comes back for review (today, then as the boxes say) */
export function scheduleMiss(lineId: string, now: Date = new Date()): void {
  const store = load();
  store[lineId] = { box: 0, due: getLocalDateString(now) };
  save(store);
}

/** The result of reviewing a line: right moves it up a box (past the last one it is done), wrong sends it back */
export function recordReview(lineId: string, ok: boolean, now: Date = new Date()): void {
  const store = load();
  const prev = store[lineId];
  if (!prev) return;
  if (!ok) {
    store[lineId] = { box: 0, due: dayAfter(now, BOX_DAYS[0]) };
  } else if (prev.box + 1 >= BOX_DAYS.length) {
    delete store[lineId];
  } else {
    store[lineId] = { box: prev.box + 1, due: dayAfter(now, BOX_DAYS[prev.box + 1]) };
  }
  save(store);
}

/** Lines due today or earlier, the most overdue and the least known first */
export function dueLines(now: Date = new Date(), limit = Infinity): string[] {
  const today = getLocalDateString(now);
  return Object.entries(load())
    .filter(([, e]) => e.due <= today)
    .sort(([, a], [, b]) => (a.due === b.due ? a.box - b.box : a.due < b.due ? -1 : 1))
    .map(([id]) => id)
    .slice(0, limit);
}

/** Lines waiting for review, due or not */
export function reviewTotal(): number {
  return Object.keys(load()).length;
}

/** Forget a line (its conversation was deleted) */
export function dropReview(lineId: string): void {
  const store = load();
  if (store[lineId]) {
    delete store[lineId];
    save(store);
  }
}
