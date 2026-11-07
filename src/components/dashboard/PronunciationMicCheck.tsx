import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { AUTO_SPEAK_DELAY_MS, SPEAK_EVENT, stopSpeaking, waitForSpeechToEnd } from "../review/speech";
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
const PASS_ADVANCE_MS = 750;

const VERDICT_TONE: Record<Verdict["kind"], string> = {
  match: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300",
  focus_ok: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300",
  weak: "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  confused: "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
  unclear: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  silent: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
  error: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300",
};

/**
 * Record the word and let the recognizer say what it heard against the target and its minimal-pair confusables.
 * Hands-free: after the sample audio finishes speaking, the microphone opens automatically, grades when the
 * learner stops speaking, and automatically advances when pronounced accurately.
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
  const autoTimer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const passedRef = useRef(false);
  // Bumped when the word changes or the check goes away: a begin still getting ready then gives up
  const attempt = useRef(0);
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;
  const grammar = useRef<string[]>([]);
  const target = item.text;

  const canUseMic = asrAvailable() && canCheck(lesson, target);
  const confusables = isCheckableWord(target) ? confusablesFor(lesson, target) : [];
  const mates = isCheckableWord(target) ? focusMates(lesson, target) : [];
  const decoys = canUseMic ? decoysFor(lesson, target, [...confusables, ...mates]) : [];

  const finish = async () => {
    window.clearTimeout(timer.current);
    if (phaseRef.current !== "listening") return;
    phaseRef.current = "checking";
    setPhase("checking");
    const mine = attempt.current;
    const result = await finishListening(grammar.current);
    // Another word by now: this answer is not for it
    if (!alive.current || mine !== attempt.current) return;
    const next = judge(target, result, {
      level,
      mates,
      ipaTarget: item.ipa,
      ipaOf: (w) => ipaOf(lesson, w),
      focusLabel: focusLabel(lesson, item),
    });
    setVerdict(next);
    phaseRef.current = "idle";
    setPhase("idle");
    // What the machine heard is evidence like a quiz answer: it counts toward the sound's mastery
    if (next.kind === "match" || next.kind === "focus_ok" || next.kind === "weak" || next.kind === "confused") {
      recordMasteryAnswers([lesson.id], next.ok ? 1 : 0, 1, [target]);
    }
    if (next.ok && onPassedRef.current) {
      passedRef.current = true;
      playSound("correct");
      advanceTimer.current = window.setTimeout(() => onPassedRef.current?.(), PASS_ADVANCE_MS);
    } else if (next.kind === "confused" || next.kind === "weak") {
      playSound("wrong");
    }
  };

  const begin = async (automatic = false) => {
    if (passedRef.current || phaseRef.current !== "idle") return;
    window.clearTimeout(autoTimer.current);
    if (!automatic) {
      setVerdict(null);
      stopSpeaking();
    }
    setProblem(null);
    phaseRef.current = "preparing";
    setPhase("preparing");
    const mine = ++attempt.current;
    const failure = await prepareListening({ automatic });
    // The learner moved to another word (or left) while the microphone was getting ready: not for this one
    if (!alive.current || mine !== attempt.current || passedRef.current) {
      if (phaseRef.current === "preparing") {
        phaseRef.current = "idle";
        setPhase("idle");
      }
      return;
    }
    if (failure === "declined") {
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    if (failure) {
      setProblem(
        failure === "permission"
          ? micPermissionText()
          : "Chưa chuẩn bị được bộ nhận dạng giọng nói. Thử lại sau ít phút."
      );
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    // A word outside the recognizer's dictionary can never be heard: say so instead of failing every time
    const list = wordsInDictionary(buildGrammar(target, confusables, [...mates, ...decoys]));
    if (!list.includes(target.trim().toLowerCase())) {
      setProblem(`Bộ nhận dạng offline chưa biết từ "${target}", nên không chấm được từ này. Bạn tự chấm bên dưới nhé.`);
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    grammar.current = list;
    if (!startListening(finish)) {
      setProblem("Không bật được micro (có thể app khác đang dùng). Bấm micro để thử lại nhé.");
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    phaseRef.current = "listening";
    setPhase("listening");
    timer.current = window.setTimeout(finish, MAX_LISTEN_MS);
  };

  const beginRef = useRef(begin);
  beginRef.current = begin;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Another word: forget the last answer, stop listening if the learner moved on, and auto-open the mic once the sample finishes playing
  useEffect(() => {
    passedRef.current = false;
    phaseRef.current = "idle";
    setVerdict(null);
    setProblem(null);
    setPhase("idle");

    if (!canUseMic) return;

    const listenAfterSpeech = async (delayMs: number) => {
      const mine = ++attempt.current;
      await new Promise<void>((resolve) => {
        window.clearTimeout(autoTimer.current);
        autoTimer.current = window.setTimeout(resolve, delayMs);
      });
      if (!alive.current || mine !== attempt.current || passedRef.current) return;
      await waitForSpeechToEnd();
      if (!alive.current || mine !== attempt.current || passedRef.current) return;
      void beginRef.current(true);
    };

    void listenAfterSpeech(AUTO_SPEAK_DELAY_MS + 150);

    const onSpeak = () => {
      if (passedRef.current) return;
      attempt.current += 1;
      window.clearTimeout(timer.current);
      window.clearTimeout(autoTimer.current);
      cancelListening();
      if (phaseRef.current === "listening" || phaseRef.current === "preparing") {
        phaseRef.current = "idle";
        setPhase("idle");
      }
      void listenAfterSpeech(150);
    };

    window.addEventListener(SPEAK_EVENT, onSpeak);

    return () => {
      window.removeEventListener(SPEAK_EVENT, onSpeak);
      attempt.current += 1;
      window.clearTimeout(timer.current);
      window.clearTimeout(advanceTimer.current);
      window.clearTimeout(autoTimer.current);
      cancelListening();
    };
  }, [target, canUseMic]);

  if (!asrAvailable()) {
    return compact ? null : <p className="w-full pt-3 text-xs text-center text-slate-600 dark:text-zinc-400">{speechUnavailableText()}</p>;
  }
  if (!canCheck(lesson, target)) return null;

  const chooseLevel = (next: CheckLevel) => {
    setLevel(next);
    setCheckLevel(next);
    setVerdict(null);
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

  if (compact) {
    return (
      <div className="w-full space-y-2">
        {problem && <p className="text-xs text-center text-red-700 dark:text-red-300 px-2">{problem}</p>}
        {verdict && (
          <div className={`rounded-xl border px-3 py-2 text-xs space-y-1 shadow-2xs ${VERDICT_TONE[verdict.kind]}`} role="status">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold uppercase tracking-wide">
                {verdict.ok ? (onPassed ? "✓ Phát âm chuẩn · đang qua từ tiếp…" : "✓ Phát âm chuẩn") : "Chưa đạt · thử đọc lại"}
              </span>
              {(verdict.kind === "match" || verdict.kind === "focus_ok" || verdict.kind === "weak" || verdict.kind === "confused") && canPlayRecording() && (
                <button
                  type="button"
                  onClick={playRecording}
                  className="text-[11px] font-semibold underline underline-offset-2 inline-flex items-center gap-1 shrink-0 opacity-90 hover:opacity-100"
                >
                  <Volume2 className="w-3 h-3" /> Nghe lại giọng mình
                </button>
              )}
            </div>
            <p className="font-medium leading-snug">{verdict.message}</p>
          </div>
        )}
        {phase === "listening" ? (
          <button
            type="button"
            onClick={finish}
            className="w-full min-h-14 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-md ring-4 ring-red-500/20 animate-pulse motion-reduce:animate-none flex items-center justify-center gap-3 transition-all active:scale-98"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Square className="h-4 w-4 fill-white" />
            </span>
            <div className="text-left min-w-0 flex-1">
              <span className="block text-sm sm:text-base font-bold leading-tight truncate">
                Đang nghe… hãy đọc "{target}"
              </span>
              <span className="block text-[11px] text-red-100 leading-tight">
                Đọc xong máy tự chấm & qua từ (hoặc chạm để dừng)
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void begin(false)}
            disabled={phase !== "idle"}
            className={`w-full min-h-14 px-4 py-2.5 rounded-2xl text-white shadow-md flex items-center justify-center gap-3 transition-all active:scale-98 disabled:cursor-not-allowed ${
              phase === "idle"
                ? "bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 ring-4 ring-teal-500/15"
                : "bg-teal-600/70 dark:bg-teal-600/60"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              {phase === "idle" ? <Mic className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
            </span>
            <div className="text-left min-w-0 flex-1">
              <span className="block text-sm sm:text-base font-bold leading-tight truncate">
                {phase === "idle"
                  ? verdict && !verdict.ok
                    ? `Bấm để đọc lại "${target}"`
                    : `Bấm micro để đọc "${target}"`
                  : phase === "preparing"
                    ? "Đang bật micro…"
                    : "Đang chấm điểm…"}
              </span>
              {phase === "idle" && (
                <span className="block text-[11px] text-teal-100 leading-tight">
                  Đọc chuẩn máy sẽ tự động chuyển qua từ tiếp theo
                </span>
              )}
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 pt-3">
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
            <span className="block text-xs text-slate-500 dark:text-zinc-400">Đọc xong dừng lại máy sẽ tự chấm & qua từ</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void begin(false)}
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
                Đọc chuẩn máy sẽ tự chấm và chuyển sang từ tiếp theo
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
