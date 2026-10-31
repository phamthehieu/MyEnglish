import type { DialogueNode, Situation, SituationLine } from "@/types/situation";
import type { AsrResult } from "@/services/pronunciationCheck";
import { recognitionErrorText, SILENCE_PEAK } from "@/services/pronunciationCheck";

/**
 * "Trò chuyện tình huống": what the speech check listens for and how its answer is read. Pure functions;
 * the phone side (recording, recognizer) is in pronunciationCheck.ts.
 */

const UNKNOWN = "[unk]";

/** Below this average confidence a recognized sentence is reported as shaky */
export const SHAKY_CONFIDENCE = 0.5;

/** The way the recognizer writes a sentence: lowercase words, apostrophes kept, no punctuation */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every wording of a line the learner may say, normalized and without repeats */
export function variantsOf(line: SituationLine): string[] {
  return [...new Set([line.en, ...line.accept].map(normalizeSpeech).filter(Boolean))];
}

/** The sentences handed to the recognizer, and which line each one belongs to */
export interface Grammar {
  /** Sentences, ending with "[unk]" (something else) */
  phrases: string[];
  owner: Map<string, string>;
}

/**
 * The recognizer chooses between the sentences of `wanted` (what makes sense now) and `decoys` (other
 * sentences of the situation). Against the wanted ones alone it would accept nearly any sound as one of them.
 * `isSpeakable` drops a sentence with a word outside the recognizer's dictionary, which could never be heard.
 */
export function buildGrammar(
  wanted: SituationLine[],
  decoys: SituationLine[] = [],
  isSpeakable: (phrase: string) => boolean = () => true
): Grammar {
  const owner = new Map<string, string>();
  for (const line of [...wanted, ...decoys]) {
    for (const phrase of variantsOf(line)) {
      if (!owner.has(phrase) && isSpeakable(phrase)) owner.set(phrase, line.id);
    }
  }
  return { phrases: [...owner.keys(), UNKNOWN], owner };
}

/** Lines of the situation that are not in `wanted`, to put in the recognizer's list as decoys */
export function decoysFor(situation: Situation, wanted: SituationLine[]): SituationLine[] {
  const skip = new Set(wanted.map((l) => l.id));
  return situation.lines.filter((l) => !skip.has(l.id));
}

/** Words of a list of sentences, to ask the recognizer which it knows */
export function wordsOf(phrases: string[]): string[] {
  return [...new Set(phrases.filter((p) => p !== UNKNOWN).flatMap((p) => p.split(" ")))];
}

/** A predicate "all words of this sentence are known", from the list of known words */
export function speakableFrom(known: string[]): (phrase: string) => boolean {
  const set = new Set(known);
  return (phrase) => phrase.split(" ").every((w) => set.has(w));
}

export type SpokenKind = "ok" | "shaky" | "other" | "unclear" | "silent" | "error";

export interface SpokenVerdict {
  kind: SpokenKind;
  /** The line the learner was heard saying (ok, shaky, other) */
  lineId?: string;
  /** What the machine heard, as text */
  heard?: string;
  /** Average confidence of the words heard, 0 to 1 */
  conf?: number;
  /** Vietnamese feedback */
  message: string;
}

/** Of the sentences that would pass, the one sharing most words with what was said */
function closestLine(said: string, grammar: Grammar, valid: ReadonlySet<string>): string | null {
  const heardWords = new Set(said.split(" "));
  let best: { phrase: string; shared: number } | null = null;
  for (const phrase of grammar.phrases) {
    const id = grammar.owner.get(phrase);
    if (!id || !valid.has(id)) continue;
    const shared = phrase.split(" ").filter((w) => heardWords.has(w)).length;
    if (!best || shared > best.shared) best = { phrase, shared };
  }
  return best?.phrase ?? null;
}

/** The words of `target` that were not heard (in its order, each once) */
export function missingWords(said: string, target: string | null): string[] {
  if (!target) return [];
  const heardWords = new Set(said.split(" "));
  return [...new Set(target.split(" ").filter((w) => w && w !== "[unk]" && !heardWords.has(w)))];
}

function averageConfidence(result: AsrResult): number {
  const words = result.words ?? [];
  if (words.length === 0) return 1;
  return words.reduce((sum, w) => sum + (w.conf ?? 0), 0) / words.length;
}

/**
 * Read the recognizer's answer. `valid` are the lines that make sense now: hearing one of them is a pass
 * (in a conversation, any of the possible answers). Hearing another sentence of the situation is "other".
 * Like the word check, this is what the machine heard, not a score.
 */
export function judgeSpoken(
  result: AsrResult,
  grammar: Grammar,
  valid: ReadonlySet<string>,
  options: { minConfidence?: number } = {}
): SpokenVerdict {
  if (!result.ok) {
    return { kind: "error", message: recognitionErrorText(result.error) };
  }
  if ((result.peak ?? 1) < SILENCE_PEAK) {
    return { kind: "silent", message: "Không nghe thấy tiếng. Kiểm tra micro, rồi nói to và rõ hơn." };
  }
  const heard = normalizeSpeech(result.text ?? "");
  const lineId = heard ? grammar.owner.get(heard) : undefined;
  if (!heard || !lineId) {
    // What was said, heard freely (the app's second pass, or the browser's own guess): the words the closest right
    // sentence has and that were not heard tell the learner what to work on
    const said = normalizeSpeech(result.free ?? (heard && heard !== "[unk]" ? heard : "")).replace(/\[unk\]/g, "").trim();
    if (said) {
      const missing = missingWords(said, closestLine(said, grammar, valid));
      return {
        kind: "unclear",
        heard: said,
        message:
          `Máy nghe ra "${said}".` +
          (missing.length > 0 ? ` Chưa nghe rõ: ${missing.slice(0, 4).map((w) => `"${w}"`).join(", ")}.` : "") +
          " Nói chậm, rõ từng từ rồi thử lại.",
      };
    }
    return { kind: "unclear", message: "Máy chưa nghe rõ câu nào. Nói chậm, rõ từng từ rồi thử lại." };
  }
  const conf = averageConfidence(result);
  if (!valid.has(lineId)) {
    return {
      kind: "other",
      lineId,
      heard,
      conf,
      message: `Máy nghe ra "${heard}". Câu này chưa hợp ở đây, nghe lại gợi ý rồi nói lại nhé.`,
    };
  }
  if (conf < (options.minConfidence ?? SHAKY_CONFIDENCE)) {
    return {
      kind: "shaky",
      lineId,
      heard,
      conf,
      message: `Máy nghe ra "${heard}" nhưng chưa chắc. Nói rõ và chậm hơn một chút nhé.`,
    };
  }
  return { kind: "ok", lineId, heard, conf, message: `Máy nghe ra đúng "${heard}". Tốt lắm!` };
}

/** Where the conversation goes after the learner's answer: the next node id, or null when it ends */
export function nextNodeId(situation: Situation, nodeId: string, lineId: string): string | null | undefined {
  const node = situation.dialogue.find((n) => n.id === nodeId);
  const reply = node?.replies.find((r) => r.lineId === lineId);
  return reply ? reply.next : undefined;
}

/**
 * The same conversation with the roles swapped: the learner says what the other person said, and the other
 * person answers with the learner's lines (spoken to them). One path through the branches is picked at random.
 * The node ids are "s0", "s1", … whatever the path, so a new path can replace the old one.
 */
export function swapRoles(situation: Situation, random: () => number = Math.random): Situation {
  const lineOf = new Map(situation.lines.map((l) => [l.id, l] as const));
  const lines: SituationLine[] = [];
  const dialogue: DialogueNode[] = [];
  const visited = new Set<string>();
  let nodeId: string | null = situation.dialogue[0]?.id ?? null;
  let heard: SituationLine | null = null;
  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = situation.dialogue.find((n) => n.id === nodeId);
    if (!node) break;
    const mine: SituationLine = { id: `${situation.id}.${node.id}~npc`, en: node.npc_en, vi: node.npc_vi, accept: [] };
    const options = node.replies.filter((r) => lineOf.has(r.lineId));
    const pick = options[Math.floor(random() * options.length)];
    const i = dialogue.length;
    lines.push(mine);
    dialogue.push({
      id: `s${i}`,
      npc_en: heard?.en ?? "…",
      npc_vi: heard?.vi ?? "Bạn mở lời trước nhé",
      replies: [{ lineId: mine.id, next: pick?.next ? `s${i + 1}` : null }],
    });
    heard = pick ? (lineOf.get(pick.lineId) ?? null) : null;
    nodeId = pick?.next ?? null;
  }
  // A path cut short (a loop in the data) must not point at a node that does not exist
  const ids = new Set(dialogue.map((n) => n.id));
  for (const n of dialogue) for (const r of n.replies) if (r.next && !ids.has(r.next)) r.next = null;
  return { ...situation, lines, dialogue };
}

// ---- How the learner answers: word tiles, speaking, or typing ----

/** Easiest to hardest: pick the right sentence, build it from tiles, say it, type it */
export type Method = "choose" | "tiles" | "say" | "type";
export type Level = "auto" | Method;

/**
 * How to answer this turn. A fixed level is used as it is. "auto" climbs the ladder with what the learner has
 * done with the answers of this turn: a new one is picked from choices, then built from tiles, then spoken or
 * typed, mixing two rungs at random while moving between them. `seen` is how many times they have got such a
 * line right (chosen, built, typed or said). Without a microphone (`canSpeak` false) speaking is replaced by typing.
 */
export function pickMethod(level: Level, seen: number, canSpeak: boolean, random: () => number = Math.random): Method {
  if (level !== "auto") return level === "say" && !canSpeak ? "type" : level;
  const hard: Method = canSpeak ? "say" : "type";
  const pool: Method[] =
    seen <= 0 ? ["choose"] : seen === 1 ? ["choose", "tiles"] : seen === 2 ? ["tiles", hard] : canSpeak ? ["say", "type"] : ["type"];
  return pool[Math.floor(random() * pool.length)] ?? "choose";
}

/** Number of single-letter edits (insert, delete, change) between two strings */
export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

export interface TypedMatch {
  lineId: string;
  /** Typed without a slip */
  exact: boolean;
}

/** One slip is forgiven per 12 letters (at least one), never in very short answers */
function allowedSlips(length: number): number {
  return length < 6 ? 0 : Math.max(1, Math.floor(length / 12));
}

/** Which of `lines` the typed text is, if any: an exact wording first, then one that is nearly right */
export function matchTyped(text: string, lines: SituationLine[]): TypedMatch | null {
  const typed = normalizeSpeech(text);
  if (!typed) return null;
  let best: { lineId: string; distance: number } | null = null;
  for (const line of lines) {
    for (const variant of variantsOf(line)) {
      if (variant === typed) return { lineId: line.id, exact: true };
      const d = editDistance(variant, typed);
      if (d <= allowedSlips(variant.length) && (!best || d < best.distance)) best = { lineId: line.id, distance: d };
    }
  }
  return best ? { lineId: best.lineId, exact: false } : null;
}

export interface Tile {
  id: string;
  text: string;
}

/**
 * The tiles for building `target`: its words, plus `extra` words that do not belong (taken from the other
 * sentences of the situation), in an order that is not the answer.
 */
export function buildTiles(
  target: SituationLine,
  situation: Situation,
  extra = 2,
  random: () => number = Math.random
): Tile[] {
  const words = normalizeSpeech(target.en).split(" ");
  const own = new Set(words);
  const pool = [
    ...new Set(
      situation.lines
        .filter((l) => l.id !== target.id)
        .flatMap((l) => normalizeSpeech(l.en).split(" "))
        .filter((w) => !own.has(w))
    ),
  ];
  const decoys: string[] = [];
  while (decoys.length < extra && pool.length > 0) decoys.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  const tiles = [...words, ...decoys].map((text, i) => ({ id: `t${i}`, text }));
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (tiles.map((t) => t.text).join(" ") !== words.join(" ") || tiles.length < 2) break;
  }
  return tiles;
}

/** The line among `lines` that the chosen tiles spell, if any (exact wording of the line or its accepted ones) */
export function matchTiles(chosen: Tile[], lines: SituationLine[]): string | null {
  const built = chosen.map((t) => t.text).join(" ");
  return lines.find((l) => variantsOf(l).includes(built))?.id ?? null;
}

export interface Choice {
  line: SituationLine;
  correct: boolean;
}

/**
 * The sentences to pick from: `target` and `count - 1` sentences of the situation that do not make sense
 * at this turn (none of `valid`), in an order that varies.
 */
export function buildChoices(
  target: SituationLine,
  valid: SituationLine[],
  situation: Situation,
  count = 3,
  random: () => number = Math.random
): Choice[] {
  const skip = new Set(valid.map((l) => l.id));
  const pool = situation.lines.filter((l) => !skip.has(l.id));
  const wrong: SituationLine[] = [];
  while (wrong.length < count - 1 && pool.length > 0) wrong.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  const all: Choice[] = [{ line: target, correct: true }, ...wrong.map((line) => ({ line, correct: false }))];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
