import { useState, useEffect } from "react";
import { Volume2, RotateCcw, Quote, BookOpen } from "lucide-react";
import type { WordDetail } from "@/types/database";
import { isLeech } from "@/services/smartReview";
import { getCatalogEntries, type CatalogEntry } from "@/services/vocabCatalog";
import { highlightWord } from "./highlightWord";
import MnemonicPanel from "./MnemonicPanel";

/**
 * Subcomponent to render revealed word details (Vietnamese meaning, examples & grammar analysis)
 */
export default function RevealedWordContent({
  currentWord,
  handleSpeak,
  onFlipBack,
  compact = false,
}: {
  currentWord: WordDetail;
  handleSpeak: (text: string, e?: React.MouseEvent) => void;
  onFlipBack?: () => void;
  compact?: boolean;
}) {
  const hasExamples = Boolean(currentWord.examples && currentWord.examples.length > 0);
  const wordIsLeech = isLeech(currentWord.srs);

  const [catalogEntry, setCatalogEntry] = useState<CatalogEntry | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!currentWord.catalog_id) {
      setCatalogEntry(null);
      return;
    }
    getCatalogEntries([currentWord.catalog_id])
      .then(([e]) => !cancelled && setCatalogEntry(e ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentWord.catalog_id]);

  return (
    <div
      className={`flex flex-col ${
        compact ? "space-y-3" : "flex-1 min-h-0 justify-between h-full"
      } animate-in fade-in duration-200`}
    >
      {/* Top Header Section */}
      <div className="space-y-2 shrink-0 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {currentWord.word}
            </h3>
            {currentWord.phonetic && (
              <span className="text-sm font-mono text-teal-700 dark:text-teal-300 bg-slate-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                {currentWord.phonetic}
              </span>
            )}
            <button
              onClick={(e) => handleSpeak(currentWord.word, e)}
              className="min-w-10 min-h-10 inline-flex items-center justify-center text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200 transition-colors rounded-full hover:bg-teal-50 dark:hover:bg-teal-400/10"
              title="Phát âm từ vựng"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!compact && onFlipBack && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFlipBack();
                }}
                className="text-sm font-semibold flex items-center gap-1.5 px-3 min-h-10 rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
                title="Lật thẻ về mặt trước"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Lật lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Vietnamese Meaning Header Pill */}
        <div className="px-3.5 py-2.5 rounded-2xl bg-teal-50 dark:bg-teal-400/10 border border-teal-700/20 dark:border-teal-400/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-teal-800 dark:text-teal-300 font-semibold">
              Nghĩa tiếng Việt:
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              {currentWord.meaning_vn}
            </span>
          </div>
        </div>

        {/* AI Mnemonic Memory Hook for Leech / Challenging Words */}
        <MnemonicPanel currentWord={currentWord} wordIsLeech={wordIsLeech} />
      </div>

      {/* Main Content Area: Examples & Grammar Analysis taking full card height */}
      <div
        className={
          compact
            ? "space-y-3 py-1"
            : "flex-1 min-h-0 h-full overflow-y-auto pr-1 py-2 space-y-3 scrollbar-thin"
        }
      >
        <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-zinc-300 font-semibold pt-0.5">
          <Quote className="w-3.5 h-3.5" />
          <span>Ví dụ & Phân tích ngữ pháp ({currentWord.examples?.length || 0}):</span>
        </div>

        {hasExamples ? (
          <div className="space-y-3">
            {currentWord.examples.map((ex, idx) => {
              const sense = (ex.sense_index != null && catalogEntry?.senses)
                ? catalogEntry.senses[ex.sense_index]
                : undefined;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white dark:bg-zinc-900 p-4 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
                >
                  {sense && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-xs bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {sense.pos}
                      </span>
                      <span className="text-slate-600 dark:text-zinc-300 font-medium">
                        {sense.vn}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900 dark:text-zinc-100 leading-relaxed">
                    "{highlightWord(ex.sentence_en, currentWord.word)}"
                  </p>
                  <button
                    onClick={(e) => handleSpeak(ex.sentence_en, e)}
                    title="Nghe câu ví dụ"
                    className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-full text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-400/10 transition-colors shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {ex.sentence_vn && (
                  <p className="text-sm text-slate-600 dark:text-zinc-400 italic leading-relaxed bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 rounded-xl">
                    {ex.sentence_vn}
                  </p>
                )}

                {ex.grammar_analysis && (
                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      <BookOpen className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                      <span>Phân tích ngữ pháp:</span>
                    </div>
                    <div className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                      {ex.grammar_analysis}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-600 dark:text-zinc-400 space-y-2">
            <Quote className="w-10 h-10 mx-auto opacity-40 text-teal-600" />
            <p className="text-sm">Chưa có câu ví dụ và phân tích ngữ pháp cho từ này.</p>
          </div>
        )}
      </div>
    </div>
  );
}
