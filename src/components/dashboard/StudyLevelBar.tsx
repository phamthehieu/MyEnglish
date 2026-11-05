import { useEffect, useState } from "react";
import { ChevronDown, Layers, X } from "lucide-react";
import type { StudyLevel } from "@/services/vocabCatalog";
import { changeStudyLevels, getStudyLevels, levelAbove } from "@/services/vocabFeed";
import { useWordsStore } from "@/stores/wordsStore";
import { LevelPicker, mixDescription } from "./VocabTab";

const rangeText = (levels: readonly StudyLevel[]) => (levels.length === 1 ? levels[0] : `${levels[0]} – ${levels[levels.length - 1]}`);

/**
 * "Cấp của bạn" on the Today screen: supports both standalone card and inline hero pill inside Today's Hero Card.
 */
export default function StudyLevelBar({ variant = "card" }: { variant?: "card" | "hero-pill" }) {
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [levels, setLevels] = useState<StudyLevel[]>(getStudyLevels);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sync = () => setLevels(getStudyLevels());
    window.addEventListener("myenglish-study-levels-changed", sync);
    return () => window.removeEventListener("myenglish-study-levels-changed", sync);
  }, []);

  const choose = async (next: StudyLevel[]) => {
    setSaving(true);
    try {
      setLevels(await changeStudyLevels(next));
      refreshWords();
    } finally {
      setSaving(false);
    }
  };
  const above = levelAbove(levels);

  return (
    <>
      {variant === "hero-pill" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-200 ring-1 ring-white/15 transition-colors hover:bg-white/20"
        >
          <Layers className="h-3.5 w-3.5 text-teal-300" />
          <span>Cấp đang học: <b className="text-white">{rangeText(levels)}</b></span>
          <span className="text-indigo-200/80">· Đổi cấp</span>
          <ChevronDown className="h-3.5 w-3.5 text-teal-300" />
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 md:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 px-2 text-lg font-bold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
            {levels[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900 dark:text-white">Cấp của bạn: {rangeText(levels)}</span>
            <span className="block text-sm text-slate-500 dark:text-zinc-400">Từ mới và lộ trình nói theo cấp này</span>
          </span>
          <button
            onClick={() => setOpen(true)}
            className="min-h-10 shrink-0 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:bg-teal-400/20"
          >
            Đổi cấp
          </button>
        </div>
      )}

      {open && (
        <div
          className="popup-backdrop-enter fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Đổi cấp" className="popup-card-enter w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-3 shadow-xl text-left">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Bạn muốn học cấp nào?</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Đổi lúc nào cũng được. Từ vựng mới và lộ trình nói đều theo cấp này.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Đóng" className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <LevelPicker value={levels} onChange={choose} disabled={saving} />
            <p className="text-xs text-slate-500 dark:text-zinc-400">{mixDescription(levels)}</p>
            {above && (
              <button
                onClick={() => choose([...levels, above])}
                disabled={saving}
                className="w-full px-4 py-2 rounded-xl border border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 disabled:opacity-60 text-sm font-semibold"
              >
                Nâng lên {above}
              </button>
            )}
            <button onClick={() => setOpen(false)} disabled={saving} className="w-full px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-semibold">
              Xong
            </button>
          </div>
        </div>
      )}
    </>
  );
}
