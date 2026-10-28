import { SkipForward } from "lucide-react";
import { Rating, type IntervalPreviews } from "@/services/srs";
import type { ExerciseType } from "@/services/smartReview";
import { isSimpleMode } from "@/services/learnerProfile";
import { EXERCISE_LABEL_VN } from "./exerciseLabels";
import GiveUpButton from "./GiveUpButton";

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
      activeCls: "border-rose-400 dark:border-rose-500 bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/30",
      idleCls: "border-rose-200 dark:border-rose-800/80 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300",
      badgeCls: "bg-rose-200/70 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100",
    },
    {
      rating: Rating.Hard,
      label: "Khó",
      key: 2,
      keyLabel: "Hard (2)",
      highlight: false,
      activeCls: "",
      idleCls: "border-amber-200 dark:border-amber-800/80 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300",
      badgeCls: "bg-amber-200/70 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100",
    },
    {
      rating: Rating.Good,
      label: "Nhớ",
      key: 3,
      keyLabel: "Good (3)",
      highlight: !!isCorrect,
      activeCls: "border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/30",
      idleCls: "border-blue-200 dark:border-blue-800/80 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300",
      badgeCls: "bg-blue-200/70 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100",
    },
    {
      rating: Rating.Easy,
      label: "Dễ",
      key: 4,
      keyLabel: "Easy (4)",
      highlight: false,
      activeCls: "",
      idleCls: "border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300",
      badgeCls: "bg-emerald-200/70 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100",
    },
  ].filter((g) => (onlyAgain ? g.rating === Rating.Again : g.rating !== Rating.Easy || allowEasy));

  return (
    <div className="w-full mt-3 min-h-14 shrink-0 flex items-center justify-center">
      {introMode ? (
        <button
          onClick={onIntroDone}
          disabled={isAdvancing || introLocked}
          autoFocus
          className="w-full h-14 px-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 text-sm font-semibold leading-tight flex items-center justify-center gap-2 transition-colors shadow-md"
        >
          <span>{introLocked ? "🎤 Đọc to từ này, hoặc chọn \"không nói to được\" ở trên" : "Học tiếp (sẽ hỏi lại sau vài thẻ)"}</span>
          {!introLocked && <kbd className="px-2 py-0.5 rounded bg-white/20 text-[11px] font-mono">Enter ↵</kbd>}
        </button>
      ) : pendingRating !== null ? (
        <button
          onClick={onContinue}
          disabled={isAdvancing}
          autoFocus
          className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-slate-900 disabled:opacity-40 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
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
                className={`min-h-[56px] px-1 py-1.5 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  g.highlight ? `${g.activeCls} font-bold` : `${g.idleCls} font-medium`
                }`}
              >
                <span className="text-sm font-bold leading-tight">{g.label}</span>
                <span className={`text-[11px] leading-tight px-1.5 py-0.5 rounded-md font-semibold ${g.badgeCls}`}>
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
          className="w-full h-14 rounded-2xl bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>Lật thẻ xem đáp án</span>
          <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-700 dark:text-zinc-300">
            Space
          </kbd>
        </button>
      ) : effectiveExerciseType === "cloze" ? (
        <button
          onClick={handleCheckAnswer}
          disabled={!userInput.trim() || isAdvancing}
          className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20"
        >
          <span>Kiểm tra đáp án</span>
          <kbd className="px-2 py-0.5 rounded bg-indigo-700/60 border border-indigo-400/40 text-[11px] font-mono text-indigo-100">
            Enter ↵
          </kbd>
        </button>
      ) : (
        <button
          onClick={handleCheckAnswer}
          disabled={!userInput.trim() || isAdvancing}
          className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
        >
          <span>Kiểm tra chính tả</span>
          <kbd className="px-2 py-0.5 rounded bg-emerald-700/60 border border-emerald-400/40 text-[11px] font-mono text-emerald-100">
            Enter ↵
          </kbd>
        </button>
      )}
    </div>
  );
}
