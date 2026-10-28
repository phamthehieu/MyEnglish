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
    <section aria-label="Ngữ pháp cho nói" className="rounded-2xl border border-cyan-200 dark:border-cyan-900/60 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full min-h-[44px] flex items-center gap-2 text-left">
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Footprints className="w-4 h-4 shrink-0 text-emerald-500" /> Ngữ pháp cho nói
          </span>
          <span className="block text-xs text-slate-600 dark:text-zinc-400">
            Vì sao các câu mẫu của lộ trình nói lại đúng, để bạn tự đặt thêm câu mới.
            {currentEntry ? ` Bạn đang ở chặng "${currentEntry.stageTitle}".` : ""}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && levels.length > 1 && (
        <div className="flex gap-1.5" role="tablist" aria-label="Cấp">
          {levels.map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={level === l}
              onClick={() => {
                setLevel(l);
                setOpen(null);
              }}
              className={`px-4 min-h-[40px] rounded-lg border text-xs font-bold ${
                level === l
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-cyan-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {expanded && <ul className="space-y-1.5">
        {shown.map((e) => {
          const isOpen = open === e.stage;
          return (
            <li key={e.stage} className={`rounded-xl border ${e.stage === current?.id ? "border-emerald-400 dark:border-emerald-700" : "border-slate-200 dark:border-zinc-800"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : e.stage)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{e.stageTitle}</span>
                  <span className="block text-xs text-slate-600 dark:text-zinc-400 truncate">{e.title}</span>
                </span>
                {e.stage === current?.id && (
                  <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">Đang học</span>
                )}
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <Collapse open={isOpen}>
                <div className="px-3 pb-3">
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
