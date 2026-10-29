import { SkipForward } from "lucide-react";
import { Rating, type IntervalPreviews } from "@/services/srs";
import type { ExerciseType } from "@/services/smartReview";
import { isSimpleMode } from "@/services/learnerProfile";
import { EXERCISE_LABEL_VN } from "./exerciseLabels";
import GiveUpButton from "./GiveUpButton";
import type { LetterTilesAction } from "../exercises/LetterTilesExercise";

interface GradingBarProps {
  effectiveExerciseType: ExerciseType;
  handleGrade: (rating: Rating, overrideExerciseType?: ExerciseType, attempts?: number) => void;
  isAdvancing: boolean;
  isFlipped: boolean;
  setIsFlipped: (value: boolean) => void;
  hasCheckedAnswer: boolean;
  isCorrect: boolean | null;
  intervalPreviews: IntervalPreviews;
  handleCheckAnswer: () => void;
  userInput: string;
  /** After "Xem đáp án" the word was not recalled: only Again is a truthful grade */
  onlyAgain: boolean;
  /** Easy is offered only for production (recall) cards; recognition is capped at Good */
  allowEasy: boolean;
  /** Grade of a correct typed answer waiting for the user to continue */
  pendingRating: Rating | null;
  onContinue: () => void;
  /** A new word's introduction card: one "continue" button, nothing is graded */
  introMode?: boolean;
  onIntroDone?: () => void;
  /** The word has not been said aloud yet: the introduction cannot be finished */
  introLocked?: boolean;
  /** Practice mode: does not move FSRS schedule */
  isPractice?: boolean;
  /** The letter tiles' check, shown here instead of on the card */
  tilesAction?: LetterTilesAction | null;
}

/** BOTTOM ACTION BAR - at least h-14 in every state (it only grows for the grades and their caption) */
export default function GradingBar({
  effectiveExerciseType,
  handleGrade,
  isAdvancing,
  isFlipped,
  setIsFlipped,
  hasCheckedAnswer,
  isCorrect,
  intervalPreviews,
  handleCheckAnswer,
  userInput,
  onlyAgain,
  allowEasy,
  pendingRating,
  onContinue,
  introMode = false,
  onIntroDone,
  introLocked = false,
  isPractice = false,
  tilesAction = null,
}: GradingBarProps) {
  // Simple mode: Vietnamese labels only (no Again/Hard/Good/Easy, no exercise code names)
  const simple = isSimpleMode();
  // Only the grades that can be used are shown: after "show answer" just Quên, on recognition cards no Dễ
  const grades = [
    {
      rating: Rating.Again,
      label: "Quên",
      key: 1,
      keyLabel: "Again (1)",
      highlight: !isCorrect && effectiveExerciseType !== "flip",
      activeCls: "border-red-600 bg-red-100 text-red-900 ring-2 ring-red-600/20 dark:border-red-500 dark:bg-red-500/20 dark:text-red-100",
      idleCls: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
      badgeCls: "text-red-700 dark:text-red-300",
    },
    {
      rating: Rating.Hard,
      label: "Khó",
      key: 2,
      keyLabel: "Hard (2)",
      highlight: false,
      activeCls: "",
      idleCls: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
      badgeCls: "text-amber-700 dark:text-amber-300",
    },
    {
      rating: Rating.Good,
      label: "Nhớ",
      key: 3,
      keyLabel: "Good (3)",
      highlight: !!isCorrect,
      activeCls: "border-teal-800 bg-teal-700 text-white ring-2 ring-teal-700/25 dark:bg-teal-600",
      idleCls: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800 dark:border-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500",
      badgeCls: "text-teal-50",
    },
    {
      rating: Rating.Easy,
      label: "Dễ",
      key: 4,
      keyLabel: "Easy (4)",
      highlight: false,
      activeCls: "",
      idleCls: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200",
      badgeCls: "text-green-700 dark:text-green-300",
    },
  ].filter((g) => (onlyAgain ? g.rating === Rating.Again : g.rating !== Rating.Easy || allowEasy));

  // The letter tiles: their "Kiểm tra" here, in the place and look of "Tiếp tục" (their other buttons are on the card)
  if (effectiveExerciseType === "letter_tiles" && !introMode && pendingRating === null) {
    if (!tilesAction) return null;
    return (
      <div className="w-full mt-3 shrink-0">
        <button
          onClick={tilesAction.check}
          disabled={!tilesAction.canCheck || isAdvancing}
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 text-white text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Kiểm tra</span>
          <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">Enter ↵</kbd>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mt-3 min-h-14 shrink-0 flex items-center justify-center">
      {introMode ? (
        <button
          onClick={onIntroDone}
          disabled={isAdvancing || introLocked}
          autoFocus
          className="w-full min-h-14 px-3 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white disabled:opacity-40 text-base font-semibold leading-tight flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>{introLocked ? "🎤 Đọc to từ này, hoặc chọn \"không nói to được\" ở trên" : "Học tiếp (sẽ hỏi lại sau vài thẻ)"}</span>
          {!introLocked && <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">Enter ↵</kbd>}
        </button>
      ) : pendingRating !== null ? (
        <button
          onClick={onContinue}
          disabled={isAdvancing}
          autoFocus
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white disabled:opacity-40 text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Tiếp tục</span>
          <span className="text-xs opacity-80">
            {isPractice
              ? "(luyện tập củng cố)"
              : pendingRating === Rating.Again
              ? "(gặp lại ở cuối phiên)"
              : `(gặp lại sau ${intervalPreviews[pendingRating as keyof IntervalPreviews]})`}
          </span>
          <kbd className="px-2 py-0.5 rounded bg-white/20 dark:bg-black/10 text-[11px] font-mono">Enter ↵</kbd>
        </button>
      ) : ["multiple_choice", "sentence_builder", "context_match", "meaning_match", "listening", "reverse_cloze", "free_writing", "letter_tiles"].includes(
        effectiveExerciseType
      ) ? (
        <div className="w-full flex items-center justify-between px-3">
          {effectiveExerciseType === "letter_tiles" ? (
            // The exercise has its own "Không nhớ, xem đáp án" (it asks twice): a second one-tap way to fail the word, down
            // here by the bottom of the screen, was only a mis-tap waiting to happen
            <span />
          ) : (
            <GiveUpButton
              onConfirm={() => handleGrade(Rating.Again, effectiveExerciseType)}
              disabled={isAdvancing}
              label="Chưa nhớ từ này"
              icon={<SkipForward className="w-3.5 h-3.5" />}
            />
          )}
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            {EXERCISE_LABEL_VN[effectiveExerciseType]}
          </div>
        </div>
      ) : (effectiveExerciseType === "flip" ? isFlipped : hasCheckedAnswer) ? (
        <div className="w-full flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-150">
          <div
            className={`w-full grid gap-2 ${grades.length === 1 ? "grid-cols-1" : grades.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}
          >
            {grades.map((g) => (
              <button
                key={g.rating}
                onClick={() => handleGrade(g.rating)}
                disabled={isAdvancing}
                className={`min-h-16 px-1 py-2 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  g.highlight ? `${g.activeCls} font-bold` : `${g.idleCls} font-medium`
                }`}
              >
                <span className="text-base font-bold leading-tight">{g.label}</span>
                <span className={`text-xs leading-tight font-medium ${g.badgeCls}`}>
                  {intervalPreviews[g.rating as keyof IntervalPreviews]}
                </span>
                <span className="desktop-only text-[11px] font-mono opacity-80">{simple ? `phím ${g.key}` : g.keyLabel}</span>
              </button>
            ))}
          </div>
          <p className="text-xs leading-snug text-center text-slate-600 dark:text-zinc-400">
            {onlyAgain
              ? "Bạn đã xem đáp án nên chỉ chấm Quên."
              : `Quên: không nhớ ra · Khó: nhớ chậm, còn lúng túng · Nhớ: nhớ đúng${
                  allowEasy ? " · Dễ: nhớ ngay, không cần nghĩ" : ""
                }. Số dưới mỗi nút: bao lâu nữa từ này hiện lại.`}
          </p>
        </div>
      ) : effectiveExerciseType === "flip" ? (
        <button
          onClick={() => setIsFlipped(true)}
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Lật thẻ xem đáp án</span>
          <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">
            Space
          </kbd>
        </button>
      ) : effectiveExerciseType === "cloze" ? (
        <button
          onClick={handleCheckAnswer}
          disabled={!userInput.trim() || isAdvancing}
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-40 text-white text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Kiểm tra đáp án</span>
          <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">
            Enter ↵
          </kbd>
        </button>
      ) : (
        <button
          onClick={handleCheckAnswer}
          disabled={!userInput.trim() || isAdvancing}
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-40 text-white text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Kiểm tra chính tả</span>
          <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">
            Enter ↵
          </kbd>
        </button>
      )}
    </div>
  );
}
