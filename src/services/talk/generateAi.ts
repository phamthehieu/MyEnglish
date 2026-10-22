import { invoke } from "@tauri-apps/api/core";
import type { Situation } from "@/types/situation";
import { allSituations } from "@/data/situations";
import { getActiveCefrLevel } from "@/services/pipeline";
import { isFoundationMode } from "@/services/learnerProfile";
import { addGenerated, usedTopicIds } from "./custom";
import { buildSituationFromAi, ContentError, findDuplicate } from "./generate";
import { pickTopic } from "./topics";

const AI_TIMEOUT_MS = 120_000;
/** A conversation the app turns down (not valid, or too like one the learner has) is asked for once more */
const MAX_ATTEMPTS = 2;
/** Foundation ("A0") learners get short sentences */
const FOUNDATION_MAX_WORDS = 5;

const CEFR: ReadonlyArray<Situation["cefr"]> = ["A1", "A2", "B1", "B2", "C1", "C2"];

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI trả lời quá lâu. Vui lòng thử lại.")), AI_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The learner's level for the conversation: an absolute beginner ("A0") is written for as A1 with short lines */
async function conversationLevel(): Promise<{ cefr: Situation["cefr"]; foundation: boolean }> {
  const foundation = isFoundationMode();
  const level = (await getActiveCefrLevel()) as Situation["cefr"];
  return { cefr: foundation ? "A1" : CEFR.includes(level) ? level : "B1", foundation };
}

/**
 * Ask the AI for one new conversation at the learner's level, on a topic not used before, and keep it only when
 * it is playable and not a copy of one the learner already has. The request is the learner's own choice (a button).
 */
export async function generateSituation(): Promise<Situation> {
  const { cefr, foundation } = await conversationLevel();
  const existing = allSituations();
  const topic = pickTopic(usedTopicIds());
  const avoid = existing.map((s) => s.title_en);
  const customPath = (() => {
    try {
      return localStorage.getItem("myenglish_custom_cli_path") || undefined;
    } catch {
      return undefined;
    }
  })();

  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // A failure to reach the AI is not retried: it would only spend another request
    const raw = await withTimeout(
      invoke<string>("generate_situation_ai", {
        topic: topic.topic,
        level: cefr,
        group: topic.group,
        foundation,
        avoid,
        customPath,
      })
    );
    try {
      const situation = buildSituationFromAi(raw, {
        id: `ai-${Date.now().toString(36)}`,
        group: topic.group,
        cefr,
        topicId: topic.id,
        now: Date.now(),
        maxWords: foundation ? FOUNDATION_MAX_WORDS : undefined,
      });
      const duplicate = findDuplicate(situation, existing);
      if (duplicate) throw new ContentError(`AI viết ${duplicate}.`);
      addGenerated(situation);
      return situation;
    } catch (err) {
      if (!(err instanceof ContentError)) throw err;
      lastProblem = err.message;
    }
  }
  throw new ContentError(`${lastProblem} Bạn bấm tạo lại để thử lần nữa.`);
}

/** Whether an AI is set up (a Gemini key or the CLI): the button is off without one */
export async function aiReady(): Promise<boolean> {
  try {
    const customPath = localStorage.getItem("myenglish_custom_cli_path") || undefined;
    const res = await invoke<{ installed: boolean }>("check_cli_status", { customPath });
    return !!res.installed;
  } catch {
    return false;
  }
}
