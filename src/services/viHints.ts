/**
 * Tap a Vietnamese word, see its English: the Vietnamese prompt of a sentence to say (patterns, talk) cut into
 * chunks, each paired with a word of the English answer. Offline and without AI: the English sentence is known, so
 * only its own words are looked up (the deck's Vietnamese meanings plus a few small words the deck does not hold),
 * and a chunk is paired only with a word that is really in the answer.
 */
import { catalogMeaningsOf } from "./vocabCatalog";

export interface ViSegment {
  /** The Vietnamese as written, spaces and punctuation included */
  text: string;
  /** The English of this chunk, as written in the answer ("coffee", "I'm") */
  en?: string;
}

/** A pair known for sure, e.g. the slot of a pattern: "một ly cà phê" ↔ "a coffee" */
export interface FixedPair {
  vi: string;
  en: string;
}

/** Small words the deck has no (useful) meaning for, by the English word they stand for */
const SMALL_WORDS: Record<string, string[]> = {
  i: ["tôi", "mình", "em"],
  me: ["tôi", "mình", "em"],
  my: ["của tôi", "của mình", "tôi", "mình"],
  you: ["bạn", "anh", "chị", "cậu"],
  your: ["của bạn", "bạn"],
  we: ["chúng tôi", "chúng ta", "chúng mình"],
  us: ["chúng tôi", "chúng ta", "chúng mình"],
  our: ["của chúng tôi", "chúng tôi"],
  he: ["anh ấy", "ông ấy", "cậu ấy"],
  him: ["anh ấy", "ông ấy", "cậu ấy"],
  his: ["của anh ấy", "anh ấy"],
  she: ["cô ấy", "chị ấy", "bà ấy"],
  her: ["cô ấy", "chị ấy", "bà ấy"],
  they: ["họ"],
  them: ["họ"],
  their: ["của họ", "họ"],
  it: ["nó"],
  this: ["cái này", "này", "đây"],
  that: ["cái đó", "đó", "kia"],
  these: ["những cái này"],
  those: ["những cái đó"],
  here: ["ở đây", "đây"],
  there: ["ở đó", "đó"],
  am: ["là"],
  is: ["là"],
  are: ["là"],
  not: ["không", "chưa"],
  no: ["không"],
  yes: ["vâng", "có", "dạ"],
  please: ["làm ơn", "vui lòng", "nhé", "giúp"],
  what: ["cái gì", "gì"],
  where: ["ở đâu", "đâu"],
  when: ["khi nào", "lúc nào"],
  why: ["tại sao", "vì sao"],
  how: ["như thế nào", "thế nào", "làm sao", "bao"],
  who: ["ai"],
  which: ["nào"],
  much: ["bao nhiêu"],
  many: ["bao nhiêu", "nhiều"],
  very: ["rất", "lắm"],
  and: ["và"],
  or: ["hoặc", "hay"],
  but: ["nhưng"],
  with: ["với", "cùng"],
  in: ["trong", "ở"],
  at: ["ở", "lúc", "vào"],
  on: ["trên", "vào"],
  to: ["đến", "tới"],
  for: ["cho"],
  of: ["của"],
  from: ["từ"],
  will: ["sẽ"],
  would: ["có muốn"],
  can: ["có thể", "được"],
  could: ["có thể"],
  should: ["nên"],
  must: ["phải"],
  some: ["một ít", "một chút", "vài"],
  a: ["một"],
  an: ["một"],
  the: [],
};

/** "n't", "'m" … as the words they stand for */
const CONTRACTIONS: Array<[RegExp, string[]]> = [
  [/^can't$/, ["can", "not"]],
  [/^won't$/, ["will", "not"]],
  [/^(\w+)n't$/, ["$1", "not"]],
  [/^(\w+)'m$/, ["$1", "am"]],
  [/^(\w+)'re$/, ["$1", "are"]],
  [/^(\w+)'s$/, ["$1", "is"]],
  [/^(\w+)'ll$/, ["$1", "will"]],
  [/^(\w+)'d$/, ["$1", "would"]],
  [/^(\w+)'ve$/, ["$1", "have"]],
];

const IRREGULAR: Record<string, string> = {
  went: "go", gone: "go", ate: "eat", eaten: "eat", had: "have", has: "have", was: "be", were: "be", been: "be",
  got: "get", made: "make", took: "take", taken: "take", saw: "see", seen: "see", bought: "buy", came: "come",
  gave: "give", given: "give", told: "tell", said: "say", children: "child", people: "person", thought: "think",
  felt: "feel", left: "leave", met: "meet", paid: "pay", sent: "send", spent: "spend", found: "find", lost: "lose",
  kept: "keep", slept: "sleep", did: "do", does: "do", done: "do", knew: "know", known: "know",
  wrote: "write", written: "write", spoke: "speak", spoken: "speak", drank: "drink", drunk: "drink", ran: "run",
  sat: "sit", stood: "stand", brought: "bring", taught: "teach", caught: "catch", heard: "hear", understood: "understand",
  better: "good", best: "good", worse: "bad", worst: "bad",
};

/** The plain words of an English sentence, contractions opened, each with the word as written in the sentence */
export function englishWords(en: string): Array<{ word: string; shown: string }> {
  const out: Array<{ word: string; shown: string }> = [];
  for (const raw of en.split(/\s+/)) {
    const shown = raw.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
    if (!shown) continue;
    const lower = shown.toLowerCase().replace(/’/g, "'");
    const rule = CONTRACTIONS.find(([re]) => re.test(lower));
    const parts = rule ? rule[1].map((p) => lower.replace(rule[0], p)) : [lower];
    for (const word of parts) out.push({ word, shown });
  }
  return out;
}

/** The forms a word may be listed under in the deck: "coffees" → coffee, "stopped" → stop, "went" → go */
export function baseForms(word: string): string[] {
  const w = word.toLowerCase();
  const forms = [w];
  if (IRREGULAR[w]) forms.push(IRREGULAR[w]);
  if (w.endsWith("ies")) forms.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) forms.push(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) forms.push(w.slice(0, -1));
  if (w.endsWith("ied")) forms.push(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) forms.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("ing")) forms.push(w.slice(0, -3), w.slice(0, -3) + "e");
  // stopped → stop, running → run
  const doubled = w.match(/^(.*?)([b-df-hj-np-tv-z])\2(ed|ing)$/);
  if (doubled) forms.push(doubled[1] + doubled[2]);
  return [...new Set(forms.filter((f) => f.length > 0))];
}

/** The Vietnamese phrases of a deck meaning: "có thể, biết (làm gì); lon, hộp" → có thể, biết, lon, hộp */
export function meaningPhrases(vn: string): string[] {
  return vn
    .replace(/\([^)]*\)/g, " ")
    .split(/[;,/]/)
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((p) => p && !p.includes("…") && !p.includes("...") && p.split(" ").length <= 4);
}

const syllableKey = (s: string) => s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/**
 * Cut `vi` into chunks paired with the English of `en`: a fixed pair first, then the longest phrase that is the
 * meaning of a word of the answer. `meanings`: deck meaning by English word (lower case).
 */
export function alignVi(vi: string, en: string, meanings: ReadonlyMap<string, string>, fixed: readonly FixedPair[] = []): ViSegment[] {
  // Vietnamese phrase (syllables joined by one space) → the English shown for it
  const fixedPhrases = new Map<string, string>();
  for (const f of fixed) {
    const key = f.vi.split(/\s+/).map(syllableKey).filter(Boolean).join(" ");
    if (key) fixedPhrases.set(key, f.en.trim());
  }
  const phrases = new Map<string, string[]>();
  const add = (phrase: string, shown: string) => {
    const list = phrases.get(phrase) ?? [];
    if (!list.includes(shown)) list.push(shown);
    phrases.set(phrase, list);
  };
  for (const { word, shown } of englishWords(en)) {
    for (const p of SMALL_WORDS[word] ?? []) add(p, shown);
    // A small word is not looked up in the deck: "can" is not "lon, hộp" here
    if (word in SMALL_WORDS) continue;
    for (const form of baseForms(word)) {
      const vn = meanings.get(form);
      if (vn) for (const p of meaningPhrases(vn)) add(p, shown);
    }
  }

  // Each token keeps its spaces, so the chunks put back together are the sentence as written
  const tokens = vi.match(/\S+\s*/g) ?? [];
  const keys = tokens.map(syllableKey);
  const longest = Math.max(1, ...[...fixedPhrases.keys(), ...phrases.keys()].map((p) => p.split(" ").length));
  const segments: ViSegment[] = [];
  const lead = vi.match(/^\s*/)?.[0] ?? "";
  if (lead) segments.push({ text: lead });
  const plain = (text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.en === undefined) last.text += text;
    else segments.push({ text });
  };

  const keyAt = (i: number, len: number) => {
    const slice = keys.slice(i, i + len);
    return slice.some((k) => !k) ? null : slice.join(" ");
  };

  // Word by word: the longest phrase that is the meaning of a word of the answer
  let groups: Array<{ start: number; len: number; en: string }> = [];
  for (let i = 0; i < tokens.length; ) {
    let hit: { len: number; en: string } | null = null;
    for (let len = Math.min(longest, tokens.length - i); len >= 1 && !hit; len--) {
      const key = keyAt(i, len);
      if (key && phrases.has(key)) hit = { len, en: phrases.get(key)!.slice(0, 2).join(" / ") };
    }
    if (hit) groups.push({ start: i, ...hit });
    i += hit?.len ?? 1;
  }
  // A fixed pair the words did not cover (half of it or more unpaired) is paired as a whole: "Pa ri" → Paris
  for (let i = 0; i < tokens.length; i++) {
    for (let len = Math.min(longest, tokens.length - i); len >= 1; len--) {
      const key = keyAt(i, len);
      const sure = key ? fixedPhrases.get(key) : undefined;
      if (!sure) continue;
      const end = i + len;
      const covered = groups.filter((g) => g.start >= i && g.start + g.len <= end).reduce((a, g) => a + g.len, 0);
      if (covered * 2 < len) {
        groups = groups.filter((g) => g.start + g.len <= i || g.start >= end);
        groups.push({ start: i, len, en: sure });
      }
      i = end - 1;
      break;
    }
  }
  groups.sort((a, b) => a.start - b.start);

  let at = 0;
  for (const g of groups) {
    for (; at < g.start; at++) plain(tokens[at]);
    // The spaces after the chunk (and punctuation around it) stay outside the tappable part
    const text = tokens.slice(g.start, g.start + g.len).join("");
    const m = text.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*\s*)$/su)!;
    if (m[1]) plain(m[1]);
    segments.push({ text: m[2], en: g.en });
    if (m[3]) plain(m[3]);
    at = g.start + g.len;
  }
  for (; at < tokens.length; at++) plain(tokens[at]);
  return segments;
}

/** `alignVi` with the deck's meanings of the answer's words read from the database */
export async function viHints(vi: string, en: string, fixed: readonly FixedPair[] = []): Promise<ViSegment[]> {
  const lookups = englishWords(en).flatMap(({ word }) => (word in SMALL_WORDS ? [] : baseForms(word)));
  const meanings = await catalogMeaningsOf(lookups).catch(() => new Map<string, string>());
  return alignVi(vi, en, meanings, fixed);
}
