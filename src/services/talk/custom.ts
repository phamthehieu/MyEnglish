import type { Situation } from "@/types/situation";

/**
 * Conversations the AI wrote for the learner, kept in localStorage (like the rest of the talk feature).
 * Newest last. Each one is a complete Situation, checked before it was stored.
 */

const KEY = "myenglish_talk_generated_v1";
export const TALK_GENERATED_EVENT = "myenglish-talk-generated";
/** The oldest are dropped past this, so the list stays manageable */
export const MAX_GENERATED = 40;

export function getGenerated(): Situation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Situation => !!s && typeof s.id === "string" && Array.isArray(s.lines) && Array.isArray(s.dialogue)
    );
  } catch {
    return [];
  }
}

function save(list: Situation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_GENERATED)));
    window.dispatchEvent(new Event(TALK_GENERATED_EVENT));
  } catch {
    /* not remembered */
  }
}

export function addGenerated(situation: Situation): void {
  save([...getGenerated().filter((s) => s.id !== situation.id), situation]);
}

export function removeGenerated(id: string): void {
  save(getGenerated().filter((s) => s.id !== id));
}

/** Topic ids already written for */
export function usedTopicIds(): Set<string> {
  return new Set(getGenerated().flatMap((s) => (s.ai ? [s.ai.topicId] : [])));
}
