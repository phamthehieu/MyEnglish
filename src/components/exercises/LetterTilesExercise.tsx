import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, HelpCircle, RotateCcw } from "lucide-react";
import { Rating } from "@/services/srs";
import type { WordDetail } from "@/types/database";
import { isLeech, maskWordInSentence, pickExample } from "@/services/smartReview";
import { getConciseMeaning } from "@/services/meaningText";
import { maskTargetInMeaning } from "@/utils/exerciseHints";
import { playWrongTry } from "@/services/sound";

interface LetterTilesExerciseProps {
  word: WordDetail;
  /** Rating: Hard when the first-letter hint was used, else Good; attempts = wrong tries */
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string) => void;
  hideHeader?: boolean;
  hideHints?: boolean;
  /**
   * Given: the "Kiểm tra" button is drawn by the parent (in the bar under the card, where "Tiếp tục" comes), so this
   * reports what it needs: whether every letter is placed, and how to check. null once the word is answered.
   */
  onAction?: (action: LetterTilesAction | null) => void;
}

export interface LetterTilesAction {
  canCheck: boolean;
  check: () => void;
}

/** Characters placed automatically (the learner only builds the letters) */
export const FIXED = /[\s\-'’.,/()]/;
/** Extra letters that are not in the word, so the user must identify the correct letters among distractors */
export const EXTRA_POOL = "etaoinsrhldcumfpgwybvkxjqz";

export interface Tile {
  id: number;
  ch: string;
}

export function buildTiles(
  target: string,
  random: () => number = Math.random,
  distractorCount?: number
): Tile[] {
  const letters = [...target.toLowerCase()].filter((c) => !FIXED.test(c));
  // 3-4 distractor letters unless explicitly specified
  const count = distractorCount !== undefined ? distractorCount : (Math.floor(random() * 2) + 3);

  const distinctExtras = [...EXTRA_POOL].filter((c) => !letters.includes(c));
  for (let i = distinctExtras.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [distinctExtras[i], distinctExtras[j]] = [distinctExtras[j], distinctExtras[i]];
  }
  const extras = distinctExtras.slice(0, count);

  // Fallback in case distinct characters are fewer than count
  if (extras.length < count) {
    const fallback = [...EXTRA_POOL];
    for (let i = fallback.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
    }
    extras.push(...fallback.slice(0, count - extras.length));
  }

  const all = [...letters, ...extras].map((ch, id) => ({ id, ch }));
  // Fisher-Yates, then make sure the tiles do not already spell the word in order
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  if (all.slice(0, letters.length).map((t) => t.ch).join("") === letters.join("") && all.length > 1) {
    const diffIdx = all.findIndex((t, idx) => idx > 0 && t.ch !== all[0].ch);
    if (diffIdx > 0) {
      [all[0], all[diffIdx]] = [all[diffIdx], all[0]];
    }
  }
  return all;
}

export { decomposeVietnameseChar, type VietDecomposition } from "@/lib/telex";
import { decomposeVietnameseChar } from "@/lib/telex";

/**
 * First step of the recall ladder (see selectExerciseType): the Vietnamese meaning is shown, the learner
 * builds the English word from shuffled letters of that word (plus 3-4 distractor letters). Easier than typing from scratch,
 * so a beginner can start producing words without failing on every spelling detail.
 */
export default function LetterTilesExercise({
  word,
  onComplete,
  onSpeak,
  hideHeader = false,
  hideHints = hideHeader,
  onAction,
}: LetterTilesExerciseProps) {
  const target = word.word.trim();
  const slots = useMemo(() => [...target.toLowerCase()], [target]);
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(target));
  const [picked, setPicked] = useState<number[]>([]); // tile ids, in slot order (letters only)
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [state, setState] = useState<"building" | "wrong" | "correct" | "give_up">("building");
  // "Không nhớ" was pressed once: the next press gives up (it falls back after a few seconds, or when the learner goes on)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentUndosRef = useRef<Array<{ id: number; ch: string; time: number }>>([]);

  useEffect(() => {
    setTiles(buildTiles(target));
    setPicked([]);
    setWrongAttempts(0);
    setHint(false);
    setHintsUsed(0);
    setState("building");
    doneRef.current = false;
    recentUndosRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [target]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    setConfirmGiveUp(false);
  }, [target, picked]);
  useEffect(() => {
    if (!confirmGiveUp) return;
    const t = setTimeout(() => setConfirmGiveUp(false), 3000);
    return () => clearTimeout(t);
  }, [confirmGiveUp]);

  const letterCount = slots.filter((c) => !FIXED.test(c)).length;
  const example = pickExample(word);
  const maskedExampleSentence = useMemo(() => {
    if (!example?.sentence_en) return null;
    return maskWordInSentence(example.sentence_en, target, "____") || example.sentence_en;
  }, [example, target]);

  // Adaptive Scaffolding: calculate max allowed hints based on SRS memory stability
  const maxHints = useMemo(() => {
    const srs = word.srs;
    const reps = srs?.reps ?? 0;
    const stability = srs?.stability ?? 0;

    // Stage 1: New card, low reps, low stability (< 2 days), or leech
    if (reps === 0 || stability < 2 || isLeech(srs)) {
      // 50% of the word's letters, rounded up for odd numbers (e.g. 5 letters -> 3 hints)
      return Math.max(1, Math.ceil(letterCount * 0.5));
    }
    // Stage 2: Intermediate familiarity (2 - 7 days stability)
    if (stability < 7) {
      // Faded assistance: ~30% of letters
      return Math.max(1, Math.floor(letterCount * 0.3));
    }
    // Stage 3: Mature word (stability >= 7 days)
    // Only give 1 hint if user has made at least 2 wrong attempts
    return wrongAttempts >= 2 ? 1 : 0;
  }, [word.srs, letterCount, wrongAttempts]);

  const builtLetters = picked.map((id) => tiles.find((t) => t.id === id)?.ch ?? "");
  const slotIndices = useMemo(() => {
    let k = 0;
    return slots.map((c) => (FIXED.test(c) ? -1 : k++));
  }, [slots]);

  const giveUp = useCallback(() => {
    if (doneRef.current || state === "correct" || state === "give_up") return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    doneRef.current = true;
    setState("give_up");
    onSpeak(target);
    onComplete(false, Math.max(wrongAttempts, 1), Rating.Again);
  }, [state, target, onSpeak, onComplete, wrongAttempts]);

  const check = useCallback(
    (ids: number[]) => {
      if (doneRef.current || state === "correct" || state === "wrong" || state === "give_up") return;
      if (ids.length !== letterCount) return;
      const built = ids.map((id) => tiles.find((t) => t.id === id)?.ch ?? "").join("");
      const expected = slots.filter((c) => !FIXED.test(c)).join("");
      if (built === expected) {
        doneRef.current = true;
        setState("correct");
        onSpeak(target);
        // Reported at once: the session keeps the built word on screen until the learner continues
        onComplete(true, wrongAttempts, (hint || hintsUsed > 0) ? Rating.Hard : Rating.Good);
      } else {
        setState("wrong");
        playWrongTry();
        const tries = wrongAttempts + 1;
        setWrongAttempts(tries);
        if (tries >= 2) setHint(true);
        // Show the wrong word briefly, then give the tiles back
        timerRef.current = setTimeout(() => {
          setPicked([]);
          setState("building");
        }, 900);
      }
    },
    [tiles, slots, onSpeak, target, onComplete, wrongAttempts, hint, hintsUsed, letterCount, state]
  );

  const applyNextLetterHint = useCallback(() => {
    if (doneRef.current || state === "correct" || state === "give_up") return;
    if (hintsUsed >= maxHints) return;

    const expectedLetters = slots.filter((c) => !FIXED.test(c));

    // Determine how many prefix letters in `picked` are currently correct
    let correctPrefixCount = 0;
    for (let i = 0; i < picked.length; i++) {
      const tile = tiles.find((t) => t.id === picked[i]);
      if (tile && tile.ch === expectedLetters[i]) {
        correctPrefixCount++;
      } else {
        break;
      }
    }

    const nextIdx = correctPrefixCount;
    if (nextIdx >= expectedLetters.length) return;

    const targetChar = expectedLetters[nextIdx];
    const validPickedPrefix = picked.slice(0, correctPrefixCount);

    // Find a tile with targetChar that isn't already used in validPickedPrefix
    const tileToPick = tiles.find((t) => t.ch === targetChar && !validPickedPrefix.includes(t.id));
    if (!tileToPick) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState("building");
    const nextPicked = [...validPickedPrefix, tileToPick.id];
    setPicked(nextPicked);
    setHintsUsed((prev) => prev + 1);

    // If hint completes all letters, trigger check
    if (nextPicked.length === letterCount) {
      check(nextPicked);
    }
  }, [state, hintsUsed, maxHints, slots, picked, tiles, letterCount, check]);

  // The parent draws "Kiểm tra": tell it whether the word is complete, and how to check it
  const answered = state === "correct" || state === "give_up";
  const canCheck = state !== "wrong" && picked.length === letterCount;
  useEffect(() => {
    if (!onAction) return;
    onAction(answered ? null : { canCheck, check: () => check(picked) });
  }, [onAction, answered, canCheck, check, picked]);
  useEffect(() => () => onAction?.(null), [onAction]);

  const pick = useCallback(
    (id: number) => {
      if (doneRef.current || state === "correct" || state === "give_up") return;
      if (state === "wrong") {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setPicked([]);
      }
      setState("building");
      setPicked((prev) => {
        if (prev.includes(id) || prev.length >= letterCount) return prev;
        const next = [...prev, id];
        if (next.length === letterCount) {
          setTimeout(() => check(next), 40);
        }
        return next;
      });
    },
    [letterCount, state, check]
  );

  const unpickAt = useCallback(
    (index: number) => {
      if (doneRef.current || state === "correct" || state === "give_up") return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setState("building");
      setPicked((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        return prev.filter((_, i) => i !== index);
      });
    },
    [state]
  );

  const undo = useCallback(() => {
    if (doneRef.current || state === "correct" || state === "give_up") return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState("building");
    setPicked((prev) => {
      if (prev.length === 0) return prev;
      const lastId = prev[prev.length - 1];
      const lastTile = tiles.find((t) => t.id === lastId);
      if (lastTile) {
        const now = Date.now();
        recentUndosRef.current = [
          ...recentUndosRef.current.filter((u) => now - u.time < 500).slice(-4),
          { id: lastId, ch: lastTile.ch, time: now },
        ];
      }
      return prev.slice(0, -1);
    });
  }, [state, tiles]);

  const clear = () => {
    if (doneRef.current || state === "correct" || state === "give_up") return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recentUndosRef.current = [];
    setState("building");
    setPicked([]);
  };

  // Keyboard: type a letter to pick a matching tile, Backspace to undo, Enter to submit and check
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (doneRef.current || state === "correct" || state === "give_up") return;
      if (e.repeat) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        undo();
        return;
      }

      if (e.key === "Enter") {
        if (picked.length === letterCount && state !== "wrong") {
          e.preventDefault();
          e.stopPropagation();
          check(picked);
        }
        return;
      }

      if (e.key.length !== 1) return;
      const ch = e.key.toLowerCase();

      // 1. Vietnamese Telex support: when typing with Vietnamese IME (EVKey, Unikey, macOS Telex),
      // typing 'r' after 'i' (like in "their") causes the IME to send Backspace (deleting 'i') followed by 'ỉ'.
      // We detect the accented character, restore the deleted vowel, and pick the intended letter ('r').
      const viet = decomposeVietnameseChar(ch);
      if (viet) {
        e.preventDefault();
        setPicked((prev) => {
          let nextPicked = [...prev];
          const now = Date.now();

          // Check if the base vowel was deleted by the IME's fake Backspace within the last 350ms
          const undoIdx = recentUndosRef.current.findIndex(
            (u) => u.ch === viet.base && now - u.time < 350 && !nextPicked.includes(u.id)
          );

          if (undoIdx !== -1) {
            const [restored] = recentUndosRef.current.splice(undoIdx, 1);
            if (nextPicked.length < letterCount) {
              nextPicked.push(restored.id);
            }
          } else {
            // If not undone, check if current end of picked has base
            const lastId = nextPicked[nextPicked.length - 1];
            const lastTile = tiles.find((t) => t.id === lastId);
            if (!lastTile || lastTile.ch !== viet.base) {
              const baseTile = tiles.find((t) => t.ch === viet.base && !nextPicked.includes(t.id));
              if (baseTile && nextPicked.length < letterCount) {
                nextPicked.push(baseTile.id);
              }
            }
          }

          // Pick the Telex modifier keys (e.g. 'r' for ỉ, 's' for í, 'w' for ơ/ư/ă, etc.)
          for (const key of viet.telexKeys) {
            if (nextPicked.length >= letterCount) break;
            const tile = tiles.find((t) => t.ch === key && !nextPicked.includes(t.id));
            if (tile) {
              nextPicked.push(tile.id);
            }
          }

          return nextPicked;
        });
        return;
      }

      // 2. Normal ASCII letter matching
      const tile = tiles.find((t) => t.ch === ch && !picked.includes(t.id));
      if (tile) {
        e.preventDefault();
        pick(tile.id);
        return;
      }

      // 3. Fallback to physical key from e.code if key character was modified by another IME layout
      if (e.code && e.code.startsWith("Key")) {
        const physicalChar = e.code.slice(3).toLowerCase();
        if (physicalChar.length === 1 && physicalChar !== ch) {
          const fallbackTile = tiles.find((t) => t.ch === physicalChar && !picked.includes(t.id));
          if (fallbackTile) {
            e.preventDefault();
            pick(fallbackTile.id);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tiles, picked, pick, undo, check, letterCount, state]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {!hideHeader ? (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 text-center space-y-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">Xếp chữ cái thành từ tiếng Anh có nghĩa:</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{maskTargetInMeaning(getConciseMeaning(word.meaning_vn, target, example), target)}</h2>
          {/* The pronunciation as a hint */}
          {word.phonetic && <p className="font-mono text-base text-teal-700 dark:text-teal-300">{word.phonetic}</p>}

          {/* Context Example Sentence with Blank */}
          {maskedExampleSentence && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-center space-y-0.5">
              <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-zinc-200">
                "{maskedExampleSentence}"
              </p>
              {example?.sentence_vn && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
                  {example.sentence_vn}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-zinc-400 pt-1">
          <span>Xếp chữ cái thành từ tiếng Anh:</span>
          <span className="text-xs font-mono text-teal-700 dark:text-teal-300 font-bold">
            {letterCount} chữ cái
          </span>
        </div>
      )}

      {/* Slots */}
      <div className={`flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 min-h-[48px] py-1 ${state === "wrong" ? "animate-shake" : ""}`}>
        {slots.map((slotChar, i) => {
          const isFixed = FIXED.test(slotChar);
          if (isFixed) {
            return (
              <span key={i} className="w-4 flex items-center justify-center font-bold text-slate-400 dark:text-zinc-500">
                {slotChar === " " ? "" : slotChar}
              </span>
            );
          }

          const nonFixedIdx = slotIndices[i];
          const hasLetter = nonFixedIdx >= 0 && nonFixedIdx < picked.length;
          const letter = hasLetter ? builtLetters[nonFixedIdx] : "";
          const isFirstSlotHint = hint && i === 0 && !hasLetter;

          if (hasLetter && state !== "correct" && state !== "give_up") {
            return (
              <button
                key={i}
                type="button"
                onClick={() => unpickAt(nonFixedIdx)}
                title="Bấm để xóa chữ này"
                className={`w-8 h-11 sm:w-10 sm:h-12 rounded-lg sm:rounded-xl border-2 flex items-center justify-center text-lg sm:text-xl font-bold font-mono transition-colors cursor-pointer select-none group ${
                  state === "wrong"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:border-red-600 hover:bg-red-50"
                    : "border-teal-700 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-400/10 dark:text-teal-200 hover:border-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-300 active:scale-95"
                }`}
              >
                {letter}
              </button>
            );
          }

          return (
            <span
              key={i}
              className={`w-8 h-11 sm:w-10 sm:h-12 rounded-lg sm:rounded-xl border-2 flex items-center justify-center text-lg sm:text-xl font-bold font-mono select-none ${
                state === "correct"
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-500/10 dark:border-green-500 dark:text-green-200"
                  : state === "give_up"
                  ? "border-red-600 bg-red-50 text-red-800 dark:bg-red-500/10 dark:border-red-500 dark:text-red-200 font-bold"
                  : state === "wrong"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  : nonFixedIdx === picked.length && state === "building" ? "border-teal-500 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-950/30 text-teal-700 ring-2 ring-teal-500/20" : "border-dashed border-slate-300 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-slate-400"
              }`}
            >
              {state === "give_up"
                ? slotChar
                : letter || (isFirstSlotHint ? <span className="text-slate-300 dark:text-zinc-600">{slots[0]}</span> : "")}
            </span>
          );
        })}
      </div>

      {/* Helpers sit under the answer being built, away from the main button: a hint costs the word a grade (Hard) */}
      {state !== "correct" && state !== "give_up" && (
        <div className="flex items-center justify-center gap-1 text-sm">
          <button
            type="button"
            onClick={clear}
            disabled={picked.length === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium cursor-pointer"
            title="Làm lại từ đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Làm lại</span>
          </button>
          {!hideHints && maxHints > 0 && (
            <button
              type="button"
              onClick={applyNextLetterHint}
              disabled={hintsUsed >= maxHints || picked.length === letterCount}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl font-medium transition-colors ${
                hintsUsed < maxHints && picked.length < letterCount
                  ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs cursor-pointer active:scale-95"
                  : "opacity-40 text-slate-400 dark:text-zinc-600 border border-slate-200 dark:border-zinc-800 cursor-not-allowed"
              }`}
              title={
                hintsUsed < maxHints
                  ? `Gợi ý ký tự tiếp theo (còn ${maxHints - hintsUsed}/${maxHints} lần)`
                  : "Đã dùng hết số lượt gợi ý cho từ này"
              }
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Gợi ý ({Math.max(0, maxHints - hintsUsed)})</span>
            </button>
          )}

          {/* Giving up counts the word as forgotten: it asks twice */}
          <button
            type="button"
            onClick={() => (confirmGiveUp ? giveUp() : setConfirmGiveUp(true))}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl font-medium transition-colors cursor-pointer ${
              confirmGiveUp
                ? "border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                : "text-slate-600 hover:text-red-700 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-500/10"
            }`}
            title="Xem đáp án và học lại từ này (tính là chưa nhớ)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{confirmGiveUp ? "Bấm lần nữa" : "Không nhớ"}</span>
          </button>
        </div>
      )}

      {/* Tiles */}
      <div className="flex flex-wrap justify-center gap-2 py-1">
        {tiles.map((t) => {
          const used = picked.includes(t.id);
          const pickedIdx = picked.indexOf(t.id);
          return (
            <button
              key={t.id}
              onClick={() => {
                if (used) {
                  unpickAt(pickedIdx);
                } else {
                  pick(t.id);
                }
              }}
              disabled={state === "correct" || state === "give_up"}
              title={used ? "Bấm để xóa chữ này khỏi từ đã ghép" : undefined}
              className={`w-12 h-12 rounded-2xl text-lg font-bold font-mono transition-colors ${
                used || state === "give_up"
                  ? "bg-slate-50 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 border border-dashed border-slate-300 dark:border-zinc-700 cursor-not-allowed opacity-60"
                  : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-teal-700 hover:bg-teal-50 dark:hover:border-teal-400 dark:hover:bg-teal-400/10 active:scale-95 cursor-pointer"
              }`}
            >
              {t.ch}
            </button>
          );
        })}
      </div>

      {/* What the exercise says now. Always the same height, so nothing moves under the learner's finger */}
      <div className="min-h-[28px] flex items-center justify-center px-1 text-sm text-center" aria-live="polite">
        {state === "correct" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {target}
          </span>
        ) : state === "give_up" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" /> Đáp án: {target}
          </span>
        ) : state === "wrong" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" /> Gần rồi, đổi vài chữ rồi thử lại nhé
          </span>
        ) : picked.length === letterCount ? (
          <span className="font-medium text-teal-700 dark:text-teal-300">Đã đủ chữ, bấm Kiểm tra</span>
        ) : (
          <span className="font-mono text-slate-600 dark:text-zinc-400">
            {picked.length}/{letterCount} chữ
          </span>
        )}
      </div>

      {/* The main button, when the parent does not draw it in its own bar. It sleeps until every letter is placed, so a
          tap that comes too early does nothing */}
      {!onAction && state !== "correct" && state !== "give_up" && (
        <button
          type="button"
          onClick={() => check(picked)}
          disabled={!canCheck}
          className="w-full min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 disabled:pointer-events-none text-white font-semibold text-base shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Kiểm tra</span>
          <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono leading-none">Enter</kbd>
        </button>
      )}
    </div>
  );
}
