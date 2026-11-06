import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { stopSpeaking } from "../review/speech";
import { playSound } from "@/services/sound";
import { recordMasteryAnswers } from "@/services/pronunciationMastery";
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
  canPlayRecording,
  speechUnavailableText,
  micPermissionText,
} from "@/services/pronunciationCheck";

/** How long a pass stays on screen before the lesson moves on by itself */
const PASS_ADVANCE_MS = 1500;

const VERDICT_TONE: Record<Verdict["kind"], string> = {
  match: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300",
  focus_ok: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300",
  weak: "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
  confused: "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300",
  unclear: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  silent: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  error: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
};

/**
 * Android only: record the word and let the offline recognizer say what it heard. It is told the word and
 * the words it is mistaken for in this lesson (the minimal pairs), so "heard tree instead of three" is a
 * real answer. Not a score, and it never replaces the learner's own rating below.
 */
export function MicCheck({
  lesson,
  item,
  compact = false,
  onPassed,
}: {
  lesson: PronunciationLesson;
  item: PronunciationItem;
  compact?: boolean;
  /** Called a moment after a pass (the verdict stays on screen meanwhile): the lesson moves to the next word */
  onPassed?: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [level, setLevel] = useState<CheckLevel>(getCheckLevel);
  const timer = useRef<number | undefined>(undefined);
  const advanceTimer = useRef<number | undefined>(undefined);
  // Bumped when the word changes or the check goes away: a begin still getting ready then gives up
  const attempt = useRef(0);
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;
  const grammar = useRef<string[]>([]);
  const target = item.text;

  // Another word: forget the last answer, and stop listening if the learner moved on
  useEffect(() => {
    setVerdict(null);
    setProblem(null);
    setPhase("idle");
    return () => {
      attempt.current += 1;
      window.clearTimeout(timer.current);
      window.clearTimeout(advanceTimer.current);
      cancelListening();
    };
  }, [target]);

  // Any single word of the lesson can be tried (see canCheck). What the recognizer chooses between: the target,
  // what it is mistaken for, the words sharing the sound being learned (a pass at the medium level), and, when
  // that is too few, other words of the lesson so that it does not accept any sound as the target
  const confusables = isCheckableWord(target) ? confusablesFor(lesson, target) : [];
  const mates = isCheckableWord(target) ? focusMates(lesson, target) : [];
  if (!asrAvailable()) {
    return compact ? null : <p className="w-full pt-3 text-xs text-center text-slate-600 dark:text-zinc-400">{speechUnavailableText()}</p>;
  }
  if (!canCheck(lesson, target)) return null;
  const decoys = decoysFor(lesson, target, [...confusables, ...mates]);

  const chooseLevel = (next: CheckLevel) => {
    setLevel(next);
    setCheckLevel(next);
    setVerdict(null);
  };

  const finish = async () => {
    window.clearTimeout(timer.current);
    setPhase("checking");
    const mine = attempt.current;
    const result = await finishListening(grammar.current);
    // Another word by now: this answer is not for it
    if (mine !== attempt.current) return;
    const next = judge(target, result, {
      level,
      mates,
      ipaTarget: item.ipa,
      ipaOf: (w) => ipaOf(lesson, w),
      focusLabel: focusLabel(lesson, item),
    });
    setVerdict(next);
    setPhase("idle");
    // What the machine heard is evidence like a quiz answer: it counts toward the sound's mastery (a self-rating does
    // not). Silence, an error or nothing made out says nothing about the sound.
    if (next.kind === "match" || next.kind === "focus_ok" || next.kind === "weak" || next.kind === "confused") {
      recordMasteryAnswers([lesson.id], next.ok ? 1 : 0, 1, [target]);
    }
    if (next.ok && onPassedRef.current) {
      playSound("correct");
      advanceTimer.current = window.setTimeout(() => onPassedRef.current?.(), PASS_ADVANCE_MS);
    }
  };

  const begin = async () => {
    setVerdict(null);
    setProblem(null);
    stopSpeaking();
    setPhase("preparing");
    const mine = attempt.current;
    const failure = await prepareListening();
    // The learner moved to another word (or left) while the microphone was getting ready: not for this one
    if (mine !== attempt.current) return;
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
    // A word outside the recognizer's dictionary can never be heard: say so instead of failing every time
    const list = wordsInDictionary(buildGrammar(target, confusables, [...mates, ...decoys]));
    if (!list.includes(target.trim().toLowerCase())) {
      setProblem(`Bộ nhận dạng offline chưa biết từ "${target}", nên không chấm được từ này. Bạn tự chấm bên dưới nhé.`);
      setPhase("idle");
      return;
    }
    grammar.current = list;
    if (!startListening(finish)) {
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
      className={`flex-1 min-h-[40px] px-2 rounded-lg text-sm font-semibold transition-colors ${
        level === id
          ? "bg-white dark:bg-zinc-900 text-teal-800 dark:text-teal-300 shadow-sm"
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
          <p className="text-xs text-center text-slate-600 dark:text-zinc-400">
            {level === "focus"
              ? `Trung bình: đúng âm đang học${focusLabel(lesson, item) ? ` (${focusLabel(lesson, item)})` : ""} là đạt.`
              : "Khó: phải đọc đúng cả từ, và máy nghe thật rõ."}
          </p>
        </div>
      )}
      {phase === "listening" ? (
        <button
          type="button"
          onClick={finish}
          className="group mx-auto flex w-full flex-col items-center gap-2.5 rounded-2xl py-2 text-sm font-semibold"
        >
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-8 ring-red-500/20 animate-pulse group-hover:bg-red-700 motion-reduce:animate-none">
            <Square className="h-7 w-7 fill-white" />
          </span>
          <div className="text-center space-y-0.5">
            <span className="block text-base font-bold text-red-600 dark:text-red-400">Đang nghe… hãy đọc "{target}"</span>
            <span className="block text-xs text-slate-500 dark:text-zinc-400">Đọc xong dừng lại máy sẽ tự chấm (hoặc bấm để dừng)</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={begin}
          disabled={phase !== "idle"}
          className="group mx-auto flex w-full flex-col items-center gap-2.5 rounded-2xl py-2 text-sm font-semibold disabled:cursor-not-allowed"
        >
          <span
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all group-active:scale-95 ${
              phase === "idle"
                ? "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 ring-4 ring-teal-500/10"
                : "bg-teal-600/60 dark:bg-teal-500/60"
            }`}
          >
            {phase === "idle" ? <Mic className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
          </span>
          <div className="text-center space-y-0.5">
            <span className="block text-base font-bold text-teal-800 dark:text-teal-300">
              {phase === "idle" ? "Bấm micro để đọc" : phase === "preparing" ? "Đang chuẩn bị micro…" : "Đang chấm điểm…"}
            </span>
            {phase === "idle" && (
              <span className="block text-xs text-slate-500 dark:text-zinc-400">
                Đọc to từ trên cho máy nghe và chấm
              </span>
            )}
          </div>
        </button>
      )}
      {problem && <p className="text-sm text-red-700 dark:text-red-300">{problem}</p>}
      {verdict && (
        <div className={`rounded-xl border p-3.5 text-sm space-y-2 shadow-xs ${VERDICT_TONE[verdict.kind]}`} role="status">
          {(verdict.kind === "match" || verdict.kind === "focus_ok" || verdict.kind === "weak" || verdict.kind === "confused") && (
            <p className="text-xs font-bold uppercase tracking-wide">
              {verdict.ok ? (onPassed ? "✓ Phát âm chuẩn · đang chuyển từ…" : "✓ Phát âm chuẩn") : "Chưa đạt · thử đọc lại"}
            </p>
          )}
          <p className="font-medium">{verdict.message}</p>
          {(verdict.kind === "match" || verdict.kind === "focus_ok" || verdict.kind === "weak" || verdict.kind === "confused") && canPlayRecording() && (
            <button
              type="button"
              onClick={playRecording}
              className="min-h-9 text-xs font-semibold underline underline-offset-2 inline-flex items-center gap-1.5 opacity-90 hover:opacity-100"
            >
              <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
            </button>
          )}
        </div>
      )}
    </div>
  );
}
