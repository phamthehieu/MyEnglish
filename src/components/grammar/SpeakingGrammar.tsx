import { useMemo, useState } from "react";
import { ChevronDown, Footprints } from "lucide-react";
import { tipEntries } from "@/data/grammarTips";
import type { PatternLevel } from "@/types/pattern";
import GrammarTipCard from "./GrammarTipCard";
import Collapse from "../ui/Collapse";
import { useRoadmap } from "../roadmap/useRoadmap";

/**
 * "Ngữ pháp cho nói": the grammar behind the sentences of each stage of the speaking path, by level. It opens on the
 * stage the learner is working on, so the tab shows the grammar they need now first.
 */
export default function SpeakingGrammar({ onOpenLesson, defaultOpen = false }: { onOpenLesson?: (lessonId: string) => void; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const entries = useMemo(tipEntries, []);
  const { current } = useRoadmap();
  const levels = useMemo(() => [...new Set(entries.map((e) => e.level))], [entries]);
  const currentEntry = entries.find((e) => e.stage === current?.id);
  const [level, setLevel] = useState<PatternLevel>(currentEntry?.level ?? levels[0] ?? "A1");
  const [open, setOpen] = useState<string | null>(currentEntry?.stage ?? null);

  if (entries.length === 0) return null;
  const shown = entries.filter((e) => e.level === level);

  return (
    <section aria-label="Ngữ pháp cho nói" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 md:p-5 space-y-3">
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full min-h-11 flex items-center gap-3 text-left">
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-zinc-100">
            <Footprints className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" /> Ngữ pháp cho nói
          </span>
          <span className="block text-sm text-slate-500 dark:text-zinc-400">
            Vì sao các câu mẫu của lộ trình nói lại đúng, để bạn tự đặt thêm câu mới.
            {currentEntry ? ` Bạn đang ở chặng "${currentEntry.stageTitle}".` : ""}
          </span>
        </span>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 dark:text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && levels.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cấp">
          {levels.map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={level === l}
              onClick={() => {
                setLevel(l);
                setOpen(null);
              }}
              className={`px-4 min-h-10 rounded-full text-sm font-semibold transition-colors ${
                level === l
                  ? "bg-teal-700 text-white dark:bg-teal-600"
                  : "border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {expanded && <ul className="space-y-2">
        {shown.map((e) => {
          const isOpen = open === e.stage;
          return (
            <li key={e.stage} className={`rounded-2xl border ${e.stage === current?.id ? "border-teal-700/40 dark:border-teal-400/40" : "border-slate-200 dark:border-zinc-800"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : e.stage)}
                aria-expanded={isOpen}
                className="w-full min-h-14 flex items-center gap-2 px-4 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">{e.stageTitle}</span>
                  <span className="block text-xs text-slate-500 dark:text-zinc-400 truncate">{e.title}</span>
                </span>
                {e.stage === current?.id && (
                  <span className="shrink-0 rounded-full bg-teal-50 dark:bg-teal-400/10 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:text-teal-300">Đang học</span>
                )}
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 dark:text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <Collapse open={isOpen}>
                <div className="px-4 pb-4">
                  <GrammarTipCard tip={e} onOpenLesson={onOpenLesson} />
                </div>
              </Collapse>
            </li>
          );
        })}
      </ul>}
    </section>
  );
}
