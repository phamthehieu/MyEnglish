import { useState, useRef, useEffect } from "react";
import { Folder, Clock, ChevronDown, Check, Play, RotateCcw } from "lucide-react";
import type { ReviewTimeBucket } from "@/utils/reviewSchedule";
import { AI_VOCAB_ENABLED } from "@/services/features";
import { topicLabel } from "@/utils/labels";

interface LibraryFilterToolbarProps {
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  availableTopics: string[];
  topicStats: Record<string, number>;
  handleStartReview: (onlyDue?: boolean, topicFilter?: string) => void;
  selectedBucket: ReviewTimeBucket;
  onSelectBucket: (bucket: ReviewTimeBucket) => void;
  bucketCounts: Record<ReviewTimeBucket, number>;
}

interface BucketConfig {
  id: ReviewTimeBucket;
  label: string;
  /** One short plain sentence: what the chip filters */
  hint: string;
  activeClass: string;
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    id: "all",
    label: "Tất cả",
    hint: "mọi từ trong thư viện.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "due",
    label: "Đến hạn",
    hint: "từ đã tới lúc ôn lại, nên ôn ngay.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "today",
    label: "Hôm nay",
    hint: "từ sẽ tới hạn ôn trong hôm nay.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "1-3d",
    label: "1 - 3 ngày",
    hint: "từ sẽ tới hạn ôn sau 1 đến 3 ngày nữa.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "4-7d",
    label: "4 - 7 ngày",
    hint: "từ sẽ tới hạn ôn sau 4 đến 7 ngày nữa.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "future",
    label: "> 7 ngày",
    hint: "từ nhớ khá chắc, hơn 7 ngày nữa mới phải ôn.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "waiting",
    label: "Chờ lượt",
    hint: "từ chưa tới lượt học vì hôm nay đã đủ số từ mới. Sẽ tự xuất hiện khi còn chỗ.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "new",
    label: "Chưa học",
    hint: "từ bạn chưa học lần nào.",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
];

export default function LibraryFilterToolbar({
  selectedTopic,
  setSelectedTopic,
  availableTopics,
  topicStats,
  handleStartReview,
  selectedBucket,
  onSelectBucket,
  bucketCounts,
}: LibraryFilterToolbarProps) {
  const [isLevelMenuOpen, setIsLevelMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalWords = Object.values(topicStats).reduce((sum, n) => sum + n, 0);
  const isTopicFiltered = selectedTopic !== "all";
  const isBucketFiltered = selectedBucket !== "all";
  const hasActiveFilters = isTopicFiltered || isBucketFiltered;

  // Close dropdown on outside click or Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsLevelMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsLevelMenuOpen(false);
      }
    }
    if (isLevelMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLevelMenuOpen]);

  const levelLabel = AI_VOCAB_ENABLED ? "Chủ đề" : "Cấp độ";

  // The selected chip's meaning; with no chip picked, still explain "Chờ lượt" when some words are in it
  const selectedConfig = BUCKET_CONFIGS.find((c) => c.id === selectedBucket);
  const helpLine =
    selectedConfig && selectedConfig.id !== "all"
      ? `${selectedConfig.label}: ${selectedConfig.hint}`
      : (bucketCounts.waiting || 0) > 0
        ? `Chờ lượt: ${BUCKET_CONFIGS.find((c) => c.id === "waiting")?.hint}`
        : null;

  const handleResetFilters = () => {
    setSelectedTopic("all");
    onSelectBucket("all");
  };

  const topicDueCount = bucketCounts.due || 0;

  return (
    <div className="relative z-20 rounded-2xl border border-slate-200 bg-white text-sm shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
      {/* Phone: the dropdown (and review / reset) on top, the chips below */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
      {/* 1. Level / Topic Dropdown Selector */}
      <div className="relative shrink-0 min-w-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsLevelMenuOpen((prev) => !prev)}
          className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
            isTopicFiltered
              ? "border-teal-700 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-400/10 dark:text-teal-200"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
          title={`Chọn ${levelLabel}`}
        >
          <Folder className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
          <span className="truncate max-w-[9rem] sm:max-w-none">
            {isTopicFiltered ? `${levelLabel}: ${topicLabel(selectedTopic)}` : `${levelLabel}: Tất cả`}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
            {isTopicFiltered ? (topicStats[selectedTopic] || 0) : totalWords}
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-500 transition-transform dark:text-zinc-400 ${
              isLevelMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Level Dropdown Menu */}
        {isLevelMenuOpen && (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              Lọc theo {levelLabel.toLowerCase()}
            </div>
            {/* Option: Tất cả */}
            <button
              type="button"
              onClick={() => {
                setSelectedTopic("all");
                setIsLevelMenuOpen(false);
              }}
              className={`flex min-h-11 w-full items-center justify-between px-4 text-left text-sm transition-colors ${
                !isTopicFiltered
                  ? "bg-teal-50 font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-200"
                  : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="flex items-center gap-2">
                {!isTopicFiltered && <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />}
                <span className={!isTopicFiltered ? "ml-0" : "ml-[22px]"}>Tất cả</span>
              </span>
              <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                {totalWords} từ
              </span>
            </button>

            {/* Individual Topics / Levels */}
            {availableTopics.map((top) => {
              const count = topicStats[top] || 0;
              const isSelected = selectedTopic.toLowerCase() === top.toLowerCase();
              return (
                <button
                  key={top}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(top);
                    setIsLevelMenuOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between px-4 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-teal-50 font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />}
                    <span className={isSelected ? "ml-0" : "ml-[22px]"}>{topicLabel(top)}</span>
                  </span>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                    {count} từ
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action: Start Review (due words) or Practice (all words) for this topic if filtered */}
      {isTopicFiltered && (
        <button
          type="button"
          onClick={() => handleStartReview(topicDueCount > 0, selectedTopic)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
          title={
            topicDueCount > 0
              ? `Ôn ${topicDueCount} từ đến hạn cấp ${topicLabel(selectedTopic)}`
              : `Luyện ${topicStats[selectedTopic] || 0} từ cấp ${topicLabel(selectedTopic)} (không đổi lịch ôn)`
          }
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>{topicDueCount > 0 ? `Ôn ${topicLabel(selectedTopic)} (${topicDueCount})` : `Luyện ${topicLabel(selectedTopic)}`}</span>
        </button>
      )}

      {/* 3. Reset Button (Only shown when any filter is active) */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetFilters}
          title="Đặt lại bộ lọc về mặc định"
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:ml-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Đặt lại</span>
        </button>
      )}
      </div>

      {/* Vertical divider */}
      <div className="hidden h-6 w-px shrink-0 bg-slate-200 dark:bg-zinc-800 sm:block" />

      {/* 2. Schedule Chips (Horizontally Scrollable, a fade on the right hints there is more) */}
      <div className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 pr-6">
        <Clock className="hidden h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400 sm:inline" />
        {BUCKET_CONFIGS.map((config) => {
          const isSelected = selectedBucket === config.id;
          const count = bucketCounts[config.id] || 0;

          // Don't clutter with 0-count items except 'all' and 'due'
          if (count === 0 && config.id !== "all" && config.id !== "due" && !isSelected) {
            return null;
          }

          return (
            <button
              key={config.id}
              type="button"
              onClick={() => onSelectBucket(config.id)}
              title={config.hint}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                isSelected
                  ? config.activeClass
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {config.id === "due" && count > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              <span>{config.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-zinc-900 sm:hidden"
      />
      </div>
      </div>

      {/* What the selected (or the cryptic) schedule chip means, as visible text */}
      {helpLine && (
        <p className="px-3 pb-2.5 text-sm leading-snug text-slate-600 dark:text-zinc-400">{helpLine}</p>
      )}
    </div>
  );
}
