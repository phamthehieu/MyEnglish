/**
 * Speech recognition in the web app: the browser's own (Web Speech API: Chrome, Edge, Safari on iPhone and Mac), in
 * the shape of the Android app's bridge (AsrBridge.kt), so every speaking screen runs unchanged.
 *
 * Two differences from the app's Vosk, made up for here:
 * - Vosk only hears the words of the list it is given; the browser hears anything. Its best guesses are matched to
 *   the list (an exact match, else one close enough), else what it heard is passed on as heard.
 * - The browser sends the sound to its maker (Google, Apple) to recognize it; Vosk keeps it on the phone.
 * There is no recording to play back.
 */
import type { AsrResult } from "./pronunciationCheck";

interface Alternative {
  transcript: string;
  confidence: number;
}

/* The parts of SpeechRecognition used here (not in TypeScript's DOM types) */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<Alternative> & { isFinal: boolean }> }) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechAvailable(): boolean {
  return recognitionCtor() !== null;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0 to 100 in words ("21" → "twenty one"); other numbers stay as digits */
function numberInWords(digits: string): string {
  const n = Number(digits);
  if (!/^\d{1,3}$/.test(digits) || n > 100) return digits;
  if (n < 20) return ONES[n];
  if (n === 100) return "one hundred";
  return n % 10 === 0 ? TENS[n / 10] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`;
}

/**
 * "Three." → "three", "I’m fine!" → "i'm fine", "2 coffees" → "two coffees": what the browser wrote, as the word lists
 * are written (the browser writes numbers as digits, the lessons as words: "three" against "tree")
 */
export function normalizeHeard(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\b\d+\b/g, numberInWords)
    .replace(/\s+/g, " ")
    .trim();
}

function wordDistance(a: string[], b: string[]): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/** How close two sentences are, word by word: 1 the same, 0 nothing in common */
export function similarity(a: string, b: string): number {
  const wa = a.split(" ").filter(Boolean);
  const wb = b.split(" ").filter(Boolean);
  const longest = Math.max(wa.length, wb.length);
  return longest === 0 ? 1 : 1 - wordDistance(wa, wb) / longest;
}

/** A sentence counts as said when this close to it (one word in five may differ) */
const CLOSE_ENOUGH = 0.8;
/** Safari often gives no confidence (0) for its best guess: taken as fairly sure, not as wrong */
const UNKNOWN_CONFIDENCE = 0.85;
/** A lower guess with no confidence (Chrome gives one for the best guess only): a weak one */
const UNKNOWN_LOWER_CONFIDENCE = 0.4;
/** Only the browser's best guesses may be the word of the list: a fifth guess is not what the learner said */
const TOP_GUESSES = 2;

/**
 * The browser's guesses as the app's result: the word list's entry they say (exactly, else closely enough), else
 * the best guess as heard. `heardSpeech`: the browser noticed a voice (no guess and no voice reads as silence).
 */
export function pickResult(alternatives: Alternative[], grammar: string[], heardSpeech: boolean): AsrResult {
  const guesses = alternatives
    .slice(0, TOP_GUESSES)
    .map((a, i) => ({
      text: normalizeHeard(a.transcript),
      conf: a.confidence > 0 ? a.confidence : i === 0 ? UNKNOWN_CONFIDENCE : UNKNOWN_LOWER_CONFIDENCE,
    }))
    .filter((g) => g.text);
  if (guesses.length === 0) return { ok: true, text: "", words: [], peak: heardSpeech ? 0.5 : 0 };
  const phrases = grammar.map((p) => normalizeHeard(p)).filter(Boolean);
  const said = (text: string, conf: number): AsrResult => ({
    ok: true,
    text,
    words: text.split(" ").map((word) => ({ word, conf })),
    peak: 0.5,
  });
  for (const g of guesses) if (phrases.includes(g.text)) return said(g.text, g.conf);
  let best: { phrase: string; score: number; conf: number } | null = null;
  for (const g of guesses) {
    for (const phrase of phrases) {
      const score = similarity(g.text, phrase);
      if (score >= CLOSE_ENOUGH && (!best || score > best.score)) best = { phrase, score, conf: g.conf * score };
    }
  }
  if (best) return said(best.phrase, best.conf);
  return said(guesses[0].text, guesses[0].conf);
}

const emit = (event: string, detail: string) => window.dispatchEvent(new CustomEvent(event, { detail }));

/**
 * A sentence heard in pieces (the browser finalizes one at each pause) as one set of guesses: the best guess of each
 * piece, the last piece's other guesses after the same beginning. The sentence is as sure as its least sure piece.
 */
export function joinSegments(segments: Alternative[][]): Alternative[] {
  const pieces = segments.filter((s) => s && s.length > 0);
  if (pieces.length <= 1) return pieces[0] ?? [];
  const head = pieces.slice(0, -1);
  const last = pieces[pieces.length - 1];
  const start = head.map((s) => s[0].transcript.trim()).join(" ");
  const known = head.map((s) => s[0].confidence).filter((c) => c > 0);
  const headConf = known.length > 0 ? Math.min(...known) : 0;
  return last.map((a) => ({
    transcript: `${start} ${a.transcript.trim()}`,
    confidence: headConf > 0 && a.confidence > 0 ? Math.min(headConf, a.confidence) : a.confidence,
  }));
}

/** The browser's recognition with the calls and events of the Android app's bridge (see pronunciationCheck.ts) */
export function createWebSpeechBridge() {
  let micAllowed = false;
  let rec: Recognition | null = null;
  let alternatives: Alternative[] = [];
  let heardSpeech = false;
  let failure: string | null = null;
  let ended = true;
  let pending: string[] | null = null;

  const deliver = () => {
    if (!pending) return;
    const grammar = pending;
    pending = null;
    const result: AsrResult =
      failure && failure !== "no-speech" && failure !== "aborted"
        ? { ok: false, error: failure }
        : pickResult(alternatives, grammar, heardSpeech);
    emit("myenglish-asr-result", JSON.stringify(result));
  };

  let quietWatch: number | undefined;

  /**
   * One word (`silenceMs` null): the browser ends by itself at the first pause. A sentence: it keeps listening (a
   * beginner pauses between words, and the browser would cut the sentence there), its pieces are put together, and
   * the end of speech is announced after `silenceMs` without anything new heard.
   */
  const listen = (silenceMs: number | null): boolean => {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    rec?.abort();
    window.clearInterval(quietWatch);
    const r = new Ctor();
    const sentence = silenceMs !== null;
    r.lang = "en-US";
    r.continuous = sentence;
    r.interimResults = sentence;
    r.maxAlternatives = 5;
    alternatives = [];
    heardSpeech = false;
    failure = null;
    pending = null;
    ended = false;
    const segments: Alternative[][] = [];
    let lastHeard = 0;
    let announced = false;
    // A recognition aborted for this one still fires its events: they must not touch this one's state
    const current = () => rec === r;
    r.onresult = (e) => {
      if (!current()) return;
      lastHeard = Date.now();
      heardSpeech = true;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) continue;
        const alts = Array.from(res, (a) => ({ transcript: a.transcript, confidence: a.confidence }));
        if (sentence) segments[i] = alts;
        else alternatives = alts;
      }
      if (sentence) alternatives = joinSegments(segments);
    };
    r.onspeechstart = () => {
      if (!current()) return;
      heardSpeech = true;
      lastHeard = Date.now();
    };
    r.onspeechend = () => {
      if (current() && !sentence) emit("myenglish-asr-endpoint", "");
    };
    r.onerror = (e) => {
      if (current()) failure = e.error;
    };
    r.onend = () => {
      if (!current()) return;
      window.clearInterval(quietWatch);
      ended = true;
      deliver();
    };
    if (sentence) {
      quietWatch = window.setInterval(() => {
        if (!current() || announced || !heardSpeech || Date.now() - lastHeard < silenceMs) return;
        announced = true;
        emit("myenglish-asr-endpoint", "");
      }, 200);
    }
    rec = r;
    try {
      r.start();
      return true;
    } catch {
      window.clearInterval(quietWatch);
      ended = true;
      return false;
    }
  };

  return {
    status: () => JSON.stringify({ permission: micAllowed, modelReady: true, loading: false }),
    /** Ask for the microphone once (the browser remembers the answer for the site) */
    requestPermission(): void {
      if (!navigator.mediaDevices?.getUserMedia) {
        emit("myenglish-asr-permission", "false");
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          micAllowed = true;
          emit("myenglish-asr-permission", "true");
        })
        .catch(() => emit("myenglish-asr-permission", "false"));
    },
    prepare: () => emit("myenglish-asr-ready", JSON.stringify({ ok: true })),
    /** Every word: the browser's dictionary has them all */
    knownWords: (wordsJson: string) => wordsJson,
    start: () => listen(null),
    /** A sentence: the browser keeps listening through pauses, and the end is this long a quiet after speech */
    startFor: (silenceMs: number) => listen(silenceMs),
    /** The answer comes as the myenglish-asr-result event, once the browser has finished */
    stop(grammarJson: string): void {
      pending = JSON.parse(grammarJson) as string[];
      if (ended) deliver();
      else rec?.stop();
    },
    cancel(): void {
      pending = null;
      window.clearInterval(quietWatch);
      rec?.abort();
    },
    playLast(): void {
      /* the browser keeps no recording */
    },
  };
}
