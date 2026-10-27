import { pullWordFromDeck } from "@/services/vocabFeed";
import type { Stage } from "./stages";
import { getRoadmap, markWordsAdded } from "./state";

/** At most this many words of a stage are put in the word bank: enough to meet them again, not a flood of new cards */
export const MAX_STAGE_WORDS = 12;

type Pull = (word: string) => Promise<{ status: string; word: string }>;

/**
 * Puts the words of a stage in the learner's word bank (the next new words to learn), once per stage, so the words of
 * the sentences they are practising come back as cards too. Only words of the Oxford deck can be added; the others are
 * skipped. Returns how many were added. Never throws: a stage whose words could not be added is not marked, and is
 * tried again the next time it starts.
 */
export async function addStageWords(stage: Stage, options: { pull?: Pull; max?: number } = {}): Promise<number> {
  if (getRoadmap().wordsAdded.includes(stage.id)) return 0;
  const pull = options.pull ?? pullWordFromDeck;
  const max = options.max ?? MAX_STAGE_WORDS;
  let added = 0;
  try {
    for (const word of stage.words) {
      if (added >= max) break;
      const result = await pull(word);
      // "studied": the learner has the word already; "not_in_deck": not an Oxford word
      if (result.status === "added" || result.status === "moved") added++;
    }
    markWordsAdded(stage.id);
  } catch {
    /* the words are only a bonus: the session goes on without them */
  }
  return added;
}
