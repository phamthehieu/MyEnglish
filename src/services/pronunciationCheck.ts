import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { CHECK_AGAINST, CHECK_NEEDS_LOOKALIKE, END_SOUND_LESSONS } from "@/data/pronunciationCheckData";
import { features, isWeb } from "@/lib/platform";
import { createWebSpeechBridge, webSpeechAvailable } from "./webSpeechAsr";

/**
 * "Đọc thử cho máy nghe": on Android the phone records the learner and an offline recognizer (Vosk, see
 * AsrBridge.kt) hears the word against a short list: the target and the words it is easily mistaken for
 * (the lesson's minimal pairs). The answer is what the machine heard, not a score: speech recognizers are
 * built to understand sloppy speech, so a number out of 100 would claim more than they can tell.
 *
 * Two levels:
 *  - "focus" (trung bình): the sound the lesson is about must be right. Words that share that sound with
 *    the target (same ending, same start...) are put in the list too, and hearing one of them counts as a
 *    pass: the learner got the sound, the rest of the word was not exact.
 *  - "word" (khó): the whole word must be heard, clearly.
 */

/** The page-facing side of AsrBridge.kt */
interface AsrBridge {
  status(): string;
  requestPermission(): void;
  prepare(): void;
  knownWords(wordsJson: string): string;
  start(): boolean;
  stop(grammarJson: string): void;
  cancel(): void;
  playLast(): void;
}

export interface AsrWord {
  word: string;
  conf: number;
}

export interface AsrResult {
  ok: boolean;
  text?: string;
  words?: AsrWord[];
  /** Loudest sample of the recording, 0 to 1 */
  peak?: number;
  error?: string;
}

export type CheckLevel = "focus" | "word";
export type VerdictKind = "match" | "focus_ok" | "weak" | "confused" | "unclear" | "silent" | "error";

export interface Verdict {
  kind: VerdictKind;
  /** The learner passed at the level that was set */
  ok: boolean;
  /** What the machine heard (a word of the list), when it heard one */
  heard?: string;
  /** Vietnamese feedback shown to the learner */
  message: string;
}

/** Below this the recording is practically silence (microphone off, or nobody spoke) */
export const SILENCE_PEAK = 0.02;
/** Recognizer confidence under which a correct word is still reported as shaky (level "word") */
export const WEAK_CONFIDENCE = 0.6;
/** Longest recording the page waits for before it stops by itself */
export const MAX_LISTEN_MS = 3500;
/** Words sharing the lesson's sound added to the list at level "focus" */
const MAX_MATES = 4;

const UNKNOWN = "[unk]";
const SINGLE_WORD = /^[a-z]+$/;

// ---- Level (kept on the device) ----

const LEVEL_KEY = "myenglish_pronunciation_check_level_v1";

export function getCheckLevel(): CheckLevel {
  try {
    return localStorage.getItem(LEVEL_KEY) === "word" ? "word" : "focus";
  } catch {
    return "focus";
  }
}

export function setCheckLevel(level: CheckLevel): void {
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    /* the level is simply not remembered */
  }
}

// ---- Words and sounds ----

/** A word the check can handle: one plain lowercase English word (not a phrase, not an acronym) */
export function isCheckableWord(text: string): boolean {
  return SINGLE_WORD.test(text.trim().toLowerCase());
}

function lessonItems(lesson: PronunciationLesson): PronunciationItem[] {
  return [...lesson.examples, ...(lesson.pairs ?? []).flatMap((p) => [p.a, p.b])];
}

function pairPartner(lesson: PronunciationLesson, word: string): PronunciationItem | undefined {
  const w = word.trim().toLowerCase();
  for (const pair of lesson.pairs ?? []) {
    if (pair.a.text.toLowerCase() === w) return pair.b;
    if (pair.b.text.toLowerCase() === w) return pair.a;
  }
  return undefined;
}

/** The words `target` is easily mistaken for in this lesson: authored, its minimal-pair partner, the other quiz options */
export function confusablesFor(lesson: PronunciationLesson, target: string): string[] {
  const word = target.trim().toLowerCase();
  const found = new Set<string>();
  const add = (w: string) => {
    const c = w.trim().toLowerCase();
    if (c && c !== word && isCheckableWord(c)) found.add(c);
  };
  (CHECK_AGAINST[lesson.id]?.[word] ?? []).forEach(add);
  const partner = pairPartner(lesson, word);
  if (partner) add(partner.text);
  for (const q of lesson.quiz) {
    const options = q.options.map((o) => o.trim().toLowerCase());
    if (options.includes(word)) options.forEach(add);
  }
  return [...found];
}

/** At least this many alternatives (look-alikes, same-sound words, decoys) are given to the recognizer besides the target */
const MIN_ALTERNATIVES = 4;

/**
 * Whether "Đọc thử cho máy nghe" is offered for this word: any single word, except in the lessons whose skill
 * a recognizer cannot judge (see CHECK_NEEDS_LOOKALIKE), where it needs a known look-alike.
 */
export function canCheck(lesson: PronunciationLesson, target: string): boolean {
  if (!isCheckableWord(target)) return false;
  return !CHECK_NEEDS_LOOKALIKE.has(lesson.id) || confusablesFor(lesson, target).length > 0;
}

/**
 * Other words of the lesson, added to the list so the recognizer has something else to pick when what it hears
 * is not the target. Against [target, unknown] alone it would accept nearly any sound as the target. Only as
 * many as needed to reach MIN_ALTERNATIVES, the closest in length first.
 */
export function decoysFor(lesson: PronunciationLesson, target: string, alreadyListed: string[] = []): string[] {
  const word = target.trim().toLowerCase();
  const need = MIN_ALTERNATIVES - alreadyListed.length;
  if (need <= 0) return [];
  const skip = new Set([word, ...alreadyListed.map((w) => w.trim().toLowerCase())]);
  const pool = [...new Set(lessonItems(lesson).map((i) => i.text.trim().toLowerCase()))].filter(
    (w) => isCheckableWord(w) && !skip.has(w)
  );
  pool.sort((a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length) || a.localeCompare(b));
  return pool.slice(0, need);
}

/** IPA of a word of this lesson, to point at the sound that differs */
export function ipaOf(lesson: PronunciationLesson, word: string): string | undefined {
  const w = word.trim().toLowerCase();
  return lessonItems(lesson).find((i) => i.text.toLowerCase() === w)?.ipa;
}

/** Split an IPA transcription into sounds: "/tʃek/" -> ["tʃ", "e", "k"] (stress marks dropped, length marks kept) */
export function ipaSymbols(ipa: string): string[] {
  const s = ipa.replace(/[/ˈˌ.\s]/g, "");
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "tʃ" || two === "dʒ") {
      out.push(two);
      i++;
    } else if (s[i] === "ː" && out.length > 0) {
      out[out.length - 1] += "ː";
    } else {
      out.push(s[i]);
    }
  }
  return out;
}

const VOWEL_LETTERS = "aeiouæɑɒɔʌəɚɛɪʊɜɝɐ";
const isVowel = (symbol: string) => [...symbol].some((c) => VOWEL_LETTERS.includes(c));

/** The last sound of a word, or null when it ends in a vowel. "-es" and "-ed" count as /ɪz/ and /ɪd/. */
export function endSound(ipa: string): string | null {
  const symbols = ipaSymbols(ipa);
  const last = symbols[symbols.length - 1];
  if (!last || isVowel(last)) return null;
  const before = symbols[symbols.length - 2];
  if ((last === "z" || last === "d") && (before === "ɪ" || before === "ə")) return before + last;
  return last;
}

/** The sound a lesson is about, as it appears in one word */
export interface Focus {
  symbols: string[];
  position: "start" | "mid" | "end";
}

/** The sound to get right in `item`: the end of the word in the last-sound lessons, else what differs from its pair partner */
export function focusOf(lesson: PronunciationLesson, item: PronunciationItem): Focus | null {
  if (END_SOUND_LESSONS.has(lesson.id)) {
    const end = endSound(item.ipa);
    return end ? { symbols: ipaSymbols(end), position: "end" } : null;
  }
  const partner = pairPartner(lesson, item.text);
  if (!partner) return null;
  const a = ipaSymbols(item.ipa);
  const b = ipaSymbols(partner.ipa);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const symbols = a.slice(head, a.length - tail);
  if (symbols.length === 0) return null;
  return { symbols, position: head === 0 ? "start" : tail === 0 ? "end" : "mid" };
}

function hasFocus(ipa: string, focus: Focus, lesson: PronunciationLesson): boolean {
  if (focus.position === "end" && END_SOUND_LESSONS.has(lesson.id)) return endSound(ipa) === focus.symbols.join("");
  const symbols = ipaSymbols(ipa);
  const n = focus.symbols.length;
  const same = (from: number) => focus.symbols.every((s, i) => symbols[from + i] === s);
  if (focus.position === "start") return same(0);
  if (focus.position === "end") return symbols.length >= n && same(symbols.length - n);
  for (let from = 1; from + n <= symbols.length - 1; from++) if (same(from)) return true;
  return false;
}

/** Other words of the lesson that share the sound being learned with `target`: right sound, not necessarily right word */
export function focusMates(lesson: PronunciationLesson, target: string): string[] {
  const word = target.trim().toLowerCase();
  const item = lessonItems(lesson).find((i) => i.text.toLowerCase() === word);
  const focus = item ? focusOf(lesson, item) : null;
  if (!item || !focus) return [];
  const excluded = new Set([word, ...confusablesFor(lesson, word)]);
  const mates: string[] = [];
  for (const other of lessonItems(lesson)) {
    const w = other.text.trim().toLowerCase();
    if (excluded.has(w) || mates.includes(w) || !isCheckableWord(w)) continue;
    if (hasFocus(other.ipa, focus, lesson)) mates.push(w);
  }
  return mates.slice(0, MAX_MATES);
}

/** The list handed to the recognizer: the target, what it is mistaken for, (focus level) its mates, and "something else" */
export function buildGrammar(target: string, confusables: string[], mates: string[] = []): string[] {
  const words = [target, ...confusables, ...mates].map((w) => w.trim().toLowerCase());
  return [...new Set(words.filter(Boolean)), UNKNOWN];
}

/** What to tell the learner: pure, so it can be tested */
export function judge(
  target: string,
  result: AsrResult,
  options: {
    level?: CheckLevel;
    mates?: string[];
    ipaTarget?: string;
    ipaOf?: (word: string) => string | undefined;
    /** The sound the lesson is about, written for the learner (e.g. "/d/") */
    focusLabel?: string;
  } = {}
): Verdict {
  const level = options.level ?? "focus";
  const word = target.trim().toLowerCase();
  if (!result.ok) {
    return { kind: "error", ok: false, message: "Không nghe được lúc này, thử lại nhé." };
  }
  if ((result.peak ?? 1) < SILENCE_PEAK) {
    return { kind: "silent", ok: false, message: "Không nghe thấy tiếng. Kiểm tra micro, rồi đọc to và rõ hơn." };
  }
  const heard = (result.text ?? "").trim().toLowerCase();
  if (!heard || heard === UNKNOWN) {
    return { kind: "unclear", ok: false, message: "Máy chưa nghe rõ từ nào. Đọc chậm, rõ từng âm rồi thử lại." };
  }
  if (heard === word) {
    const conf = result.words?.find((w) => w.word.toLowerCase() === word)?.conf ?? 1;
    if (level === "word" && conf < WEAK_CONFIDENCE) {
      return {
        kind: "weak",
        ok: false,
        heard,
        message: `Máy nghe ra "${word}" nhưng chưa chắc. Mức Khó cần cả từ thật rõ, thử đọc rõ từng âm hơn.`,
      };
    }
    return { kind: "match", ok: true, heard, message: `Máy nghe ra đúng "${word}". Tốt lắm!` };
  }
  if (options.mates?.includes(heard)) {
    if (level === "focus") {
      const sound = options.focusLabel ? ` ${options.focusLabel}` : "";
      return {
        kind: "focus_ok",
        ok: true,
        heard,
        message: `Âm${sound} bạn đang luyện đã đúng. Cả từ máy nghe ra "${heard}", phần còn lại của "${word}" chưa thật chuẩn. Chuyển sang mức Khó để luyện cả từ.`,
      };
    }
    return {
      kind: "confused",
      ok: false,
      heard,
      message: `Máy nghe ra "${heard}" thay vì "${word}". Mức Khó cần đúng cả từ: nghe lại mẫu rồi đọc lại nhé.`,
    };
  }
  const ipaHeard = options.ipaOf?.(heard);
  const compare =
    options.ipaTarget && ipaHeard ? ` Hai từ khác nhau ở âm: ${options.ipaTarget} (cần đọc) và ${ipaHeard} (máy nghe).` : "";
  return {
    kind: "confused",
    ok: false,
    heard,
    message: `Máy nghe ra "${heard}" thay vì "${word}".${compare} Nghe lại mẫu rồi đọc lại nhé.`,
  };
}

/** The sound being learned in `item`, as shown to the learner: "/d/", or null when it cannot be told */
export function focusLabel(lesson: PronunciationLesson, item: PronunciationItem): string | undefined {
  const focus = focusOf(lesson, item);
  return focus ? `/${focus.symbols.join("")}/` : undefined;
}

// ---- Talking to the phone ----

let webBridge: AsrBridge | null = null;

/**
 * The Android app's recognizer (Vosk, AsrBridge.kt), or in the web app the browser's own (webSpeechAsr.ts) in the
 * same shape. Not in the desktop app: its webview has the browser object but no service behind it.
 */
function bridge(): AsrBridge | null {
  try {
    const android = (window as unknown as { AndroidASR?: AsrBridge }).AndroidASR;
    if (android) return android;
    if (isWeb() && webSpeechAvailable()) return (webBridge ??= createWebSpeechBridge());
    return null;
  } catch {
    return null;
  }
}

/** The check exists in the Android app (Vosk) and in browsers that recognize speech (Chrome, Edge, Safari) */
export function asrAvailable(): boolean {
  return bridge() !== null;
}

function waitFor<T>(event: string, timeoutMs: number, parse: (detail: string) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(event, onEvent);
      reject(new Error("timeout"));
    }, timeoutMs);
    function onEvent(e: Event) {
      window.clearTimeout(timer);
      window.removeEventListener(event, onEvent);
      resolve(parse(String((e as CustomEvent).detail)));
    }
    window.addEventListener(event, onEvent);
  });
}

export type PrepareFailure = "no-bridge" | "permission" | "model";

/** Get the microphone permission and the model ready; null when the check can start */
export async function prepareListening(): Promise<PrepareFailure | null> {
  const asr = bridge();
  if (!asr) return "no-bridge";
  try {
    const status = JSON.parse(asr.status()) as { permission: boolean; modelReady: boolean };
    if (!status.permission) {
      const answer = waitFor("myenglish-asr-permission", 60_000, (d) => d === "true");
      asr.requestPermission();
      if (!(await answer)) return "permission";
    }
    if (!status.modelReady) {
      // The first time the model is copied out of the app: a few seconds
      const ready = waitFor("myenglish-asr-ready", 120_000, (d) => (JSON.parse(d) as { ok: boolean }).ok);
      asr.prepare();
      if (!(await ready)) return "model";
    }
    return null;
  } catch {
    return "model";
  }
}

/** The words of the list the recognizer's dictionary has: a word outside it can never be recognized */
export function wordsInDictionary(words: string[]): string[] {
  try {
    const asr = bridge();
    if (!asr) return words;
    const known = JSON.parse(asr.knownWords(JSON.stringify(words))) as string[];
    return Array.isArray(known) ? known : words;
  } catch {
    return words;
  }
}

let stopWatching: (() => void) | null = null;
let finishing: Promise<AsrResult> | null = null;

function unwatchSpeechEnd(): void {
  stopWatching?.();
  stopWatching = null;
}

/**
 * Start recording; false when the phone refused (no permission, microphone busy).
 * `onSpeechEnd` is called once when the learner has spoken and then gone quiet: the caller finishes the
 * recording there, so nobody has to press stop.
 */
export function startListening(onSpeechEnd?: () => void): boolean {
  try {
    unwatchSpeechEnd();
    const started = bridge()?.start() ?? false;
    if (started && onSpeechEnd) {
      const handler = () => {
        unwatchSpeechEnd();
        onSpeechEnd();
      };
      window.addEventListener("myenglish-asr-endpoint", handler);
      stopWatching = () => window.removeEventListener("myenglish-asr-endpoint", handler);
    }
    return started;
  } catch {
    return false;
  }
}

/** Stop recording and recognize against the word list (a second call while the first is running gets the same answer) */
export function finishListening(grammar: string[]): Promise<AsrResult> {
  unwatchSpeechEnd();
  if (finishing) return finishing;
  const asr = bridge();
  if (!asr) return Promise.resolve({ ok: false, error: "no-bridge" });
  const run = (async (): Promise<AsrResult> => {
    try {
      const result = waitFor("myenglish-asr-result", 20_000, (d) => JSON.parse(d) as AsrResult);
      asr.stop(JSON.stringify(grammar));
      return await result;
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  })();
  finishing = run;
  void run.finally(() => {
    if (finishing === run) finishing = null;
  });
  return run;
}

export function cancelListening(): void {
  unwatchSpeechEnd();
  try {
    bridge()?.cancel();
  } catch {
    /* nothing was recording */
  }
}

/** The learner's own recording can be heard again (the Android app keeps it; a browser's recognition does not) */
export function canPlayRecording(): boolean {
  return features.playbackOwnVoice();
}

/** Why there is no speaking check here, for the learner */
export function speechUnavailableText(): string {
  return isWeb()
    ? "Trình duyệt này chưa nghe được giọng nói. Mở bằng Chrome, Edge hoặc Safari, hoặc dùng app trên điện thoại Android."
    : "Chấm giọng chỉ có trên điện thoại Android.";
}

/** Play the learner's last recording */
export function playRecording(): void {
  try {
    bridge()?.playLast();
  } catch {
    /* nothing recorded */
  }
}
