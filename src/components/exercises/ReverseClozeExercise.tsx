import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Volume2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Rating } from "@/services/srs";
import type { WordDetail } from "@/types/database";
import { cleanMeaningForOption, generateMultipleChoiceQuestion, pickExample, wordFormsPattern } from "@/services/smartReview";
import { pickSenseForExample, sharesSense } from "@/utils/exerciseHints";
import { playWrongTry } from "@/services/sound";

interface ReverseClozeExerciseProps {
  word: WordDetail;
  allWords: WordDetail[];
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string) => void;
  onFallback: () => void;
}

export default function ReverseClozeExercise({
  word,
  allWords,
  onComplete,
  onSpeak,
  onFallback,
}: ReverseClozeExerciseProps) {
  // Rotated example (the learner's own sentence first), only sentences that contain the word
  const example = useMemo(() => pickExample(word), [word]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  // Fallback if no example sentence
  useEffect(() => {
    if (!example || !example.sentence_en || example.sentence_en.trim().length === 0) {
      onFallback();
    }
  }, [example, onFallback]);

  // Options: the shared generator (plausible distractors, never synonyms of the word). The right answer is
  // the sense the example sentence uses, not always the first one; no distractor may share a sense with the word.
  const options = useMemo(() => {
    const others = allWords.filter((w) => !sharesSense(word.meaning_vn, w.meaning_vn));
    const sense = example ? cleanMeaningForOption(pickSenseForExample(word.meaning_vn, example)) : "";
    return generateMultipleChoiceQuestion(word, others, "en_to_vn").options.map((o) => ({
      id: o.id,
      text: o.isCorrect && sense ? sense : o.text,
      isCorrect: o.isCorrect,
    }));
    // Options must not reshuffle while answering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id, example?.id]);

  useEffect(() => {
    setSelectedId(null);
    setIsAnswered(false);
    setWrongAttempts(0);
    setShakeIdx(null);
  }, [word]);

  // Pending completion timer, cleared on unmount so a stale card is never graded
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const handleSelect = useCallback(
    (opt: { id: string; text: string; isCorrect: boolean }, idx: number) => {
      if (isAnswered) return;
      setSelectedId(opt.id);

      if (opt.isCorrect) {
        setIsAnswered(true);
        onSpeak(word.word);

        let rating: Rating = Rating.Easy;
        if (wrongAttempts === 0) rating = Rating.Easy;
        else if (wrongAttempts === 1) rating = Rating.Good;
        else rating = Rating.Hard;

        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
        // Reported at once: the session keeps this card on screen until the learner continues
        onComplete(true, wrongAttempts, rating);
      } else {
        setWrongAttempts((prev) => prev + 1);
        playWrongTry();
        setShakeIdx(idx);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => {
          shakeTimerRef.current = null;
          setShakeIdx(null);
        }, 400);
      }
    },
    [isAnswered, onSpeak, word.word, wrongAttempts, onComplete]
  );

  // Keyboard shortcuts 1, 2, 3, 4
  useEffect(() => {
    if (!example || !example.sentence_en) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0 && options[idx]) {
        handleSelect(options[idx], idx);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [example, isAnswered, options, handleSelect]);

  if (!example || !example.sentence_en) return null;

  // Highlight target word in sentence
  const renderSentenceWithHighlight = () => {
    const rawSentence = example.sentence_en;
    // Escaped pattern; the capture group puts matches at odd indices
    const regex = new RegExp(`(${wordFormsPattern(word.word)})`, "gi");
    const parts = rawSentence.split(regex);

    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span
            key={i}
            className="font-bold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-400/10 px-1.5 py-0.5 rounded underline decoration-teal-700 dark:decoration-teal-400 decoration-2 underline-offset-2"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Context Sentence Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <Sparkles className="w-3 h-3" />
          <span>Câu ví dụ thực tế</span>
        </div>

        <div className="text-base md:text-lg font-medium text-slate-900 dark:text-zinc-100 leading-relaxed">
          "{renderSentenceWithHighlight()}"
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => onSpeak(example.sentence_en)}
            type="button"
            className="inline-flex items-center gap-1.5 px-4 min-h-10 rounded-2xl text-sm font-semibold border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Nghe câu ví dụ</span>
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800 pt-3">
          Từ được gạch chân mang nghĩa là gì trong câu trên?
        </p>
      </div>

      {/* 4 Choices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const isShake = shakeIdx === idx;
          const showSuccess = isAnswered && opt.isCorrect;
          const showFail = isSelected && !opt.isCorrect;

          let btnClasses =
            "min-h-14 rounded-2xl border px-4 py-4 text-left transition-colors duration-150 flex items-start gap-3 relative ";
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

          if (isShake) btnClasses += " animate-shake";

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt, idx)}
              disabled={isAnswered}
              className={btnClasses}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-xs font-mono font-bold ${
                  showSuccess
                    ? "bg-green-600 text-white"
                    : showFail
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
              >
                {idx + 1}
              </span>
              <p className="text-base font-medium leading-snug flex-1">{opt.text}</p>

              {/* Reserved icon slot so text width and button height never shift */}
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {showSuccess && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 animate-in zoom-in duration-150" />}
                {showFail && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 animate-in zoom-in duration-150" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Status - constant height h-7 so it NEVER jumps */}
      <div className="h-7 min-h-[28px] flex items-center justify-center text-sm">
        {wrongAttempts > 0 && !isAnswered ? (
          <p className="text-center text-sm text-amber-700 dark:text-amber-400 font-semibold animate-in fade-in duration-150">
            Chưa đúng, thử phương án khác nhé!
          </p>
        ) : (
          <span className="text-center text-xs text-slate-600 dark:text-zinc-400">
            Chọn phương án đúng nhất theo ngữ cảnh câu
          </span>
        )}
      </div>
    </div>
  );
}
