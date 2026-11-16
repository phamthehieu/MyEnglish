import { getLocalDateString } from "@/services/streak";
import type { TodayTaskId } from "@/components/dashboard/todayPlan";

/**
 * "Hôm nay" as one flow: the main button starts the things of the day that are not done, one after the other. The
 * flow lives for the app session and for one day; a small bar on every tab moves to the next thing, so the learner
 * does not go back to the list to choose.
 */
const KEY = "myenglish_dayflow_v1";
export const DAYFLOW_EVENT = "myenglish-dayflow-updated";

export interface DayFlow {
  /** The things of the flow, in order */
  queue: TodayTaskId[];
  /** The one being done */
  index: number;
  /** Local day it was started */
  day: string;
}

const IDS: readonly TodayTaskId[] = ["speaking", "talkReview", "vocab", "weakGrammar", "grammar", "pronunciation", "reflex"];

/** The things not done yet, in the order of the list */
export const planFlow = (tasks: ReadonlyArray<{ id: TodayTaskId; done: boolean }>): TodayTaskId[] => tasks.filter((t) => !t.done).map((t) => t.id);

function write(flow: DayFlow | null): void {
  try {
    if (flow) sessionStorage.setItem(KEY, JSON.stringify(flow));
    else sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event(DAYFLOW_EVENT));
  } catch {
    /* the flow is only a convenience */
  }
}

/** The flow in progress (none after a day change or a damaged value) */
export function getFlow(now: Date = new Date()): DayFlow | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || "null") as Partial<DayFlow> | null;
    if (!raw || !Array.isArray(raw.queue) || raw.queue.length === 0 || typeof raw.index !== "number" || raw.day !== getLocalDateString(now)) return null;
    const queue = raw.queue.filter((id): id is TodayTaskId => IDS.includes(id as TodayTaskId));
    if (queue.length !== raw.queue.length || raw.index < 0 || raw.index >= queue.length) return null;
    return { queue, index: raw.index, day: raw.day };
  } catch {
    return null;
  }
}

/** Starts a flow at its first thing; null when there is nothing to do */
export function startFlow(queue: readonly TodayTaskId[], now: Date = new Date()): DayFlow | null {
  if (queue.length === 0) return null;
  const flow: DayFlow = { queue: [...queue], index: 0, day: getLocalDateString(now) };
  write(flow);
  return flow;
}

/** Index of the thing after the current one, the ones to skip (done some other way) left out; -1 at the end */
function nextIndex(flow: DayFlow, skip?: (id: TodayTaskId) => boolean): number {
  for (let i = flow.index + 1; i < flow.queue.length; i++) if (!skip?.(flow.queue[i])) return i;
  return -1;
}

/** The thing after the current one (null at the last) */
export const nextInFlow = (flow: DayFlow, skip?: (id: TodayTaskId) => boolean): TodayTaskId | null => flow.queue[nextIndex(flow, skip)] ?? null;

/** Moves to the next thing and returns it; at the last one the flow ends and null comes back */
export function advanceFlow(now: Date = new Date(), skip?: (id: TodayTaskId) => boolean): TodayTaskId | null {
  const flow = getFlow(now);
  if (!flow) return null;
  const index = nextIndex(flow, skip);
  if (index < 0) {
    write(null);
    return null;
  }
  write({ ...flow, index });
  return flow.queue[index];
}

/** Moves the flow in progress to one of its things (the learner opened it from the list); false when it is not in the flow */
export function jumpFlow(id: TodayTaskId, now: Date = new Date()): boolean {
  const flow = getFlow(now);
  const index = flow ? flow.queue.indexOf(id) : -1;
  if (!flow || index < 0) return false;
  write({ ...flow, index });
  return true;
}

/**
 * Back to the previous thing: the learner pressed "next" but stayed where they were (they chose to keep the session
 * that was open), so the bar must not run ahead of them
 */
export function retreatFlow(now: Date = new Date()): void {
  const flow = getFlow(now);
  if (flow && flow.index > 0) write({ ...flow, index: flow.index - 1 });
}

export const stopFlow = (): void => write(null);
