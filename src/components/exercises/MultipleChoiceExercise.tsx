import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Volume2, CheckCircle2, XCircle, Sparkles, HelpCircle } from "lucide-react";
import { Rating } from "@/services/srs";
import type { WordDetail } from "@/types/database";
import {
  generateMultipleChoiceQuestion,
  multipleChoiceDirection,
  type MultipleChoiceQuestion,
  type MultipleChoiceOption,
} from "@/services/smartReview";
import { getConciseMeaning } from "@/services/meaningText";
import { playWrongTry } from "@/services/sound";

interface MultipleChoiceExerciseProps {
  word: WordDetail;
  allWords: WordDetail[];
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string) => void;
}

export default function MultipleChoiceExercise({
  word,
  allWords,
  onComplete,
  onSpeak,
}: MultipleChoiceExerciseProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [wrongNote, setWrongNote] = useState<string | null>(null);

  // Pending completion timer, cleared on unmount so a stale card is never graded
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Young cards are asked English -> Vietnamese; older ones sometimes Vietnamese -> English
  const questionData: MultipleChoiceQuestion = useMemo(
    () => generateMultipleChoiceQuestion(word, allWords, multipleChoiceDirection(word)),
    // Options must not reshuffle while answering
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word.id]
  );

  // Reset state on word change
  useEffect(() => {
    setSelectedId(null);
    setIsAnswered(false);
    setWrongAttempts(0);
    setShakeIdx(null);
    setWrongNote(null);
  }, [word]);

  const handleSelectOption = useCallback(
    (option: MultipleChoiceOption, index: number) => {
      if (isAnswered) return;

      setSelectedId(option.id);

      if (option.isCorrect) {
        setIsAnswered(true);
        onSpeak(word.word);

        // Grade rating
        let rating: Rating = Rating.Easy;
        if (wrongAttempts === 0) {
          rating = Rating.Easy;
        } else if (wrongAttempts === 1) {
          rating = Rating.Good;
        } else {
          rating = Rating.Hard;
        }

        // Reported at once: the session keeps this card on screen until the learner continues
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
        onComplete(true, wrongAttempts, rating);
      } else {
        setWrongAttempts((prev) => prev + 1);
        playWrongTry();
        setShakeIdx(index);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => {
          shakeTimerRef.current = null;
          setShakeIdx(null);
        }, 400);
        // Say what the picked option really is: a wrong choice still teaches something
        const other = allWords.find((w) => w.id === option.id);
        setWrongNote(
          other
            ? questionData.promptType === "en_to_vn"
              ? `"${option.text}" là nghĩa của "${other.word}". Thử lại nhé!`
              : `"${other.word}" nghĩa là "${getConciseMeaning(other.meaning_vn)}". Thử lại nhé!`
            : "Chưa đúng, thử phương án khác nhé!"
        );
      }
    },
    [isAnswered, onSpeak, word.word, wrongAttempts, onComplete, allWords, questionData.promptType]
  );

  // Keyboard shortcuts 1, 2, 3, 4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (["1", "2", "3", "4"].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        if (questionData.options[idx]) {
          handleSelectOption(questionData.options[idx], idx);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswered, questionData.options, handleSelectOption]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-3 md:space-y-6 animate-in fade-in duration-200">
      {/* Question Card: on a phone it drops its own frame (a card inside the card ate the space) */}
      <div className="rounded-2xl md:border border-slate-200 dark:border-zinc-800 md:bg-white md:dark:bg-zinc-900 py-1 md:p-8 text-center space-y-1.5 md:space-y-3 md:shadow-[0_1px_3px_rgba(15,23,42,0.05)] relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <Sparkles className="w-3 h-3" />
          <span>{questionData.subPrompt}</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {questionData.question}
          </h2>
          {questionData.promptType === "en_to_vn" && (
            <button
              onClick={() => onSpeak(word.word)}
              type="button"
              className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              title="Phát âm"
              aria-label="Phát âm"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Never under a Vietnamese prompt: the IPA of the answer would give it away */}
        {questionData.phonetic && questionData.promptType === "en_to_vn" && (
          <p className="text-sm font-mono text-slate-600 dark:text-zinc-400">
            {questionData.phonetic}
          </p>
        )}

        {questionData.partOfSpeech && (
          <p className="text-xs italic text-slate-600 dark:text-zinc-400">
            {questionData.partOfSpeech}
          </p>
        )}
      </div>

      {/* 4 Choices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        {questionData.options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const isShake = shakeIdx === idx;
          const showSuccess = isAnswered && opt.isCorrect;
          const showFail = isSelected && !opt.isCorrect;

          let btnClasses =
            "min-h-14 rounded-2xl border px-4 py-3 md:py-4 text-left transition-colors duration-150 flex items-start gap-3 relative ";
          if (showSuccess) {
            btnClasses +=
              "border-green-600 bg-green-50 text-green-800 dark:bg-green-500/10 dark:border-green-500 dark:text-green-200";
          } else if (showFail) {
            btnClasses +=
              "border-red-600 bg-red-50 text-red-800 dark:bg-red-500/10 dark:border-red-500 dark:text-red-200";
          } else {
            btnClasses +=
              "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-700/50 hover:bg-slate-50 dark:hover:border-teal-400/50 dark:hover:bg-zinc-800/50 text-slate-900 dark:text-zinc-100";
          }

          if (isShake) {
            btnClasses += " animate-shake";
          }

          return (
            <button
              key={opt.id}
              onClick={() => handleSelectOption(opt, idx)}
              disabled={isAnswered}
              className={btnClasses}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                  showSuccess
                    ? "bg-green-600 text-white"
                    : showFail
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
              >
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-base font-medium leading-snug break-words">{opt.text}</p>
              </div>

              {/* Reserved icon slot so text width and button height never shift */}
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {showSuccess && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 animate-in zoom-in duration-150" />
                )}
                {showFail && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 animate-in zoom-in duration-150" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Helpful Hint - fixed height h-7 so it NEVER jumps */}
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400 px-2 min-h-[20px] md:min-h-[28px]">
        <span className="desktop-only flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" />
          Phím tắt: bấm <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono">1</kbd> - <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono">4</kbd>
        </span>
        {wrongNote && !isAnswered ? (
          <span className="text-sm text-amber-700 dark:text-amber-400 font-semibold animate-in fade-in duration-150 text-right">
            {wrongNote}
          </span>
        ) : (
          <span className="text-xs text-slate-600 dark:text-zinc-400">
            Chọn 1 trong 4 đáp án
          </span>
        )}
      </div>
    </div>
  );
}
