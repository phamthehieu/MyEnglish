import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { stopSpeaking } from "../review/speech";
import {
  asrAvailable,
  buildGrammar,
  canCheck,
  cancelListening,
  confusablesFor,
  decoysFor,
  finishListening,
  focusLabel,
  focusMates,
  getCheckLevel,
  ipaOf,
  isCheckableWord,
  judge,
  MAX_LISTEN_MS,
  playRecording,
  prepareListening,
  setCheckLevel,
  startListening,
  wordsInDictionary,
  type CheckLevel,
  type Verdict,
} from "@/services/pronunciationCheck";

const VERDICT_TONE: Record<Verdict["kind"], string> = {
  match: "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300",
  focus_ok: "border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300",
  weak: "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
  confused: "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300",
  unclear: "border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  silent: "border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  error: "border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
};

/**
 * Android only: record the word and let the offline recognizer say what it heard. It is told the word and
 * the words it is mistaken for in this lesson (the minimal pairs), so "heard tree instead of three" is a
 * real answer. Not a score, and it never replaces the learner's own rating below.
 */
export function MicCheck({ lesson, item, compact = false }: { lesson: PronunciationLesson; item: PronunciationItem; compact?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [level, setLevel] = useState<CheckLevel>(getCheckLevel);
  const timer = useRef<number | undefined>(undefined);
  const grammar = useRef<string[]>([]);
  const target = item.text;

  // Another word: forget the last answer, and stop listening if the learner moved on
  useEffect(() => {
    setVerdict(null);
    setProblem(null);
    setPhase("idle");
    return () => {
      window.clearTimeout(timer.current);
      cancelListening();
    };
  }, [target]);

  // Any single word of the lesson can be tried (see canCheck). What the recognizer chooses between: the target,
  // what it is mistaken for, the words sharing the sound being learned (a pass at the medium level), and, when
  // that is too few, other words of the lesson so that it does not accept any sound as the target
  const confusables = isCheckableWord(target) ? confusablesFor(lesson, target) : [];
  const mates = isCheckableWord(target) ? focusMates(lesson, target) : [];
  if (!asrAvailable() || !canCheck(lesson, target)) return null;
  const decoys = decoysFor(lesson, target, [...confusables, ...mates]);

  const chooseLevel = (next: CheckLevel) => {
    setLevel(next);
    setCheckLevel(next);
    setVerdict(null);
  };

  const finish = async () => {
    window.clearTimeout(timer.current);
    setPhase("checking");
    const result = await finishListening(grammar.current);
    setVerdict(
      judge(target, result, {
        level,
        mates,
        ipaTarget: item.ipa,
        ipaOf: (w) => ipaOf(lesson, w),
        focusLabel: focusLabel(lesson, item),
      })
    );
    setPhase("idle");
  };

  const begin = async () => {
    setVerdict(null);
    setProblem(null);
    stopSpeaking();
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
    // A word outside the recognizer's dictionary can never be heard: say so instead of failing every time
    const list = wordsInDictionary(buildGrammar(target, confusables, [...mates, ...decoys]));
    if (!list.includes(target.trim().toLowerCase())) {
      setProblem(`Bộ nhận dạng offline chưa biết từ "${target}", nên không chấm được từ này. Bạn tự chấm bên dưới nhé.`);
      setPhase("idle");
      return;
    }
    grammar.current = list;
    if (!startListening()) {
      setProblem("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
      setPhase("idle");
      return;
    }
    setPhase("listening");
    timer.current = window.setTimeout(finish, MAX_LISTEN_MS);
  };

  const levelButton = (id: CheckLevel, label: string) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={level === id}
      onClick={() => chooseLevel(id)}
      disabled={phase !== "idle"}
      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
        level === id
          ? "bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 shadow-sm"
          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full space-y-2 pt-3">
      {!compact && (
        <div className="space-y-1">
          <div role="radiogroup" aria-label="Mức chấm" className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/70">
            {levelButton("focus", "Trung bình")}
            {levelButton("word", "Khó")}
          </div>
          <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400">
            {level === "focus"
              ? `Trung bình: đúng âm đang học${focusLabel(lesson, item) ? ` (${focusLabel(lesson, item)})` : ""} là đạt.`
              : "Khó: phải đúng cả từ, và máy nghe thật rõ."}
          </p>
        </div>
      )}
      {phase === "listening" ? (
        <button
          onClick={finish}
          className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 animate-pulse"
        >
          <Square className="w-4 h-4 fill-white" /> Đang nghe… đọc "{target}" rồi bấm để dừng
        </button>
      ) : (
        <button
          onClick={begin}
          disabled={phase !== "idle"}
          className="w-full py-2.5 rounded-xl border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-60 text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          {phase === "idle" ? (
            <>
              <Mic className="w-4 h-4" /> Đọc thử cho máy nghe
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang nghe lại…"}
            </>
          )}
        </button>
      )}
      {problem && <p className="text-xs text-rose-600 dark:text-rose-400">{problem}</p>}
      {verdict && (
        <div className={`rounded-xl border p-3 text-sm space-y-2 ${VERDICT_TONE[verdict.kind]}`} role="status">
          {(verdict.kind === "match" || verdict.kind === "focus_ok" || verdict.kind === "weak" || verdict.kind === "confused") && (
            <p className="text-xs font-bold uppercase tracking-wide">{verdict.ok ? "✓ Đạt" : "Chưa đạt"}</p>
          )}
          <p>{verdict.message}</p>
          {(verdict.kind === "match" || verdict.kind === "focus_ok" || verdict.kind === "weak" || verdict.kind === "confused") && (
            <button onClick={playRecording} className="text-xs font-semibold underline underline-offset-2 inline-flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
            </button>
          )}
        </div>
      )}
    </div>
  );
}
