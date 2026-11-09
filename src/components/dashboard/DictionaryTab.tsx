import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Check,
  Clock,
  Globe,
  History,
  Languages,
  Loader2,
  Mic,
  Plus,
  Search,
  Snail,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  addDictionaryEntryToSrs,
  clearDictHistory,
  FEATURED_DISCOVERY_WORDS,
  getBookmarkedWords,
  getDictHistory,
  getShortMeaning,
  hasVietnameseCharacters,
  isWordBookmarked,
  lookupDictionaryWord,
  POS_BADGE_SHORT,
  POS_LABEL_VI,
  recordDictLookup,
  searchEnglishDictionary,
  searchVietnameseDictionary,
  toggleBookmarkWord,
  type DictDisplayMode,
  type DictEntry,
  type DictHistoryItem,
  type DictSense,
  type ViSearchMatch,
} from "@/services/dictionary";
import { handleSpeak, SLOW_RATE } from "../review/speech";
import { PAGE_CONTAINER } from "./shared";
import { useWordsStore } from "@/stores/wordsStore";
import { wordStatus, WORD_STATUS_LABELS } from "@/services/wordStatus";
import { MicCheck } from "./PronunciationMicCheck";
import type { PronunciationLesson } from "@/types/pronunciation";
import { useBackHandler } from "@/lib/backNavigation";

interface DictionaryTabProps {
  resetKey?: number;
  /** Initial word to look up immediately (used by Quick Dictionary Modal) */
  initialWord?: string;
  /** Compact layout when rendered inside the global popup modal */
  isModal?: boolean;
  onCloseModal?: () => void;
}

const MODE_OPTIONS: Array<{ id: DictDisplayMode; label: string; shortLabel: string }> = [
  { id: "bilingual", label: "Song ngữ (Anh-Việt & Anh-Anh)", shortLabel: "Song ngữ" },
  { id: "en-vi", label: "Anh - Việt", shortLabel: "Anh - Việt" },
  { id: "en-en", label: "Anh - Anh (Learner)", shortLabel: "Anh - Anh" },
  { id: "vi-en", label: "Việt - Anh", shortLabel: "Việt - Anh" },
];

export default function DictionaryTab({
  resetKey,
  initialWord,
  isModal = false,
}: DictionaryTabProps) {
  const words = useWordsStore((s) => s.words);
  const refreshWords = useWordsStore((s) => s.refreshWords);

  const [mode, setMode] = useState<DictDisplayMode>("bilingual");
  const [query, setQuery] = useState(initialWord ?? "");
  const [selectedEntry, setSelectedEntry] = useState<DictEntry | null>(null);
  const [enSuggestions, setEnSuggestions] = useState<DictEntry[]>([]);
  const [viSuggestions, setViSuggestions] = useState<ViSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [notFoundWord, setNotFoundWord] = useState<string | null>(null);

  const [history, setHistory] = useState<DictHistoryItem[]>(getDictHistory);
  const [bookmarks, setBookmarks] = useState<DictHistoryItem[]>(getBookmarkedWords);
  const [homeTab, setHomeTab] = useState<"history" | "bookmarks" | "discover">("history");

  // Mic practice toggle inside the entry card
  const [showMicPractice, setShowMicPractice] = useState(false);
  // SRS add state
  const [addingToSrs, setAddingToSrs] = useState(false);
  const [srsToast, setSrsToast] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map user's existing words by lowercase word for instant SRS badge display
  const userWordMap = useMemo(() => {
    const map = new Map<string, (typeof words)[number]>();
    for (const w of words) {
      map.set(w.word.trim().toLowerCase(), w);
    }
    return map;
  }, [words]);

  const openWord = useCallback(async (wordText: string) => {
    const clean = wordText.trim();
    if (!clean) return;
    setLoadingEntry(true);
    setNotFoundWord(null);
    setShowMicPractice(false);
    setSrsToast(null);
    try {
      const entry = await lookupDictionaryWord(clean);
      if (entry) {
        setSelectedEntry(entry);
        setHistory(recordDictLookup(entry));
      } else {
        setSelectedEntry(null);
        setNotFoundWord(clean);
      }
    } finally {
      setLoadingEntry(false);
    }
  }, []);

  // Reset when clicking the sidebar/header tab again
  useEffect(() => {
    if (!isModal && resetKey !== undefined) {
      setSelectedEntry(null);
      setNotFoundWord(null);
    }
  }, [resetKey, isModal]);

  // Open initialWord if passed (e.g. from Quick Dictionary Modal)
  useEffect(() => {
    if (initialWord && initialWord.trim()) {
      setQuery(initialWord.trim());
      void openWord(initialWord.trim());
    }
  }, [initialWord, openWord]);

  // Back button on mobile returns from entry detail to search/home
  useBackHandler(() => {
    if (selectedEntry || notFoundWord) {
      setSelectedEntry(null);
      setNotFoundWord(null);
      return true;
    }
    return false;
  }, !isModal && Boolean(selectedEntry || notFoundWord));

  // Live search as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setEnSuggestions([]);
      setViSuggestions([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const isViQuery = mode === "vi-en" || hasVietnameseCharacters(trimmed);
        if (isViQuery) {
          const [viRes, enRes] = await Promise.all([
            searchVietnameseDictionary(trimmed, 24),
            mode === "vi-en" ? Promise.resolve([]) : searchEnglishDictionary(trimmed, 10),
          ]);
          if (!cancelled) {
            setViSuggestions(viRes);
            setEnSuggestions(enRes);
          }
        } else {
          const [enRes, viRes] = await Promise.all([
            searchEnglishDictionary(trimmed, 28),
            trimmed.length >= 2 ? searchVietnameseDictionary(trimmed, 8) : Promise.resolve([]),
          ]);
          if (!cancelled) {
            setEnSuggestions(enRes);
            setViSuggestions(viRes);
          }
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 20);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (mode === "vi-en" && viSuggestions.length > 0 && viSuggestions[0].words[0]) {
      void openWord(viSuggestions[0].words[0].word);
      return;
    }
    if (enSuggestions.length > 0 && enSuggestions[0].w.toLowerCase() === trimmed.toLowerCase()) {
      setSelectedEntry(enSuggestions[0]);
      setHistory(recordDictLookup(enSuggestions[0]));
      setNotFoundWord(null);
      setShowMicPractice(false);
      return;
    }
    void openWord(trimmed);
  };

  const handleToggleBookmark = (entry: DictEntry) => {
    const res = toggleBookmarkWord(entry);
    setBookmarks(res.list);
  };

  const handleAddToSrs = async (entry: DictEntry) => {
    if (addingToSrs) return;
    setAddingToSrs(true);
    setSrsToast(null);
    try {
      const res = await addDictionaryEntryToSrs(entry);
      setSrsToast(res.message);
      if (res.ok) {
        await refreshWords();
      }
    } finally {
      setAddingToSrs(false);
    }
  };

  // Group senses by part of speech for clean presentation
  const groupedSenses = useMemo(() => {
    if (!selectedEntry?.m) return [];
    const groups = new Map<string, DictSense[]>();
    for (const s of selectedEntry.m) {
      // Filter senses according to display mode if needed, but never hide all senses
      if (mode === "en-en" && !s.e && selectedEntry.m.some((x) => x.e)) continue;
      if (mode === "en-vi" && !s.v && selectedEntry.m.some((x) => x.v)) continue;
      const key = s.p || "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()];
  }, [selectedEntry, mode]);

  // Build synthetic PronunciationLesson for MicCheck inside dictionary
  const micLesson = useMemo<PronunciationLesson | null>(() => {
    if (!selectedEntry) return null;
    const firstEx = selectedEntry.m?.flatMap((s) => s.x || [])[0]?.[0];
    return {
      id: `dict-${selectedEntry.w.toLowerCase()}`,
      order: 1,
      title: `Phát âm từ "${selectedEntry.w}"`,
      tagline: selectedEntry.i || "",
      intro: [],
      tips: [],
      examples: [
        {
          text: selectedEntry.w,
          ipa: selectedEntry.i || "",
          note: getShortMeaning(selectedEntry, "bilingual").slice(0, 60),
          phrase: firstEx || undefined,
        },
      ],
      quiz: [],
    };
  }, [selectedEntry]);

  const firstExampleSentence = useMemo(() => {
    if (!selectedEntry?.m) return undefined;
    for (const s of selectedEntry.m) {
      if (s.x?.[0]?.[0]) return s.x[0][0];
    }
    return undefined;
  }, [selectedEntry]);

  const existingUserWord = selectedEntry ? userWordMap.get(selectedEntry.w.toLowerCase()) : undefined;
  const existingStatus = existingUserWord ? wordStatus(existingUserWord) : null;
  const bookmarked = selectedEntry ? isWordBookmarked(selectedEntry.w) : false;
  const lookupCount = useMemo(() => {
    if (!selectedEntry) return 0;
    return history.find((h) => h.word.toLowerCase() === selectedEntry.w.toLowerCase())?.count ?? 1;
  }, [selectedEntry, history]);

  const outerContainerClass = isModal
    ? "flex-1 min-h-0 flex flex-col overflow-hidden"
    : `${PAGE_CONTAINER} space-y-4`;

  return (
    <div className={outerContainerClass}>
      {/* Fixed / Sticky Top Search & Mode Selector Section */}
      <div
        className={
          isModal
            ? "shrink-0 px-3 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            : "max-w-4xl mx-auto w-full space-y-4"
        }
      >
        {/* Top Header (only in standalone tab mode) */}
        {!isModal && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span>Từ điển Đa năng (Anh - Việt · Anh - Anh · Việt - Anh)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
                161.500+ mục từ Offline · Định nghĩa chuẩn WordNet & Oxford · Nghe phát âm, chấm giọng đọc & thêm vào Sổ từ 1 chạm.
              </p>
            </div>
          </div>
        )}

        {/* Search Box & Mode Selector Card */}
        <div
          className={
            isModal
              ? "space-y-2.5"
              : "rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-3 sm:p-4 space-y-3"
          }
        >
          {/* Mode Switcher Tabs */}
          <div role="tablist" className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80">
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(opt.id)}
                  className={`min-h-8 sm:min-h-9 px-2 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
                    active
                      ? "bg-white dark:bg-zinc-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <span className="sm:hidden">{opt.shortLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedEntry) setSelectedEntry(null);
                  if (notFoundWord) setNotFoundWord(null);
                }}
                placeholder={
                  mode === "vi-en"
                    ? "Nhập nghĩa tiếng Việt (VD: trì hoãn, triển khai, cơ sở dữ liệu)..."
                    : "Nhập từ tiếng Anh, dạng chia (went, debugging) hoặc nghĩa tiếng Việt..."
                }
                className="w-full min-h-11 sm:min-h-12 pl-10 pr-10 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 text-sm sm:text-base text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedEntry(null);
                    setNotFoundWord(null);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Xóa ô tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="min-h-11 sm:min-h-12 px-4 sm:px-5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold shadow-2xs shrink-0 inline-flex items-center gap-1.5"
            >
              Tra từ
            </button>
          </form>
        </div>
      </div>

      {/* Scrollable Results & Content Body */}
      <div className={isModal ? "flex-1 min-h-0 overflow-y-auto p-3 sm:p-5" : "max-w-4xl mx-auto w-full"}>
        <div className="space-y-4">
          {/* Loading Spinner */}
          {loadingEntry && (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-sm font-medium">Đang tra cứu từ điển...</span>
            </div>
          )}

          {/* Word Not Found Banner */}
          {!loadingEntry && notFoundWord && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-3 text-center">
              <p className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Không tìm thấy mục từ chính xác cho “{notFoundWord}”
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
                Hãy kiểm tra lại chính tả hoặc chọn một trong các từ gợi ý gần giống bên dưới.
              </p>
            </div>
          )}

          {/* SELECTED DICTIONARY ENTRY CARD */}
          {!loadingEntry && selectedEntry && (
            <div className="space-y-4">
            {/* Back to search results bar if query is non-empty */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="min-h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách tìm kiếm</span>
              </button>
              {lookupCount >= 3 && !existingUserWord && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                  💡 Bạn đã tra từ này {lookupCount} lần
                </span>
              )}
            </div>

            {/* Hero Word Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 sm:p-6 space-y-4">
              {selectedEntry.matchedFromForm && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-xs font-semibold text-teal-800 dark:text-teal-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tự động nhận diện biến thể: {selectedEntry.matchedFromForm}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight break-words">
                      {selectedEntry.w}
                    </h1>
                    {selectedEntry.c && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                        {selectedEntry.c}
                      </span>
                    )}
                    {selectedEntry.t && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {selectedEntry.t}
                      </span>
                    )}
                    {existingStatus && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                        ✓ Sổ từ: {WORD_STATUS_LABELS[existingStatus]}
                      </span>
                    )}
                  </div>

                  {/* IPA Transcriptions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {selectedEntry.i && (
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {selectedEntry.uk ? `US ${selectedEntry.i}` : selectedEntry.i}
                      </span>
                    )}
                    {selectedEntry.uk && (
                      <span className="font-mono text-slate-500 dark:text-zinc-400">
                        UK {selectedEntry.uk}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Bookmark & Add to SRS */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleBookmark(selectedEntry)}
                    title={bookmarked ? "Bỏ lưu từ này" : "Lưu từ vào danh sách yêu thích"}
                    className={`min-h-10 px-3 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      bookmarked
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                        : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Star className={`w-4 h-4 ${bookmarked ? "fill-amber-500 text-amber-500" : ""}`} />
                    <span>{bookmarked ? "Đã lưu" : "Lưu từ"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleAddToSrs(selectedEntry)}
                    disabled={addingToSrs}
                    className="min-h-10 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {addingToSrs ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : existingUserWord ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>{existingUserWord ? "Ưu tiên ôn sớm" : "Thêm vào Sổ từ"}</span>
                  </button>
                </div>
              </div>

              {srsToast && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/80 dark:bg-teal-950/30 px-3.5 py-2 text-xs sm:text-sm font-medium text-teal-900 dark:text-teal-200 flex items-center justify-between gap-2">
                  <span>{srsToast}</span>
                  <button type="button" onClick={() => setSrsToast(null)} className="text-teal-700 dark:text-teal-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Audio & Pronunciation Check Toolbar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleSpeak(selectedEntry.w)}
                  className="min-h-10 px-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/60 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Nghe phát âm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeak(selectedEntry.w, SLOW_RATE)}
                  className="min-h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <Snail className="w-4 h-4" />
                  <span>Nghe chậm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMicPractice((v) => !v)}
                  className={`min-h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    showMicPractice
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-teal-600/30 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{showMicPractice ? "Đóng chấm phát âm" : "Đọc thử bằng Mic"}</span>
                </button>
              </div>

              {/* Inline Mic Pronunciation Practice */}
              {showMicPractice && micLesson && (
                <div className="rounded-2xl border border-teal-200/80 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/15 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center justify-between">
                    <span>🎙️ Đọc to từ “{selectedEntry.w}” {firstExampleSentence ? `hoặc cả câu ví dụ bên dưới` : ""} để máy chấm:</span>
                  </div>
                  <MicCheck
                    lesson={micLesson}
                    item={micLesson.examples[0]}
                    phrase={firstExampleSentence}
                    compact
                  />
                </div>
              )}
            </div>

            {/* SENSES BY PART OF SPEECH */}
            {groupedSenses.map(([pos, senses]) => (
              <div
                key={pos}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 sm:p-5 space-y-3.5"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-700 dark:bg-teal-600 text-white text-xs font-bold uppercase tracking-wide">
                    {POS_LABEL_VI[pos] || pos}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    {senses.length} nghĩa
                  </span>
                </div>

                <div className="space-y-4">
                  {senses.map((sense, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Vietnamese Meaning */}
                        {mode !== "en-en" && sense.v && (
                          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 leading-snug">
                            {sense.v}
                          </div>
                        )}

                        {/* English-English Definition */}
                        {mode !== "en-vi" && sense.e && (
                          <div
                            className={`rounded-xl px-3 py-2 border ${
                              mode === "en-en"
                                ? "border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 text-base font-semibold text-slate-900 dark:text-zinc-100"
                                : "border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-xs sm:text-sm text-slate-700 dark:text-zinc-300"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mr-1.5">
                              <Globe className="w-3 h-3" /> EN:
                            </span>
                            <span>{sense.e}</span>
                          </div>
                        )}

                        {/* Fallback if user is in EN-EN or EN-VI and only the other language exists */}
                        {mode === "en-en" && !sense.e && sense.v && (
                          <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{sense.v}</div>
                        )}
                        {mode === "en-vi" && !sense.v && sense.e && (
                          <div className="text-sm text-slate-700 dark:text-zinc-300">{sense.e}</div>
                        )}

                        {/* Examples */}
                        {sense.x && sense.x.length > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            {sense.x.map(([en, vi], exIdx) => (
                              <div
                                key={exIdx}
                                className="flex items-start gap-2 pl-2.5 border-l-2 border-teal-500/40 py-0.5"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSpeak(en)}
                                  title="Nghe câu ví dụ"
                                  className="mt-0.5 p-1 rounded-full text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 shrink-0"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="min-w-0 text-xs sm:text-sm">
                                  <p className="font-medium text-slate-800 dark:text-zinc-200">“{en}”</p>
                                  {mode !== "en-en" && vi && (
                                    <p className="text-slate-500 dark:text-zinc-400 italic">{vi}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sense-level synonyms */}
                        {sense.s && sense.s.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                              Đồng nghĩa:
                            </span>
                            {sense.s.map((syn) => (
                              <button
                                key={syn}
                                type="button"
                                onClick={() => {
                                  setQuery(syn);
                                  void openWord(syn);
                                }}
                                className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-teal-700 dark:text-teal-300 hover:border-teal-600/50"
                              >
                                {syn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* IDIOMS & COLLOCATIONS */}
            {selectedEntry.id && selectedEntry.id.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span>💬</span>
                  <span>Thành ngữ & Cụm từ đi kèm ({selectedEntry.id.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedEntry.id.map(([phrase, meaning], idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 p-3 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => handleSpeak(phrase)}
                          className="text-left text-sm font-bold text-teal-800 dark:text-teal-300 hover:underline"
                        >
                          {phrase}
                        </button>
                        <p className="text-xs text-slate-600 dark:text-zinc-400">{meaning}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSpeak(phrase)}
                        title="Nghe cụm từ"
                        className="p-1.5 rounded-lg text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SYNONYMS & INFLECTED FORMS */}
            {((selectedEntry.syn && selectedEntry.syn.length > 0) ||
              (selectedEntry.f && selectedEntry.f.length > 0)) && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 sm:p-5 space-y-3">
                {selectedEntry.syn && selectedEntry.syn.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      🔗 Từ đồng nghĩa / Liên quan (Chạm để tra ngay)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntry.syn.map((syn) => (
                        <button
                          key={syn}
                          type="button"
                          onClick={() => {
                            setQuery(syn);
                            void openWord(syn);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 text-xs sm:text-sm font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100/70 transition-colors"
                        >
                          {syn}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.f && selectedEntry.f.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      🔤 Biến thể & Dạng chia từ
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntry.f.map((form) => (
                        <span
                          key={form}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300"
                        >
                          {form}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LIVE SEARCH SUGGESTIONS (When typing & no entry open) */}
        {!loadingEntry && !selectedEntry && query.trim().length > 0 && (
          <div className="space-y-4">
            {searching && enSuggestions.length === 0 && viSuggestions.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-500 dark:text-zinc-400">
                Đang tìm kiếm...
              </div>
            )}

            {/* English Suggestions */}
            {enSuggestions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <span>🇬🇧 Từ vựng Tiếng Anh ({enSuggestions.length})</span>
                  <span>Chạm để xem chi tiết</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {enSuggestions.map((item) => {
                    const shortDef = getShortMeaning(item, mode);
                    const primaryPos = item.m?.[0]?.p;
                    return (
                      <div
                        key={item.w}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEntry(item);
                            setHistory(recordDictLookup(item));
                            setNotFoundWord(null);
                            setShowMicPractice(false);
                          }}
                          className="flex-1 min-w-0 text-left space-y-0.5"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                              {item.w}
                            </span>
                            {item.i && (
                              <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                                {item.i}
                              </span>
                            )}
                            {primaryPos && (
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                {POS_BADGE_SHORT[primaryPos] || primaryPos}
                              </span>
                            )}
                            {item.c && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                                {item.c}
                              </span>
                            )}
                            {item.matchedFromForm && (
                              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                                ({item.matchedFromForm})
                              </span>
                            )}
                          </div>
                          {shortDef && (
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 line-clamp-1">
                              {shortDef}
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSpeak(item.w)}
                          title={`Nghe "${item.w}"`}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 shrink-0"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vietnamese -> English Suggestions */}
            {viSuggestions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50/70 dark:bg-amber-950/25 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Languages className="w-4 h-4" />
                    <span>🇻🇳 Tra ngược Việt → Anh ({viSuggestions.length} nhóm nghĩa)</span>
                  </span>
                  <span>Chạm vào từ tiếng Anh để mở</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {viSuggestions.map((match) => (
                    <div key={match.vi} className="p-3.5 sm:px-4 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Nghĩa tiếng Việt: <span className="text-slate-900 dark:text-zinc-100">“{match.vi}”</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {match.words.map((wItem) => (
                          <button
                            key={`${match.vi}-${wItem.word}`}
                            type="button"
                            onClick={() => {
                              setQuery(wItem.word);
                              void openWord(wItem.word);
                            }}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-teal-600/50 bg-slate-50/50 dark:bg-zinc-800/40 text-left flex items-start justify-between gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-teal-800 dark:text-teal-300">
                                  {wItem.word}
                                </span>
                                {wItem.pos && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                                    {wItem.pos}
                                  </span>
                                )}
                                {wItem.cefr && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                                    {wItem.cefr}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                {wItem.meaningVn}
                              </p>
                            </div>
                            <Volume2
                              className="w-4 h-4 text-slate-400 hover:text-teal-600 shrink-0 mt-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpeak(wItem.word);
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stable Empty State when query has no matching suggestions */}
            {!searching && enSuggestions.length === 0 && viSuggestions.length === 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-2">
                <Search className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  Chưa tìm thấy gợi ý trực tiếp cho “{query.trim()}”
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Hãy thử gõ từ đơn ngắn gọn hơn (VD: “hiểu”, “understand”) hoặc bấm nút <b>Tra từ</b> để tra cứu mở rộng.
                </p>
              </div>
            )}
          </div>
        )}

        {/* HOME DASHBOARD (When search box is empty and no entry is open) */}
        {!loadingEntry && !selectedEntry && query.trim().length === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHomeTab("history")}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    homeTab === "history"
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Vừa tra ({history.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHomeTab("bookmarks")}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    homeTab === "bookmarks"
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <BookMarked className="w-4 h-4" />
                  <span>Đã lưu ({bookmarks.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHomeTab("discover")}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    homeTab === "discover"
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gợi ý từ hay</span>
                </button>
              </div>

              {homeTab === "history" && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearDictHistory();
                    setHistory([]);
                  }}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa lịch sử</span>
                </button>
              )}
            </div>

            {homeTab === "history" && (
              history.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {history.map((item) => (
                    <div
                      key={item.word}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between gap-2.5 hover:border-teal-600/50 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => void openWord(item.word)}
                        className="flex-1 min-w-0 text-left space-y-0.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {item.word}
                          </span>
                          {item.ipa && (
                            <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                              {item.ipa}
                            </span>
                          )}
                          {item.cefr && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300">
                              {item.cefr}
                            </span>
                          )}
                          {item.count >= 2 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                              tra {item.count} lần
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                          {item.shortMeaning}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeak(item.word)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-2">
                  <Clock className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Chưa có lịch sử tra từ
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Gõ bất kỳ từ tiếng Anh hoặc tiếng Việt vào ô tìm kiếm phía trên, hoặc chọn một từ gợi ý bên dưới.
                  </p>
                </div>
              )
            )}

            {homeTab === "bookmarks" && (
              bookmarks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {bookmarks.map((item) => (
                    <div
                      key={item.word}
                      className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between gap-2.5 hover:border-amber-500 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => void openWord(item.word)}
                        className="flex-1 min-w-0 text-left space-y-0.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {item.word}
                          </span>
                          {item.ipa && (
                            <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                              {item.ipa}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                          {item.shortMeaning}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpeak(item.word)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-teal-700 dark:text-teal-300 hover:bg-teal-50 shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-2">
                  <Star className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Chưa có từ nào được lưu
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Khi đang xem một từ, bấm nút “⭐ Lưu từ” để ghim lại những từ bạn muốn xem nhanh.
                  </p>
                </div>
              )
            )}

            {(homeTab === "discover" || (homeTab === "history" && history.length === 0)) && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-1">
                  🎯 Từ vựng Thực chiến Đáng học (Chạm để xem Anh-Việt & Anh-Anh)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FEATURED_DISCOVERY_WORDS.map((item) => (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => void openWord(item.word)}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-left flex items-center justify-between gap-2.5 hover:border-teal-600/50 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                            {item.word}
                          </span>
                          <span className="text-xs font-mono text-teal-700 dark:text-teal-400">
                            {item.ipa}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                            {item.cefr}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                          {item.hint}
                        </p>
                      </div>
                      <Volume2
                        className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(item.word);
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

