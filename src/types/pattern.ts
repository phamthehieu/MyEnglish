/** "Mẫu câu": a sentence frame with a blank, learned and drilled as one unit (src/data/patterns) */

export type PatternLevel = "A1" | "A2" | "B1" | "B2" | "C1";
/** What the learner wants English for; patterns are tagged with the goals they serve */
export type PatternGoal = "travel" | "work" | "daily" | "social";

export interface PatternSlot {
  /** What goes into the blank, with its article: "a coffee", "some water" */
  en: string;
  /** The Vietnamese that fits the blank of frame_vi */
  vi: string;
  /** How the whole sentence made with this slot is pronounced, "/maɪ neɪm ɪz ˈænə/" (scripts/add-pattern-ipa.mjs) */
  ipa?: string;
}

export interface PatternExample {
  en: string;
  vi: string;
  ipa?: string;
}

export interface PatternAsk {
  /** A question the other person asks, that this pattern answers */
  en: string;
  vi: string;
}

export interface Pattern {
  /** "a1.can-i-have" */
  id: string;
  level: PatternLevel;
  /** Topic slug ("food-drink") and its Vietnamese name ("Gọi đồ ăn uống") */
  topic: string;
  topic_vi: string;
  goals: PatternGoal[];
  /** "Can I have ___, please?": exactly one blank */
  frame_en: string;
  /** "Cho tôi ___ nhé?" */
  frame_vi: string;
  /** One short line of Vietnamese on how the frame works */
  note_vi: string;
  slots: PatternSlot[];
  /** Whole sentences in the same pattern, with other wording than the slots */
  examples: PatternExample[];
  asks: PatternAsk[];
}

export const BLANK = "___";

/** The frame with one of its slots in the blank */
export function fillPattern(pattern: Pick<Pattern, "frame_en" | "frame_vi">, slot: PatternSlot): { en: string; vi: string } {
  return { en: pattern.frame_en.replace(BLANK, slot.en), vi: pattern.frame_vi.replace(BLANK, slot.vi) };
}
