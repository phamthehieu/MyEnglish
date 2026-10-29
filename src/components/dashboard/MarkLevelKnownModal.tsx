import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Info, Loader2, X } from "lucide-react";
import {
  STUDY_LEVELS,
  type StudyLevel,
  CATALOG_LEVEL_COUNTS,
} from "@/services/vocabCatalog";
import {
  countUnstudiedWordsForLevel,
  markLevelWordsKnown,
  normalizeStudyLevels,
  type LevelProgress,
} from "@/services/vocabFeed";

export const LEVEL_NAMES: Record<StudyLevel, string> = {
  A1: "Mới bắt đầu",
  A2: "Cơ bản",
  B1: "Trung cấp",
  B2: "Khá",
  C1: "Thành thạo",
};

interface MarkLevelKnownModalProps {
  level: StudyLevel;
  progress: LevelProgress | null;
  levels: StudyLevel[];
  onClose: () => void;
  onDone: (nextLevels?: StudyLevel[]) => void;
}

export default function MarkLevelKnownModal({
  level,
  progress,
  levels,
  onClose,
  onDone,
}: MarkLevelKnownModalProps) {
  const [unstudiedCount, setUnstudiedCount] = useState<number | null>(() => {
    if (progress) return Math.max(0, progress.total - progress.met);
    return null;
  });
  const [loadingCount, setLoadingCount] = useState(unstudiedCount === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<{ done: number; total: number } | null>(null);

  const nextLevelIndex = STUDY_LEVELS.indexOf(level) + 1;
  const nextLevel: StudyLevel | null = nextLevelIndex < STUDY_LEVELS.length ? STUDY_LEVELS[nextLevelIndex] : null;
  const canAdvance = nextLevel !== null && !levels.includes(nextLevel);
  const [autoAdvance, setAutoAdvance] = useState(canAdvance);

  useEffect(() => {
    let cancelled = false;
    countUnstudiedWordsForLevel(level)
      .then((count) => {
        if (!cancelled) {
          setUnstudiedCount(count);
          setLoadingCount(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingCount(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  const total = progress?.total ?? CATALOG_LEVEL_COUNTS[level];
  const countToMark = unstudiedCount ?? (progress ? Math.max(0, progress.total - progress.met) : total);
  const alreadyMet = total - countToMark;

  const handleConfirm = async () => {
    if (countToMark === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    setProgressStatus({ done: 0, total: countToMark });

    try {
      await markLevelWordsKnown(level, (done, total) => {
        setProgressStatus({ done, total });
      });

      let updatedLevels: StudyLevel[] | undefined = undefined;
      if (autoAdvance && nextLevel) {
        // The chosen levels plus the next one (a run that starts above A1 keeps its start)
        updatedLevels = normalizeStudyLevels([...levels, nextLevel]);
      }

      onDone(updatedLevels);
    } catch (err) {
      setError(`Không thể đánh dấu từ đã biết: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  const progressPercent =
    progressStatus && progressStatus.total > 0
      ? Math.min(100, Math.round((progressStatus.done / progressStatus.total) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 dark:bg-black/60 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-level-title"
        className="popup-card-enter max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="mark-level-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <CheckCheck className="w-5 h-5 shrink-0 text-teal-700 dark:text-teal-300" />
              Đánh dấu toàn bộ cấp {level} là đã biết
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              {level} · {LEVEL_NAMES[level]} (tổng cộng {total.toLocaleString("vi-VN")} từ Oxford)
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats card */}
        <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-slate-50 p-3 text-center dark:bg-zinc-800/60">
          <div>
            <span className="block text-xs text-slate-600 dark:text-zinc-400">Tổng số từ</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{total.toLocaleString("vi-VN")}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-600 dark:text-zinc-400">Đã học trước</span>
            <span className="text-base font-bold text-teal-700 dark:text-teal-300">{alreadyMet.toLocaleString("vi-VN")}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-600 dark:text-zinc-400">Sẽ đánh dấu</span>
            <span className="text-base font-bold text-green-700 dark:text-green-400">
              {loadingCount ? "..." : countToMark.toLocaleString("vi-VN")}
            </span>
          </div>
        </div>

        {/* Context and Spaced Repetition explanation */}
        <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          <div className="flex items-start gap-2.5 rounded-2xl bg-teal-50 p-3.5 text-teal-900 dark:bg-teal-400/10 dark:text-teal-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
            <div className="space-y-1">
              <p>
                <b>{countToMark.toLocaleString("vi-VN")} từ</b> chưa học sẽ được chuyển thẳng vào mục <b>"Đã biết"</b> và không còn xuất hiện trong phần học từ mới.
              </p>
              <p className="text-sm text-teal-800 dark:text-teal-200">
                Để chắc chắn bạn không quên, app sẽ phân bổ lịch kiểm tra nhẹ nhàng sau <b>4 đến 21 ngày</b> (rải đều các ngày, không dồn dập).
              </p>
            </div>
          </div>

          {alreadyMet > 0 && (
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              * {alreadyMet} từ bạn đã học thật trước đây sẽ được giữ nguyên lịch ôn tập hiện tại, không bị ghi đè.
            </p>
          )}
        </div>

        {/* Option to automatically open the next level */}
        {canAdvance && nextLevel && (
          <label className="flex min-h-12 cursor-pointer select-none items-start gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700">
            <input
              type="checkbox"
              checked={autoAdvance}
              disabled={busy}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-teal-700 text-teal-700 focus:ring-teal-600"
            />
            <div className="space-y-0.5 text-sm text-slate-700 dark:text-zinc-200">
              <span className="font-semibold text-slate-900 dark:text-white">
                Mở thêm cấp {nextLevel} · {LEVEL_NAMES[nextLevel]} vào lộ trình học
              </span>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Sau khi bỏ qua cấp {level}, bạn có thể bắt đầu nhận từ mới của cấp {nextLevel} ngay từ buổi học tiếp theo.
              </p>
            </div>
          </label>
        )}

        {/* Progress Bar while working */}
        {busy && progressStatus && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700 dark:text-teal-300" />
                Đang xử lý {progressStatus.done}/{progressStatus.total} từ...
              </span>
              <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-700 transition-all duration-150 ease-out dark:bg-teal-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || countToMark === 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {countToMark === 0
              ? "Đã học hết cấp này"
              : `Xác nhận đánh dấu ${countToMark.toLocaleString("vi-VN")} từ`}
          </button>
        </div>
      </div>
    </div>
  );
}
