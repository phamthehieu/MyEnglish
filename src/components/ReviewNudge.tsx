import { useCallback, useEffect, useRef, useState } from "react";
import { logLearningEvent } from "@/services/learningEvents";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Clock, Play, Zap, Flame, Check, X, Sparkles, Crosshair, Ear, Volume2 } from "lucide-react";
import { getFocusSettings } from "@/services/focusSettings";
import {
  buildNudgePayload,
  hideReviewNudge,
  NUDGE_AUTO_OPEN_SECONDS,
  resetIgnoredNudges,
  snoozeIgnoredNudge,
  snoozeReminder,
  startFocusFromReminder,
  triggerReviewPopup,
  type ReviewNudgePayload,
} from "@/services/reminderSettings";
import {
  evaluateMicroQuizAnswer,
  type MicroQuizEvaluationResult,
} from "@/services/duoMotivation";
import { playSound } from "@/services/sound";
import { selectMicroPhonemeQuiz, type MicroPhonemeQuizQuestion } from "@/services/phonemeMatcher";
import { handleSpeak } from "./review/speech";

interface ReviewNudgeProps {
  /** Browser preview only: called after an action instead of hiding a native window */
  onDone?: () => void;
  inApp?: boolean;
  initialPayload?: ReviewNudgePayload;
}

// Each tick asks Rust whether the cursor is over the card: twice a second is enough to pause the countdown
const TICK_MS = 500;
const QUIZ_COUNTDOWN_SECONDS = 30;
/** After a wrong quick answer the card stays up to show the right one, then closes by itself (N13) */
const WRONG_ANSWER_CLOSE_MS = 60 * 1000;

export default function ReviewNudge({ onDone, inApp, initialPayload }: ReviewNudgeProps) {
  const [payload, setPayload] = useState<ReviewNudgePayload>(() => initialPayload || buildNudgePayload(0));
  const [mode, setMode] = useState<"nudge" | "quiz" | "phoneme">("nudge");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Length of the countdown that is running (the nudge and the quiz wait different times)
  const [countdownTotal, setCountdownTotal] = useState(NUDGE_AUTO_OPEN_SECONDS);
  const [animationKey, setAnimationKey] = useState(0);

  // Micro-Quiz state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<MicroQuizEvaluationResult | null>(null);
  const quizStartTimeRef = useRef(0);

  // Phoneme Discrimination Quiz state
  const [phonemeQuiz, setPhonemeQuiz] = useState<MicroPhonemeQuizQuestion | null>(null);
  const [selectedPhonemeOptId, setSelectedPhonemeOptId] = useState<string | null>(null);
  const [phonemeResult, setPhonemeResult] = useState<{ isCorrect: boolean } | null>(null);

  // Browser-preview fallback only: > 0 while the pointer is over the card
  const hoverAtRef = useRef(0);
  const deadlineRef = useRef(0);
  const lastTickRef = useRef(0);
  const actedRef = useRef(false);
  // Closes the card a moment after a quick answer: a newer reminder must not be closed by an older answer's timer
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearCloseTimer, [clearCloseTimer]);
  // Counts the reminders shown: an answer evaluated for an earlier one must not close the current one
  const beginSeqRef = useRef(0);
  const lastNudgeIdRef = useRef<number | null>(null);
  const [freshBar, setFreshBar] = useState(false);

  const begin = useCallback((next: ReviewNudgePayload & { nudgeId?: number }) => {
    if (next.nudgeId !== undefined) {
      if (next.nudgeId === lastNudgeIdRef.current) return;
      lastNudgeIdRef.current = next.nudgeId;
    }
    clearCloseTimer();
    beginSeqRef.current++;
    actedRef.current = false;
    hoverAtRef.current = 0;
    deadlineRef.current = Date.now() + next.autoOpenSeconds * 1000;
    lastTickRef.current = Date.now();
    setPayload(next);
    setSecondsLeft(next.autoOpenSeconds);
    setCountdownTotal(next.autoOpenSeconds);
    logLearningEvent("nudge_shown", { meta: { dueCount: next.dueCount, quiz: !!next.microQuiz, moment: next.moment ?? null } });
    setFreshBar(true);
    setAnimationKey((k) => k + 1);

    // Reset quiz state
    setSelectedOptionId(null);
    setQuizResult(null);

    // Reset phoneme state
    setSelectedPhonemeOptId(null);
    setPhonemeResult(null);

    // If algorithm prefers micro-quiz and question exists, switch directly to quiz
    if (next.microQuiz && next.motivation?.isMicroQuizPreferred) {
      setMode("quiz");
      const duration = Math.max(next.autoOpenSeconds, QUIZ_COUNTDOWN_SECONDS);
      deadlineRef.current = Date.now() + duration * 1000;
      setSecondsLeft(duration);
      setCountdownTotal(duration);
      // Opened by itself: the answer time starts when the learner reaches the card (first hover), not when
      // it appeared while they were busy elsewhere, or a correct answer would be graded slow (Hard)
      quizStartTimeRef.current = 0;
    } else {
      setMode("nudge");
    }
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!freshBar) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFreshBar(false)));
    return () => cancelAnimationFrame(id);
  }, [freshBar]);

  const finish = useCallback(
    async (action: "start" | "focus" | "snooze" | "timeout" | "quiz-done") => {
      if (actedRef.current) return;
      actedRef.current = true;
      hoverAtRef.current = 0;
      setSecondsLeft(null);

      logLearningEvent(
        action === "timeout" ? "nudge_ignored" : action === "snooze" ? "nudge_snoozed" : action === "quiz-done" ? "nudge_quiz" : "nudge_opened",
        action === "focus" ? { meta: { focus: true } } : {}
      );
      if (action === "timeout") {
        snoozeIgnoredNudge();
        await hideReviewNudge();
      } else if (action === "snooze") {
        resetIgnoredNudges();
        snoozeReminder();
        await hideReviewNudge();
      } else if (action === "quiz-done") {
        resetIgnoredNudges();
        await hideReviewNudge();
      } else if (action === "focus") {
        // A focus session in the main window (not the popup): the whole window, the clock, no reminders
        resetIgnoredNudges();
        await hideReviewNudge();
        await startFocusFromReminder(getFocusSettings().minutes);
      } else {
        resetIgnoredNudges();
        await hideReviewNudge();
        await triggerReviewPopup();
      }
      onDone?.();
    },
    [onDone]
  );

  // Load phoneme challenge in background
  useEffect(() => {
    selectMicroPhonemeQuiz()
      .then((q) => {
        if (q) setPhonemeQuiz(q);
      })
      .catch(() => {});
  }, []);

  // Switch to phoneme quiz mode
  const switchToPhoneme = () => {
    if (actedRef.current || !phonemeQuiz) return;
    setMode("phoneme");
    setSecondsLeft(QUIZ_COUNTDOWN_SECONDS);
    setCountdownTotal(QUIZ_COUNTDOWN_SECONDS);
    deadlineRef.current = Date.now() + QUIZ_COUNTDOWN_SECONDS * 1000;
    setSelectedPhonemeOptId(null);
    setPhonemeResult(null);
    handleSpeak(phonemeQuiz.spokenWord);
  };

  const handleAnswerPhoneme = (optId: string, isCorrect: boolean) => {
    if (!phonemeQuiz || selectedPhonemeOptId !== null) return;
    setSelectedPhonemeOptId(optId);
    setSecondsLeft(null);
    setPhonemeResult({ isCorrect });
    playSound(isCorrect ? "correct" : "wrong");

    logLearningEvent("nudge_quiz", {
      meta: { pairId: phonemeQuiz.pairId, word: phonemeQuiz.spokenWord, isCorrect, phoneme: true },
    });

    if (isCorrect) {
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        finish("quiz-done");
      }, 1800);
    }
  };

  // Switch to quiz mode manually
  const switchToQuiz = () => {
    if (actedRef.current) return;
    if (payload.microQuiz) {
      setMode("quiz");
      quizStartTimeRef.current = Date.now();
      // Give more time for answering
      setSecondsLeft(QUIZ_COUNTDOWN_SECONDS);
      setCountdownTotal(QUIZ_COUNTDOWN_SECONDS);
      deadlineRef.current = Date.now() + QUIZ_COUNTDOWN_SECONDS * 1000;
    }
  };

  // Handle answering Micro-Quiz
  const handleAnswerQuiz = async (optionId: string) => {
    if (!payload.microQuiz || selectedOptionId !== null) return;
    setSelectedOptionId(optionId);
    // Answered (right or wrong): the countdown stops now, so a fast answer is never counted as ignored (N14)
    setSecondsLeft(null);
    const responseTime = Date.now() - (quizStartTimeRef.current || Date.now());
    const shownSeq = beginSeqRef.current;
    // The answer tone plays at the click (a single question: no combo)
    playSound(payload.microQuiz.options.find((o) => o.id === optionId)?.isCorrect ? "correct" : "wrong");

    try {
      const res = await evaluateMicroQuizAnswer({
        wordId: payload.microQuiz.wordId,
        selectedChoiceId: optionId,
        options: payload.microQuiz.options,
        targetMeaning: payload.microQuiz.targetMeaning,
        responseTimeMs: responseTime,
        direction: payload.microQuiz.direction,
        scheduledQuestion: payload.microQuiz.scheduled,
      });
      if (shownSeq !== beginSeqRef.current) return; // another reminder replaced this one meanwhile
      setQuizResult(res);

      // A right answer dismisses itself after a brief celebration; a wrong one stays on screen
      // until the learner has read the right one and closes the card
      if (res.isCorrect) {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null;
          finish("quiz-done");
        }, 1800);
      }
    } catch (err) {
      console.warn("Error evaluating micro quiz answer:", err);
      if (shownSeq !== beginSeqRef.current) return;
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        finish("quiz-done");
      }, 1500);
    }
  };

  // A wrong answer left on screen closes after a while: counted as closed, not as an ignored card (N13)
  useEffect(() => {
    if (!quizResult || quizResult.isCorrect) return;
    const timer = setTimeout(() => finish("quiz-done"), WRONG_ANSWER_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [quizResult, finish]);

  // Keys (1, 2, 3 for the quiz; Enter to start; Esc to snooze) only reach the browser preview: the native
  // card never takes keyboard focus, so no key hints are shown (N13)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "quiz" && quizResult && !quizResult.isCorrect) {
        if (e.key === "Enter" || e.key === "Escape") finish("quiz-done");
      } else if (mode === "quiz" && payload.microQuiz && selectedOptionId === null) {
        if (e.key === "1" && payload.microQuiz.options[0]) {
          handleAnswerQuiz(payload.microQuiz.options[0].id);
        } else if (e.key === "2" && payload.microQuiz.options[1]) {
          handleAnswerQuiz(payload.microQuiz.options[1].id);
        } else if (e.key === "3" && payload.microQuiz.options[2]) {
          handleAnswerQuiz(payload.microQuiz.options[2].id);
        }
      } else if (mode === "phoneme" && phonemeQuiz && selectedPhonemeOptId === null) {
        if (e.key === "1" && phonemeQuiz.options[0]) {
          handleAnswerPhoneme(phonemeQuiz.options[0].id, phonemeQuiz.options[0].isCorrect);
        } else if (e.key === "2" && phonemeQuiz.options[1]) {
          handleAnswerPhoneme(phonemeQuiz.options[1].id, phonemeQuiz.options[1].isCorrect);
        } else if (e.key === " ") {
          handleSpeak(phonemeQuiz.spokenWord);
        }
      } else if (mode === "phoneme" && phonemeResult && !phonemeResult.isCorrect) {
        if (e.key === "Enter" || e.key === "Escape") finish("quiz-done");
      } else if (mode === "nudge") {
        if (e.key === "Enter") {
          finish("start");
        } else if (e.key.toLowerCase() === "f") {
          finish("focus");
        } else if (e.key === "Escape") {
          finish("snooze");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, payload.microQuiz, selectedOptionId, quizResult, finish]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    listen<ReviewNudgePayload>("review-nudge-opened", (event) => {
      if (!cancelled && event.payload) begin(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});

    if ("__TAURI_INTERNALS__" in window) {
      invoke<(ReviewNudgePayload & { nudgeId?: number }) | null>("take_review_nudge_payload")
        .then((pending) => {
          if (!cancelled && pending) begin(pending);
        })
        .catch(() => {});
    }

    if (!("__TAURI_INTERNALS__" in window) && !initialPayload) begin(buildNudgePayload(5));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [begin, initialPayload]);

  useEffect(() => {
    if (initialPayload) begin(initialPayload);
  }, [initialPayload, begin]);

  const running = secondsLeft !== null;
  useEffect(() => {
    if (!running) return;
    const native = "__TAURI_INTERNALS__" in window;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        let hovered: boolean;
        if (native) {
          hovered = await invoke<boolean>("is_cursor_over_nudge").catch(() => hoverAtRef.current > 0);
        } else {
          hovered = hoverAtRef.current > 0;
        }
        if (actedRef.current) return;
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;
        if (hovered) {
          deadlineRef.current += elapsed;
          return;
        }
        const left = Math.max(0, Math.ceil((deadlineRef.current - now) / 1000));
        setSecondsLeft((s) => (s === null || s === left ? s : left));
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) finish("timeout");
  }, [secondsLeft, finish]);

  const progress = secondsLeft === null ? 0 : secondsLeft / countdownTotal;

  // Mascot styling based on Duo emotion
  const mood = payload.motivation?.mascotMood || "happy";
  const renderMascot = () => {
    switch (mood) {
      case "alarm":
        return (
          <span className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm">
            <Flame className="w-4 h-4 fill-white" />
          </span>
        );
      // Pleading / wilting faces made a skipped reminder feel like a failure: every other mood is the owl
      default:
        return (
          <span className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-sm text-base">
            🦉
          </span>
        );
    }
  };

  const title = payload.motivation?.title || "Đến giờ ôn tập";
  const message =
    payload.motivation?.message ||
    (payload.dueCount > 0
      ? `${payload.dueCount} từ đến hạn · ${payload.sessionSize} câu · ~${payload.estimatedMinutes} phút`
      : `Ôn nhanh ${payload.sessionSize} câu · ~${payload.estimatedMinutes} phút`);

  return (
    <div className={inApp ? "w-full select-none font-sans" : "w-screen h-screen flex items-start justify-end p-1.5 bg-transparent select-none font-sans"}>
      <div
        key={animationKey}
        className="nudge-enter w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col justify-between"
        onMouseEnter={() => {
          hoverAtRef.current = Date.now();
          if (quizStartTimeRef.current === 0) quizStartTimeRef.current = Date.now();
        }}
        onMouseLeave={() => (hoverAtRef.current = 0)}
      >
        {mode === "nudge" ? (
          /* ─── MODE 1: DUO MOTIVATION PROMPT ─── */
          <div className="p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              {renderMascot()}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
                    {title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {secondsLeft !== null && (
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 tabular-nums">
                        {secondsLeft}s
                      </span>
                    )}
                    <button
                      onClick={() => finish("snooze")}
                      className="min-w-10 min-h-10 -m-2 inline-flex items-center justify-center text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded transition-colors"
                      aria-label="Đóng"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 mt-0.5 leading-snug">
                  {message}
                </div>
              </div>
            </div>

            {/* One main action; the quick question next to it when there is one; the rest as small links */}
            <div className="flex items-center gap-2 pt-0.5" role="group" aria-label="Nhắc ôn tập">
              <button
                onClick={() => finish("start")}
                aria-label="Học ngay"
                title="Học ngay (Enter)"
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-3 min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 !text-white text-[13px] font-bold shadow-sm whitespace-nowrap transition-all active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 fill-white shrink-0" />
                Học ngay
              </button>
              {payload.microQuiz ? (
                <button
                  onClick={switchToQuiz}
                  aria-label="Trả lời 1 câu nhanh"
                  title="Trả lời 1 câu ngay tại đây, không mở app"
                  className="shrink-0 inline-flex items-center gap-1 px-3 min-h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[13px] font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500 shrink-0" />
                  1 câu
                </button>
              ) : null}
              {phonemeQuiz ? (
                <button
                  onClick={switchToPhoneme}
                  aria-label="Luyện phân biệt âm"
                  title="Luyện phân biệt âm thanh nhanh ngay tại đây"
                  className="shrink-0 inline-flex items-center gap-1 px-3 min-h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-[13px] font-semibold whitespace-nowrap transition-all active:scale-[0.98]"
                >
                  <Ear className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  Luyện âm
                </button>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 -mt-0.5 text-xs whitespace-nowrap">
              <button
                onClick={() => finish("focus")}
                aria-label={`Phiên tập trung ${getFocusSettings().minutes} phút`}
                title="Mở app và học trọn vài phút, tắt nhắc nhở (phím F)"
                className="inline-flex items-center gap-1 px-2 min-h-10 rounded text-violet-700 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:underline font-medium"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Tập trung {getFocusSettings().minutes} phút
              </button>
              <button
                onClick={() => finish("snooze")}
                aria-label={`Hoãn nhắc ôn tập ${payload.snoozeMinutes} phút`}
                title="Hoãn (Esc)"
                className="inline-flex items-center gap-1 px-2 min-h-10 rounded text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:underline font-medium"
              >
                <Clock className="w-3.5 h-3.5" />
                Hoãn {payload.snoozeMinutes} phút
              </button>
            </div>
          </div>
        ) : mode === "quiz" ? (
          /* ─── MODE 2: INSTANT MICRO-QUIZ ─── */
          <div className="p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-indigo-500 text-indigo-500" />
                  1 câu nhanh
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {payload.microQuiz?.direction === "production" ? "Nhớ từ tiếng Anh" : "Chọn nghĩa đúng"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {secondsLeft !== null && (
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums font-mono">
                    {secondsLeft}s
                  </span>
                )}
                <button
                  onClick={() => finish("quiz-done")}
                  className="min-w-10 min-h-10 -m-2 inline-flex items-center justify-center text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Target Word Display */}
            {payload.microQuiz ? (
              <div className="flex flex-col gap-0.5">
                {payload.microQuiz.direction === "production" ? (
                  <div>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider">
                      Nghĩa tiếng Việt:
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug block line-clamp-2">
                      {payload.microQuiz.promptTitle || payload.microQuiz.targetMeaning}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {payload.microQuiz.promptTitle || payload.microQuiz.word}
                    </span>
                    {payload.microQuiz.phonetic && (
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                        {payload.microQuiz.phonetic}
                      </span>
                    )}
                    {payload.microQuiz.partOfSpeech && (
                      <span className="text-[11px] px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-medium">
                        {payload.microQuiz.partOfSpeech}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* 3 MCQ Options */}
            <div className="flex flex-col gap-1.5">
              {payload.microQuiz?.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                const isAnswered = selectedOptionId !== null;
                const isCorrect = opt.isCorrect;

                let btnStyle =
                  "border-slate-200 dark:border-zinc-700/80 bg-slate-50/80 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200";

                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle =
                      "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold";
                  } else if (isSelected && !isCorrect) {
                    btnStyle =
                      "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through opacity-90";
                  } else {
                    btnStyle = "border-transparent opacity-40 text-slate-400 dark:text-zinc-600";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    disabled={isAnswered}
                    onClick={() => handleAnswerQuiz(opt.id)}
                    className={`w-full min-h-10 flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-all text-left ${btnStyle} active:scale-98`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{opt.text}</span>
                    </div>
                    {isAnswered && isCorrect && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {isAnswered && isSelected && !isCorrect && (
                      <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quiz Result banner */}
            {quizResult && (
              <div
                className={`mt-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center justify-between animate-fade-in ${
                  quizResult.isCorrect
                    ? "bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-100/90 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {quizResult.isCorrect
                      ? quizResult.praise ?? `Chính xác! +${quizResult.xpEarned ?? 0} XP`
                      : `Đáp án: ${payload.microQuiz?.direction === "production" ? payload.microQuiz.word : quizResult.correctMeaning}. Từ này sẽ quay lại sớm để bạn ôn.`}
                  </span>
                </div>
                {!quizResult.isCorrect && (
                  <button
                    onClick={() => finish("quiz-done")}
                    className="shrink-0 ml-2 px-3 min-h-9 rounded bg-white/70 dark:bg-zinc-800/80 text-xs font-semibold hover:bg-white dark:hover:bg-zinc-700"
                  >
                    Đóng
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ─── MODE 3: RAPID PHONEME DISCRIMINATION ─── */
          <div className="p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Ear className="w-3 h-3 text-purple-500" />
                  Luyện phân biệt âm
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {phonemeQuiz?.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {secondsLeft !== null && (
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums font-mono">
                    {secondsLeft}s
                  </span>
                )}
                <button
                  onClick={() => finish("quiz-done")}
                  className="min-w-10 min-h-10 -m-2 inline-flex items-center justify-center text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Target Spoken Word */}
            {phonemeQuiz && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSpeak(phonemeQuiz.spokenWord)}
                    className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-sm"
                    title="Bấm để nghe lại"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-slate-800 dark:text-white block">
                      Nghe từ: "{phonemeQuiz.spokenWord}"
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Bạn nghe thấy âm nào dưới đây?
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2 Options */}
            <div className="flex flex-col gap-1.5">
              {phonemeQuiz?.options.map((opt) => {
                const isSelected = selectedPhonemeOptId === opt.id;
                const isAnswered = selectedPhonemeOptId !== null;
                const isCorrect = opt.isCorrect;

                let btnStyle =
                  "border-slate-200 dark:border-zinc-700/80 bg-slate-50/80 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200";

                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle =
                      "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold";
                  } else if (isSelected && !isCorrect) {
                    btnStyle =
                      "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through opacity-90";
                  } else {
                    btnStyle = "border-transparent opacity-40 text-slate-400 dark:text-zinc-600";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    disabled={isAnswered}
                    onClick={() => handleAnswerPhoneme(opt.id, opt.isCorrect)}
                    className={`w-full min-h-10 flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-all text-left ${btnStyle} active:scale-98`}
                  >
                    <span className="truncate">{opt.text}</span>
                    {isAnswered && isCorrect && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {isAnswered && isSelected && !isCorrect && (
                      <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Result banner */}
            {phonemeResult && (
              <div
                className={`mt-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center justify-between animate-fade-in ${
                  phonemeResult.isCorrect
                    ? "bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-100/90 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {phonemeResult.isCorrect
                      ? "Chính xác! Tai bạn nghe rất tốt +10 XP 🎯"
                      : phonemeQuiz?.explanation}
                  </span>
                </div>
                {!phonemeResult.isCorrect && (
                  <button
                    onClick={() => finish("quiz-done")}
                    className="shrink-0 ml-2 px-3 min-h-9 rounded bg-white/70 dark:bg-zinc-800/80 text-xs font-semibold hover:bg-white dark:hover:bg-zinc-700"
                  >
                    Đóng
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Countdown bar */}
        <div className="h-1.5 bg-slate-200 dark:bg-zinc-800 w-full overflow-hidden">
          <div
            className={`h-full ${
              mode === "quiz"
                ? "bg-indigo-500"
                : mode === "phoneme"
                ? "bg-purple-500"
                : "bg-emerald-500"
            } ${freshBar ? "" : "transition-[width] duration-500 ease-linear"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
