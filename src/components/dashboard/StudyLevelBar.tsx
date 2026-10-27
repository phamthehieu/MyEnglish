import { useEffect, useState } from "react";
import { GraduationCap, X } from "lucide-react";
import type { StudyLevel } from "@/services/vocabCatalog";
import { changeStudyLevels, getStudyLevels, levelAbove } from "@/services/vocabFeed";
import { useWordsStore } from "@/stores/wordsStore";
import { LevelPicker, mixDescription } from "./VocabTab";

const rangeText = (levels: readonly StudyLevel[]) => (levels.length === 1 ? levels[0] : `${levels[0]} – ${levels[levels.length - 1]}`);

/**
 * "Cấp của bạn" on the Today screen: the levels the learner studies, and a button that opens the level picker
 * right here (it used to be in the fourth tab of the word section). The speaking path starts at the lowest level.
 */
export default function StudyLevelBar() {
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
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 min-w-0 text-slate-700 dark:text-zinc-300">
          <GraduationCap className="w-4 h-4 shrink-0 text-cyan-500" />
          <span className="truncate">
            Cấp của bạn: <b className="text-slate-900 dark:text-white">{rangeText(levels)}</b>
          </span>
        </span>
        <button onClick={() => setOpen(true)} className="shrink-0 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:underline">
          Đổi cấp
        </button>
      </div>

      {open && (
        <div
          className="popup-backdrop-enter fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Đổi cấp" className="popup-card-enter w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-3 shadow-xl">
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
                className="w-full px-4 py-2 rounded-lg border border-cyan-500 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 disabled:opacity-60 text-sm font-semibold"
              >
                Nâng lên {above}
              </button>
            )}
            <button onClick={() => setOpen(false)} disabled={saving} className="w-full px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-semibold">
              Xong
            </button>
          </div>
        </div>
      )}
    </>
  );
}
