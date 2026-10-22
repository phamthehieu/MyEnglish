import { useState, useRef, useEffect } from "react";
import { Folder, Clock, ChevronDown, Check, Play, RotateCcw } from "lucide-react";
import type { ReviewTimeBucket } from "@/utils/reviewSchedule";
import { AI_VOCAB_ENABLED } from "@/services/features";

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
  activeClass: string;
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    id: "all",
    label: "Tất cả",
    activeClass:
      "bg-slate-900 dark:bg-white text-white dark:text-zinc-900 border-slate-900 dark:border-white shadow-sm font-semibold",
  },
  {
    id: "due",
    label: "Đến hạn",
    activeClass:
      "bg-rose-600 text-white border-rose-600 shadow-sm font-semibold",
  },
  {
    id: "today",
    label: "Hôm nay",
    activeClass:
      "bg-amber-600 text-white border-amber-600 shadow-sm font-semibold",
  },
  {
    id: "1-3d",
    label: "1 - 3 ngày",
    activeClass:
      "bg-cyan-600 text-white border-cyan-600 shadow-sm font-semibold",
  },
  {
    id: "4-7d",
    label: "4 - 7 ngày",
    activeClass:
      "bg-teal-600 text-white border-teal-600 shadow-sm font-semibold",
  },
  {
    id: "future",
    label: "> 7 ngày",
    activeClass:
      "bg-indigo-600 text-white border-indigo-600 shadow-sm font-semibold",
  },
  {
    id: "waiting",
    label: "Chờ lượt",
    activeClass:
      "bg-violet-600 text-white border-violet-600 shadow-sm font-semibold",
  },
  {
    id: "new",
    label: "Chưa học",
    activeClass:
      "bg-slate-700 dark:bg-zinc-700 text-white border-slate-700 shadow-sm font-semibold",
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

  const handleResetFilters = () => {
    setSelectedTopic("all");
    onSelectBucket("all");
  };

  return (
    <div className="relative z-20 flex items-center gap-2 p-1.5 rounded-xl bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 backdrop-blur-sm text-xs">
      {/* 1. Level / Topic Dropdown Selector */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsLevelMenuOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm ${
            isTopicFiltered
              ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/80 font-semibold"
              : "bg-white dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100"
          }`}
          title={`Chọn ${levelLabel}`}
        >
          <Folder className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>
            {isTopicFiltered ? `${levelLabel}: ${selectedTopic}` : `${levelLabel}: Tất cả`}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold">
            {isTopicFiltered ? (topicStats[selectedTopic] || 0) : totalWords}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform ${
              isLevelMenuOpen ? "rotate-180 text-cyan-500" : ""
            }`}
          />
        </button>

        {/* Level Dropdown Menu */}
        {isLevelMenuOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80">
              Lọc theo {levelLabel.toLowerCase()}
            </div>
            {/* Option: Tất cả */}
            <button
              type="button"
              onClick={() => {
                setSelectedTopic("all");
                setIsLevelMenuOpen(false);
              }}
              className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                !isTopicFiltered
                  ? "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 font-semibold"
                  : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="flex items-center gap-2">
                {!isTopicFiltered && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                <span className={!isTopicFiltered ? "ml-0" : "ml-5.5"}>Tất cả</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
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
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                    isSelected
                      ? "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 font-semibold"
                      : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                    <span className={isSelected ? "ml-0" : "ml-5.5"}>{top}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                    {count} từ
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action: Start Review for this topic if filtered */}
      {isTopicFiltered && (
        <button
          type="button"
          onClick={() => handleStartReview(false, selectedTopic)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-300/80 dark:border-orange-500/40 text-xs font-semibold transition-all shadow-sm shrink-0 active:scale-95"
          title={`Ôn ${topicStats[selectedTopic] || 0} từ cấp ${selectedTopic}`}
        >
          <Play className="w-3 h-3 fill-orange-500 text-orange-500 dark:fill-orange-400 dark:text-orange-400" />
          <span>Ôn {selectedTopic}</span>
        </button>
      )}

      {/* Vertical divider */}
      <div className="w-[1px] h-4 bg-slate-300/80 dark:bg-zinc-800 shrink-0" />

      {/* 2. Schedule Chips (Horizontally Scrollable) */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 hidden sm:inline" />
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
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border ${
                isSelected
                  ? config.activeClass
                  : "bg-white dark:bg-zinc-900/90 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80 shadow-sm"
              }`}
            >
              {config.id === "due" && count > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
              <span>{config.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? "bg-black/20 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Reset Button (Only shown when any filter is active) */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetFilters}
          title="Đặt lại bộ lọc về mặc định"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors shrink-0 shadow-sm ml-auto"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden md:inline">Đặt lại</span>
        </button>
      )}
    </div>
  );
}
