/**
 * Words met in a real text (the reading screen, or text shared from another app): picked by the learner, learnt
 * soon with the sentence they were met in as their first example.
 */
import { AI_VOCAB_ENABLED } from "./features";
import { pipeline } from "./pipeline";
import { suggestedBase } from "./reading";
import { pullWordFromDeck } from "./vocabFeed";

export interface MetWord {
  /** As written ("meetings") */
  raw: string;
  /** The word to learn ("meeting") */
  base: string;
}

export interface MetSentence {
  text: string;
  words: MetWord[];
}

/** A text as sentences and their English words: addresses, e-mails and numbers left out */
export function splitMetText(text: string): MetSentence[] {
  const cleaned = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/g, " ")
    .replace(/\r/g, "");
  return cleaned
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((sentence) => ({
      text: sentence,
      words: (sentence.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g) ?? []).map((raw) => ({
        raw,
        base: suggestedBase(raw.toLowerCase().replace(/’/g, "'")),
      })),
    }))
    .filter((s) => s.words.length > 0);
}

/** The word picked from the start: when the text is one word (a selection of a single word) */
export function preselected(sentences: MetSentence[]): string[] {
  const all = sentences.flatMap((s) => s.words);
  return all.length === 1 ? [all[0].base] : [];
}

export interface AddReport {
  accepted: number;
  /** Words the app could not take (not in the deck, or refused) */
  refused: string[];
}

/** Learn these words soon, each with the sentence it was met in (base → sentence) */
export async function addMetWords(picked: ReadonlyMap<string, string>): Promise<AddReport> {
  let accepted = 0;
  const refused: string[] = [];
  for (const [base, sentence] of picked) {
    if (!AI_VOCAB_ENABLED) {
      // The Oxford deck is the only source of words: words it has are learnt next, with this sentence
      const r = await pullWordFromDeck(base, sentence).catch(() => ({ status: "not_in_deck", word: base }));
      if (r.status === "not_in_deck") refused.push(base);
      else accepted++;
      continue;
    }
    const res = await pipeline.enqueue(base, { context: sentence });
    if (res.accepted) accepted++;
    else refused.push(base);
  }
  return { accepted, refused };
}
