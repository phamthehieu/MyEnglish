import { useCallback } from "react";
import { Volume2, Lightbulb } from "lucide-react";
import type { GrammarBlock } from "@/types/grammarBook";
import { handleSpeak } from "@/components/review/speech";

interface HandbookViewProps {
  blocks: GrammarBlock[];
  /** The lesson's names: the lesson screen already shows them in its header, so the handbook does not repeat them */
  title?: string;
  titleVn?: string;
  chapterNotes?: GrammarBlock[];
}

/** Imported data is the learner's own: anything that is not text shows as nothing instead of crashing */
function txt(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export default function HandbookView({
  blocks,
  chapterNotes = [],
}: HandbookViewProps) {
  const speakText = useCallback((text: string) => {
    handleSpeak(text, 0.95);
  }, []);

  const safeBlocks = list<GrammarBlock>(blocks);
  const safeNotes = list<GrammarBlock>(chapterNotes);

  const renderBlock = (block: GrammarBlock, index: number) => {
    if (!block || typeof block !== "object") return null;
    switch (block.type) {
      case "heading":
        return (
          <h3
            key={index}
            className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mt-6 first:mt-0 mb-2"
          >
            {txt(block.text)}
          </h3>
        );

      case "text":
        return (
          <p key={index} className="text-base text-slate-700 dark:text-zinc-300 leading-relaxed my-2 whitespace-pre-line">
            {txt(block.text)}
          </p>
        );

      case "bullet":
        return (
          <div key={index} className="flex items-start gap-2.5 my-1.5 ml-1 text-base text-slate-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-700 dark:bg-teal-400 mt-2.5 shrink-0" />
            <span className="leading-relaxed flex-1 whitespace-pre-line">{txt(block.text)}</span>
          </div>
        );

      case "formula":
        return (
          <div
            key={index}
            className="my-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-400/10 border border-teal-700/20 dark:border-teal-400/20"
          >
            {txt(block.label) && (
              <span className="inline-block px-2.5 py-1 mb-2 text-xs font-semibold rounded-full bg-white dark:bg-zinc-900 text-teal-800 dark:text-teal-300">
                {txt(block.label)}
              </span>
            )}
            <div className="font-mono text-base font-semibold text-teal-950 dark:text-teal-100 whitespace-pre-line break-words leading-relaxed">
              {txt(block.text)}
            </div>
          </div>
        );

      case "example":
        return (
          <div
            key={index}
            className="my-2.5 py-2 pl-4 pr-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-3"
          >
            <div className="space-y-1 flex-1 min-w-0 py-1">
              <div className="text-base font-semibold text-slate-900 dark:text-zinc-100 break-words">
                <span>{txt(block.en)}</span>
              </div>
              {txt(block.vi) && (
                <div className="text-sm text-slate-500 dark:text-zinc-400">
                  {txt(block.vi)}
                </div>
              )}
            </div>
            <button
              onClick={() => speakText(txt(block.en))}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 transition-colors shrink-0"
              aria-label="Phát âm tiếng Anh"
              title="Phát âm tiếng Anh"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        );

      case "note":
        return (
          <div
            key={index}
            className="my-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2.5 text-sm text-amber-900 dark:text-amber-200"
          >
            <Lightbulb className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed whitespace-pre-line flex-1">{txt(block.text)}</div>
          </div>
        );

      case "table": {
        const headers = list<unknown>(block.headers);
        const rows = list<unknown>(block.rows);
        if (headers.length === 0 && rows.length === 0) return null;
        return (
          <div key={index} className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              {headers.length > 0 && (
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 font-semibold border-b border-slate-200 dark:border-zinc-700">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-3 border-r border-slate-200 dark:border-zinc-700 last:border-r-0">
                        {txt(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-slate-100 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition last:border-b-0"
                  >
                    {(Array.isArray(row) ? row : [row]).map((cell: unknown, cIdx) => (
                      <td
                        key={cIdx}
                        className="p-3 border-r border-slate-200/60 dark:border-zinc-800/60 last:border-r-0 align-top text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed"
                      >
                        {txt(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "wordlist": {
        const items = list<{ en?: unknown; vi?: unknown } | null>(block.items).filter((item) => !!item && typeof item === "object");
        if (items.length === 0) return null;
        return (
          <div key={index} className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((item, wIdx) => (
              <div
                key={wIdx}
                className="py-1 pl-3 pr-1 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 break-words">
                  <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100">{txt(item!.en)}</span>
                  {txt(item!.vi) && <span className="ml-2 text-sm text-slate-500 dark:text-zinc-400">({txt(item!.vi)})</span>}
                </div>
                <button
                  onClick={() => speakText(txt(item!.en))}
                  className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 transition-colors"
                  aria-label="Phát âm"
                  title="Phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
      {/* Main Blocks */}
      <div className="space-y-1">
        {safeBlocks.map((block, idx) => renderBlock(block, idx))}
      </div>

      {/* Chapter Notes if present */}
      {safeNotes.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400 mb-3">
            Ghi nhớ chung của chương
          </h4>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 space-y-2">
            {safeNotes.map((noteBlock, nIdx) => renderBlock(noteBlock, nIdx))}
          </div>
        </div>
      )}
    </div>
  );
}
