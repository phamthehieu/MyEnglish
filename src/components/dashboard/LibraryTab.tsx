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
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-teal-50 py-1 pl-4 pr-1 text-sm text-teal-900 dark:bg-teal-400/10 dark:text-teal-100">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Đóng thông báo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-teal-700 hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row 1: Search Input & View Mode Toggle (Grid vs Table) */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400" />
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
            className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-base text-slate-900 transition-colors placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:pr-14 sm:text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-zinc-400 pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">/</kbd>
            </div>
          )}
        </div>

        {/* View Mode Toggle: Grid / Table */}
        <div
          role="group"
          aria-label="Chế độ hiển thị danh sách từ"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={() => setViewMode("gallery")}
            title="Dạng lưới thẻ"
            aria-label="Xem dạng lưới"
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors ${
              viewMode === "gallery"
                ? "bg-teal-700 font-semibold text-white dark:bg-teal-600"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Lưới</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title="Dạng bảng chi tiết"
            aria-label="Xem dạng bảng"
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors ${
              viewMode === "table"
                ? "bg-teal-700 font-semibold text-white dark:bg-teal-600"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <List className="w-4 h-4" />
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
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
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-700/30 bg-white px-5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                >
                  Xem thêm ({filteredWords.length - visibleWords.length} từ còn lại)
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-12">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Không có từ vựng nào phù hợp
          </h3>
          <p className="mx-auto max-w-sm text-sm text-slate-600 dark:text-zinc-400">
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
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-700/30 bg-white px-5 text-base font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
              >
                Đặt lại bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("capture")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <Plus className="w-4 h-4" />
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
