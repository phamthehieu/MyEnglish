import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  ChevronsDownUp,
  ChevronsUpDown,
  Keyboard,
  Languages,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Repeat,
  Square,
  Subtitles,
  TextCursorInput,
  Type,
  Volume2,
} from "lucide-react";
// Round, wide letters with Vietnamese support, bundled with the app (works offline); used for the sentences only
import { COMMON_WORDS, FUNCTION_WORDS } from "@/data/commonWords";
import { getAllWords } from "@/services/db";
import { isFoundationMode } from "@/services/learnerProfile";
import { buildWordIndex, classifyToken } from "@/services/reading";
import type { WordDetail } from "@/types/database";
import { PAGE_CONTAINER } from "./shared";
import WordSheet, { cleanWord } from "./WordSheet";
import { ClozeCard, DictationCard, SkeletonText } from "./ShadowingPractice";
import { SENTENCE_FONT, WORD_TONE } from "./shadowingStyle";
import {
  asrAvailable,
  cancelListening,
  finishListening,
  playRecording,
  prepareListening,
  SILENCE_PEAK,
  startListening,
  canPlayRecording,
  speechUnavailableText,
  micPermissionText,
} from "@/services/pronunciationCheck";
import { checkSentence, type SentenceCheck } from "@/services/sentenceCheck";
import { countWords } from "@/services/shadowingPractice";
import INDEX from "@/data/shadowing/index.json";
import { FEED_EVENT, getFeedEntries, getFeedLesson } from "@/services/shadowingFeed";

/** A video cut into sentences with their times (built by scripts/build-shadowing.mjs) */
interface ShadowingLesson {
  id: string;
  youtubeId: string;
  title: string;
  channel?: string;
  level: string;
  /** The topic the video is filed under ("Hội thoại hàng ngày") */
  group?: string;
  duration: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    vi?: string;
    /** Each word with the second it starts (lets the sentence light up as it is said) */
    words?: Array<[string, number]>;
    /** How the whole sentence is pronounced, "/ðeɪ weɪt/" (the pronunciation line of the Shadowing tab) */
    ipa?: string;
  }>;
}

/** One line of the list: what the list screen needs without loading the lesson itself */
interface ShadowingEntry {
  id: string;
  youtubeId: string;
  title: string;
  level: string;
  group?: string | null;
  duration: number;
  /** Number of sentences */
  count: number;
}

/** The list (built with the lessons by scripts/build-shadowing.mjs) */
const ENTRIES = INDEX as unknown as ShadowingEntry[];
/** A lesson is a file of its own, loaded when it is opened */
const LESSON_FILES = import.meta.glob("../../data/shadowing/lessons/*.json", { import: "default" }) as Record<string, () => Promise<ShadowingLesson>>;
const OTHER_GROUP = "Bài khác";

function loadLesson(id: string): Promise<ShadowingLesson> {
  const path = Object.keys(LESSON_FILES).find((p) => p.endsWith(`/${id}.json`));
  if (path) return LESSON_FILES[path]();
  // Not in the app: one of the lessons downloaded since (services/shadowingFeed.ts)
  return getFeedLesson<ShadowingLesson>(id).then((l) => l ?? Promise.reject(new Error(`No lesson ${id}`)));
}

/** The captions run a little tight: start a hair early, stop a hair late */
const LEAD = 0.25;
const TAIL = 0.3;
const SPEEDS = [0.5, 0.75, 1, 1.25];

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("Không tải được trình phát YouTube (kiểm tra mạng)."));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** The sentence stays bright and only the word being said is lit: one set of colors for a list row, one for the dark pill on the video */
const KARAOKE_TONE = {
  card: {
    past: "text-slate-900 dark:text-zinc-100",
    now: "text-teal-700 dark:text-teal-300 underline decoration-teal-600 dark:decoration-teal-300 underline-offset-[5px] decoration-2",
    next: "text-slate-900 dark:text-zinc-100",
    // A harder word (see isHardWord) in a muted gold
    hard: "text-yellow-700 dark:text-yellow-300/80",
  },
  overlay: {
    past: "text-white",
    now: "text-teal-300 underline decoration-teal-300 underline-offset-4",
    next: "text-white",
    hard: "text-white",
  },
};


/** Whether a word of a sentence is one the learner has not learned yet (see Lesson) */
type Unlearned = (word: string) => boolean;

/** A sentence that follows the video word by word. Only this small piece redraws as the time moves. */
function KaraokeText({
  words,
  getTime,
  tone,
  unlearned,
  onWord,
}: {
  words: Array<[string, number]>;
  getTime: () => number;
  tone: keyof typeof KARAOKE_TONE;
  unlearned: Unlearned;
  /** A tap on a word (not on the sentence around it) */
  onWord?: (word: string) => void;
}) {
  const [at, setAt] = useState(-1);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const t = getTime();
      // The last word that has started; a hair early so the light is not behind the voice
      let now = -1;
      for (let i = 0; i < words.length && t >= words[i][1] - 0.08; i++) now = i;
      setAt((prev) => (prev === now ? prev : now));
    }, 70);
    return () => window.clearInterval(timer);
  }, [words, getTime]);
  const colors = KARAOKE_TONE[tone];
  return (
    <>
      {words.map(([word], i) => (
        <span
          key={i}
          className={`transition-colors duration-100 motion-reduce:transition-none ${
            i === at ? colors.now : unlearned(word) ? colors.hard : i < at ? colors.past : colors.next
          }`}
          onClick={
            onWord
              ? (e) => {
                  e.stopPropagation();
                  onWord(word);
                }
              : undefined
          }
        >
          {word}{" "}
        </span>
      ))}
    </>
  );
}

/** A sentence that is not being played: plain, with the words the learner has not learned yet in gold */
function PlainSentence({ text, unlearned, onWord }: { text: string; unlearned: Unlearned; onWord?: (word: string) => void }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={i}
          className={unlearned(word) ? KARAOKE_TONE.card.hard : undefined}
          onClick={
            onWord
              ? (e) => {
                  e.stopPropagation();
                  onWord(word);
                }
              : undefined
          }
        >
          {word}{" "}
        </span>
      ))}
    </>
  );
}

/** Android only: read the sentence aloud and see, word by word, what the offline recognizer heard */
function SentenceReader({ text, seconds, onStart, trailing }: { text: string; seconds: number; onStart: () => void; trailing?: ReactNode }) {
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [result, setResult] = useState<SentenceCheck | null>(null);
  const [problem, setProblem] = useState("");
  const timer = useRef<number | undefined>(undefined);
  /** Bumped whenever the sentence changes or the row goes away: work started for an earlier one must stop there */
  const run = useRef(0);

  // Another sentence: forget the last answer, and stop listening if the learner moved on
  useEffect(() => {
    setResult(null);
    setProblem("");
    setPhase("idle");
    return () => {
      run.current++;
      window.clearTimeout(timer.current);
      cancelListening();
    };
  }, [text]);

  if (!asrAvailable()) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-center text-slate-500 dark:text-zinc-400">{speechUnavailableText()}</p>
        {trailing && <div className="flex justify-end">{trailing}</div>}
      </div>
    );
  }

  const finish = async () => {
    const mine = run.current;
    window.clearTimeout(timer.current);
    setPhase("checking");
    const heard = await finishListening([]);
    if (mine !== run.current) return;
    if (!heard.ok) setProblem("Máy chưa nghe được, thử lại nhé.");
    else if ((heard.peak ?? 0) < SILENCE_PEAK) setProblem("Không nghe thấy tiếng. Kiểm tra micro rồi thử lại.");
    else setResult(checkSentence(text, heard.words ?? []));
    setPhase("idle");
  };

  const begin = async () => {
    setResult(null);
    setProblem("");
    onStart();
    const mine = run.current;
    setPhase("preparing");
    const failure = await prepareListening();
    // The learner went to another sentence while the microphone was getting ready: do not switch it on
    if (mine !== run.current) return;
    if (failure === "declined") {
      setPhase("idle");
      return;
    }
    if (failure) {
      setProblem(
        failure === "permission"
          ? micPermissionText()
          : "Chưa chuẩn bị được bộ nhận dạng giọng nói. Thử lại sau ít phút."
      );
      setPhase("idle");
      return;
    }
    if (!startListening(finish, { sentence: true })) {
      setProblem("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
      setPhase("idle");
      return;
    }
    setPhase("listening");
    // The sentence's own length plus time to start and stop, never more than the recorder keeps
    timer.current = window.setTimeout(finish, Math.min(14000, seconds * 1000 + 4000));
  };

  const busy = phase === "preparing" || phase === "checking";
  const label =
    phase === "listening" ? "Đang nghe… đọc xong thì dừng, máy sẽ tự chấm (hoặc bấm để dừng)" : phase === "preparing" ? "Đang chuẩn bị…" : phase === "checking" ? "Đang chấm…" : result ? "Ghi lại" : "Ghi âm";

  return (
    <div className="space-y-4">
      {/* A big round button in the middle, whatever goes next (the "Tiếp" button) at its right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span />
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={phase === "listening" ? finish : begin}
            disabled={busy}
            aria-label={label}
            className={`h-20 w-20 rounded-full ring-8 inline-flex items-center justify-center text-white shadow-sm transition-colors active:scale-95 disabled:opacity-70 ${
              phase === "listening"
                ? "bg-red-600 hover:bg-red-700 ring-red-500/20 animate-pulse motion-reduce:animate-none"
                : "bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 ring-teal-700/10"
            }`}
          >
            {busy ? <Loader2 className="w-8 h-8 animate-spin" /> : phase === "listening" ? <Square className="w-7 h-7 fill-white" /> : <Mic className="w-8 h-8" />}
          </button>
          <span className="text-sm font-semibold text-teal-800 dark:text-teal-300 text-center max-w-[16rem]">{label}</span>
        </div>
        <div className="justify-self-end">{trailing}</div>
      </div>
      {problem && <p className="text-sm text-center text-red-700 dark:text-red-300">{problem}</p>}
      {result && (
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-3 space-y-1.5" role="status">
          <p className="text-base font-semibold leading-snug">
            {result.words.map((w, i) => (
              <span key={i} className={WORD_TONE[w.status]}>
                {w.text}{" "}
              </span>
            ))}
          </p>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            <b className="text-slate-900 dark:text-zinc-100">
              {result.clear}/{result.judged}
            </b>{" "}
            từ rõ
            {result.words.some((w) => w.status === "shaky") && " · cam: nghe được nhưng chưa rõ"}
          </p>
          {result.words
            .filter((w) => w.status === "wrong")
            .map((w, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                "{w.text.replace(/[^\w'’-]/g, "")}" máy nghe thành "{w.heard}"
              </p>
            ))}
          {result.words.some((w) => w.status === "missing") && <p className="text-xs text-red-600 dark:text-red-400">Gạch ngang: chưa nghe thấy từ đó.</p>}
          {canPlayRecording() && (
            <button onClick={playRecording} className="min-h-10 text-sm font-semibold text-teal-700 dark:text-teal-300 underline underline-offset-2 inline-flex items-center gap-1">
              <Volume2 className="w-4 h-4" /> Nghe lại giọng mình
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The Shadowing tab: one sentence at a time. A progress bar, the sentence big and lit word by word as it plays, how it
 * is pronounced, play / speed / repeat, and the microphone with "Tiếp" (the next sentence) beside it.
 */
function ShadowCard({
  seg,
  index,
  total,
  fontScale,
  getTime,
  showIpa,
  onToggleIpa,
  speed,
  onSpeed,
  loop,
  onLoop,
  onPlay,
  onNext,
  onStartRecording,
  onWord,
}: {
  seg: ShadowingLesson["segments"][number];
  index: number;
  total: number;
  fontScale: number;
  getTime: () => number;
  showIpa: boolean;
  onToggleIpa: () => void;
  speed: number;
  onSpeed: () => void;
  loop: boolean;
  onLoop: () => void;
  onPlay: () => void;
  onNext: () => void;
  onStartRecording: () => void;
  onWord: (word: string) => void;
}) {
  const pill = "h-11 rounded-full inline-flex items-center justify-center text-sm font-semibold transition-colors";
  return (
    <div className="mb-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 md:p-5 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div
        className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800"
        role="progressbar"
        aria-label="Tiến độ trong bài"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div className="h-full rounded-full bg-teal-700 dark:bg-teal-500 transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <p className="text-center font-semibold leading-[1.6] text-slate-900 dark:text-zinc-100" style={{ ...SENTENCE_FONT, fontSize: 22 * fontScale }}>
        {seg.words ? <KaraokeText key={index} words={seg.words} getTime={getTime} tone="card" unlearned={() => false} onWord={onWord} /> : seg.text}
      </p>

      {seg.ipa && (
        <div className="flex items-start gap-3">
          {showIpa ? <p className="min-w-0 flex-1 text-center text-[15px] leading-snug text-slate-500 dark:text-zinc-400 break-words">{seg.ipa}</p> : <span className="flex-1" />}
          <button
            onClick={onToggleIpa}
            aria-pressed={showIpa}
            aria-label={showIpa ? "Ẩn phiên âm" : "Hiện phiên âm"}
            title="IPA = ký hiệu cách đọc"
            className={`h-11 shrink-0 rounded-full border px-3 text-sm font-bold ${
              showIpa
                ? "border-teal-700/40 dark:border-teal-400/40 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300"
                : "border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
            }`}
          >
            IPA
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onPlay}
          className="h-14 w-14 rounded-full bg-teal-50 hover:bg-teal-100 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 inline-flex items-center justify-center"
          aria-label="Nghe câu này"
        >
          <Play className="w-6 h-6 fill-current" />
        </button>
        <button onClick={onSpeed} className={`${pill} min-w-[3.5rem] px-4 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums`} aria-label={`Tốc độ ${speed} lần. Bấm để đổi`}>
          {speed}×
        </button>
        <button
          onClick={onLoop}
          aria-pressed={loop}
          aria-label={loop ? "Đang lặp lại câu này. Bấm để tắt" : "Lặp lại câu này"}
          className={`${pill} gap-1.5 px-4 ${loop ? "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300 ring-1 ring-teal-700/40 dark:ring-teal-400/40" : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"}`}
        >
          <Repeat className="w-5 h-5" /> Lặp
        </button>
      </div>

      <div className="border-t border-slate-100 dark:border-zinc-800" />

      <SentenceReader
        text={seg.text}
        seconds={seg.end - seg.start}
        onStart={onStartRecording}
        trailing={
          <button
            onClick={onNext}
            disabled={index >= total - 1}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl border border-teal-700/30 px-4 text-base font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:text-teal-300 dark:hover:bg-teal-400/10 disabled:opacity-40"
          >
            Tiếp <ArrowRight className="w-5 h-5" />
          </button>
        }
      />
    </div>
  );
}

const FONT_KEY = "myenglish_shadowing_font_v2";
/** The choices of the "Cỡ chữ" sheet; the sentences are 17px at 100% and the meaning under them 14px */
const FONT_SCALES = [
  { label: "Nhỏ", pct: 85 },
  { label: "Vừa", pct: 100 },
  { label: "Lớn", pct: 115 },
  { label: "Rất lớn", pct: 130 },
];
const SENTENCE_PX = 16;
const MEANING_PX = 13.5;

/** Slides up from the bottom to pick the size of the text: a preview line shows what each size looks like */
function FontSheet({ index, onPick, onClose }: { index: number; onPick: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pct = FONT_SCALES[index].pct;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Cỡ chữ">
      <button className="popup-backdrop-enter absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <div className="sheet-enter relative mx-auto w-full max-w-lg rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
        <button onClick={onClose} className="mx-auto block h-1.5 w-10 rounded-full bg-slate-300 dark:bg-zinc-600" aria-label="Đóng" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Cỡ chữ</h3>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Xem trước</p>
          <p className="mt-1 font-medium text-slate-900 dark:text-zinc-100" style={{ ...SENTENCE_FONT, fontSize: (SENTENCE_PX * pct) / 100 }}>
            It's 1780 in Paris
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Cỡ chữ">
          {FONT_SCALES.map((f, i) => {
            const on = i === index;
            return (
              <button
                key={f.pct}
                role="radio"
                aria-checked={on}
                onClick={() => onPick(i)}
                className={`flex flex-col items-center justify-end gap-1 rounded-2xl border px-1 pb-3 pt-2 transition-colors ${
                  on
                    ? "border-teal-700 ring-1 ring-teal-700 dark:border-teal-500 dark:ring-teal-500 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300"
                    : "border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                }`}
              >
                <span className="font-bold leading-none" style={{ fontSize: (20 * f.pct) / 100 }}>
                  A
                </span>
                <span className="text-sm font-semibold">{f.label}</span>
                <span className="text-xs opacity-70 tabular-nums">{f.pct}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 00:16 */
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const SCROLLBAR_HIDDEN = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Lesson({ lesson, onBack }: { lesson: ShadowingLesson; onBack: () => void }) {
  const { segments } = lesson;
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [showVi, setShowVi] = useState(true);
  /** "subtitles": follow the video; "shadow": the same list, and the active sentence can be read aloud to the microphone */
  const [view, setView] = useState<"subtitles" | "shadow" | "dictation" | "cloze">("subtitles");
  /** The sentences already answered in each typing exercise: only these show their text in the list */
  const [doneDictation, setDoneDictation] = useState<Set<number>>(() => new Set());
  const [doneCloze, setDoneCloze] = useState<Set<number>>(() => new Set());
  const [follow, setFollow] = useState(true);
  const [captions, setCaptions] = useState(true);
  /** The title and the two tabs folded away so the sentences get more room; the video and the tools stay */
  const [compact, setCompact] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [fontIdx, setFontIdx] = useState(() => {
    try {
      const raw = localStorage.getItem(FONT_KEY);
      const n = raw === null ? 1 : Number(raw);
      return Number.isInteger(n) && n >= 0 && n < FONT_SCALES.length ? n : 1;
    } catch {
      return 1;
    }
  });
  /** Shadowing tab: how fast the sentence plays, whether it plays again and again, and whether its pronunciation shows */
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [showIpa, setShowIpa] = useState(true);
  const hasVi = segments.some((s) => s.vi);
  const canShadow = asrAvailable();
  // The poll below runs outside React: it reads these through refs
  const indexRef = useRef(0);
  const viewRef = useRef(view);
  const loopRef = useRef(loop);
  /** After a tap on a sentence the video needs a moment to arrive: until then the clock must not pick another sentence */
  const manualUntil = useRef(0);
  /** The sentence the Shadowing tab already paused at the end of, so a tap on the video that plays on is left alone */
  const stoppedFor = useRef(-1);
  indexRef.current = index;
  viewRef.current = view;
  loopRef.current = loop;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    loadYouTubeApi()
      .then(() => {
        if (dead || !host.current || !window.YT) return;
        const el = document.createElement("div");
        host.current.appendChild(el);
        player.current = new window.YT.Player(el, {
          videoId: lesson.youtubeId,
          width: "100%",
          height: "100%",
          // No YouTube controls, full screen or keyboard: the app has its own, and a layer over the video blocks the rest
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, cc_load_policy: 0, controls: 0, fs: 0, disablekb: 1 },
          events: {
            onReady: () => !dead && setReady(true),
            onError: (e: { data: number }) => !dead && setError(`YouTube không phát được video này (mã lỗi ${e.data}).`),
          },
        });
      })
      .catch((e: Error) => !dead && setError(e.message));
    return () => {
      dead = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [lesson.youtubeId]);

  const play = useCallback(
    (i: number) => {
      const p = player.current;
      const seg = segments[i];
      if (!p || !seg) return;
      setIndex(i);
      indexRef.current = i;
      manualUntil.current = performance.now() + 500;
      stoppedFor.current = -1;
      p.seekTo(Math.max(0, seg.start - LEAD), true);
      p.playVideo();
    },
    [segments]
  );

  // Follow the video: move the highlight with the time. In the practice tabs (Shadowing, Chính tả, Điền từ) one sentence
  // is practised at a time: it stops at its end (or plays again when the loop is on) and the clock never moves on to
  // another sentence.
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const p = player.current;
      if (!p) return;
      if (performance.now() < manualUntil.current) return;
      const t = p.getCurrentTime();
      if (viewRef.current !== "subtitles") {
        const cur = segments[indexRef.current];
        if (cur && t >= cur.end + TAIL) {
          if (loopRef.current) p.seekTo(Math.max(0, cur.start - LEAD), true);
          else if (stoppedFor.current !== indexRef.current) {
            stoppedFor.current = indexRef.current;
            p.pauseVideo();
          }
        }
        return;
      }
      const at = segments.findIndex((s) => t >= s.start - 0.05 && t < s.end + 0.05);
      if (at >= 0 && at !== indexRef.current) {
        indexRef.current = at;
        setIndex(at);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [ready, segments]);

  useEffect(() => {
    player.current?.setPlaybackRate(speed);
  }, [speed, ready]);

  // Keep the current sentence in view, a third of the way down the list (only the list scrolls, never the page).
  // In the practice tabs the practice card is at the top of the list, so that is where to look.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior = still ? "auto" : "smooth";
    if (view !== "subtitles") {
      list.scrollTo({ top: 0, behavior });
      return;
    }
    if (!follow) return;
    const row = list.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (!row) return;
    list.scrollTo({ top: Math.max(0, row.offsetTop - list.clientHeight / 3), behavior });
  }, [index, follow, view]);

  // The learner's own words: a word is gold when it is not in their word bank (and not one of the very common words),
  // or it is in the bank but they have never studied it. The very common words stay plain, as in the Đọc tab.
  const [bank, setBank] = useState<WordDetail[]>([]);
  useEffect(() => {
    let dead = false;
    getAllWords()
      .then((words) => !dead && setBank(words))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);
  const unlearned = useMemo<Unlearned>(() => {
    const { formIndex } = buildWordIndex(bank);
    const known = isFoundationMode() ? FUNCTION_WORDS : COMMON_WORDS;
    const memo = new Map<string, boolean>();
    return (raw) => {
      // The words of the captions carry their punctuation: "collapses," "confident."
      const word = raw.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, "");
      if (!word) return false;
      const key = word.toLowerCase();
      let answer = memo.get(key);
      if (answer === undefined) {
        const cls = classifyToken(word, formIndex, known);
        answer = cls.kind === "candidate" || (cls.kind === "bank" && cls.status === "new");
        memo.set(key, answer);
      }
      return answer;
    };
  }, [bank]);

  // The word the learner tapped, with the sentence it is in: shown in a sheet from the bottom
  const [lookup, setLookup] = useState<{ raw: string; index: number } | null>(null);
  const openWord = (raw: string, at: number) => {
    if (!cleanWord(raw)) return;
    player.current?.pauseVideo();
    setLookup({ raw, index: at });
  };
  const reloadBank = useCallback(() => {
    getAllWords()
      .then(setBank)
      .catch(() => {});
  }, []);
  const closeLookup = useCallback(() => setLookup(null), []);

  const seg = segments[index];
  const getTime = useCallback(() => player.current?.getCurrentTime() ?? 0, []);
  const pickFont = (i: number) => {
    setFontIdx(i);
    try {
      localStorage.setItem(FONT_KEY, String(i));
    } catch {
      /* the size is only a convenience */
    }
  };
  const fontScale = FONT_SCALES[fontIdx].pct / 100;
  const closeFont = useCallback(() => setFontOpen(false), []);

  // What the practice cards share: play / speed / repeat, the next sentence (it starts playing), and "this one is done"
  const practiceBar = {
    speed,
    loop,
    onPlay: () => play(index),
    onSpeed: () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]),
    onLoop: () => setLoop((v) => !v),
  };
  const goNext = () => play(Math.min(segments.length - 1, index + 1));
  const markDone = (kind: "dictation" | "cloze", i: number) =>
    (kind === "dictation" ? setDoneDictation : setDoneCloze)((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));

  const tool = (on: boolean) =>
    `h-11 shrink-0 rounded-xl border inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
      on
        ? "border-teal-700/40 dark:border-teal-400/40 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300"
        : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
    }`;
  const tab = (on: boolean) =>
    `shrink-0 px-4 min-h-11 rounded-full border text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
      on
        ? "border-teal-700 bg-teal-700 text-white dark:border-teal-600 dark:bg-teal-600"
        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
    }`;
  const divider = <span className="w-px h-6 shrink-0 bg-slate-200 dark:bg-zinc-700" aria-hidden="true" />;

  // One screen: the video and its tools stay in view, and only the sentence list scrolls
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[3fr_2fr] lg:gap-4 max-w-5xl mx-auto w-full md:p-6">
      <div className="shrink-0 min-w-0 lg:overflow-y-auto">
        {/* Video: edge to edge on a phone, with the sentence written over it word by word */}
        {/* The height is capped so that held sideways the sentence list still has room under the video */}
        <div className="relative aspect-video max-h-[45vh] mx-auto bg-black overflow-hidden md:rounded-2xl">
          {/* The player frame is taller than what shows: the video stays 16:9 in the middle, and YouTube's own title, share
              buttons, logo and "more videos", which sit at the top and bottom edge of its frame, fall outside and are cut off */}
          <div className="absolute left-0 w-full h-[150%] -top-[25%] [&_iframe]:w-full [&_iframe]:h-full" ref={host} />
          {/* Catches every tap meant for YouTube's own buttons (share, watch later, logo): a tap plays or pauses */}
          <button
            className="absolute inset-0 w-full cursor-pointer"
            aria-label="Phát hoặc tạm dừng"
            onClick={() => {
              const p = player.current;
              if (!p) return;
              if (p.getPlayerState() === 1) p.pauseVideo();
              else p.playVideo();
            }}
          />
          {/* Not in the typing exercises: the caption would give the answer away */}
          {captions && seg && view !== "dictation" && view !== "cloze" && (
            <div className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
              <p className="max-w-full rounded-xl bg-black/70 px-3 py-1.5 text-center text-[15px] font-semibold leading-snug text-white">
                {seg.words ? <KaraokeText key={index} words={seg.words} getTime={getTime} tone="overlay" unlearned={unlearned} /> : seg.text}
              </p>
            </div>
          )}
        </div>
        {error && <p className="px-3 pt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="px-3 md:px-0 pt-3 space-y-3">
          {!compact && (
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="w-11 h-11 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shrink-0" aria-label="Danh sách">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 truncate">{lesson.title}</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-400 tabular-nums">
                  {lesson.level} · {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2, "0")} · câu {index + 1}/{segments.length}
                </p>
              </div>
            </div>
          )}

          {!compact && (
            <div className={`flex gap-2 overflow-x-auto ${SCROLLBAR_HIDDEN}`} role="tablist" aria-label="Chế độ học">
              <button role="tab" aria-selected={view === "subtitles"} onClick={() => setView("subtitles")} className={tab(view === "subtitles")}>
                <Captions className="w-4 h-4" /> Phụ đề
              </button>
              {/* The microphone check only exists on the phone (the line under the tabs says so elsewhere) */}
              {canShadow && (
                <button role="tab" aria-selected={view === "shadow"} onClick={() => setView("shadow")} className={tab(view === "shadow")}>
                  <Mic className="w-4 h-4" /> Shadowing
                </button>
              )}
              <button role="tab" aria-selected={view === "dictation"} onClick={() => setView("dictation")} className={tab(view === "dictation")}>
                <Keyboard className="w-4 h-4" /> Chính tả
              </button>
              <button role="tab" aria-selected={view === "cloze"} onClick={() => setView("cloze")} className={tab(view === "cloze")}>
                <TextCursorInput className="w-4 h-4" /> Điền từ
              </button>
            </div>
          )}
          {!compact && (
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              {view === "subtitles"
                ? "Chạm một câu để nghe lại. Bật \"Cuộn theo\" để danh sách tự chạy theo video."
                : view === "shadow"
                  ? "Shadowing: nghe một câu rồi đọc theo, máy chấm từng từ."
                  : view === "dictation"
                    ? "Chính tả: nghe rồi gõ lại cả câu."
                    : "Điền từ: điền các từ còn thiếu trong câu."}
              {!canShadow && ` ${speechUnavailableText()}`}
            </p>
          )}

          {/* Tools: square buttons and a fold button; the row scrolls sideways when the screen is narrow. Only for the
              subtitles: the practice tabs have their own controls on their card. */}
          <div className={`${view !== "subtitles" ? "hidden" : "flex"} items-center gap-2 overflow-x-auto pb-0.5 -mx-3 px-3 md:mx-0 md:px-0 ${SCROLLBAR_HIDDEN}`}>
            <button onClick={() => setFontOpen(true)} className={`${tool(fontOpen)} w-11`} aria-haspopup="dialog" aria-label="Cỡ chữ" title="Cỡ chữ">
              <Type className="w-4 h-4" />
            </button>
            {/* Lit: the list follows the sentence being played. Dim: it stays where the learner scrolls it. */}
            <button
              onClick={() => setFollow((v) => !v)}
              className={`${tool(follow)} px-3`}
              aria-pressed={follow}
              aria-label={follow ? "Đang tự cuộn theo câu đang phát. Bấm để cuộn thủ công" : "Đang cuộn thủ công. Bấm để tự cuộn theo câu đang phát"}
              title={follow ? "Tự cuộn theo câu đang phát" : "Cuộn thủ công"}
            >
              <RefreshCw className="w-4 h-4" /> Cuộn theo
            </button>
            {hasVi && (
              <button onClick={() => setShowVi((v) => !v)} className={`${tool(showVi)} w-11`} aria-pressed={showVi} aria-label="Nghĩa tiếng Việt" title="Nghĩa tiếng Việt">
                <Languages className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setCaptions((v) => !v)} className={`${tool(captions)} w-11`} aria-pressed={captions} aria-label="Phụ đề trên video" title="Phụ đề trên video">
              <Subtitles className="w-4 h-4" />
            </button>
            {divider}
            <button
              onClick={() => setCompact((v) => !v)}
              className={`${tool(false)} w-11`}
              aria-pressed={compact}
              aria-label={compact ? "Hiện tiêu đề và tab" : "Ẩn tiêu đề và tab"}
              title={compact ? "Hiện tiêu đề và tab" : "Ẩn tiêu đề và tab, giữ video"}
            >
              {compact ? <ChevronsUpDown className="w-4 h-4" /> : <ChevronsDownUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="relative flex-1 min-h-0 overflow-y-auto px-2 md:px-0 pt-2 pb-3 space-y-0.5">
        {view === "shadow" && seg && (
          <ShadowCard
            seg={seg}
            index={index}
            total={segments.length}
            fontScale={fontScale}
            getTime={getTime}
            showIpa={showIpa}
            onToggleIpa={() => setShowIpa((v) => !v)}
            speed={speed}
            onSpeed={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            loop={loop}
            onLoop={() => setLoop((v) => !v)}
            onPlay={() => play(index)}
            onNext={() => play(Math.min(segments.length - 1, index + 1))}
            onStartRecording={() => player.current?.pauseVideo()}
            onWord={(w) => openWord(w, index)}
          />
        )}
        {view === "dictation" && seg && (
          <DictationCard key={index} sentence={seg} index={index} total={segments.length} bar={practiceBar} onNext={goNext} onDone={() => markDone("dictation", index)} />
        )}
        {view === "cloze" && seg && (
          <ClozeCard
            key={index}
            sentence={seg}
            index={index}
            total={segments.length}
            bar={practiceBar}
            unlearned={unlearned}
            fontScale={fontScale}
            onNext={goNext}
            onDone={() => markDone("cloze", index)}
          />
        )}
        {segments.map((s, i) => {
          const active = i === index;
          // In the typing exercises a sentence shows its text only once it has been answered
          const hidden = (view === "dictation" && !doneDictation.has(i)) || (view === "cloze" && !doneCloze.has(i));
          return (
            <div
              key={i}
              data-i={i}
              role="button"
              tabIndex={0}
              onClick={() => {
                // Selecting words to copy ends with a click: that must not restart the sentence
                if (window.getSelection()?.toString()) return;
                play(i);
              }}
              onKeyDown={(e) => {
                // Only the row itself: Enter or Space on a button inside it (the microphone) belongs to that button
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  play(i);
                }
              }}
              className={`relative flex gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition-colors ${
                active ? "border-teal-600/40 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-400/10" : "border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/60 motion-reduce:transition-none"
              }`}
            >
              {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full bg-teal-700 dark:bg-teal-500" aria-hidden="true" />}
              <span
                className={`w-11 shrink-0 pt-1 text-[13px] tabular-nums ${active ? "font-semibold text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-zinc-400"}`}
                style={{ fontFamily: SENTENCE_FONT.fontFamily }}
              >
                {clock(s.start)}
              </span>
              <div className="min-w-0 flex-1">
                {hidden ? (
                  <SkeletonText words={countWords(s.text)} seed={i} />
                ) : (
                  <>
                    <p
                      className={`leading-[1.55] ${active ? "font-medium text-slate-900 dark:text-zinc-100" : "font-normal text-slate-700 dark:text-zinc-200"}`}
                      style={{ ...SENTENCE_FONT, fontSize: SENTENCE_PX * fontScale }}
                    >
                      {active && s.words ? (
                        <KaraokeText key={i} words={s.words} getTime={getTime} tone="card" unlearned={unlearned} onWord={(w) => openWord(w, i)} />
                      ) : (
                        <PlainSentence text={s.text} unlearned={unlearned} onWord={(w) => openWord(w, i)} />
                      )}
                    </p>
                    {showVi && s.vi && (
                      <p
                        className="mt-1.5 leading-[1.5] font-normal text-slate-500 dark:text-zinc-400"
                        style={{ ...SENTENCE_FONT, fontSize: MEANING_PX * fontScale }}
                      >
                        {s.vi}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {fontOpen && <FontSheet index={fontIdx} onPick={pickFont} onClose={closeFont} />}
      {lookup && (
        <WordSheet
          raw={lookup.raw}
          sentence={segments[lookup.index].text}
          fontFamily={SENTENCE_FONT.fontFamily}
          onSaved={reloadBank}
          onClose={closeLookup}
        />
      )}
    </div>
  );
}

export default function ShadowingTab({ resetKey }: { resetKey?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<ShadowingLesson | null>(null);
  const [failed, setFailed] = useState(false);
  // The lessons in the app plus the ones downloaded since (a few new ones each day)
  const [downloaded, setDownloaded] = useState<ShadowingEntry[]>([]);
  useEffect(() => {
    const load = () => void getFeedEntries().then(setDownloaded);
    load();
    window.addEventListener(FEED_EVENT, load);
    return () => window.removeEventListener(FEED_EVENT, load);
  }, []);
  const entries = useMemo(() => {
    const have = new Set(ENTRIES.map((e) => e.id));
    return [...ENTRIES, ...downloaded.filter((e) => !have.has(e.id))];
  }, [downloaded]);
  const levels = useMemo(() => [...new Set(entries.map((e) => e.level))].sort(), [entries]);
  const [level, setLevel] = useState(levels[0] ?? "A1");

  // Tapping the tab again returns to the list
  useEffect(() => {
    setOpenId(null);
  }, [resetKey]);

  // A lesson is only loaded when it is opened: the list needs just the small index
  useEffect(() => {
    setLesson(null);
    setFailed(false);
    if (!openId) return;
    let dead = false;
    loadLesson(openId)
      .then((l) => !dead && setLesson(l))
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
    };
  }, [openId]);

  // The lessons of the level, in the order of their topic: the topics as they first appear, "Bài khác" last
  const groups = useMemo(() => {
    const byGroup = new Map<string, ShadowingEntry[]>();
    for (const e of entries.filter((x) => x.level === level)) {
      const name = e.group || OTHER_GROUP;
      byGroup.set(name, [...(byGroup.get(name) ?? []), e]);
    }
    return [...byGroup.entries()].sort(([a], [b]) => Number(a === OTHER_GROUP) - Number(b === OTHER_GROUP));
  }, [level, entries]);

  if (openId && lesson) return <Lesson key={lesson.id} lesson={lesson} onBack={() => setOpenId(null)} />;

  if (openId) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-3xl mx-auto space-y-4">
          <button onClick={() => setOpenId(null)} className="w-11 h-11 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700" aria-label="Danh sách">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {failed ? (
            <p className="text-sm text-red-600 dark:text-red-400">Không mở được bài này. Quay lại và thử lại nhé.</p>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang mở bài…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CONTAINER}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Shadowing</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Xem video, bấm vào câu nào là video nhảy tới câu đó, nghe rồi nói theo.</p>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Có 4 cách học: Phụ đề (xem), Shadowing (nghe rồi đọc theo), Chính tả (nghe rồi gõ lại), Điền từ (điền từ còn thiếu).</p>
        </div>

        {entries.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có video nào.</p>}

        {levels.length > 0 && <p className="text-sm text-slate-500 dark:text-zinc-400 -mb-2">Cấp độ: A1 dễ → C2 khó.</p>}
        {levels.length > 0 && (
          <div className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 ${SCROLLBAR_HIDDEN}`} role="tablist" aria-label="Cấp độ">
            {levels.map((l) => {
              const on = l === level;
              return (
                <button
                  key={l}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setLevel(l)}
                  className={`shrink-0 px-4 min-h-10 rounded-full text-sm font-semibold border transition-colors ${
                    on
                      ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                      : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {l}
                  <span className={`ml-1.5 text-xs font-normal ${on ? "text-teal-50" : "text-slate-500 dark:text-zinc-400"}`}>
                    {entries.filter((e) => e.level === l).length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {groups.map(([name, items]) => (
          <section key={name} className="space-y-2">
            <h3 className="pt-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
              {name}
              <span className="ml-2 font-normal text-slate-500 dark:text-zinc-400">{items.length} bài</span>
            </h3>
            {items.map((l) => (
              <button
                key={l.id}
                onClick={() => setOpenId(l.id)}
                className="w-full flex gap-3 items-center text-left p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-teal-600/50"
              >
                <img
                  src={`https://i.ytimg.com/vi/${l.youtubeId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="w-28 sm:w-32 aspect-video rounded-xl object-cover bg-slate-200 dark:bg-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-zinc-100 line-clamp-2">{l.title}</div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    {l.level} · {Math.max(1, Math.round(l.duration / 60))} phút · {l.count} câu
                  </div>
                </div>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
