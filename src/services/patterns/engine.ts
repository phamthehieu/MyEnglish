import { fillPattern, type Pattern, type PatternAsk, type PatternSlot } from "@/types/pattern";
import type { Situation, SituationLine } from "@/types/situation";
import { normalizeSpeech, type Tile } from "@/services/talk/engine";

/** Pure builders for the exercises of a pattern; the screens only show what these return */

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length)];

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `count` different slots of the pattern, in a random order */
export function pickSlots(pattern: Pattern, count: number, random: () => number = Math.random): PatternSlot[] {
  return shuffled(pattern.slots, random).slice(0, Math.min(count, pattern.slots.length));
}

export interface SubstituteItem {
  /** What the learner reads: the Vietnamese sentence */
  vi: string;
  /** The English frame with the blank still open */
  frame: string;
  /** The choices for the blank, one of them right */
  options: PatternSlot[];
  answer: PatternSlot;
  /** The full English sentence, shown after the answer */
  full: string;
}

/** "Thay chỗ trống": read the Vietnamese sentence, pick the word that fills the blank of the English frame */
export function buildSubstitution(pattern: Pattern, slot: PatternSlot, random: () => number = Math.random): SubstituteItem {
  const others = shuffled(pattern.slots.filter((s) => s.en !== slot.en), random).slice(0, 2);
  const filled = fillPattern(pattern, slot);
  return { vi: filled.vi, frame: pattern.frame_en, options: shuffled([slot, ...others], random), answer: slot, full: filled.en };
}

export interface TilesItem {
  vi: string;
  /** The right sentence */
  en: string;
  tiles: Tile[];
}

/** "Ghép câu": the words of the sentence, plus two that do not belong (words of the other slots), in a shuffled order */
export function buildTilesItem(pattern: Pattern, slot: PatternSlot, random: () => number = Math.random): TilesItem {
  const filled = fillPattern(pattern, slot);
  const words = filled.en.replace(/[.,?!]/g, "").split(/\s+/).filter(Boolean);
  const own = new Set(words.map((w) => w.toLowerCase()));
  const pool = [
    ...new Set(
      pattern.slots
        .filter((s) => s.en !== slot.en)
        .flatMap((s) => s.en.split(/\s+/))
        .filter((w) => !own.has(w.toLowerCase()))
    ),
  ];
  const decoys = shuffled(pool, random).slice(0, 2);
  const tiles = shuffled([...words, ...decoys], random).map((text, i) => ({ id: `t${i}`, text }));
  return { vi: filled.vi, en: filled.en, tiles };
}

/** Do the chosen tiles spell the sentence? (case and punctuation do not count) */
export function tilesSpell(chosen: Tile[], item: TilesItem): boolean {
  return normalizeSpeech(chosen.map((t) => t.text).join(" ")) === normalizeSpeech(item.en);
}

export interface RapidItem {
  /** What the other person asks (spoken) */
  ask: PatternAsk;
  /** What the learner has to say, in Vietnamese */
  vi: string;
  /** The English sentence that is right */
  en: string;
  slot: PatternSlot;
}

/** "Hỏi đáp nhanh": the other person asks, the learner has a few seconds to say the sentence shown in Vietnamese */
export function buildRapid(pattern: Pattern, slot: PatternSlot, random: () => number = Math.random): RapidItem {
  const filled = fillPattern(pattern, slot);
  return { ask: pick(pattern.asks, random), vi: filled.vi, en: filled.en, slot };
}

/** The lines the speech check listens for: every sentence the pattern can make, so a wrong word is heard as a wrong word */
export function patternLines(pattern: Pattern): SituationLine[] {
  return pattern.slots.map((slot, i) => ({ id: `${pattern.id}.s${i + 1}`, en: fillPattern(pattern, slot).en, vi: fillPattern(pattern, slot).vi, accept: [] }));
}

/** A situation made of those lines, for the speech check (it only needs the lines) */
export function patternSituation(pattern: Pattern): Situation {
  return {
    id: pattern.id,
    group: "daily",
    title_vi: pattern.topic_vi,
    title_en: pattern.frame_en,
    cefr: pattern.level,
    goal_vi: "",
    partner_vi: "",
    partner_emoji: "💬",
    lines: patternLines(pattern),
    dialogue: [],
  };
}

/** The line of `patternLines` for one slot */
export function lineOfSlot(pattern: Pattern, slot: PatternSlot): SituationLine {
  return patternLines(pattern).find((l) => l.en === fillPattern(pattern, slot).en)!;
}
