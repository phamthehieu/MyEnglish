import type { FormEvent } from "react";
import {
  BookOpen,
  Sparkles,
  Volume2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Code2,
  Copy,
  Terminal,
  Layers,
  Tag,
  RotateCw,
} from "lucide-react";
import { pipeline, type PipelineItem } from "@/services/pipeline";
import { parseTerms, parseCollocations } from "@/types/database";
import { useWordsStore } from "@/stores/wordsStore";
import { PAGE_CONTAINER, handleSpeak, type DashboardTab } from "./shared";

interface CaptureTabProps {
  inputWord: string;
  setInputWord: (value: string) => void;
  setMessage: (msg: string | null) => void;
  pipelineQueue: PipelineItem[];
  expandedQueueItems: Record<string, boolean>;
  toggleQueueItemExpand: (wordKey: string, e?: React.MouseEvent) => void;
  expandedTerms: Record<string, boolean>;
  toggleTermExpanded: (termKey: string, e?: React.MouseEvent) => void;
  copiedSnippet: boolean;
  handleCopyCode: (code: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
}

/** TAB 2: QUICK CAPTURE & AI PIPELINE */
export default function CaptureTab({
  inputWord,
  setInputWord,
  setMessage,
  pipelineQueue,
  expandedQueueItems,
  toggleQueueItemExpand,
  expandedTerms,
  toggleTermExpanded,
  copiedSnippet,
  handleCopyCode,
  setActiveTab,
}: CaptureTabProps) {
  const words = useWordsStore((s) => s.words);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);

  // Submit word manually
  const handleCaptureSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = inputWord.trim();
    if (!clean) return;

    setInputWord("");
    pipeline.enqueue(clean).then((res) =>
      setMessage(res.accepted ? `Analyzing "${clean}" with Gemini CLI...` : `Không thể thêm "${clean}": ${res.reason}`)
    );
  };

  return (
    <div className={`${PAGE_CONTAINER} space-y-4`}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI Vocabulary Enrichment</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Input any English word. Gemini CLI will automatically break down the Vietnamese meaning, tech context, and 3 code examples with grammar analysis.
        </p>
      </div>

      {/* Input Card */}
      <form onSubmit={handleCaptureSubmit} autoComplete="off" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <label className="flex min-h-12 min-w-0 flex-1 basis-full items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 sm:basis-auto">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
            <Terminal className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            placeholder="Nhập từ tiếng Anh (e.g. idempotent, telemetry, volatile, sanitize)..."
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-gramm="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
          />
          </label>
          <button
            type="submit"
            disabled={!inputWord.trim()}
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500 sm:w-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Phân tích & Lưu</span>
          </button>
        </div>

        {/* Sample Suggestions */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
          <span>Gợi ý mẫu:</span>
          {["idempotent", "concurrency", "telemetry", "deterministic", "throughput"].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setInputWord(term);
                pipeline.enqueue(term);
              }}
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {term}
            </button>
          ))}
        </div>
      </form>


      {/* Live Pipeline Queue */}
      {pipelineQueue.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
            Hàng đợi phân tích AI
          </h3>
          <div className="space-y-3">
            {pipelineQueue.map((item, idx) => {
              const enrichedData =
                item.result ||
                (() => {
                  const match = words.find(
                    (w) =>
                      (item.wordId && w.id === item.wordId) ||
                      w.word.toLowerCase() === item.word.toLowerCase()
                  );
                  if (!match) return null;
                  return {
                    phonetic: match.phonetic || undefined,
                    part_of_speech: match.part_of_speech || undefined,
                    topic: match.topic || undefined,
                    meaning_vn: match.meaning_vn,
                    collocations: parseCollocations(match.collocations),
                    code_snippet: match.code_snippet || undefined,
                    synonyms: parseTerms(match.synonyms),
                    antonyms: parseTerms(match.antonyms),
                    examples: match.examples.map((ex) => ({
                      sentence_en: ex.sentence_en,
                      sentence_vn: ex.sentence_vn,
                      grammar_analysis: ex.grammar_analysis,
                    })),
                  };
                })();

              const isExpanded = !!expandedQueueItems[item.word];
              const matchingWord = words.find(
                (w) =>
                  (item.wordId && w.id === item.wordId) ||
                  w.word.toLowerCase() === item.word.toLowerCase()
              );

              // MẶC ĐỊNH THU GỌN KHI ĐÃ HOÀN TẤT SINH TỪ (Chỉ mở ra khi user click)
              if (!isExpanded && enrichedData && item.status !== "analyzing") {
                return (
                  <div
                    key={idx}
                    onClick={(e) => toggleQueueItemExpand(item.word, e)}
                    className="relative cursor-pointer select-none space-y-2 rounded-2xl border border-slate-200 bg-white p-4 pr-14 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    {/* Nút xổ ra luôn cố định ở góc trên phải */}
                    <button
                      type="button"
                      onClick={(e) => toggleQueueItemExpand(item.word, e)}
                      title="Bấm để mở rộng chi tiết"
                      className="absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white capitalize">
                          {item.word}
                        </span>
                        {enrichedData.phonetic && (
                          <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
                            {enrichedData.phonetic}
                          </span>
                        )}
                        {enrichedData.part_of_speech && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {enrichedData.part_of_speech}
                          </span>
                        )}
                        {enrichedData.topic && (
                          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                            <Tag className="w-2.5 h-2.5" />
                            <span>{enrichedData.topic}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(item.word);
                          }}
                          title="Phát âm từ này"
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition-colors hover:bg-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:bg-teal-400/20"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        {matchingWord && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWord(matchingWord);
                              setActiveTab("library");
                            }}
                            title="Xem chi tiết trong Thư viện"
                            className="flex min-h-10 items-center gap-1 rounded-2xl border border-teal-700/30 bg-white px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Thư viện</span>
                          </button>
                        )}
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300">
                          Saved to Library ✓
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">Nghĩa: </span>
                      {enrichedData.meaning_vn}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="relative space-y-5 rounded-2xl border border-slate-200 bg-white p-4 pr-14 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5 md:pr-14"
                >
                  {/* Nút thu gọn thẻ luôn cố định ở góc trên phải */}
                  {enrichedData && (
                    <button
                      type="button"
                      onClick={(e) => toggleQueueItemExpand(item.word, e)}
                      title="Bấm để thu gọn thẻ"
                      className="absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  )}

                  {/* Header Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800/80 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xl font-semibold text-slate-900 dark:text-white capitalize">
                        {item.word}
                      </span>
                      {enrichedData?.phonetic && (
                        <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
                          {enrichedData.phonetic}
                        </span>
                      )}
                      {enrichedData?.part_of_speech && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {enrichedData.part_of_speech}
                        </span>
                      )}
                      {enrichedData?.topic && (
                        <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                          <Tag className="w-3 h-3" />
                          <span>{enrichedData.topic}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {enrichedData && (
                        <button
                          type="button"
                          onClick={() => handleSpeak(item.word)}
                          title="Phát âm từ này"
                          className="flex min-h-10 items-center gap-1 rounded-2xl bg-teal-50 px-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:bg-teal-400/20"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Phát âm</span>
                        </button>
                      )}

                      {matchingWord && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWord(matchingWord);
                            setActiveTab("library");
                          }}
                          title="Xem chi tiết đầy đủ trong Thư viện"
                          className="flex min-h-10 items-center gap-1 rounded-2xl border border-teal-700/30 bg-white px-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Thư viện</span>
                        </button>
                      )}

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "analyzing"
                          ? "bg-amber-50 text-amber-800 animate-pulse dark:bg-amber-500/10 dark:text-amber-300"
                          : item.status === "completed"
                            ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                          }`}
                      >
                        {item.status === "analyzing" && "Analyzing with Gemini..."}
                        {item.status === "completed" && "Saved to Library ✓"}
                        {item.status === "failed" && "Failed"}
                        {item.status === "pending" && "Queued"}
                      </span>

                      {item.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => pipeline.retry(item.word)}
                          title="Thử lại phân tích AI"
                          className="flex min-h-10 items-center gap-1 rounded-2xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Thử lại</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Analyzing Banner */}
                  {item.status === "analyzing" && (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                      <Sparkles className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-300 shrink-0" />
                      <span>Gemini AI đang phân tích nghĩa, phát âm, từ đồng nghĩa, trái nghĩa và cấu trúc ví dụ...</span>
                    </div>
                  )}

                  {item.error && <p className="text-sm text-red-700 dark:text-red-400">{item.error}</p>}

                  {/* Complete Analysis Breakdown */}
                  {enrichedData && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      {/* 1. Vietnamese Meaning Card */}
                      <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 space-y-1.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ý nghĩa Tiếng Việt (Chuyên ngành & Đời sống)</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-zinc-200 font-normal leading-relaxed">
                          {enrichedData.meaning_vn}
                        </p>
                      </div>

                      {/* 2. Collocations */}
                      {enrichedData.collocations && enrichedData.collocations.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 space-y-2">
                          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            Cụm từ thường gặp (Collocations):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {enrichedData.collocations.map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700/70 text-slate-800 dark:text-zinc-200 font-mono text-xs hover:border-cyan-500/50 transition-colors"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Synonyms Section */}
                      {enrichedData.synonyms && enrichedData.synonyms.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-500" />
                              Từ đồng nghĩa (Synonyms):
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                              {enrichedData.synonyms.length} từ • click để xem phân tích
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {enrichedData.synonyms.map((s, sIdx) => {
                              const termKey = `queue-${item.word}-syn-${s.word}`;
                              const isExpanded = !!expandedTerms[termKey];
                              const hasExamples = s.examples && s.examples.length > 0;

                              return (
                                <div
                                  key={sIdx}
                                  className={`rounded-2xl border transition-all overflow-hidden ${isExpanded
                                    ? "bg-teal-50/40 dark:bg-zinc-900 border-teal-400 dark:border-teal-500/60"
                                    : "bg-slate-50 dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800 hover:border-teal-400 dark:hover:border-teal-500/40 hover:bg-slate-50/90 dark:hover:bg-zinc-900"
                                    }`}
                                >
                                  {/* Synonym Header */}
                                  <div
                                    onClick={(e) => toggleTermExpanded(termKey, e)}
                                    className="p-3.5 cursor-pointer flex items-start justify-between gap-2 select-none"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300">
                                          {s.word}
                                        </span>
                                        {s.phonetic && (
                                          <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400/90 bg-teal-100/70 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/50 px-1.5 py-0.2 rounded">
                                            {s.phonetic}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => handleSpeak(s.word, e)}
                                          title="Phát âm"
                                          className="text-slate-500 hover:text-teal-600 dark:text-zinc-500 dark:hover:text-teal-400 p-0.5 rounded transition-colors"
                                        >
                                          <Volume2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {s.meaning_vn && (
                                        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 leading-snug">
                                          {s.meaning_vn}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 dark:text-zinc-400">
                                      {hasExamples ? (
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-400 border border-teal-200 dark:border-teal-800/60 font-medium">
                                          {s.examples!.length} câu ví dụ
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400">
                                          Chi tiết
                                        </span>
                                      )}
                                      <div className="p-1 rounded text-slate-500 group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-white transition-colors">
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Synonym Body */}
                                  {isExpanded && (
                                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200 dark:border-zinc-800/80 space-y-3 animate-in slide-in-from-top-2 duration-150">
                                      {hasExamples ? (
                                        <div className="space-y-3 pt-2">
                                          {s.examples!.map((ex, exIdx) => (
                                            <div
                                              key={exIdx}
                                              className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/90 space-y-2.5 text-xs shadow-sm"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2">
                                                  <span className="font-mono text-teal-600 dark:text-teal-400 font-bold text-[11px] shrink-0 mt-0.5">
                                                    #{exIdx + 1}
                                                  </span>
                                                  <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                                                    "{ex.sentence_en}"
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => handleSpeak(ex.sentence_en, e)}
                                                  title="Nghe câu"
                                                  className="text-slate-500 hover:text-teal-600 dark:text-zinc-500 dark:hover:text-teal-400 p-0.5 rounded shrink-0"
                                                >
                                                  <Volume2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>

                                              {ex.meaning_vn && (
                                                <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
                                                  <span className="font-bold text-cyan-700 dark:text-cyan-400 block mb-0.5">
                                                    📖 Ý nghĩa của câu:
                                                  </span>
                                                  {ex.meaning_vn}
                                                </div>
                                              )}

                                              {ex.structure && (
                                                <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 text-[11px] text-teal-900 dark:text-teal-200 font-mono leading-relaxed">
                                                  <span className="font-bold text-teal-700 dark:text-teal-400 block mb-0.5 font-sans">
                                                    🧩 Cấu trúc câu:
                                                  </span>
                                                  {ex.structure}
                                                </div>
                                              )}

                                              {ex.why_used && (
                                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                                                  <span className="font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                                                    💡 Giải thích lý do dùng cấu trúc:
                                                  </span>
                                                  {ex.why_used}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="py-2.5 text-[11px] text-slate-500 dark:text-zinc-500 italic text-center">
                                          Từ này đã được tự động lưu vào thư viện từ vựng.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 4. Antonyms Section */}
                      {enrichedData.antonyms && enrichedData.antonyms.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-slate-500" />
                              Từ trái nghĩa (Antonyms):
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                              {enrichedData.antonyms.length} từ • click để xem phân tích
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {enrichedData.antonyms.map((a, aIdx) => {
                              const termKey = `queue-${item.word}-ant-${a.word}`;
                              const isExpanded = !!expandedTerms[termKey];
                              const hasExamples = a.examples && a.examples.length > 0;

                              return (
                                <div
                                  key={aIdx}
                                  className={`rounded-2xl border transition-all overflow-hidden ${isExpanded
                                    ? "bg-slate-50/40 dark:bg-zinc-900 border-slate-400 dark:border-zinc-500/60"
                                    : "bg-slate-50 dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-500/40 hover:bg-slate-50/90 dark:hover:bg-zinc-900"
                                    }`}
                                >
                                  {/* Antonym Header */}
                                  <div
                                    onClick={(e) => toggleTermExpanded(termKey, e)}
                                    className="p-3.5 cursor-pointer flex items-start justify-between gap-2 select-none"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-bold text-slate-700 dark:text-zinc-300">
                                          {a.word}
                                        </span>
                                        {a.phonetic && (
                                          <span className="text-[11px] font-mono text-slate-700 dark:text-zinc-400/90 bg-slate-100/70 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800/50 px-1.5 py-0.2 rounded">
                                            {a.phonetic}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => handleSpeak(a.word, e)}
                                          title="Phát âm"
                                          className="text-slate-500 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 p-0.5 rounded transition-colors"
                                        >
                                          <Volume2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {a.meaning_vn && (
                                        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 leading-snug">
                                          {a.meaning_vn}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-slate-500 dark:text-zinc-400">
                                      {hasExamples ? (
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-950/90 text-slate-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800/60 font-medium">
                                          {a.examples!.length} câu ví dụ
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400">
                                          Chi tiết
                                        </span>
                                      )}
                                      <div className="p-1 rounded text-slate-500 group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-white transition-colors">
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Antonym Body */}
                                  {isExpanded && (
                                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200 dark:border-zinc-800/80 space-y-3 animate-in slide-in-from-top-2 duration-150">
                                      {hasExamples ? (
                                        <div className="space-y-3 pt-2">
                                          {a.examples!.map((ex, exIdx) => (
                                            <div
                                              key={exIdx}
                                              className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/90 space-y-2.5 text-xs shadow-sm"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2">
                                                  <span className="font-mono text-slate-600 dark:text-zinc-400 font-bold text-[11px] shrink-0 mt-0.5">
                                                    #{exIdx + 1}
                                                  </span>
                                                  <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                                                    "{ex.sentence_en}"
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => handleSpeak(ex.sentence_en, e)}
                                                  title="Nghe câu"
                                                  className="text-slate-500 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 p-0.5 rounded shrink-0"
                                                >
                                                  <Volume2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>

                                              {ex.meaning_vn && (
                                                <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
                                                  <span className="font-bold text-cyan-700 dark:text-cyan-400 block mb-0.5">
                                                    📖 Ý nghĩa của câu:
                                                  </span>
                                                  {ex.meaning_vn}
                                                </div>
                                              )}

                                              {ex.structure && (
                                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/20 border border-slate-200 dark:border-zinc-900/40 text-[11px] text-slate-900 dark:text-zinc-200 font-mono leading-relaxed">
                                                  <span className="font-bold text-slate-700 dark:text-zinc-400 block mb-0.5 font-sans">
                                                    🧩 Cấu trúc câu:
                                                  </span>
                                                  {ex.structure}
                                                </div>
                                              )}

                                              {ex.why_used && (
                                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                                                  <span className="font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                                                    💡 Giải thích lý do dùng cấu trúc:
                                                  </span>
                                                  {ex.why_used}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="py-2.5 text-[11px] text-slate-500 dark:text-zinc-500 italic text-center">
                                          Từ này đã được tự động lưu vào thư viện từ vựng.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 5. Code Snippet with Terminal Styling */}
                      {enrichedData.code_snippet && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Terminal className="w-4 h-4" />
                              Đoạn mã ngữ cảnh (Code Snippet):
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(enrichedData.code_snippet!)}
                              className="flex min-h-10 items-center gap-1 rounded-2xl px-3 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                            >
                              {copiedSnippet ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-green-700 dark:text-green-400" />
                                  <span className="text-green-700 dark:text-green-400 font-semibold">Đã sao chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Sao chép mã</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[#0d1117] dark:border-zinc-800">
                            <div className="bg-zinc-900/90 px-4 py-2 border-b border-zinc-800 flex items-center justify-between select-none">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                                <span className="ml-2 text-[11px] font-mono text-zinc-500">example.ts</span>
                              </div>
                              <span className="text-[11px] font-mono text-zinc-500">Developer Context</span>
                            </div>
                            <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed selection:bg-cyan-500/30 whitespace-pre">
                              <code>{enrichedData.code_snippet}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* 6. Context Examples with Grammar & Syntax Analysis */}
                      {enrichedData.examples && enrichedData.examples.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Code2 className="w-4 h-4" />
                              Ví dụ & Phân tích cú pháp:
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                              {enrichedData.examples.length} câu ví dụ
                            </span>
                          </div>

                          <div className="space-y-3.5">
                            {enrichedData.examples.map((ex, exIdx) => (
                              <div
                                key={exIdx}
                                className="rounded-2xl bg-slate-50 dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-800/90 space-y-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-xs shrink-0 mt-0.5">
                                      #{exIdx + 1}
                                    </span>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                                      {ex.sentence_en}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSpeak(ex.sentence_en)}
                                    title="Nghe cả câu"
                                    className="text-slate-500 hover:text-cyan-600 dark:text-zinc-500 dark:hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-900 transition-colors shrink-0"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {ex.sentence_vn && (
                                  <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 text-xs text-cyan-950 dark:text-cyan-200 leading-relaxed">
                                    <span className="font-semibold text-cyan-700 dark:text-cyan-400">Dịch nghĩa: </span>
                                    {ex.sentence_vn}
                                  </div>
                                )}

                                {ex.grammar_analysis && (
                                  <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-zinc-900">
                                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold block">
                                      Phân tích cú pháp (Grammar / Syntax):
                                    </span>
                                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap shadow-inner">
                                      {ex.grammar_analysis}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
