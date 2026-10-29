import { ChevronDown, X } from "lucide-react";
import type { ReviewCard } from "@/types/database";
import type { StudyMode } from "@/hooks/useReviewSession";
import { isSimpleMode } from "@/services/learnerProfile";
import { COMBO_EVERY } from "@/services/sound";

interface ReviewTopBarProps {
  onExit: () => void;
  mode: StudyMode;
  handleModeChange: (newMode: StudyMode) => void;
  currentIndex: number;
  queue: ReviewCard[];
  currentWord: ReviewCard;
  practiceMode: boolean;
  consecutiveCorrect?: number;
  /** Focus session: leaving goes through its own bar (asks first) */
  hideExit?: boolean;
}

/** The kinds of exercise a learner may pin; "Thích ứng" lets the app pick per word (recommended) */
const MODES: Array<{ mode: StudyMode; label: string }> = [
  { mode: "mixed", label: "Thích ứng (app tự chọn)" },
  { mode: "flip", label: "Thẻ lật" },
  { mode: "multiple_choice", label: "Trắc nghiệm" },
  { mode: "meaning_match", label: "Nối từ" },
  { mode: "cloze", label: "Điền từ" },
  { mode: "spelling", label: "Luyện gõ" },
  { mode: "sentence_builder", label: "Ghép câu" },
  { mode: "listening", label: "Luyện nghe" },
];

/**
 * The session's top bar, kept quiet so the card is all there is: close, how far along, a run of right answers.
 * Under it, small: the kind of exercise (a dropdown) and what this card trains.
 */
export default function ReviewTopBar({
  onExit,
  mode,
  handleModeChange,
  currentIndex,
  queue,
  currentWord,
  practiceMode,
  consecutiveCorrect,
  hideExit = false,
}: ReviewTopBarProps) {
  // Simple mode: no format selector (the app picks), no combo pill (a run of right answers is not the goal)
  const simple = isSimpleMode();
  const percent = queue.length ? ((currentIndex + 1) / queue.length) * 100 : 0;
  return (
    <div className="w-full shrink-0 mb-3 space-y-2">
      <div className="flex items-center gap-3">
        {!hideExit && (
          <button
            onClick={onExit}
            aria-label="Thoát phiên học"
            title="Thoát"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span
              className="truncate text-slate-500 dark:text-zinc-400"
              title={
                currentWord?.direction === "production"
                  ? "Tự nhớ ra từ tiếng Anh từ nghĩa tiếng Việt (lịch ôn riêng)"
                  : "Hiểu nghĩa khi gặp từ tiếng Anh (lịch ôn riêng)"
              }
            >
              {currentWord ? (currentWord.direction === "production" ? "Tự nhớ ra từ" : "Hiểu nghĩa") : "Tiến độ"}
              {practiceMode && " · Luyện thêm"}
            </span>
            <span className="text-teal-800 dark:text-teal-300">
              Thẻ {currentIndex + 1}/{queue.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-teal-700 transition-[width] duration-300 dark:bg-teal-500" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {!simple && consecutiveCorrect !== undefined && consecutiveCorrect >= 3 && (
          <div
            // A new key at every combo (5, 10…): the pill zooms in again together with the combo sound
            key={`combo-${Math.floor(consecutiveCorrect / COMBO_EVERY)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 animate-in fade-in zoom-in-95 dark:bg-orange-500/10 dark:text-orange-300"
            title={`Chuỗi trả lời đúng liên tiếp: ${consecutiveCorrect} câu`}
          >
            🔥 Đúng liền {consecutiveCorrect}
          </div>
        )}
      </div>

      {!simple && (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(
          <label className="relative inline-flex items-center">
            <span className="sr-only">Dạng bài</span>
            <select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as StudyMode)}
              title="Dạng bài: để app tự chọn là tốt nhất"
              className="min-h-9 appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {MODES.map((m) => (
                <option key={m.mode} value={m.mode}>
                  Dạng bài: {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-500" />
          </label>
        )}
      </div>
      )}
    </div>
  );
}
