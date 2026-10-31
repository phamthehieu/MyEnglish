/**
 * Text-To-Speech (one implementation for the whole app); accepts a click event (stops propagation) or a
 * speech rate. The learner's voice and speed (Settings) apply everywhere; an explicit rate (e.g. "nghe
 * chậm") is scaled by the learner's speed.
 */
const TTS_KEY = "myenglish_tts_v1";
const DEFAULT_RATE = 0.9;

export interface TtsSettings {
  /** voiceURI of an English system voice; empty = the system default for en-US */
  voiceURI: string;
  /** Normal speaking rate (0.6 – 1.1) */
  rate: number;
}

export function getTtsSettings(): TtsSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(TTS_KEY) || "{}");
    const rate = Number(parsed.rate);
    return {
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : "",
      rate: Number.isFinite(rate) && rate >= 0.5 && rate <= 1.2 ? rate : DEFAULT_RATE,
    };
  } catch {
    return { voiceURI: "", rate: DEFAULT_RATE };
  }
}

export function saveTtsSettings(settings: Partial<TtsSettings>): TtsSettings {
  const next = { ...getTtsSettings(), ...settings };
  try {
    localStorage.setItem(TTS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** A voice the learner can pick: what the settings list needs, whichever engine provides it */
export interface TtsVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

/**
 * Android's own text-to-speech, exposed by the app shell (TtsBridge.kt). The WebView's speechSynthesis is
 * silent or lists no voices on many phones, so on Android this is used whenever its engine is ready.
 */
interface AndroidTtsBridge {
  isReady(): boolean;
  voices(): string;
  speak(text: string, lang: string, voiceId: string, rate: number): void;
  stop(): void;
}

function androidTts(): AndroidTtsBridge | null {
  try {
    const bridge = (window as unknown as { AndroidTTS?: AndroidTtsBridge }).AndroidTTS;
    return bridge && bridge.isReady() ? bridge : null;
  } catch {
    return null;
  }
}

function webVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  } catch {
    return [];
  }
}

/** English voices installed on this device (the list can arrive late: see onVoicesChanged) */
export function englishVoices(): TtsVoice[] {
  const native = androidTts();
  if (native) {
    try {
      const parsed = JSON.parse(native.voices());
      return Array.isArray(parsed) ? (parsed as TtsVoice[]) : [];
    } catch {
      return [];
    }
  }
  return webVoices();
}

/** Call back when the voice list changes or becomes known. Returns the way to stop listening. */
export function onVoicesChanged(callback: () => void): () => void {
  const events = ["myenglish-tts-ready"];
  events.forEach((name) => window.addEventListener(name, callback));
  let speech: SpeechSynthesis | undefined;
  try {
    speech = window.speechSynthesis;
    speech?.addEventListener("voiceschanged", callback);
  } catch {
    speech = undefined;
  }
  return () => {
    events.forEach((name) => window.removeEventListener(name, callback));
    speech?.removeEventListener("voiceschanged", callback);
  };
}

/** Stop whatever is being spoken */
export function stopSpeaking(): void {
  speaker.playing = false;
  try {
    androidTts()?.stop();
    window.speechSynthesis?.cancel?.();
  } catch {
    /* nothing is playing */
  }
}

/**
 * What the speaker is doing, so the microphone is switched on only once the word has been read (it would hear
 * the phone). `started`: the engine said it began; an engine that never does is not waited for long.
 */
const speaker = { playing: false, started: false, at: 0 };

if (typeof window !== "undefined") {
  window.addEventListener("myenglish-tts-start", () => {
    speaker.started = true;
  });
  window.addEventListener("myenglish-tts-end", () => {
    speaker.playing = false;
  });
}

/** Fired on window each time something is read aloud: a microphone listening then must pause */
export const SPEAK_EVENT = "myenglish-speak";

function speechBegins(): void {
  speaker.playing = true;
  speaker.started = false;
  speaker.at = Date.now();
  window.dispatchEvent(new Event(SPEAK_EVENT));
}

/** An engine that has not started a few moments after speak() is not going to */
const START_GRACE_MS = 1500;
/** The end of the sound can still be in the speaker when the engine says it is done */
const END_TAIL_MS = 200;

/** Resolves once nothing is being read aloud (at the latest after `maxMs`) */
export function waitForSpeechToEnd(maxMs = 10_000): Promise<void> {
  const begin = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const now = Date.now();
      const silent = !speaker.playing || (!speaker.started && now - speaker.at > START_GRACE_MS);
      if (silent || now - begin > maxMs) {
        window.setTimeout(resolve, END_TAIL_MS);
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function handleSpeak(text: string, eOrRate?: React.MouseEvent | number, voiceOverride?: string) {
  const settings = { ...getTtsSettings() };
  // A voice for this one call (the other person in a conversation), instead of the learner's own
  if (voiceOverride) settings.voiceURI = voiceOverride;
  let rate = settings.rate;
  if (typeof eOrRate === "number") {
    // When slow rate is requested (e.g. SLOW_RATE = 0.45, exactly 50% of default 0.9), scale with
    // user's rate setting but cap at SLOW_RATE so slow speech is never fast across any tab or exercise.
    const scaled = eOrRate * (settings.rate / DEFAULT_RATE);
    rate = eOrRate <= SLOW_RATE ? Math.min(SLOW_RATE, Math.max(0.35, scaled)) : Math.max(0.35, Math.min(1.2, scaled));
  } else if (eOrRate) {
    eOrRate.stopPropagation();
  }
  if (!text.trim()) return;
  const native = androidTts();
  if (native) {
    try {
      speechBegins();
      native.speak(text, "en-US", settings.voiceURI, rate);
    } catch (e) {
      console.warn("Android speech error:", e);
    }
    return;
  }
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = settings.voiceURI ? webVoices().find((v) => v.voiceURI === settings.voiceURI) : undefined;
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-US";
      utterance.rate = rate;
      activeUtterance = utterance;
      utterance.onstart = () => {
        if (activeUtterance === utterance) speaker.started = true;
      };
      utterance.onend = () => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
          speaker.playing = false;
        }
      };
      utterance.onerror = () => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
          speaker.playing = false;
        }
      };
      speechBegins();
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn("Speech synthesis error:", e);
  }
}

/**
 * Browsers (Safari on an iPhone above all) keep speech silent until the page speaks inside a tap: a card that reads
 * its word by itself would stay mute. The first tap anywhere says nothing, silently, and unlocks speech for the rest.
 */
export function unlockWebSpeechOnFirstTap(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const unlock = () => {
    try {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch {
      /* no speech in this browser */
    }
  };
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
}

/** Slow speed for a word the learner wants to hear clearly (50% of normal) */
export const SLOW_RATE = 0.45;

/** Standardized delay before an exercise or card automatically plays audio (sweet spot for visual & cognitive orientation) */
export const AUTO_SPEAK_DELAY_MS = 650;
