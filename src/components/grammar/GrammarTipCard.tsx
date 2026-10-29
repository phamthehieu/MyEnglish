import { BookOpen, Check, X } from "lucide-react";
import type { GrammarTip } from "@/types/grammarTip";

/**
 * The grammar tip of a stage: the point in a few lines, examples with their translation, the usual mistake of a
 * Vietnamese speaker, and the lessons of the grammar book that go deeper (when `onOpenLesson` is given).
 */
export default function GrammarTipCard({ tip, onOpenLesson }: { tip: GrammarTip; onOpenLesson?: (lessonId: string) => void }) {
  return (
    <div className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
      <p className="font-semibold text-slate-900 dark:text-zinc-100">{tip.title}</p>
      <ul className="space-y-1.5 list-disc pl-5 marker:text-teal-600">
        {tip.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <ul className="space-y-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-3">
        {tip.examples.map((e) => (
          <li key={e.en}>
            <span className="block font-semibold text-slate-900 dark:text-zinc-100">{e.en}</span>
            <span className="block text-xs text-slate-500 dark:text-zinc-400">{e.vi}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Lỗi hay gặp</p>
        <p className="flex items-start gap-1.5 text-red-700 dark:text-red-300">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tip.mistake.wrong}</span>
        </p>
        <p className="flex items-start gap-1.5 text-green-700 dark:text-green-300">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tip.mistake.right}</span>
        </p>
        <p className="text-xs text-slate-600 dark:text-zinc-300">{tip.mistake.why}</p>
      </div>
      {onOpenLesson && tip.lessons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Đọc kỹ hơn trong sách ngữ pháp</p>
          <div className="flex flex-wrap gap-2">
            {tip.lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onOpenLesson(l.id)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent px-3.5 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 transition-colors"
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
