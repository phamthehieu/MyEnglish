import { Play, Tag, Folder } from "lucide-react";
import { AI_VOCAB_ENABLED } from "@/services/features";

/** Deck words keep their CEFR level in `topic`: the filter is by level while the Oxford deck is the only source */
const FILTER_LABEL = AI_VOCAB_ENABLED ? "Chủ đề" : "Cấp độ";

interface TopicFiltersProps {
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  availableTopics: string[];
  topicStats: Record<string, number>;
  handleStartReview: (onlyDue?: boolean, topicFilter?: string) => void;
}

/** Level (topic) filter bar of the word library */
export default function TopicFilters({
  selectedTopic,
  setSelectedTopic,
  availableTopics,
  topicStats,
  handleStartReview,
}: TopicFiltersProps) {
  // "Tất cả" counts the same words as the chips (the learner's words, not the deck words still waiting)
  const totalCount = Object.values(topicStats).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
      <div className="flex items-center gap-1.5 shrink-0 select-none pr-1 text-sm text-slate-600 dark:text-zinc-400">
        <Folder className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
        <span>{FILTER_LABEL}:</span>
      </div>

      {/* All Topics */}
      <button
        onClick={() => setSelectedTopic("all")}
        className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${selectedTopic === "all"
          ? "border border-teal-700 bg-teal-700 font-semibold text-white dark:border-teal-600 dark:bg-teal-600"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
      >
        <span>Tất cả</span>
        <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/50">
          {totalCount}
        </span>
      </button>

      {/* Each Topic */}
      {availableTopics.map((top) => {
        const isSelected = selectedTopic.toLowerCase() === top.toLowerCase();
        const count = topicStats[top] || 0;
        return (
          <button
            key={top}
            onClick={() => setSelectedTopic(isSelected ? "all" : top)}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${isSelected
              ? "border border-teal-700 bg-teal-700 font-semibold text-white dark:border-teal-600 dark:bg-teal-600"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
          >
            <Tag className="w-3 h-3 opacity-70" />
            <span>{top}</span>
            <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/50">
              {count}
            </span>
          </button>
        );
      })}

      {/* Quick Topic Review button */}
      {selectedTopic !== "all" && (
        <button
          onClick={() => handleStartReview(false, selectedTopic)}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>
            {AI_VOCAB_ENABLED ? "Ôn tập chủ đề này" : `Ôn các từ ${selectedTopic}`} ({topicStats[selectedTopic] || 0})
          </span>
        </button>
      )}
    </div>
  );
}
