import { useState, type Dispatch, type SetStateAction, type RefObject } from "react";
import { BookOpen, Sparkles, Plus, X, Search, LayoutGrid, List } from "lucide-react";
import type { WordDetail } from "@/types/database";
import { useWordsStore } from "@/stores/wordsStore";
import WordTableView from "../WordTableView";
import WordCard, { type WordCardMeta } from "./WordCard";
import LibraryFilterToolbar from "./LibraryFilterToolbar";
import ReviewTrajectoryModal from "../review/ReviewTrajectoryModal";
import type { ReviewTimeBucket } from "@/utils/reviewSchedule";
import {
  GALLERY_PAGE_SIZE,
  PAGE_CONTAINER,
  handleSpeak,
  type DashboardTab,
  type ViewMode,
} from "./shared";
import { AI_VOCAB_ENABLED } from "@/services/features";

interface LibraryTabProps {
  message: string | null;
  setMessage: (msg: string | null) => void;
  filteredWords: WordDetail[];
  visibleWords: WordDetail[];
  setVisibleCount: Dispatch<SetStateAction<number>>;
  cardMeta: Map<string, WordCardMeta>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  availableTopics: string[];
  topicStats: Record<string, number>;
  reviewTimeFilter: ReviewTimeBucket;
  setReviewTimeFilter: (bucket: ReviewTimeBucket) => void;
  reviewBucketCounts: Record<ReviewTimeBucket, number>;
  handleStartReview: (onlyDue?: boolean, topicFilter?: string) => void;
  requestDeleteWord: (wordId: string, wordText: string, e?: React.MouseEvent) => void;
  setActiveTab: (tab: DashboardTab) => void;
}

/** TAB 1: VOCABULARY LIBRARY (topic filters + review time filter + gallery / table view) */
export default function LibraryTab({
  message,
  setMessage,
  filteredWords,
  visibleWords,
  setVisibleCount,
  cardMeta,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  selectedTopic,
  setSelectedTopic,
  availableTopics,
  topicStats,
  reviewTimeFilter,
  setReviewTimeFilter,
  reviewBucketCounts,
  handleStartReview,
  requestDeleteWord,
  setActiveTab,
}: LibraryTabProps) {
  const selectedWord = useWordsStore((s) => s.selectedWord);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);
  const [trajectoryWord, setTrajectoryWord] = useState<WordDetail | null>(null);
  const hasAnyFilter = searchQuery.trim() !== "" || selectedTopic !== "all" || reviewTimeFilter !== "all";

  return (
    <div className={`${PAGE_CONTAINER} space-y-3 sm:space-y-4`}>
      {/* Notification alert if any */}
      {message && (
        <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Đóng thông báo"
            className="text-cyan-600 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Row 1: Search Input & View Mode Toggle (Grid vs Table) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa... (nhấn / để tìm)"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-gramm="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            className="w-full bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-10 sm:pr-14 py-2.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 transition-colors shadow-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300 w-10 h-10 flex items-center justify-center"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-zinc-500 pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">/</kbd>
            </div>
          )}
        </div>

        {/* View Mode Toggle: Grid / Table */}
        <div
          role="group"
          aria-label="Chế độ hiển thị danh sách từ"
          className="inline-flex items-center gap-0.5 bg-slate-100/90 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0"
        >
          <button
            type="button"
            onClick={() => setViewMode("gallery")}
            title="Dạng lưới thẻ"
            aria-label="Xem dạng lưới"
            className={`px-2.5 min-h-10 rounded-lg transition-all flex items-center gap-1.5 text-xs ${
              viewMode === "gallery"
                ? "bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm font-semibold border border-slate-200/80 dark:border-transparent"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Lưới</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title="Dạng bảng chi tiết"
            aria-label="Xem dạng bảng"
            className={`px-2.5 min-h-10 rounded-lg transition-all flex items-center gap-1.5 text-xs ${
              viewMode === "table"
                ? "bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm font-semibold border border-slate-200/80 dark:border-transparent"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Bảng</span>
          </button>
        </div>
      </div>

      {/* Row 2: Unified Compact Filter Toolbar */}
      <LibraryFilterToolbar
        selectedTopic={selectedTopic}
        setSelectedTopic={setSelectedTopic}
        availableTopics={availableTopics}
        topicStats={topicStats}
        handleStartReview={handleStartReview}
        selectedBucket={reviewTimeFilter}
        onSelectBucket={setReviewTimeFilter}
        bucketCounts={reviewBucketCounts}
      />

      {/* Words Grid or Table View */}
      {filteredWords.length > 0 ? (
        viewMode === "table" ? (
          <WordTableView
            words={filteredWords}
            onSelectWord={setSelectedWord}
            onDeleteWord={requestDeleteWord}
            resetKey={`${searchQuery}|${selectedTopic}|${reviewTimeFilter}`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleWords.map((item) => (
              <WordCard
                key={item.id}
                item={item}
                meta={cardMeta.get(item.id)}
                isSelected={selectedWord?.id === item.id}
                onSelect={setSelectedWord}
                onSpeak={handleSpeak}
                onDelete={requestDeleteWord}
                onOpenTrajectory={setTrajectoryWord}
              />
            ))}
            {filteredWords.length > visibleWords.length && (
              <div className="col-span-full flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + GALLERY_PAGE_SIZE)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium transition-colors shadow-sm"
                >
                  Xem thêm ({filteredWords.length - visibleWords.length} từ còn lại)
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            Không có từ vựng nào phù hợp
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm, chọn chủ đề khác hoặc đặt lại bộ lọc lịch nhắc lại.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedTopic("all");
                  setReviewTimeFilter("all");
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
              >
                Đặt lại bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("capture")}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{AI_VOCAB_ENABLED ? "Thêm từ vựng mới" : "Mở lộ trình từ vựng"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Trajectory Modal for Gallery Cards */}
      {trajectoryWord && (
        <ReviewTrajectoryModal
          isOpen={!!trajectoryWord}
          onClose={() => setTrajectoryWord(null)}
          word={trajectoryWord}
        />
      )}
    </div>
  );
}
