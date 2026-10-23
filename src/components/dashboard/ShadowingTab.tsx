import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsRight, Gauge, Languages, Loader2, Mic, Pause, Play, Repeat, Square, Volume2 } from "lucide-react";
import { PAGE_CONTAINER } from "./shared";
import {
  asrAvailable,
  cancelListening,
  finishListening,
  playRecording,
  prepareListening,
  SILENCE_PEAK,
  startListening,
} from "@/services/pronunciationCheck";
import { checkSentence, type SentenceCheck, type WordStatus } from "@/services/sentenceCheck";

/** A video cut into sentences with their times (built by scripts/build-shadowing.mjs) */
interface ShadowingLesson {
  id: string;
  youtubeId: string;
  title: string;
  channel?: string;
  level: string;
  duration: number;
  segments: Array<{ start: number; end: number; text: string; vi?: string }>;
}

const LESSONS = Object.values(
  import.meta.glob("../../data/shadowing/*.json", { eager: true, import: "default" }) as Record<string, ShadowingLesson>
);

/** What happens when a sentence ends */
type Mode = "continue" | "stop" | "loop";
const MODES: Array<{ id: Mode; label: string; icon: typeof Play }> = [
  { id: "continue", label: "Liên tục", icon: ChevronsRight },
  { id: "stop", label: "Dừng sau câu", icon: Pause },
  { id: "loop", label: "Lặp câu", icon: Repeat },
];
const SPEEDS = [0.5, 0.75, 1, 1.25];
/** The captions run a little tight: start a hair early, end a hair late */
const LEAD = 0.25;
const TAIL = 0.3;

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

const WORD_TONE: Record<WordStatus, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  shaky: "text-amber-600 dark:text-amber-400",
  wrong: "text-rose-600 dark:text-rose-400 underline decoration-wavy underline-offset-4",
  missing: "text-rose-500 dark:text-rose-400 opacity-60 line-through",
  skip: "text-slate-700 dark:text-zinc-300",
};

/** Android only: read the sentence aloud and see, word by word, what the offline recognizer heard */
function SentenceReader({ text, seconds, onStart }: { text: string; seconds: number; onStart: () => void }) {
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [result, setResult] = useState<SentenceCheck | null>(null);
  const [problem, setProblem] = useState("");
  const timer = useRef<number | undefined>(undefined);

  // Another sentence: forget the last answer, and stop listening if the learner moved on
  useEffect(() => {
    setResult(null);
    setProblem("");
    setPhase("idle");
    return () => {
      window.clearTimeout(timer.current);
      cancelListening();
    };
  }, [text]);

  if (!asrAvailable()) return null;

  const finish = async () => {
    window.clearTimeout(timer.current);
    setPhase("checking");
    const heard = await finishListening([]);
    if (!heard.ok) setProblem("Máy chưa nghe được, thử lại nhé.");
    else if ((heard.peak ?? 0) < SILENCE_PEAK) setProblem("Không nghe thấy tiếng. Kiểm tra micro rồi thử lại.");
    else setResult(checkSentence(text, heard.words ?? []));
    setPhase("idle");
  };

  const begin = async () => {
    setResult(null);
    setProblem("");
    onStart();
    setPhase("preparing");
    const failure = await prepareListening();
    if (failure) {
      setProblem(
        failure === "permission"
          ? "Cần cho phép dùng micro: vào Cài đặt của máy, mục Ứng dụng, MyEnglish, Quyền, bật Micro."
          : "Chưa chuẩn bị được bộ nhận dạng giọng nói. Thử lại sau ít phút."
      );
      setPhase("idle");
      return;
    }
    if (!startListening()) {
      setProblem("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
      setPhase("idle");
      return;
    }
    setPhase("listening");
    // The sentence's own length plus time to start and stop, never more than the recorder keeps
    timer.current = window.setTimeout(finish, Math.min(14000, seconds * 1000 + 4000));
  };

  return (
    <div className="space-y-2">
      {phase === "listening" ? (
        <button onClick={finish} className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 animate-pulse">
          <Square className="w-4 h-4 fill-white" /> Đang nghe… đọc xong bấm để dừng
        </button>
      ) : (
        <button
          onClick={begin}
          disabled={phase !== "idle"}
          className="w-full py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-60 text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          {phase === "idle" ? (
            <>
              <Mic className="w-4 h-4" /> {result ? "Đọc lại" : "Đọc theo"}
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang chấm…"}
            </>
          )}
        </button>
      )}
      {problem && <p className="text-xs text-rose-600 dark:text-rose-400">{problem}</p>}
      {result && (
        <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2.5 space-y-1.5" role="status">
          <p className="text-base font-semibold leading-snug">
            {result.words.map((w, i) => (
              <span key={i} className={WORD_TONE[w.status]}>
                {w.text}{" "}
              </span>
            ))}
          </p>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            <b className="text-slate-900 dark:text-white">
              {result.clear}/{result.judged}
            </b>{" "}
            từ rõ
            {result.words.some((w) => w.status === "shaky") && " · cam: nghe được nhưng chưa rõ"}
          </p>
          {result.words
            .filter((w) => w.status === "wrong")
            .map((w, i) => (
              <p key={i} className="text-xs text-rose-600 dark:text-rose-400">
                "{w.text.replace(/[^\w'’-]/g, "")}" máy nghe thành "{w.heard}"
              </p>
            ))}
          {result.words.some((w) => w.status === "missing") && <p className="text-xs text-rose-600 dark:text-rose-400">Gạch ngang: chưa nghe thấy từ đó.</p>}
          <button onClick={playRecording} className="text-xs font-semibold text-slate-600 dark:text-zinc-300 underline underline-offset-2 inline-flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
          </button>
        </div>
      )}
    </div>
  );
}

function Lesson({ lesson, onBack }: { lesson: ShadowingLesson; onBack: () => void }) {
  const { segments } = lesson;
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("continue");
  const [speed, setSpeed] = useState(1);
  const [showVi, setShowVi] = useState(true);
  const hasVi = segments.some((s) => s.vi);
  // The poll below runs outside React: it reads these through refs
  const modeRef = useRef(mode);
  const indexRef = useRef(0);
  modeRef.current = mode;
  indexRef.current = index;
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
      p.seekTo(Math.max(0, seg.start - LEAD), true);
      p.playVideo();
    },
    [segments]
  );

  // Follow the video: move the highlight with the time, and stop or repeat at the end of a sentence
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const t = p.getCurrentTime();
      const cur = segments[indexRef.current];
      if (modeRef.current !== "continue" && cur && t >= cur.end + TAIL) {
        if (modeRef.current === "loop") p.seekTo(Math.max(0, cur.start - LEAD), true);
        else p.pauseVideo();
        return;
      }
      const at = segments.findIndex((s) => t >= s.start - 0.05 && t < s.end + 0.05);
      if (at >= 0 && at !== indexRef.current && modeRef.current === "continue") {
        indexRef.current = at;
        setIndex(at);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [ready, segments]);

  useEffect(() => {
    player.current?.setPlaybackRate(speed);
  }, [speed, ready]);

  // Keep the current sentence in view
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [index]);

  const seg = segments[index];
  const chip = (on: boolean) =>
    `py-1.5 px-2 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${on ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400"}`;
  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0];
  const ModeIcon = modeInfo.icon;

  // One screen, nothing scrolls but the sentence list: the video and its controls stay in view
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-3 md:p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 shrink-0" aria-label="Danh sách">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{lesson.title}</h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            {lesson.level} · {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2, "0")} · {segments.length} câu
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-4">
        <div className="shrink-0 min-w-0 space-y-2 lg:overflow-y-auto">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
            <div className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full" ref={host} />
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
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 space-y-2">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button onClick={() => play(Math.max(0, index - 1))} disabled={index === 0} className="p-2 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40" aria-label="Câu trước">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => play(index)} className="py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <Play className="w-4 h-4" /> Nghe câu
                <span className="text-xs font-normal text-violet-200 tabular-nums">
                  {index + 1}/{segments.length}
                </span>
              </button>
              <button onClick={() => play(Math.min(segments.length - 1, index + 1))} disabled={index >= segments.length - 1} className="p-2 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40" aria-label="Câu sau">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Each setting is one button that cycles through its values */}
            <div className={`grid gap-2 ${hasVi ? "grid-cols-3" : "grid-cols-2"}`}>
              <button onClick={() => setMode(MODES[(MODES.findIndex((m) => m.id === mode) + 1) % MODES.length].id)} className={chip(true)} aria-label="Chế độ khi hết câu">
                <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{modeInfo.label}</span>
              </button>
              <button onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} className={chip(true)} aria-label="Tốc độ phát">
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                {speed}×
              </button>
              {hasVi && (
                <button onClick={() => setShowVi((v) => !v)} className={chip(showVi)} aria-pressed={showVi}>
                  <Languages className="w-3.5 h-3.5 shrink-0" />
                  Nghĩa
                </button>
              )}
            </div>

            {seg && <SentenceReader text={seg.text} seconds={seg.end - seg.start} onStart={() => player.current?.pauseVideo()} />}

            {/* On a phone the highlighted line in the list already shows the sentence */}
            {seg && (
              <div className="hidden lg:block pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                <p className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{seg.text}</p>
                {showVi && seg.vi && <p className="text-sm text-slate-500 dark:text-zinc-400">{seg.vi}</p>}
              </div>
            )}
          </div>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 overflow-y-auto">
          {segments.map((s, i) => (
            <button
              key={i}
              data-i={i}
              onClick={() => play(i)}
              className={`w-full flex gap-2.5 text-left px-2.5 py-2 rounded-lg text-sm ${i === index ? "bg-violet-600 text-white" : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"}`}
            >
              <span className={`w-6 shrink-0 text-xs pt-0.5 ${i === index ? "text-violet-200" : "text-slate-400"}`}>{i + 1}</span>
              <span className="min-w-0">
                <span className="block">{s.text}</span>
                {showVi && s.vi && <span className={`block text-xs mt-0.5 ${i === index ? "text-violet-200" : "text-slate-400 dark:text-zinc-500"}`}>{s.vi}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShadowingTab({ resetKey }: { resetKey?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => setOpenId(null), [resetKey]);
  const lesson = LESSONS.find((l) => l.id === openId);
  if (lesson) return <Lesson key={lesson.id} lesson={lesson} onBack={() => setOpenId(null)} />;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Shadowing</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Xem video, bấm vào câu nào là video nhảy tới câu đó, nghe rồi nói theo.</p>
        </div>
        {LESSONS.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có video nào.</p>}
        <div className="space-y-2">
          {LESSONS.map((l) => (
            <button key={l.id} onClick={() => setOpenId(l.id)} className="w-full flex gap-3 items-center text-left p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-violet-400">
              <img src={`https://i.ytimg.com/vi/${l.youtubeId}/mqdefault.jpg`} alt="" className="w-32 aspect-video rounded-lg object-cover bg-slate-200 dark:bg-zinc-800 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">{l.title}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  {l.level} · {Math.floor(l.duration / 60)} phút · {l.segments.length} câu
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
