import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Zap,
  Clock,
  Flame,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowDown,
  RotateCcw,
  Volume2,
  X,
  Sparkles,
} from "lucide-react";
import type { WordDetail } from "@/types/database";
import { getCatalogSample, type CatalogEntry } from "@/services/vocabCatalog";
import {
  REFLEX_CONFIG,
  generateReflexQuestions,
  calculateReflexXP,
  speedRating,
  recordReflexCompletion,
  WORD_CATEGORY_LABELS,
  type ReflexTier,
  type ReflexQuestion,
  type ReflexSummary,
  type ReflexAnswerRecord,
} from "@/services/reflexChallenge";
import { playSound } from "@/services/sound";
import { handleSpeak } from "@/components/review/speech";
import { cn } from "@/lib/utils";

interface ReflexChallengeModalProps {
  words: readonly WordDetail[];
  isOpen: boolean;
  onClose: () => void;
  onXPUpdated?: (earnedXP: number) => void;
}

type ModalPhase = "ready" | "playing" | "tier_transition" | "second_chance" | "game_over";

export default function ReflexChallengeModal({
  words,
  isOpen,
  onClose,
  onXPUpdated,
}: ReflexChallengeModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("ready");
  const phaseRef = useRef<ModalPhase>("ready");
  phaseRef.current = phase;

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [questions, setQuestions] = useState<ReflexQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(REFLEX_CONFIG.INITIAL_TIME_SECONDS);
  const [activeTier, setActiveTier] = useState<ReflexTier>(1);

  // Gameplay metrics
  const [comboStreak, setComboStreak] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongWords, setWrongWords] = useState<Array<{ word: string; meaning: string }>>([]);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const [secondChanceTier, setSecondChanceTier] = useState<ReflexTier | null>(null);
  const [tiersCleared, setTiersCleared] = useState(0);
  // The top-left X asks first: one stray tap must not end a run
  const [confirmExit, setConfirmExit] = useState(false);

  // Detailed answer records for post-game review
  const [answerRecords, setAnswerRecords] = useState<ReflexAnswerRecord[]>([]);

  // Response time tracking
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Input lock and feedback
  const [isLocked, setIsLocked] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [disabledOptionIndices, setDisabledOptionIndices] = useState<Set<number>>(new Set());
  const [wrongTrueFalse, setWrongTrueFalse] = useState<"SAI" | "ĐÚNG" | null>(null);
  const hasMistakeOnCurrentQRef = useRef(false);

  // Pending timeout ref to prevent transition race conditions
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load catalog for distractors/fallback on mount only when active word pool is small (< 40)
  useEffect(() => {
    if (words.length >= 40) return;
    getCatalogSample(60)
      .then((entries) => setCatalog(entries))
      .catch(() => {});
  }, [words.length]);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const wasOpenRef = useRef(false);

  // Initialize fresh session
  const initSession = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const deck = generateReflexQuestions(wordsRef.current, catalogRef.current);
    setQuestions(deck);
    setCurrentIdx(0);
    setTimeLeft(REFLEX_CONFIG.INITIAL_TIME_SECONDS);
    setActiveTier(1);
    setTiersCleared(0);
    setComboStreak(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setWrongCount(0);
    setWrongWords([]);
    setAnswerRecords([]);
    setDisabledOptionIndices(new Set());
    setWrongTrueFalse(null);
    hasMistakeOnCurrentQRef.current = false;
    setSecondChanceUsed(false);
    setSecondChanceTier(null);
    setResponseTimes([]);
    setFeedback(null);
    setSelectedOptionIdx(null);
    setIsLocked(false);
    setConfirmExit(false);
    setPhase("ready");
  }, []);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      initSession();
    } else if (!isOpen) {
      wasOpenRef.current = false;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    }
  }, [isOpen, initSession]);

  // Current question data
  const currentQ: ReflexQuestion | undefined = questions[currentIdx];

  // Tier progress (questions completed in current tier)
  const tierProgress = useMemo(() => {
    if (!currentQ) return { current: 0, target: 10 };
    if (activeTier === 1) {
      return { current: currentIdx, target: 10 };
    } else if (activeTier === 2) {
      return { current: currentIdx - 10, target: 12 };
    } else {
      return { current: currentIdx - 22, target: 15 };
    }
  }, [activeTier, currentIdx, currentQ]);

  // Game countdown timer loop (decrements only during "playing" phase)
  useEffect(() => {
    if (phase !== "playing") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        if (prev <= 12) {
          playSound("tick");
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // Synchronous phase trigger when time runs out:
  // Popup stays open permanently until user makes a decision (never auto disappears!)
  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setIsLocked(false);
      setFeedback(null);
      playSound("timeOut");
      if (!secondChanceUsed) {
        setPhase("second_chance");
      } else {
        setPhase("game_over");
      }
    }
  }, [timeLeft, phase, secondChanceUsed]);

  // Start actual game from ready screen
  const handleStartGame = () => {
    questionStartTimeRef.current = Date.now();
    setPhase("playing");
  };

  // Start next tier when user clicks the transition button (NO auto transition!)
  const handleStartNextTier = () => {
    const nextTier = (activeTier + 1) as ReflexTier;
    setActiveTier(nextTier);
    questionStartTimeRef.current = Date.now();
    setPhase("playing");
  };

  // Trigger answer grading
  const handleAnswer = (
    isCorrect: boolean,
    userAnswerText: string,
    correctAnswerText: string,
    chosenIdx?: number
  ) => {
    if (isLocked || phase !== "playing" || !currentQ) return;

    const responseTime = Date.now() - questionStartTimeRef.current;
    setResponseTimes((prev) => [...prev, responseTime]);

    if (chosenIdx !== undefined) {
      setSelectedOptionIdx(chosenIdx);
    }

    if (isCorrect) {
      playSound("correct");
      setFeedback("correct");

      // Only count as clean first-try correct if answered without prior mistake on this card
      if (!hasMistakeOnCurrentQRef.current) {
        setCorrectCount((c) => c + 1);

        const nextCombo = comboStreak + 1;
        setComboStreak(nextCombo);
        setMaxCombo((m) => Math.max(m, nextCombo));

        if (nextCombo > 0 && nextCombo % 5 === 0) {
          playSound("combo");
        }

        // Record clean answer
        const logItem: ReflexAnswerRecord = {
          questionId: currentQ.id,
          word: currentQ.word,
          phonetic: currentQ.phonetic,
          prompt: currentQ.prompt,
          type: currentQ.type,
          direction: currentQ.direction,
          category: currentQ.category,
          isCorrect: true,
          userAnswer: userAnswerText,
          correctAnswer: correctAnswerText,
          responseTimeMs: responseTime,
        };
        setAnswerRecords((prev) => [...prev, logItem]);
      }

      // Quick advance to next question
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setSelectedOptionIdx(null);
        setDisabledOptionIndices(new Set());
        setWrongTrueFalse(null);
        hasMistakeOnCurrentQRef.current = false;
        advanceQuestion();
      }, 160);
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setComboStreak(0);

      // Only register as mistake once per question
      if (!hasMistakeOnCurrentQRef.current) {
        hasMistakeOnCurrentQRef.current = true;
        setWrongCount((w) => w + 1);
        setWrongWords((list) => {
          if (list.some((item) => item.word === currentQ.word)) return list;
          return [...list, { word: currentQ.word, meaning: currentQ.targetMeaning }];
        });

        // Record mistake for end-of-game review
        const logItem: ReflexAnswerRecord = {
          questionId: currentQ.id,
          word: currentQ.word,
          phonetic: currentQ.phonetic,
          prompt: currentQ.prompt,
          type: currentQ.type,
          direction: currentQ.direction,
          category: currentQ.category,
          isCorrect: false,
          userAnswer: userAnswerText,
          correctAnswer: correctAnswerText,
          responseTimeMs: responseTime,
        };
        setAnswerRecords((prev) => [...prev, logItem]);
      }

      // Mark the wrong option so user cannot pick it again
      if (chosenIdx !== undefined) {
        setDisabledOptionIndices((prev) => new Set(prev).add(chosenIdx));
      } else if (userAnswerText === "SAI" || userAnswerText === "ĐÚNG") {
        setWrongTrueFalse(userAnswerText);
      }

      // Brief lock for 350ms to display red shake, then let user retry until they find the correct answer!
      setIsLocked(true);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setSelectedOptionIdx(null);
        setIsLocked(false);
        // DO NOT ADVANCE! User must pick the correct answer to proceed!
      }, 350);
    }
  };

  // Advance to next question or trigger tier completion
  const advanceQuestion = () => {
    if (phaseRef.current !== "playing") return;

    questionStartTimeRef.current = Date.now();
    const nextIdx = currentIdx + 1;

    // Check tier 1 completion (after 10 questions)
    if (activeTier === 1 && nextIdx === 10) {
      setTiersCleared(1);
      playSound("tierUp");
      setCurrentIdx(nextIdx);
      setPhase("tier_transition");
      return;
    }

    // Check tier 2 completion (after 22 questions)
    if (activeTier === 2 && nextIdx === 22) {
      setTiersCleared(2);
      playSound("tierUp");
      setCurrentIdx(nextIdx);
      setPhase("tier_transition");
      return;
    }

    // Check tier 3 victory (after 37 questions)
    if (activeTier === 3 && nextIdx >= 37) {
      setTiersCleared(3);
      playSound("complete");
      setPhase("game_over");
      return;
    }

    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
    } else {
      setPhase("game_over");
    }
  };

  // Second chance accepted (+15s)
  const handleAcceptSecondChance = () => {
    setSecondChanceUsed(true);
    setSecondChanceTier(activeTier);
    setTimeLeft(REFLEX_CONFIG.SECOND_CHANCE_SECONDS);
    questionStartTimeRef.current = Date.now();
    setPhase("playing");
  };

  // Summary calculation when game over
  const summary: ReflexSummary = useMemo(() => {
    const isPerfect = wrongCount === 0 && tiersCleared === 3;
    const { totalXP, baseXP, perfectBonus } = calculateReflexXP(
      tiersCleared,
      secondChanceTier,
      isPerfect
    );

    const totalAnswered = correctCount + wrongCount;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    const rating = speedRating(avgResponseTimeMs);

    return {
      tiersCleared,
      totalXP,
      baseXP,
      bonusXP: perfectBonus,
      perfectBonus: isPerfect,
      secondChanceUsed,
      secondChanceTier,
      totalAnswered,
      totalCorrect: correctCount,
      totalWrong: wrongCount,
      accuracy,
      avgResponseTimeMs,
      speedTitle: rating.title,
      wrongWords,
      answers: answerRecords,
    };
  }, [
    tiersCleared,
    secondChanceTier,
    secondChanceUsed,
    correctCount,
    wrongCount,
    responseTimes,
    wrongWords,
    answerRecords,
  ]);

  // Record completion on game over
  const recordedRef = useRef(false);
  useEffect(() => {
    if (phase === "game_over" && !recordedRef.current) {
      recordedRef.current = true;
      recordReflexCompletion(summary);
      if (onXPUpdated && summary.totalXP > 0) {
        onXPUpdated(summary.totalXP);
      }
    } else if (phase !== "game_over") {
      recordedRef.current = false;
    }
  }, [phase, summary, onXPUpdated]);

  // The question is over (time up, finished): the question is gone, so is its exit question
  useEffect(() => {
    if (phase !== "playing") setConfirmExit(false);
  }, [phase]);

  // Keyboard shortcut listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === "ready") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (phase === "tier_transition") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          handleStartNextTier();
        }
        return;
      }

      if (phase === "playing" && currentQ && !isLocked && !confirmExit) {
        if (currentQ.type === "choice" && currentQ.options) {
          const keyNum = parseInt(e.key, 10);
          if (keyNum >= 1 && keyNum <= currentQ.options.length) {
            e.preventDefault();
            const chosenIdx = keyNum - 1;
            if (disabledOptionIndices.has(chosenIdx)) return;
            const chosenText = currentQ.options[chosenIdx];
            const correctText = currentQ.options[currentQ.correctIndex ?? 0];
            handleAnswer(chosenIdx === currentQ.correctIndex, chosenText, correctText, chosenIdx);
          }
        } else if (currentQ.type === "true_false") {
          if ((e.code === "ArrowLeft" || e.key === "1") && wrongTrueFalse !== "SAI") {
            e.preventDefault();
            const isCorrect = !currentQ.isTrue;
            const correctText = currentQ.isTrue ? "ĐÚNG" : `SAI (Nghĩa đúng: ${currentQ.targetMeaning})`;
            handleAnswer(isCorrect, "SAI", correctText, 1);
          } else if ((e.code === "ArrowRight" || e.key === "2") && wrongTrueFalse !== "ĐÚNG") {
            e.preventDefault();
            const isCorrect = !!currentQ.isTrue;
            const correctText = currentQ.isTrue ? "ĐÚNG" : `SAI (Nghĩa đúng: ${currentQ.targetMeaning})`;
            handleAnswer(isCorrect, "ĐÚNG", correctText, 2);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, phase, currentQ, isLocked, disabledOptionIndices, wrongTrueFalse, confirmExit]);

  if (!isOpen) return null;

  // Format mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const timerColor =
    timeLeft > 35
      ? "text-slate-800 border-slate-200 bg-white dark:text-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
      : timeLeft > 15
        ? "text-amber-800 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10"
        : "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/50 dark:bg-red-500/10 animate-pulse";

  // Filter wrong answers for review list
  const wrongAnswerRecords = answerRecords.filter((a) => !a.isCorrect);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white p-4 select-none animate-in fade-in duration-200">
      {/* ── PHASE 1: READY / ONBOARDING ── */}
      {phase === "ready" && (
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 shadow-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-400/10 flex items-center justify-center mx-auto text-teal-700 dark:text-teal-300">
            <Zap className="w-8 h-8 fill-current" />
          </div>

          <div>
            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10 px-3 py-1 rounded-full">
              Thử thách phản xạ
            </span>
            <h2 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">Thử Thách Phản Xạ 3 Chặng</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Thời gian liên thông: Giữ nguyên số giây còn lại qua từng chặng!
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 text-left space-y-3">
            <div className="flex items-center justify-between text-sm pb-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-slate-600 dark:text-zinc-400">⏱️ Quỹ thời gian ban đầu</span>
              <span className="font-bold text-slate-900 dark:text-white">105 giây (1m45s)</span>
            </div>
            <div className="space-y-2 pt-1 text-sm">
              <div className="flex items-center justify-between text-slate-800 dark:text-zinc-200 font-semibold">
                <span>🟢 Chặng 1: 10 câu khởi động</span>
                <span className="text-teal-700 dark:text-teal-300">+15 XP</span>
              </div>
              <div className="flex items-center justify-between text-slate-800 dark:text-zinc-200 font-semibold">
                <span>🔵 Chặng 2: 12 câu tăng tốc</span>
                <span className="text-teal-700 dark:text-teal-300">+25 XP</span>
              </div>
              <div className="flex items-center justify-between text-slate-800 dark:text-zinc-200 font-semibold">
                <span>🟡 Chặng 3: 15 câu chạm đỉnh</span>
                <span className="text-teal-700 dark:text-teal-300">+40 XP</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 min-h-12 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 font-semibold transition-colors"
            >
              Để sau
            </button>
            <button
              onClick={handleStartGame}
              className="flex-2 min-h-12 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-[0.98]"
            >
              <Zap className="w-5 h-5 fill-current" />
              BẮT ĐẦU NGAY
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE 2: PLAYING GAME ── */}
      {phase === "playing" && currentQ && (
        <div className="relative w-full max-w-xl flex flex-col h-full max-h-[640px] justify-between">
          {/* Header Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setConfirmExit(true)}
                className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                title="Dừng thử thách"
                aria-label="Dừng thử thách"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Time display */}
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono font-bold text-lg transition-colors",
                  timerColor
                )}
              >
                <Clock className="w-5 h-5" />
                <span>{formatTime(timeLeft)}</span>
              </div>

              {/* Streak combo */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-orange-600 dark:text-orange-400 font-bold text-sm">
                <Flame className={cn("w-4 h-4", comboStreak >= 3 && "fill-current")} />
                <span>{comboStreak}x</span>
              </div>
            </div>

            {/* 3-Tier Indicator and Question Progress */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center">
                <div
                  className={cn(
                    "py-1.5 rounded-xl border",
                    activeTier === 1
                      ? "bg-teal-50 border-teal-700 text-teal-800 dark:bg-teal-400/10 dark:border-teal-400 dark:text-teal-300 font-bold"
                      : activeTier > 1
                        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400 line-through"
                        : "bg-white border-slate-200 text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  )}
                >
                  ⚡ Chặng 1 (+15 XP)
                </div>
                <div
                  className={cn(
                    "py-1.5 rounded-xl border",
                    activeTier === 2
                      ? "bg-teal-50 border-teal-700 text-teal-800 dark:bg-teal-400/10 dark:border-teal-400 dark:text-teal-300 font-bold"
                      : activeTier > 2
                        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400 line-through"
                        : "bg-white border-slate-200 text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  )}
                >
                  ⚡ Chặng 2 (+25 XP)
                </div>
                <div
                  className={cn(
                    "py-1.5 rounded-xl border",
                    activeTier === 3
                      ? "bg-teal-50 border-teal-700 text-teal-800 dark:bg-teal-400/10 dark:border-teal-400 dark:text-teal-300 font-bold"
                      : "bg-white border-slate-200 text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  )}
                >
                  ⚡ Chặng 3 (+40 XP)
                </div>
              </div>

              {/* Progress Bar within active tier */}
              <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-700 dark:bg-teal-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((tierProgress.current / tierProgress.target) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Question Body - DYNAMIC BY QUESTION TYPE */}
          {currentQ.type === "choice" ? (
            /* 1. MULTIPLE CHOICE QUESTION VIEW */
            <div className="my-auto py-6 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">
                {currentQ.direction === "en_to_vn" ? "Chọn nghĩa đúng" : "Chọn từ tiếng Anh"}
              </span>

              <div className="flex items-center justify-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {currentQ.prompt}
                </h1>
                {currentQ.direction === "en_to_vn" && (
                  <button
                    onClick={() => handleSpeak(currentQ.word)}
                    className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
                    title="Nghe phát âm"
                    aria-label="Nghe phát âm"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {currentQ.phonetic && currentQ.direction === "en_to_vn" && (
                <p className="text-sm font-mono text-slate-500 dark:text-zinc-400 mt-1">{currentQ.phonetic}</p>
              )}
            </div>
          ) : (
            /* 2. OPTIMIZED TRUE / FALSE COMPACT FOCAL CARD */
            <div className="my-auto py-2 flex flex-col items-center justify-center w-full">
              <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10 px-3 py-1 rounded-full mb-2">
                ⚡ ĐÚNG HAY SAI?
              </span>

              {/* Seamless, ultra-compact comparison card bringing English and Vietnamese directly into one tight focal view */}
              <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center space-y-2">
                {/* English word + Phonetic + Speaker in one unified horizontal group */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {currentQ.word}
                  </span>
                  {currentQ.phonetic && (
                    <span className="text-sm font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                      {currentQ.phonetic}
                    </span>
                  )}
                  <button
                    onClick={() => handleSpeak(currentQ.word)}
                    className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
                    title="Nghe phát âm"
                    aria-label="Nghe phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sleek, instant bridge indicator */}
                <div className="flex items-center justify-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" />
                    <span>nghĩa là</span>
                  </span>
                </div>

                {/* Vietnamese meaning to verify - prominent & crystal clear */}
                <div className="py-2.5 px-4 rounded-xl bg-teal-50 dark:bg-teal-400/10 text-teal-900 dark:text-teal-200 font-bold text-lg sm:text-xl leading-snug">
                  "{currentQ.displayedPair?.meaning}"
                </div>
              </div>
            </div>
          )}

          {/* Interactive Options Area */}
          <div className="space-y-3 pb-4">
            {/* 1. Multiple Choice layout: ALWAYS 4 OPTIONS IN A BALANCED 2x2 GRID */}
            {currentQ.type === "choice" && currentQ.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOptionIdx === idx;
                  const isCorrect = idx === currentQ.correctIndex;
                  const isDisabled = disabledOptionIndices.has(idx);

                  let btnStyle =
                    "bg-white border-slate-200 text-slate-800 hover:border-teal-700/40 hover:bg-teal-50/50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800";

                  if (feedback === "correct" && isCorrect) {
                    btnStyle = "bg-green-50 border-green-600 text-green-800 dark:bg-green-500/10 dark:text-green-300";
                  } else if (feedback === "wrong" && isSelected) {
                    btnStyle = "bg-red-50 border-red-600 text-red-700 dark:bg-red-500/10 dark:text-red-300 animate-shake";
                  } else if (isDisabled) {
                    btnStyle =
                      "bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500 line-through opacity-60 cursor-not-allowed";
                  }

                  const correctText = currentQ.options![currentQ.correctIndex ?? 0];

                  return (
                    <button
                      key={idx}
                      disabled={isLocked || isDisabled}
                      onClick={() => handleAnswer(isCorrect, opt, correctText, idx)}
                      className={cn(
                        "relative flex items-center gap-3 min-h-14 p-4 rounded-2xl border text-left font-semibold text-base transition-colors duration-150 active:scale-[0.98]",
                        btnStyle
                      )}
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 min-w-0 break-words leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. True / False buttons layout directly under the comparison card */}
            {currentQ.type === "true_false" && currentQ.displayedPair && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  disabled={isLocked || wrongTrueFalse === "SAI"}
                  onClick={() => {
                    const isCorrect = !currentQ.isTrue;
                    const correctText = currentQ.isTrue
                      ? "ĐÚNG"
                      : `SAI (Nghĩa đúng: ${currentQ.targetMeaning})`;
                    handleAnswer(isCorrect, "SAI", correctText, 1);
                  }}
                  className={cn(
                    "min-h-14 p-4 rounded-2xl border font-bold text-lg flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98]",
                    wrongTrueFalse === "SAI"
                      ? "bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500 line-through opacity-60 cursor-not-allowed"
                      : feedback === "wrong" && selectedOptionIdx === 1
                        ? "bg-red-50 border-red-600 text-red-700 dark:bg-red-500/10 dark:text-red-300 animate-shake"
                        : "bg-white border-red-200 text-red-700 hover:bg-red-50 dark:bg-zinc-900 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                  )}
                >
                  <span className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 font-mono text-sm font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>SAI</span>
                </button>
                <button
                  disabled={isLocked || wrongTrueFalse === "ĐÚNG"}
                  onClick={() => {
                    const isCorrect = !!currentQ.isTrue;
                    const correctText = currentQ.isTrue
                      ? "ĐÚNG"
                      : `SAI (Nghĩa đúng: ${currentQ.targetMeaning})`;
                    handleAnswer(isCorrect, "ĐÚNG", correctText, 2);
                  }}
                  className={cn(
                    "min-h-14 p-4 rounded-2xl border font-bold text-lg flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98]",
                    wrongTrueFalse === "ĐÚNG"
                      ? "bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500 line-through opacity-60 cursor-not-allowed"
                      : feedback === "wrong" && selectedOptionIdx === 2
                        ? "bg-red-50 border-red-600 text-red-700 dark:bg-red-500/10 dark:text-red-300 animate-shake"
                        : "bg-white border-green-200 text-green-700 hover:bg-green-50 dark:bg-zinc-900 dark:border-green-500/40 dark:text-green-300 dark:hover:bg-green-500/10"
                  )}
                >
                  <span className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 font-mono text-sm font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>ĐÚNG</span>
                </button>
              </div>
            )}
          </div>

          {confirmExit && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Dừng thử thách"
              className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-4"
            >
              <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 text-center shadow-xl">
                <p className="text-lg font-bold text-slate-900 dark:text-white">Dừng thử thách?</p>
                <p className="text-sm text-slate-600 dark:text-zinc-300">Đồng hồ vẫn chạy. Dừng bây giờ thì bạn xem kết quả ngay, phần chưa làm không được tính.</p>
                <div className="flex flex-col gap-2">
                  <button
                    autoFocus
                    onClick={() => setConfirmExit(false)}
                    className="min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-base transition-colors"
                  >
                    Chơi tiếp
                  </button>
                  <button
                    onClick={() => {
                      setConfirmExit(false);
                      setPhase("game_over");
                    }}
                    className="min-h-12 rounded-2xl border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10 text-base font-semibold transition-colors"
                  >
                    Dừng và xem kết quả
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE 3: TIER TRANSITION (PAUSES AND WAITS FOR USER CLICK - NO AUTO TRANSITION) ── */}
      {phase === "tier_transition" && (
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 shadow-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto text-green-600 dark:text-green-400">
            <Trophy className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              🎉 VƯỢT QUA CHẶNG {tiersCleared}!
            </h2>
            <p className="text-green-700 dark:text-green-400 font-semibold mt-1 text-base">
              +{activeTier === 1 ? 15 : 25} XP ĐÃ ĐƯỢC BẢO LƯU!
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 space-y-2 text-sm">
            <div className="flex justify-between items-center text-slate-700 dark:text-zinc-300">
              <span>⏱️ Thời gian bảo lưu:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-lg">
                {formatTime(timeLeft)}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400 text-left">
              Toàn bộ số giây này sẽ được giữ nguyên cho Chặng {tiersCleared + 1}. Hãy nghỉ tay một
              chút và bấm nút khi bạn đã sẵn sàng!
            </p>
          </div>

          <button
            onClick={handleStartNextTier}
            className="w-full min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-[0.98]"
          >
            <span>VÀO CHẶNG {tiersCleared + 1}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── PHASE 4: SECOND CHANCE POPUP (STAYS OPEN UNTIL USER CLICKS - NEVER DISAPPEARS) ── */}
      {phase === "second_chance" && (
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 shadow-xl text-center space-y-5 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">⏰ HẾT GIỜ!</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1">
              Bạn có muốn nhận thêm <strong className="text-amber-700 dark:text-amber-400">+15 giây</strong> để hoàn
              thành Chặng {activeTier} không?
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-900 dark:text-amber-200 text-left">
            ⚠️ <em>Lưu ý:</em> Cơ hội chỉ áp dụng 1 lần duy nhất. Nếu nhận, XP thưởng của Chặng{" "}
            {activeTier} sẽ giảm 50% (còn{" "}
            {Math.round(
              (REFLEX_CONFIG.TIERS.find((t) => t.tier === activeTier)?.xpReward || 0) * 0.5
            )}{" "}
            XP).
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPhase("game_over")}
              className="flex-1 min-h-12 px-3 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 font-semibold text-sm transition-colors"
            >
              Dừng lại & Xem kết quả
            </button>
            <button
              onClick={handleAcceptSecondChance}
              className="flex-1 min-h-12 px-3 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-1 shadow-sm transition-colors active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 fill-current" />
              Nhận +15s làm tiếp
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE 5: GAME OVER / VICTORY RESULTS WITH DETAILED MISTAKE REVIEW ── */}
      {phase === "game_over" && (
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-xl text-center space-y-5 animate-in zoom-in-95 max-h-[90vh] flex flex-col justify-between">
          <div className="space-y-4">
            <div
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                summary.tiersCleared === 3
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                  : "bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
              )}
            >
              {summary.tiersCleared === 3 ? (
                <Sparkles className="w-8 h-8" />
              ) : (
                <Trophy className="w-8 h-8" />
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {summary.tiersCleared === 3
                  ? "🏆 VICTORY! CHIẾN THẮNG HOÀN TOÀN!"
                  : "TỔNG KẾT PHẢN XẠ"}
              </h2>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
                Vượt qua {summary.tiersCleared} / 3 Chặng thử thách
              </p>
            </div>

            {/* XP & Speed Stats Cards */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 block">
                  Tổng XP Nhận Được
                </span>
                <span className="text-2xl font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1 mt-0.5">
                  +{summary.totalXP} <span className="text-xs text-teal-700/80 dark:text-teal-300/80">XP</span>
                </span>
                {summary.perfectBonus && (
                  <span className="text-xs text-green-700 dark:text-green-400 font-semibold block mt-0.5">
                    ✨ +10 XP Perfect!
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 block">
                  Tốc độ phản xạ
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                  {summary.avgResponseTimeMs > 0
                    ? (summary.avgResponseTimeMs / 1000).toFixed(2)
                    : "0"}
                  s / câu
                </span>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 block mt-0.5">
                  {summary.speedTitle}
                </span>
              </div>
            </div>

            {/* Accuracy & Correct / Wrong Counter */}
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-3 border border-slate-200 dark:border-zinc-800 flex justify-around text-xs">
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block">Số câu đúng</span>
                <span className="font-bold text-green-700 dark:text-green-400 text-sm">
                  {summary.totalCorrect} câu
                </span>
              </div>
              <div className="border-r border-slate-200 dark:border-zinc-800" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block">Số câu sai</span>
                <span className="font-bold text-red-600 dark:text-red-400 text-sm">{summary.totalWrong} câu</span>
              </div>
              <div className="border-r border-slate-200 dark:border-zinc-800" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block">Độ chính xác</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{summary.accuracy}%</span>
              </div>
              <div className="border-r border-slate-200 dark:border-zinc-800" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block">Combo max</span>
                <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{maxCombo}x</span>
              </div>
            </div>

            {/* DETAILED MISTAKE REVIEW SECTION */}
            <div className="text-left space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 block">
                {wrongAnswerRecords.length > 0
                  ? `🔍 Xem lại các câu trả lời sai (${wrongAnswerRecords.length} câu)`
                  : "✨ Phản xạ tuyệt đối: Không sai câu nào!"}
              </span>

              {wrongAnswerRecords.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {wrongAnswerRecords.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.word}</span>
                          {item.phonetic && (
                            <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                              {item.phonetic}
                            </span>
                          )}
                          {item.category && WORD_CATEGORY_LABELS[item.category] && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {WORD_CATEGORY_LABELS[item.category]}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleSpeak(item.word)}
                          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                          title="Nghe phát âm"
                          aria-label="Nghe phát âm"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5 text-sm">
                        <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400 block text-xs">Bạn chọn:</span>
                            <span className="font-semibold line-through">{item.userAnswer}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-1 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400 block text-xs">Đáp án đúng:</span>
                            <span className="font-semibold">{item.correctAnswer}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-300 text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bạn đã trả lời chính xác 100% tất cả các câu hỏi!</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                initSession();
                handleStartGame();
              }}
              className="flex-1 min-h-12 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 font-semibold flex items-center justify-center gap-2 text-base transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Luyện tiếp
            </button>
            <button
              onClick={onClose}
              className="flex-1 min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-base flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Kết thúc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
