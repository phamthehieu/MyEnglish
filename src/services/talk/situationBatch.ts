import { invoke } from "@tauri-apps/api/core";
import type { Situation, SituationGroup } from "@/types/situation";
import { allSituations } from "@/data/situations";
import { addGenerated, usedTopicIds } from "./custom";
import { buildSituationFromAi, ContentError, findDuplicate } from "./generate";
import { conversationLevel } from "./generateAi";
import { pickTopic } from "./topics";

/**
 * Several conversations written in the background (Android only). A foreground service (SituationBatch.kt)
 * calls the AI one conversation after another, so it goes on when the learner leaves the screen or closes the
 * app, and a notification says when it is done. The answers wait in a file; this page checks them and adds them
 * to the learner's list the next time it looks (the checks are the same as for a single conversation).
 */

interface SituationsBridge {
  start(jobsJson: string): boolean;
  status(): string;
  takePending(): string;
  cancel(): void;
}

export interface BatchStatus {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  error: string;
}

interface PendingAnswer {
  topicId: string;
  group: SituationGroup;
  level: Situation["cefr"];
  foundation: boolean;
  raw: string;
}

const FOUNDATION_MAX_WORDS = 5;

function bridge(): SituationsBridge | null {
  return (window as unknown as { AndroidSituations?: SituationsBridge }).AndroidSituations ?? null;
}

/** Only the Android app can keep writing after it is closed */
export function batchAvailable(): boolean {
  return bridge() !== null;
}

export function batchStatus(): BatchStatus | null {
  try {
    const b = bridge();
    return b ? (JSON.parse(b.status()) as BatchStatus) : null;
  } catch {
    return null;
  }
}

/**
 * What the learner asked for, kept until it is reached: the service retries every failed call by itself, but an
 * answer the app then turns down (a line too long, a copy of another) is short by one, and this tops it up.
 */
const GOAL_KEY = "myenglish_talk_batch_goal_v1";
const MAX_TOP_UPS = 3;
interface Goal {
  target: number;
  added: number;
  topUps: number;
}

function readGoal(): Goal | null {
  try {
    const g = JSON.parse(localStorage.getItem(GOAL_KEY) || "null") as Goal | null;
    return g && g.target > 0 ? g : null;
  } catch {
    return null;
  }
}

function writeGoal(goal: Goal | null): void {
  try {
    if (goal) localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
    else localStorage.removeItem(GOAL_KEY);
  } catch {
    /* the goal is only a convenience */
  }
}

/** Ask the service to write `count` conversations on topics the learner has not had; false when it would not start */
export async function startBatch(count: number): Promise<boolean> {
  const ok = await launch(count);
  if (ok) writeGoal({ target: count, added: 0, topUps: 0 });
  return ok;
}

/**
 * Call when the service is idle: starts another round for what is still missing from the last request.
 * Gives up after a few rounds, or at once when the service stopped because of the key.
 */
export async function topUpBatch(status: BatchStatus | null): Promise<void> {
  const goal = readGoal();
  if (!goal || !status || status.running) return;
  // Nothing has run since the app started (it closed or crashed with the request half done): forget it, never
  // start writing on the learner's behalf
  if (status.total === 0) {
    writeGoal(null);
    return;
  }
  const missing = goal.target - goal.added;
  if (missing <= 0 || goal.topUps >= MAX_TOP_UPS || (status.done === 0 && status.error)) {
    writeGoal(null);
    return;
  }
  // The round is counted before it starts, so a failure to start cannot loop
  writeGoal({ ...goal, topUps: goal.topUps + 1 });
  await launch(missing);
}

async function launch(count: number): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  const { cefr, foundation } = await conversationLevel();
  const avoid = allSituations().map((s) => s.title_en);
  const used = usedTopicIds();
  const jobs: Array<{ topicId: string; group: SituationGroup; level: string; foundation: boolean; prompt: string }> = [];
  for (let i = 0; i < count; i++) {
    const topic = pickTopic(used);
    // The free topic stands for "anything new": it can repeat, the titles to avoid keep the answers apart
    if (topic.id !== "free") used.add(topic.id);
    const prompt = await invoke<string>("build_situation_prompt_ai", {
      topic: topic.topic,
      level: cefr,
      group: topic.group,
      foundation,
      avoid,
    });
    jobs.push({ topicId: topic.id, group: topic.group, level: cefr, foundation, prompt });
  }
  return b.start(JSON.stringify(jobs));
}

export function cancelBatch(): void {
  try {
    bridge()?.cancel();
  } catch {
    /* nothing running */
  }
}

/** Check the answers the service has written and add the good ones to the list; returns the conversations added */
export function importPending(): Situation[] {
  const b = bridge();
  if (!b) return [];
  let answers: PendingAnswer[] = [];
  try {
    answers = JSON.parse(b.takePending()) as PendingAnswer[];
  } catch {
    return [];
  }
  const added: Situation[] = [];
  answers.forEach((a, i) => {
    try {
      const situation = buildSituationFromAi(a.raw, {
        id: `ai-${Date.now().toString(36)}-${i}`,
        group: a.group === "work" ? "work" : "daily",
        cefr: a.level,
        topicId: a.topicId,
        now: Date.now() + i,
        maxWords: a.foundation ? FOUNDATION_MAX_WORDS : undefined,
      });
      if (findDuplicate(situation, [...allSituations(), ...added])) return;
      addGenerated(situation);
      added.push(situation);
    } catch (err) {
      if (!(err instanceof ContentError)) throw err;
    }
  });
  const goal = readGoal();
  if (goal && added.length > 0) writeGoal({ ...goal, added: goal.added + added.length });
  return added;
}
