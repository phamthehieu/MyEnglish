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

/** "Three." → "three", "I’m fine!" → "i'm fine": what the browser wrote, as the word lists are written */
export function normalizeHeard(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
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
/** Safari often gives no confidence (0): taken as fairly sure, not as wrong */
const UNKNOWN_CONFIDENCE = 0.85;

/**
 * The browser's guesses as the app's result: the word list's entry they say (exactly, else closely enough), else
 * the best guess as heard. `heardSpeech`: the browser noticed a voice (no guess and no voice reads as silence).
 */
export function pickResult(alternatives: Alternative[], grammar: string[], heardSpeech: boolean): AsrResult {
  const guesses = alternatives
    .map((a) => ({ text: normalizeHeard(a.transcript), conf: a.confidence > 0 ? a.confidence : UNKNOWN_CONFIDENCE }))
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
    start(): boolean {
      const Ctor = recognitionCtor();
      if (!Ctor) return false;
      rec?.abort();
      const r = new Ctor();
      r.lang = "en-US";
      r.continuous = false;
      r.interimResults = false;
      r.maxAlternatives = 5;
      alternatives = [];
      heardSpeech = false;
      failure = null;
      pending = null;
      ended = false;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) alternatives = Array.from(res, (a) => ({ transcript: a.transcript, confidence: a.confidence }));
        }
      };
      r.onspeechstart = () => {
        heardSpeech = true;
      };
      r.onspeechend = () => emit("myenglish-asr-endpoint", "");
      r.onerror = (e) => {
        failure = e.error;
      };
      r.onend = () => {
        ended = true;
        deliver();
      };
      try {
        r.start();
        rec = r;
        return true;
      } catch {
        ended = true;
        return false;
      }
    },
    /** The answer comes as the myenglish-asr-result event, once the browser has finished */
    stop(grammarJson: string): void {
      pending = JSON.parse(grammarJson) as string[];
      if (ended) deliver();
      else rec?.stop();
    },
    cancel(): void {
      pending = null;
      rec?.abort();
    },
    playLast(): void {
      /* the browser keeps no recording */
    },
  };
}
