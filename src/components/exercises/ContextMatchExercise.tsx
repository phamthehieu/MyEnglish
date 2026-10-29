import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, RotateCcw, Link2, AlertCircle, Eye } from "lucide-react";
import GiveUpButton from "../review/GiveUpButton";
import { Rating } from "@/services/srs";
import { shuffle } from "@/lib/utils";
import type { WordDetail } from "@/types/database";
import { prepareContextMatch, type ContextMatchPair } from "@/services/smartReview";
import { playWrongTry } from "@/services/sound";

interface ContextMatchExerciseProps {
  word: WordDetail;
  allWords: WordDetail[];
  /** Words still to come in this session: never shown here, it would reveal their answers */
  excludeIds?: ReadonlySet<string>;
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string) => void;
  onFallback: () => void;
}

// Fewer pairs make the matching trivial; the parent falls back to another exercise
const MIN_PAIRS = 3;
const BLANK = "______";

const PAIR_COLORS = [
  {
    badge: "bg-teal-700 text-white dark:bg-teal-500",
    border: "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10",
  },
  {
    badge: "bg-slate-600 text-white dark:bg-zinc-500",
    border: "border-slate-500 bg-slate-50 dark:border-zinc-500 dark:bg-zinc-800/50",
  },
  {
    badge: "bg-amber-500 text-white",
    border: "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
  },
];

export default function ContextMatchExercise({
  word,
  allWords,
  excludeIds,
  onComplete,
  onSpeak,
  onFallback,
}: ContextMatchExerciseProps) {
  const pairs: ContextMatchPair[] = useMemo(() => {
    return prepareContextMatch(word, allWords, excludeIds);
    // The pairs must not reshuffle while the learner is playing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  const [shuffledSentences, setShuffledSentences] = useState<ContextMatchPair[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  // Map wordId -> sentence wordId
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [, setWrongAttempts] = useState(0);
  const targetMistakesRef = useRef(0);
  // Word of the latest pairing: when it is the target, its sentence was the one left over (found by elimination)
  const lastPairedRef = useRef<string | null>(null);
  const [byElimination, setByElimination] = useState(false);

  const onFallbackRef = useRef(onFallback);
  useEffect(() => {
    onFallbackRef.current = onFallback;
  });

  // Pending completion timer, cleared on unmount so a stale card is never graded
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pairs || pairs.length < MIN_PAIRS) {
      onFallbackRef.current();
      return;
    }
    // Shuffle right-hand column sentences
    setShuffledSentences(shuffle(pairs));
    setSelectedWordId(null);
    setMatches({});
    setIsAnswered(false);
    setIsCorrect(null);
    setWrongAttempts(0);
  }, [pairs]);

  if (!pairs || pairs.length < MIN_PAIRS) return null;

  // Click on a word
  const handleWordClick = (wordId: string) => {
    if (isAnswered) return;
    if (selectedWordId === wordId) {
      setSelectedWordId(null);
    } else {
      setSelectedWordId(wordId);
    }
  };

  // Click on a sentence
  const handleSentenceClick = (sentencePair: ContextMatchPair) => {
    if (isAnswered) return;

    if (!selectedWordId) {
      // If this sentence was already matched, unmatch it
      const existingWord = Object.keys(matches).find((wId) => matches[wId] === sentencePair.wordId);
      if (existingWord) {
        setMatches((prev) => {
          const next = { ...prev };
          delete next[existingWord];
          return next;
        });
      }
      return;
    }

    // Match selected word to this sentence
    lastPairedRef.current = selectedWordId;
    setMatches((prev) => ({
      ...prev,
      [selectedWordId]: sentencePair.wordId,
    }));
    setSelectedWordId(null);
  };

  // Check correctness
  const handleCheck = () => {
    if (isAnswered) return;
    const allPaired = pairs.every((p) => matches[p.wordId] !== undefined);
    if (!allPaired) return;

    // All correct if every matches[p.wordId] === p.wordId
    const allCorrect = pairs.every((p) => matches[p.wordId] === p.wordId);

    // Only the reviewed word is graded: a mistake counts against it when its own pairing is wrong
    // (its word on another sentence, or another word on its sentence)
    const targetWrong =
      matches[word.id] !== word.id || pairs.some((p) => p.wordId !== word.id && matches[p.wordId] === word.id);

    if (allCorrect) {
      // The target was paired last, so every other pair was already there: its sentence was forced
      const eliminated = lastPairedRef.current === word.id;
      setByElimination(eliminated);
      setIsCorrect(true);
      setIsAnswered(true);
      onSpeak(word.word);

      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      const mistakes = targetMistakesRef.current;
      // Hard with 0 wrong attempts is read by the session as a hint, so an eliminated target grades Hard
      // Reported at once: the session keeps this card on screen until the learner continues
      onComplete(mistakes === 0 && !eliminated, mistakes, eliminated ? Rating.Hard : Rating.Good);
    } else {
      if (targetWrong) targetMistakesRef.current += 1;
      setIsCorrect(false);
      setWrongAttempts((prev) => prev + 1);
      playWrongTry();
      // Keep the correct pairs, clear the wrong ones so the learner sees exactly what to fix
      setMatches((prev) => {
        const next: Record<string, string> = {};
        for (const [w, sId] of Object.entries(prev)) if (w === sId) next[w] = sId;
        return next;
      });
    }
  };

  const handleReset = () => {
    if (isAnswered) return;
    setMatches({});
    setSelectedWordId(null);
    setIsCorrect(null);
  };

  const handleGiveUp = () => {
    if (isAnswered) return;
    setIsAnswered(true);
    setIsCorrect(false);
    // Fill all matches with the correct pairs
    const solved: Record<string, string> = {};
    for (const p of pairs) {
      solved[p.wordId] = p.wordId;
    }
    setMatches(solved);
    onSpeak(word.word);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    onComplete(false, Math.max(targetMistakesRef.current, 1), Rating.Again);
  };

  const allMatched = pairs.length > 0 && pairs.every((p) => matches[p.wordId] !== undefined);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Exercise header */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <Link2 className="w-3 h-3" />
          <span>Ghép từ vào ngữ cảnh câu thích hợp</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Chọn một từ ở cột trái rồi chọn câu có chỗ trống tương ứng ở cột phải.
        </p>
      </div>

      {/* Matching Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Words */}
        <div className="md:col-span-5 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-zinc-400 px-1">
            Từ vựng
          </h4>
          {pairs.map((p, idx) => {
            const isSelected = selectedWordId === p.wordId;
            const matchedSentenceId = matches[p.wordId];
            const colorConfig = PAIR_COLORS[idx % PAIR_COLORS.length];

            return (
              <button
                key={p.wordId}
                onClick={() => handleWordClick(p.wordId)}
                disabled={isAnswered}
                className={`w-full min-h-14 px-4 py-3 rounded-2xl border text-left transition-colors flex items-center justify-between ${
                  isSelected
                    ? "border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:border-teal-400 dark:text-teal-200"
                    : matchedSentenceId
                    ? `${colorConfig.border} text-slate-900 dark:text-white`
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-700/50 dark:hover:border-teal-400/50 text-slate-900 dark:text-zinc-100"
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-base font-semibold">{p.word}</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-1">
                    {p.meaningVN}
                  </p>
                </div>
                {matchedSentenceId && (
                  <span
                    className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${colorConfig.badge}`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Column: Sentences */}
        <div className="md:col-span-7 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-zinc-400 px-1">
            Câu có chỗ trống
          </h4>
          {shuffledSentences.map((s) => {
            // Find which word is matched with this sentence
            const matchedWordId = Object.keys(matches).find((wId) => matches[wId] === s.wordId);
            const matchedWordPair = matchedWordId ? pairs.find((p) => p.wordId === matchedWordId) : null;
            const wordIdx = matchedWordPair ? pairs.findIndex((p) => p.wordId === matchedWordPair.wordId) : -1;
            const colorConfig = wordIdx >= 0 ? PAIR_COLORS[wordIdx % PAIR_COLORS.length] : null;

            return (
              <button
                key={s.wordId}
                onClick={() => handleSentenceClick(s)}
                disabled={isAnswered}
                className={`w-full min-h-14 px-4 py-3 rounded-2xl border text-left transition-colors space-y-1.5 ${
                  colorConfig
                    ? `${colorConfig.border} text-slate-900 dark:text-white`
                    : selectedWordId
                    ? "border-dashed border-teal-700/40 dark:border-teal-400/40 bg-white dark:bg-zinc-900 hover:border-teal-700 dark:hover:border-teal-400 text-slate-900 dark:text-zinc-100"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 hover:border-teal-700/50 dark:hover:border-teal-400/50"
                }`}
              >
                <p className="text-sm font-medium leading-relaxed">
                  {matchedWordPair && s.maskedSentence.includes(BLANK) ? (
                    <span>
                      {s.maskedSentence.slice(0, s.maskedSentence.indexOf(BLANK))}
                      <span className="font-bold underline text-teal-700 dark:text-teal-300 mx-1">
                        {matchedWordPair.word}
                      </span>
                      {s.maskedSentence.slice(s.maskedSentence.indexOf(BLANK) + BLANK.length)}
                    </span>
                  ) : (
                    <span>{s.maskedSentence}</span>
                  )}
                </p>
                {matchedWordPair && (
                  <span className="inline-block text-xs text-slate-600 dark:text-zinc-400 italic">
                    Ghép với: <strong>{matchedWordPair.word}</strong> (bấm để gỡ)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={Object.keys(matches).length === 0 || isAnswered}
            className="inline-flex items-center gap-1.5 min-h-10 px-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Làm lại ghép cặp</span>
          </button>
          {!isAnswered && (
            <GiveUpButton onConfirm={handleGiveUp} label="Không nhớ" icon={<Eye className="w-3.5 h-3.5" />} />
          )}
        </div>

        <button
          onClick={handleCheck}
          disabled={!allMatched || isAnswered}
          className="px-5 min-h-12 rounded-2xl text-base font-semibold bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          Kiểm tra kết quả
        </button>
      </div>

      {/* Dedicated Stable Feedback Area - ALWAYS occupies 48px so layout NEVER jumps */}
      <div className="h-[48px] min-h-[48px] flex items-center justify-center w-full">
        {isAnswered && isCorrect ? (
          <div className="w-full h-full px-3.5 rounded-2xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/40 text-green-800 dark:text-green-200 text-sm flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="font-semibold">
              {byElimination
                ? `Đúng hết, nhưng "${word.word}" là cặp cuối còn lại nên chưa tính là nhớ chắc. Bấm Tiếp tục.`
                : "Tuyệt vời! Bạn đã ghép đúng toàn bộ ngữ cảnh. Bấm Tiếp tục."}
            </span>
          </div>
        ) : isAnswered && isCorrect === false ? (
          <div className="w-full h-full px-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200 text-sm flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="font-semibold">
              Đã hiển thị các cặp ghép đúng. Từ "{word.word}" sẽ được ôn lại sớm. Bấm Tiếp tục.
            </span>
          </div>
        ) : isCorrect === false && !isAnswered ? (
          <div className="w-full h-full px-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200 text-sm flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>Có cặp chưa khớp, đổi lại vị trí rồi thử tiếp nhé!</span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 ml-2 px-3 min-h-10 rounded-xl border border-red-200 bg-white dark:border-red-500/40 dark:bg-transparent font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-red-700 dark:text-red-300 text-sm"
            >
              Ghép lại
            </button>
          </div>
        ) : (
          <div className="w-full h-full rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-center text-sm text-slate-600 dark:text-zinc-400 font-medium select-none px-3">
            <span>Chọn 1 từ ở cột trái rồi chọn câu có chỗ trống tương ứng ở cột phải</span>
          </div>
        )}
      </div>
    </div>
  );
}
