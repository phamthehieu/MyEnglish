import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Volume2, CheckCircle2, Snail, Music, XCircle } from "lucide-react";
import { Rating } from "@/services/srs";
import type { WordDetail } from "@/types/database";
import { generateMultipleChoiceQuestion, type MultipleChoiceOption } from "@/services/smartReview";
import { samePronunciation } from "@/utils/exerciseHints";
import { playWrongTry } from "@/services/sound";
import { AUTO_SPEAK_DELAY_MS, SLOW_RATE } from "@/components/review/speech";

interface ListeningDictationExerciseProps {
  word: WordDetail;
  allWords: WordDetail[];
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string, rate?: number) => void;
}

/**
 * Listening recognition: hear the word (not shown) and pick its meaning. This tests understanding the
 * word by ear, which is valid evidence for the recognition card. (Typing a heard word was dictation: it
 * tested spelling, not the meaning, and was wrongly graded as recall.)
 */
export default function ListeningDictationExercise({
  word,
  allWords,
  onComplete,
  onSpeak,
}: ListeningDictationExerciseProps) {
  // A word that sounds the same as the target (right / write) would be a right answer by ear: never a distractor
  const question = useMemo(
    () => generateMultipleChoiceQuestion(word, allWords.filter((w) => !samePronunciation(w.phonetic, word.phonetic)), "en_to_vn"),
    // Options must not reshuffle while answering
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word.id]
  );
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [isAnswered, setIsAnswered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (playingTimerRef.current) clearTimeout(playingTimerRef.current);
    };
  }, []);

  const playAudio = useCallback(
    (rate?: number) => {
      setIsPlaying(true);
      onSpeak(word.word, rate);
      if (playingTimerRef.current) clearTimeout(playingTimerRef.current);
      const duration = rate && rate < 0.7 ? 1600 : 900;
      playingTimerRef.current = setTimeout(() => {
        playingTimerRef.current = null;
        setIsPlaying(false);
      }, duration);
    },
    [onSpeak, word.word]
  );

  useEffect(() => {
    setWrongIds(new Set());
    setIsAnswered(false);
    const timer = setTimeout(() => playAudio(), AUTO_SPEAK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [word.id]);

  const handleSelect = useCallback(
    (option: MultipleChoiceOption) => {
      if (isAnswered || wrongIds.has(option.id)) return;
      if (option.isCorrect) {
        setIsAnswered(true);
        const attempts = wrongIds.size;
        // Reported at once: the session keeps this card on screen until the learner continues
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
        onComplete(attempts === 0, attempts, Rating.Good);
      } else {
        playWrongTry();
        setWrongIds((prev) => new Set(prev).add(option.id));
      }
    },
    [isAnswered, wrongIds, onComplete]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0 && question.options[idx]) handleSelect(question.options[idx]);
      if (e.key === "r" || e.key === "R") playAudio();
      if (e.key === "s" || e.key === "S") playAudio(SLOW_RATE);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswered, question.options, handleSelect, playAudio]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <Music className="w-3 h-3" />
          <span>Nghe từ và chọn nghĩa đúng</span>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => playAudio()}
            type="button"
            className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-colors active:scale-95 cursor-pointer ${
              isPlaying
                ? "bg-teal-700 dark:bg-teal-600 text-white ring-4 ring-teal-700/20 dark:ring-teal-400/20 animate-pulse"
                : "bg-teal-50 dark:bg-teal-400/10 hover:bg-teal-100 dark:hover:bg-teal-400/20 text-teal-700 dark:text-teal-300 border border-teal-700/20 dark:border-teal-400/30"
            }`}
            title="Nghe tốc độ thường (Phím R)"
          >
            <Volume2 className="w-8 h-8 mb-0.5" />
            <span className="text-xs font-semibold">Nghe</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => playAudio(SLOW_RATE)}
            type="button"
            className="px-4 min-h-11 rounded-2xl text-sm font-semibold border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Nghe chậm (Phím S)"
          >
            <Snail className="w-3.5 h-3.5 text-amber-500" />
            <span>Nghe chậm</span>
          </button>
          <span className="desktop-only text-xs text-slate-600 dark:text-zinc-400">Phím R: nghe lại · S: nghe chậm · 1–4: chọn</span>
        </div>

        <div className="min-h-[28px] text-sm">
          {isAnswered ? (
            <span className="font-bold text-slate-900 dark:text-white">
              {word.word} {word.phonetic ? <span className="font-mono text-teal-700 dark:text-teal-300 text-sm">{word.phonetic}</span> : null}
            </span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-zinc-400">Từ sẽ hiện sau khi bạn trả lời</span>
          )}
        </div>
      </div>

      <div className="grid gap-2.5">
        {question.options.map((o, idx) => {
          const wrong = wrongIds.has(o.id);
          const right = isAnswered && o.isCorrect;
          return (
            <button
              key={o.id}
              onClick={() => handleSelect(o)}
              disabled={isAnswered || wrong}
              className={`w-full min-h-14 px-4 py-3 rounded-2xl border text-left text-base font-medium transition-colors flex items-center gap-3 ${
                right
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-500/10 dark:border-green-500 dark:text-green-200"
                  : wrong
                  ? "border-red-600 bg-red-50 text-red-800 dark:bg-red-500/10 dark:border-red-500 dark:text-red-200 opacity-70"
                  : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-700/50 hover:bg-slate-50 dark:hover:border-teal-400/50 dark:hover:bg-zinc-800/50 text-slate-900 dark:text-zinc-100"
              }`}
            >
              <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span className="flex-1">{o.text}</span>
              {right && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
              {wrong && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
