/**
 * Comprehensive Bilingual & Monolingual Dictionary Service (Anh–Việt, Anh–Anh, Việt–Anh).
 *
 * Powered by 27 lazy-loaded prefix shards (`public/dict/{a..z,other}.json`, 161,500+ entries)
 * combining Oxford 5000 (A1–C1), Open Vietnamese Dictionary Project (OVDP / StarDict),
 * Wordset / WordNet 3.1 English–English definitions & synonyms, and CMU 135,000 IPA transcriptions,
 * plus an online fallback (`api.dictionaryapi.dev`) for ultra-rare coinages.
 */
import { FULL_VERB_FORMS, IRREGULAR_PLURALS, IRREGULAR_VERB_FORMS } from "@/data/irregularForms";
import { insertEnrichedWord } from "./db";
import { pullWordFromDeck } from "./vocabFeed";

export type DictDisplayMode = "bilingual" | "en-vi" | "en-en" | "vi-en";

export interface DictSense {
  /** Compact part of speech ("n", "v", "adj", "adv", "prep", "conj", "pron", "det", "interj") */
  p?: string;
  /** Vietnamese meaning */
  v?: string;
  /** English-English definition (WordNet / Learner's Dictionary) */
  e?: string;
  /** Bilingual or monolingual examples: [englishSentence, vietnameseTranslation?] */
  x?: Array<[string, string?]>;
  /** Sense-specific synonyms */
  s?: string[];
}

export interface DictEntry {
  /** Headword */
  w: string;
  /** Primary / US IPA transcription */
  i?: string;
  /** UK IPA transcription (when different from US) */
  uk?: string;
  /** CEFR level ("A1" | "A2" | "B1" | "B2" | "C1") */
  c?: string;
  /** Domain or collection tag ("IT & Công sở", "Oxford 3000", "Oxford 5000") */
  t?: string;
  /** Meanings / senses */
  m?: DictSense[];
  /** Idioms & collocations: [phrase, vietnameseMeaning] */
  id?: Array<[string, string]>;
  /** Synonyms across senses */
  syn?: string[];
  /** Irregular or inflected forms */
  f?: string[];
  /** Populated at runtime when resolved via morphological lemmatization (e.g. "went" -> "go") */
  matchedFromForm?: string;
}

export interface ViSearchMatch {
  /** Vietnamese keyword/phrase */
  vi: string;
  /** Matching English words: [word, pos, fullVietnameseMeaning, cefr?] */
  words: Array<{
    word: string;
    pos: string;
    meaningVn: string;
    cefr?: string;
  }>;
}

export interface DictHistoryItem {
  word: string;
  ipa?: string;
  shortMeaning: string;
  cefr?: string;
  count: number;
  lastLookedUpAt: number;
}

interface RawViIndexRow {
  v: string;
  u: string;
  w: Array<[string, string, string, string?]>;
}

export const POS_LABEL_VI: Record<string, string> = {
  n: "Danh từ (noun)",
  v: "Động từ (verb)",
  adj: "Tính từ (adjective)",
  adv: "Trạng từ (adverb)",
  prep: "Giới từ (preposition)",
  conj: "Liên từ (conjunction)",
  pron: "Đại từ (pronoun)",
  det: "Từ hạn định (determiner)",
  interj: "Thán từ (interjection)",
};

export const POS_BADGE_SHORT: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adj",
  adv: "adv",
  prep: "prep",
  conj: "conj",
  pron: "pron",
  det: "det",
  interj: "excl",
};

const HISTORY_STORAGE_KEY = "myenglish_dict_history_v1";
const BOOKMARKS_STORAGE_KEY = "myenglish_dict_bookmarks_v1";
const MAX_HISTORY_ITEMS = 60;

// ---- Reverse irregular lookup map (inflected -> base form) ----
const INFLECTED_TO_BASE: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const register = (table: ReadonlyMap<string, string[]>) => {
    for (const [base, forms] of table.entries()) {
      for (const f of forms) {
        map.set(f.toLowerCase(), base.toLowerCase());
      }
    }
  };
  register(FULL_VERB_FORMS);
  register(IRREGULAR_VERB_FORMS);
  register(IRREGULAR_PLURALS);
  // Common irregular comparatives/superlatives
  map.set("better", "good");
  map.set("best", "good");
  map.set("worse", "bad");
  map.set("worst", "bad");
  map.set("farther", "far");
  map.set("farthest", "far");
  map.set("further", "far");
  map.set("furthest", "far");
  return map;
})();

/**
 * Generate candidate lemma/base forms for an inflected English word
 * (e.g., "went" -> ["go"], "studies" -> ["study"], "debugging" -> ["debug"]).
 */
export function candidateBaseForms(rawWord: string): string[] {
  const w = rawWord.trim().toLowerCase();
  if (!w || w.length < 2) return [];
  const out = new Set<string>();

  const irregular = INFLECTED_TO_BASE.get(w);
  if (irregular) out.add(irregular);

  // -ies -> -y (studies -> study,ries -> ry)
  if (w.endsWith("ies") && w.length > 4) {
    out.add(w.slice(0, -3) + "y");
  }
  // -ves -> -f / -fe (wolves -> wolf, knives -> knife)
  if (w.endsWith("ves") && w.length > 4) {
    out.add(w.slice(0, -3) + "f");
    out.add(w.slice(0, -3) + "fe");
  }
  // -es -> base (fixes -> fix, watches -> watch, goes -> go)
  if (w.endsWith("es") && w.length > 3) {
    out.add(w.slice(0, -2));
    out.add(w.slice(0, -1));
  }
  // -s -> base (tests -> test, bugs -> bug)
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is") && w.length > 2) {
    out.add(w.slice(0, -1));
  }
  // -ied -> -y (studied -> study, applied -> apply)
  if (w.endsWith("ied") && w.length > 4) {
    out.add(w.slice(0, -3) + "y");
  }
  // -ed -> base / -e / de-doubled consonant (fixed -> fix, saved -> save, stopped -> stop)
  if (w.endsWith("ed") && w.length > 3) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(w.slice(0, -1));
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      out.add(stem.slice(0, -1));
    }
  }
  // -ing -> base / -e / de-doubled consonant (running -> run, making -> make)
  if (w.endsWith("ing") && w.length > 4) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(stem + "e");
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      out.add(stem.slice(0, -1));
    }
    if (stem.endsWith("y") && stem.length > 2) {
      out.add(stem.slice(0, -1) + "ie");
    }
  }
  // -ier / -iest -> -y (happier -> happy, easiest -> easy)
  if (w.endsWith("ier") && w.length > 4) out.add(w.slice(0, -3) + "y");
  if (w.endsWith("iest") && w.length > 5) out.add(w.slice(0, -4) + "y");
  // -er / -est -> base (faster -> fast, biggest -> big)
  if (w.endsWith("er") && w.length > 4) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(stem + "e");
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      out.add(stem.slice(0, -1));
    }
  }
  if (w.endsWith("est") && w.length > 5) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(stem + "e");
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      out.add(stem.slice(0, -1));
    }
  }
  // -ly -> base (quickly -> quick, happily -> happy)
  if (w.endsWith("ily") && w.length > 5) out.add(w.slice(0, -3) + "y");
  if (w.endsWith("ly") && w.length > 4) out.add(w.slice(0, -2));

  out.delete(w);
  return [...out];
}

export function stripVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function shardKeyForWord(word: string): string {
  const clean = word.trim().toLowerCase();
  if (!clean) return "a";
  const code = clean.charCodeAt(0);
  if (code >= 97 && code <= 122) return String.fromCharCode(code);
  return "other";
}

// ---- In-memory shard caches ----
interface LoadedShard {
  list: DictEntry[];
  byKey: Map<string, DictEntry>;
  byForm: Map<string, DictEntry>;
}

const shardCache = new Map<string, LoadedShard>();
const shardPromises = new Map<string, Promise<LoadedShard>>();
let viIndexCache: RawViIndexRow[] | null = null;
let viIndexPromise: Promise<RawViIndexRow[]> | null = null;

function buildLoadedShard(list: DictEntry[]): LoadedShard {
  const byKey = new Map<string, DictEntry>();
  const byForm = new Map<string, DictEntry>();
  for (const entry of list) {
    const k = entry.w.toLowerCase();
    // Prefer entry with CEFR tag if duplicate keys exist
    if (!byKey.has(k) || entry.c) {
      byKey.set(k, entry);
    }
    if (entry.f) {
      for (const form of entry.f) {
        const fk = form.toLowerCase();
        if (!byForm.has(fk)) byForm.set(fk, entry);
      }
    }
  }
  return { list, byKey, byForm };
}

function getBaseUrl(): string {
  try {
    return (import.meta as any).env?.BASE_URL || "/";
  } catch {
    return "/";
  }
}

export async function loadDictionaryShard(shardKey: string): Promise<LoadedShard> {
  const key = shardKey.toLowerCase();
  const cached = shardCache.get(key);
  if (cached) return cached;

  const existing = shardPromises.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<LoadedShard> => {
    // 1. In browser / Tauri WebView: fetch from public/dict/<key>.json
    if (typeof window !== "undefined" && typeof fetch === "function" && window.location?.protocol !== "about:") {
      try {
        const base = getBaseUrl().replace(/\/?$/, "/");
        const res = await fetch(`${base}dict/${key}.json`);
        if (res.ok) {
          const data = (await res.json()) as DictEntry[];
          const loaded = buildLoadedShard(data);
          shardCache.set(key, loaded);
          return loaded;
        }
      } catch {
        // Fall through to Node/Vitest fs loader
      }
    }
    // 2. Fallback for Node / Vitest environment
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const filePath = path.resolve(process.cwd(), "public", "dict", `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(raw) as DictEntry[];
        const loaded = buildLoadedShard(data);
        shardCache.set(key, loaded);
        return loaded;
      }
    } catch {
      // Ignore and return empty shard
    }
    const empty = buildLoadedShard([]);
    shardCache.set(key, empty);
    return empty;
  })().finally(() => {
    shardPromises.delete(key);
  });

  shardPromises.set(key, promise);
  return promise;
}

async function loadViIndex(): Promise<RawViIndexRow[]> {
  if (viIndexCache) return viIndexCache;
  if (viIndexPromise) return viIndexPromise;

  viIndexPromise = (async (): Promise<RawViIndexRow[]> => {
    if (typeof window !== "undefined" && typeof fetch === "function" && window.location?.protocol !== "about:") {
      try {
        const base = getBaseUrl().replace(/\/?$/, "/");
        const res = await fetch(`${base}dict/vi-index.json`);
        if (res.ok) {
          const data = (await res.json()) as RawViIndexRow[];
          viIndexCache = data;
          return data;
        }
      } catch {
        // Fall through to Node/Vitest fs loader
      }
    }
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const filePath = path.resolve(process.cwd(), "public", "dict", "vi-index.json");
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawViIndexRow[];
        viIndexCache = data;
        return data;
      }
    } catch {
      // Ignore
    }
    viIndexCache = [];
    return [];
  })().finally(() => {
    viIndexPromise = null;
  });

  return viIndexPromise;
}

/**
 * Extract a concise 1-line summary meaning for autocomplete / history lists.
 */
export function getShortMeaning(entry: DictEntry, mode: DictDisplayMode = "bilingual"): string {
  const senses = entry.m || [];
  if (mode === "en-en") {
    const enSense = senses.find((s) => s.e);
    if (enSense?.e) return enSense.e;
  }
  const viSense = senses.find((s) => s.v);
  if (viSense?.v) return viSense.v;
  const enSense = senses.find((s) => s.e);
  if (enSense?.e) return enSense.e;
  if (entry.id?.[0]) return `${entry.id[0][0]}: ${entry.id[0][1]}`;
  return "";
}

/**
 * Look up a single English word or phrase (exact match -> inflected form -> lemmatized base form -> online fallback).
 */
export async function lookupDictionaryWord(
  rawWord: string,
  options: { allowOnlineFallback?: boolean } = { allowOnlineFallback: true }
): Promise<DictEntry | null> {
  const clean = rawWord.trim().replace(/^[.,!?;:"'()[\]{}]+|[.,!?;:"'()[\]{}]+$/g, "").trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();

  // 1. Direct lookup in its letter shard
  const primaryShard = await loadDictionaryShard(shardKeyForWord(lower));
  const exact = primaryShard.byKey.get(lower);
  if (exact && (exact.m?.some((s) => s.v && s.e) || (exact.m?.length ?? 0) > 0)) {
    // Also check if a lemmatized base form has richer Vietnamese meanings when `exact` only has EN-EN
    const hasVi = exact.m?.some((s) => s.v);
    if (hasVi) return exact;

    const candidates = candidateBaseForms(lower);
    for (const base of candidates) {
      const baseShard = await loadDictionaryShard(shardKeyForWord(base));
      const baseEntry = baseShard.byKey.get(base);
      if (baseEntry && baseEntry.m?.some((s) => s.v)) {
        return {
          ...baseEntry,
          w: exact.w,
          i: exact.i || baseEntry.i,
          matchedFromForm: `${clean} → gốc từ "${baseEntry.w}"`,
          m: [...(exact.m || []), ...(baseEntry.m || [])].slice(0, 8),
        };
      }
    }
    return exact;
  }

  // 2. Check recorded irregular/variant forms in the same shard
  const byForm = primaryShard.byForm.get(lower);
  if (byForm) {
    return { ...byForm, matchedFromForm: `${clean} → dạng của "${byForm.w}"` };
  }

  // 3. Check morphological base forms (could be in another shard, e.g., "went" -> "go")
  const bases = candidateBaseForms(lower);
  for (const base of bases) {
    const shard = await loadDictionaryShard(shardKeyForWord(base));
    const found = shard.byKey.get(base);
    if (found) {
      return { ...found, matchedFromForm: `${clean} → gốc từ "${found.w}"` };
    }
  }

  // 4. Online fallback via Free Dictionary API (when online and word is not in offline shards)
  if (options.allowOnlineFallback && typeof fetch === "function" && /^[a-zA-Z\s-]+$/.test(clean)) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json[0]) {
          const item = json[0];
          const phonetic =
            item.phonetic ||
            (Array.isArray(item.phonetics) ? item.phonetics.find((p: any) => p?.text)?.text : undefined);
          const senses: DictSense[] = [];
          const syns = new Set<string>();
          for (const m of item.meanings || []) {
            const pos = m.partOfSpeech ? m.partOfSpeech.slice(0, 4).toLowerCase() : undefined;
            for (const d of (m.definitions || []).slice(0, 3)) {
              if (d.definition) {
                senses.push({
                  p: pos,
                  e: d.definition,
                  x: d.example ? [[d.example]] : undefined,
                });
              }
            }
            for (const s of m.synonyms || []) {
              if (typeof s === "string" && s.trim() && syns.size < 8) syns.add(s.trim());
            }
          }
          if (senses.length > 0) {
            return {
              w: item.word || clean,
              i: phonetic,
              t: "Online Dictionary",
              m: senses,
              syn: [...syns],
            };
          }
        }
      }
    } catch {
      // Offline or API unreachable
    }
  }

  return null;
}

/**
 * Search English words/phrases by prefix, exact match, inflected forms, and close spelling.
 */
export async function searchEnglishDictionary(query: string, limit = 30): Promise<DictEntry[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const shard = await loadDictionaryShard(shardKeyForWord(clean));
  const results: DictEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: DictEntry) => {
    const k = entry.w.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      results.push(entry);
    }
  };

  // 1. Exact match
  const exact = shard.byKey.get(clean);
  if (exact) push(exact);

  // 2. Lemmatized base forms (e.g. user types "went" or "debugging")
  for (const base of candidateBaseForms(clean)) {
    const bShard = await loadDictionaryShard(shardKeyForWord(base));
    const bEntry = bShard.byKey.get(base);
    if (bEntry) {
      push({ ...bEntry, matchedFromForm: `${clean} → ${bEntry.w}` });
    }
  }

  // 3. Prefix matches sorted by pedagogic relevance:
  //    Oxford CEFR words first -> single words -> shorter words -> alphabetical
  const prefixMatches: DictEntry[] = [];
  const wordBoundaryMatches: DictEntry[] = [];

  for (const entry of shard.list) {
    const wLower = entry.w.toLowerCase();
    if (wLower === clean) continue;
    if (wLower.startsWith(clean)) {
      prefixMatches.push(entry);
    } else if (clean.length >= 3 && wLower.includes(` ${clean}`)) {
      wordBoundaryMatches.push(entry);
    }
  }

  prefixMatches.sort((a, b) => {
    const aHasCefr = Boolean(a.c);
    const bHasCefr = Boolean(b.c);
    if (aHasCefr !== bHasCefr) return aHasCefr ? -1 : 1;
    const aSingle = !a.w.includes(" ") && !a.w.includes("-");
    const bSingle = !b.w.includes(" ") && !b.w.includes("-");
    if (aSingle !== bSingle) return aSingle ? -1 : 1;
    if (a.w.length !== b.w.length) return a.w.length - b.w.length;
    return a.w.localeCompare(b.w);
  });

  for (const item of prefixMatches) {
    if (results.length >= limit) break;
    push(item);
  }

  for (const item of wordBoundaryMatches) {
    if (results.length >= limit) break;
    push(item);
  }

  return results.slice(0, limit);
}

/**
 * Search Vietnamese keywords/phrases (accented, unaccented, or multi-word like "không hieu")
 * to find matching English words.
 */
export async function searchVietnameseDictionary(query: string, limit = 25): Promise<ViSearchMatch[]> {
  const rawClean = query
    .trim()
    .toLowerCase()
    .replace(/\b(ko|k|khong)\b/g, "không")
    .replace(/\b(dc|đc)\b/g, "được");
  if (!rawClean) return [];
  const unaccented = stripVietnameseAccents(rawClean);
  const index = await loadViIndex();

  const exactMatches: ViSearchMatch[] = [];
  const prefixMatches: ViSearchMatch[] = [];
  const substringMatches: ViSearchMatch[] = [];
  const tokenMatches: ViSearchMatch[] = [];

  const tokens = unaccented.split(/\s+/).filter((t) => t.length >= 2);

  for (const row of index) {
    const isExact = row.v === rawClean || row.u === unaccented;
    const isPrefix = !isExact && (row.v.startsWith(rawClean) || row.u.startsWith(unaccented));
    const isSub =
      !isExact &&
      !isPrefix &&
      unaccented.length >= 2 &&
      (row.v.includes(rawClean) || row.u.includes(unaccented));

    // Multi-word fallback: e.g. "không hieu" matches rows containing all tokens or the main content token
    let isTokenMatch = false;
    if (!isExact && !isPrefix && !isSub && tokens.length >= 2) {
      const rowWords = row.u.split(/\s+/);
      const allTokensInKey = tokens.every((tk) => row.u.includes(tk));
      const lastTokenExactWord = rowWords.includes(tokens[tokens.length - 1]);
      if (allTokensInKey || ( row.u === tokens[tokens.length - 1] && lastTokenExactWord )) {
        isTokenMatch = true;
      }
    }

    if (!isExact && !isPrefix && !isSub && !isTokenMatch) continue;

    const mapped: ViSearchMatch = {
      vi: row.v,
      words: row.w.map(([word, pos, meaningVn, cefr]) => ({
        word,
        pos,
        meaningVn,
        cefr,
      })),
    };

    if (isExact) exactMatches.push(mapped);
    else if (isPrefix) prefixMatches.push(mapped);
    else if (isSub) substringMatches.push(mapped);
    else tokenMatches.push(mapped);

    if (exactMatches.length + prefixMatches.length >= limit * 2) break;
  }

  return [...exactMatches, ...prefixMatches, ...substringMatches, ...tokenMatches].slice(0, limit);
}

/**
 * Auto-detect whether a query is Vietnamese or English, or search both simultaneously!
 */
export function hasVietnameseCharacters(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
}

// ---- Lookup History & Bookmarks ----

const memoryStorageFallback = new Map<string, string>();

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return memoryStorageFallback.get(key) ?? null;
}

function writeStorage(key: string, value: string): void {
  memoryStorageFallback.set(key, value);
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
}

function removeStorage(key: string): void {
  memoryStorageFallback.delete(key);
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
      localStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
}

export function getDictHistory(): DictHistoryItem[] {
  try {
    const raw = readStorage(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDictLookup(entry: DictEntry): DictHistoryItem[] {
  try {
    const history = getDictHistory();
    const key = entry.w.toLowerCase();
    const existing = history.find((h) => h.word.toLowerCase() === key);
    const nextItem: DictHistoryItem = {
      word: entry.w,
      ipa: entry.i,
      shortMeaning: getShortMeaning(entry, "bilingual").slice(0, 90),
      cefr: entry.c,
      count: (existing?.count ?? 0) + 1,
      lastLookedUpAt: Date.now(),
    };
    const filtered = history.filter((h) => h.word.toLowerCase() !== key);
    const updated = [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    writeStorage(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearDictHistory(): void {
  removeStorage(HISTORY_STORAGE_KEY);
}

export function getBookmarkedWords(): DictHistoryItem[] {
  try {
    const raw = readStorage(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isWordBookmarked(word: string): boolean {
  const key = word.trim().toLowerCase();
  return getBookmarkedWords().some((b) => b.word.toLowerCase() === key);
}

export function toggleBookmarkWord(entry: DictEntry): { bookmarked: boolean; list: DictHistoryItem[] } {
  const current = getBookmarkedWords();
  const key = entry.w.toLowerCase();
  const exists = current.some((b) => b.word.toLowerCase() === key);
  let next: DictHistoryItem[];
  if (exists) {
    next = current.filter((b) => b.word.toLowerCase() !== key);
  } else {
    next = [
      {
        word: entry.w,
        ipa: entry.i,
        shortMeaning: getShortMeaning(entry, "bilingual").slice(0, 90),
        cefr: entry.c,
        count: 1,
        lastLookedUpAt: Date.now(),
      },
      ...current,
    ];
  }
  writeStorage(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
  return { bookmarked: !exists, list: next };
}

/** Curated starter words shown when the dictionary opens with an empty search */
export const FEATURED_DISCOVERY_WORDS: Array<{ word: string; ipa: string; cefr: string; hint: string }> = [
  { word: "implement", ipa: "/ˈɪmplɪment/", cefr: "B2", hint: "triển khai, thực thi (kế hoạch, tính năng)" },
  { word: "resilient", ipa: "/rɪˈzɪliənt/", cefr: "C1", hint: "kiên cường, phục hồi nhanh sau sự cố" },
  { word: "collaborate", ipa: "/kəˈlæbəreɪt/", cefr: "B2", hint: "phối hợp, cộng tác làm việc" },
  { word: "prioritize", ipa: "/praɪˈɔːrətaɪz/", cefr: "B2", hint: "ưu tiên việc quan trọng trước" },
  { word: "negotiate", ipa: "/nɪˈɡoʊʃieɪt/", cefr: "B2", hint: "đàm phán, thương lượng" },
  { word: "comprehensive", ipa: "/ˌkɑːmprɪˈhensɪv/", cefr: "B2", hint: "toàn diện, đầy đủ mọi khía cạnh" },
  { word: "troubleshoot", ipa: "/ˈtrʌblʃuːt/", cefr: "B2", hint: "tìm nguyên nhân và khắc phục sự cố" },
  { word: "sustainable", ipa: "/səˈsteɪnəbl/", cefr: "B2", hint: "bền vững, duy trì lâu dài" },
];

/** Global custom event to open the Quick Dictionary Modal from anywhere in the app */
export const OPEN_DICTIONARY_EVENT = "myenglish-open-dictionary";

export function openQuickDictionary(word?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_DICTIONARY_EVENT, { detail: { word: word?.trim() || "" } }));
}

/**
 * Add any dictionary entry (whether in the Oxford 5000 or the 161,500+ extended dictionary)
 * directly into the learner's FSRS vocabulary deck.
 */
export async function addDictionaryEntryToSrs(
  entry: DictEntry
): Promise<{ ok: boolean; status: "added" | "moved" | "studied"; message: string }> {
  try {
    const deckRes = await pullWordFromDeck(entry.w).catch(() => ({ status: "not_in_deck" as const, word: entry.w }));
    if (deckRes.status === "studied") {
      return { ok: true, status: "studied", message: `"${entry.w}" đã có trong lộ trình ôn tập của bạn.` };
    }
    if (deckRes.status === "added" || deckRes.status === "moved") {
      return { ok: true, status: deckRes.status, message: `Đã đưa "${entry.w}" lên đầu danh sách học từ mới!` };
    }

    // Extended dictionary word (outside Oxford 5000): insert directly into SQLite
    const senses = entry.m || [];
    const primaryPos = senses.find((s) => s.p)?.p || "n";
    const viMeanings = senses
      .map((s) => s.v)
      .filter((v): v is string => Boolean(v))
      .slice(0, 3);
    const enMeanings = senses
      .map((s) => s.e)
      .filter((e): e is string => Boolean(e))
      .slice(0, 2);
    const combinedMeaning =
      viMeanings.length > 0
        ? viMeanings.join("; ")
        : enMeanings.length > 0
          ? enMeanings.join("; ")
          : entry.w;

    const examples: Array<{
      sentence_en: string;
      sentence_vn?: string;
      grammar_analysis: string;
      source?: string | null;
    }> = [];

    for (const s of senses) {
      for (const ex of s.x || []) {
        if (ex[0] && examples.length < 3) {
          examples.push({
            sentence_en: ex[0],
            sentence_vn: ex[1] || s.v || s.e || "",
            grammar_analysis: s.e ? `EN: ${s.e}` : "",
            source: "dictionary",
          });
        }
      }
    }
    if (examples.length === 0) {
      examples.push({
        sentence_en: `Let's look up the meaning of "${entry.w}".`,
        sentence_vn: combinedMeaning,
        grammar_analysis: enMeanings[0] ? `EN: ${enMeanings[0]}` : "",
        source: "dictionary",
      });
    }

    await insertEnrichedWord({
      word: entry.w,
      phonetic: entry.i || entry.uk || null,
      part_of_speech: POS_BADGE_SHORT[primaryPos] || primaryPos,
      meaning_vn: combinedMeaning,
      synonyms: (entry.syn || []).slice(0, 6),
      antonyms: [],
      collocations: (entry.id || []).slice(0, 5).map(([p, m]) => `${p} (${m})`),
      topic: entry.t || "Everyday Life",
      cefr_level: entry.c || "B2",
      examples,
    });

    return {
      ok: true,
      status: "added",
      message: `Đã thêm "${entry.w}" từ Từ điển mở rộng vào sổ từ ôn tập!`,
    };
  } catch (err) {
    console.error("Failed to add dictionary word to SRS:", err);
    return {
      ok: false,
      status: "added",
      message: "Không thể lưu từ lúc này, vui lòng thử lại.",
    };
  }
}
