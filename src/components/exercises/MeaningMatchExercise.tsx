import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Link2, Eye } from "lucide-react";
import GiveUpButton from "../review/GiveUpButton";
import { Rating } from "@/services/srs";
import { shuffle } from "@/lib/utils";
import type { WordDetail } from "@/types/database";
import { prepareMeaningMatch, type MeaningMatchPair } from "@/services/smartReview";
import { playWrongTry } from "@/services/sound";

interface MeaningMatchExerciseProps {
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

/**
 * Word ↔ meaning matching game. Only the reviewed word is graded: a wrong pairing counts against it when
 * it involves the reviewed word or its meaning; mistakes between the other words are just corrected.
 * Each pair is checked as soon as it is made (correct pairs lock, wrong ones flash), so the learner always
 * knows which pairing was wrong.
 */
export default function MeaningMatchExercise({
  word,
  allWords,
  excludeIds,
  onComplete,
  onSpeak,
  onFallback,
}: MeaningMatchExerciseProps) {
  const pairs: MeaningMatchPair[] = useMemo(
    () => prepareMeaningMatch(word, allWords, excludeIds),
    // The pairs must not reshuffle while the learner is playing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word.id]
  );
  const meanings = useMemo(() => shuffle(pairs), [pairs]);

  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ wordId: string; meaningId: string } | null>(null);
  const [targetMistakes, setTargetMistakes] = useState(0);
  const [done, setDone] = useState(false);
  // The target's pair was the last one left: found by elimination, so not a clean recall
  const [byElimination, setByElimination] = useState(false);

  const onFallbackRef = useRef(onFallback);
  useEffect(() => {
    onFallbackRef.current = onFallback;
  });

  // Pending completion timer, cleared on unmount so a stale card is never graded
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (wrongFlashTimerRef.current) clearTimeout(wrongFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (pairs.length < MIN_PAIRS) onFallbackRef.current();
  }, [pairs]);

  if (pairs.length < MIN_PAIRS) return null;

  const tryPair = (wordId: string, meaningId: string) => {
    if (done) return;
    if (wordId === meaningId) {
      const next = new Set(matched).add(wordId);
      setMatched(next);
      setSelectedWordId(null);
      if (next.size === pairs.length) {
        setDone(true);
        // If the target's pair is the one made last, every other pair was already made: found by elimination
        const eliminated = wordId === word.id;
        setByElimination(eliminated);
        onSpeak(word.word);
        // Hard with 0 wrong attempts is read by the session as a hint, so an eliminated target grades Hard.
        // The session derives the real grade from the mistakes on the target
        // Reported at once: the session keeps this card on screen until the learner continues
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
        onComplete(targetMistakes === 0 && !eliminated, targetMistakes, eliminated ? Rating.Hard : Rating.Good);
      }
      return;
    }
    if (wordId === word.id || meaningId === word.id) setTargetMistakes((n) => n + 1);
    playWrongTry();
    setWrongFlash({ wordId, meaningId });
    setSelectedWordId(null);
    if (wrongFlashTimerRef.current) clearTimeout(wrongFlashTimerRef.current);
    wrongFlashTimerRef.current = setTimeout(() => {
      wrongFlashTimerRef.current = null;
      setWrongFlash(null);
    }, 600);
  };

  const handleGiveUp = () => {
    if (done) return;
    setDone(true);
    setMatched(new Set(pairs.map((p) => p.wordId)));
    onSpeak(word.word);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    onComplete(false, Math.max(targetMistakes, 1), Rating.Again);
  };

  const handleWordClick = (wordId: string) => {
    if (done || matched.has(wordId)) return;
    setSelectedWordId((prev) => (prev === wordId ? null : wordId));
  };

  const handleMeaningClick = (meaningId: string) => {
    if (done || matched.has(meaningId) || !selectedWordId) return;
    tryPair(selectedWordId, meaningId);
  };

  const cell = (state: "matched" | "selected" | "wrong" | "idle") =>
    state === "matched"
      ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-500/10 dark:border-green-500 dark:text-green-200 opacity-70"
      : state === "selected"
      ? "border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:border-teal-400 dark:text-teal-200"
      : state === "wrong"
      ? "border-red-600 bg-red-50 text-red-800 dark:bg-red-500/10 dark:border-red-500 dark:text-red-200 animate-shake"
      : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-700/50 dark:hover:border-teal-400/50 text-slate-900 dark:text-zinc-100";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <Link2 className="w-3 h-3" />
          <span>Nối từ với nghĩa</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Chọn một từ tiếng Anh ở cột trái rồi chọn nghĩa tiếng Việt tương ứng ở cột phải.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-zinc-400 px-1">Từ vựng</h4>
          {pairs.map((p) => {
            const state = matched.has(p.wordId)
              ? "matched"
              : wrongFlash?.wordId === p.wordId
              ? "wrong"
              : selectedWordId === p.wordId
              ? "selected"
              : "idle";
            return (
              <button
                key={p.wordId}
                onClick={() => handleWordClick(p.wordId)}
                disabled={done || matched.has(p.wordId)}
                className={`w-full min-h-14 px-4 py-3 rounded-2xl border text-left transition-colors flex items-center justify-between ${cell(state)}`}
              >
                <span className="text-base font-semibold">{p.word}</span>
                {matched.has(p.wordId) && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-zinc-400 px-1">Nghĩa tiếng Việt</h4>
          {meanings.map((m) => {
            const state = matched.has(m.wordId) ? "matched" : wrongFlash?.meaningId === m.wordId ? "wrong" : "idle";
            return (
              <button
                key={m.wordId}
                onClick={() => handleMeaningClick(m.wordId)}
                disabled={done || matched.has(m.wordId)}
                className={`w-full min-h-14 px-4 py-3 rounded-2xl border text-left transition-colors text-sm font-medium leading-relaxed ${cell(state)} ${
                  selectedWordId && state === "idle" ? "border-dashed border-teal-700/40 dark:border-teal-400/40" : ""
                }`}
              >
                {m.meaningVN}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm px-1 min-h-[40px]">
        {done ? (
          <span className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            {targetMistakes === 0 && !byElimination
              ? `Chính xác! "${word.word}" đã được nối đúng ngay.`
              : targetMistakes === 0
              ? `Đã nối xong. "${word.word}" là cặp cuối còn lại (không cần nhớ cũng nối được) nên chưa tính là nhớ chắc.`
              : `Đã nối xong. "${word.word}" cần ôn lại sớm.`}
          </span>
        ) : (
          <>
            <span className="text-slate-600 dark:text-zinc-400">
              Chỉ cặp của từ <strong>{word.word}</strong> được tính vào kết quả.
            </span>
            <GiveUpButton onConfirm={handleGiveUp} label="Không nhớ" icon={<Eye className="w-3.5 h-3.5" />} />
          </>
        )}
      </div>
    </div>
  );
}
