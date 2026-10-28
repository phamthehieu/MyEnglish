import { Footprints, Play } from "lucide-react";
import { PATTERNS } from "@/data/patterns";
import { AUTOSTART_KEY } from "@/components/patterns/PatternsTab";
import type { DashboardTab } from "@/components/dashboard/shared";
import { GOAL_LABEL } from "@/services/roadmap/stages";
import { useRoadmap } from "./useRoadmap";

/** "Lộ trình nói" on the Today screen: where the learner is on the path, and one button for today's work */
export default function RoadmapTodayCard({ setActiveTab, showStart = false }: { setActiveTab: (tab: DashboardTab) => void; showStart?: boolean }) {
  const { road, stages, current, plan, finishedCount, minutes, etaText } = useRoadmap();
  if (PATTERNS.length === 0) return null;

  const open = (autostart: boolean) => {
    try {
      if (autostart) sessionStorage.setItem(AUTOSTART_KEY, "1");
    } catch {
      /* the learner presses the button in the tab instead */
    }
    setActiveTab("patterns");
  };

  // A quiet card: the main action of the screen is the checklist, not this
  const box = "rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2";
  // Secondary button: outlined, so it does not compete with the screen's main one
  const outlineBtn = "w-full min-h-11 py-2.5 rounded-xl border border-emerald-600 dark:border-emerald-500 bg-white dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-bold inline-flex items-center justify-center gap-2";

  // The list of today has the path as its first item (and its button): this card only shows where the learner is
  // on it, unless the list is not shown
  if (road.goal === null && !showStart) return null;
  if (road.goal === null) {
    return (
      <div className={box}>
        <p className="font-bold text-emerald-950 dark:text-emerald-100 inline-flex items-center gap-2">
          <Footprints className="w-5 h-5" /> Lộ trình nói
        </p>
        <p className="text-sm text-emerald-900 dark:text-emerald-200">Chọn mục tiêu của bạn (du lịch, đi làm, đời sống, kết bạn) để có lộ trình học nói từng chặng.</p>
        <button onClick={() => open(false)} className={outlineBtn}>
          Chọn mục tiêu
        </button>
      </div>
    );
  }

  if (!current || !plan) {
    return (
      <div className={box}>
        <p className="font-bold text-emerald-950 dark:text-emerald-100">🎉 Bạn đã đi hết lộ trình nói hiện có!</p>
        <button onClick={() => open(false)} className="min-h-11 text-sm font-semibold underline underline-offset-2 text-emerald-800 dark:text-emerald-300">
          Xem lại lộ trình
        </button>
      </div>
    );
  }

  return (
    <div className={box}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Lộ trình nói · chặng {stages.indexOf(current) + 1}/{stages.length} · {GOAL_LABEL[road.goal]}
          </p>
          <p className="text-base font-bold text-emerald-950 dark:text-emerald-100">{current.title}</p>
        </div>
        <button onClick={() => open(false)} className="shrink-0 min-h-10 px-1 text-xs font-semibold underline underline-offset-2 text-emerald-800 dark:text-emerald-300">
          Xem lộ trình
        </button>
      </div>
      <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden" aria-label="Tiến độ lộ trình">
        <div className="h-full bg-emerald-600 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(finishedCount / Math.max(1, stages.length)) * 100}%` }} />
      </div>
      <p className="text-xs text-emerald-900 dark:text-emerald-200">
        Đã xong {finishedCount}/{stages.length} chặng · còn {etaText} nếu học {minutes} phút mỗi ngày
      </p>
      {showStart && plan.tasks.length > 0 && (
        <button onClick={() => open(true)} className={outlineBtn}>
          <Play className="w-4 h-4" /> Bắt đầu hôm nay (~{plan.minutes} phút)
        </button>
      )}
    </div>
  );
}
