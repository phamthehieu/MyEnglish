import { BookOpen, Check, X } from "lucide-react";
import type { GrammarTip } from "@/types/grammarTip";

/**
 * The grammar tip of a stage: the point in a few lines, examples with their translation, the usual mistake of a
 * Vietnamese speaker, and the lessons of the grammar book that go deeper (when `onOpenLesson` is given).
 */
export default function GrammarTipCard({ tip, onOpenLesson }: { tip: GrammarTip; onOpenLesson?: (lessonId: string) => void }) {
  return (
    <div className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
      <p className="font-bold text-slate-900 dark:text-white">{tip.title}</p>
      <ul className="space-y-1.5 list-disc pl-5 marker:text-cyan-500">
        {tip.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <ul className="space-y-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-3">
        {tip.examples.map((e) => (
          <li key={e.en}>
            <span className="block font-semibold text-slate-900 dark:text-white">{e.en}</span>
            <span className="block text-xs text-slate-500 dark:text-zinc-400">{e.vi}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Lỗi hay gặp</p>
        <p className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tip.mistake.wrong}</span>
        </p>
        <p className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tip.mistake.right}</span>
        </p>
        <p className="text-xs text-slate-600 dark:text-zinc-400">{tip.mistake.why}</p>
      </div>
      {onOpenLesson && tip.lessons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Đọc kỹ hơn trong sách ngữ pháp</p>
          <div className="flex flex-wrap gap-1.5">
            {tip.lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onOpenLesson(l.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 dark:border-cyan-800 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
