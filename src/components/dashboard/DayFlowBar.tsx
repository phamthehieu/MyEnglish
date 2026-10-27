import { useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { advanceFlow, DAYFLOW_EVENT, getFlow, nextInFlow, stopFlow } from "@/services/dayFlow";
import type { TodayTaskId } from "./todayPlan";

const LABEL: Record<TodayTaskId, string> = {
  speaking: "Lộ trình nói",
  vocab: "Ôn từ và học từ mới",
  grammar: "Ngữ pháp",
  pronunciation: "Phát âm",
  reflex: "Luyện phản xạ",
};

/**
 * The bar of the day's flow, on every tab while the flow runs: which thing the learner is on, and one button to go
 * to the next (or to finish the day), so they never go back to the list to choose.
 */
export default function DayFlowBar({ onRun, onFinish }: { onRun: (id: TodayTaskId) => void; onFinish: () => void }) {
  const [flow, setFlow] = useState(() => getFlow());
  useEffect(() => {
    const sync = () => setFlow(getFlow());
    window.addEventListener(DAYFLOW_EVENT, sync);
    return () => window.removeEventListener(DAYFLOW_EVENT, sync);
  }, []);
  if (!flow) return null;

  const next = nextInFlow(flow);
  const current = flow.queue[flow.index];
  const go = () => {
    const id = advanceFlow();
    if (id) onRun(id);
    else onFinish();
  };

  return (
    <div role="status" aria-label="Luồng hôm nay" className="shrink-0 flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5">
      <span className="min-w-0 flex-1 text-xs text-emerald-900 dark:text-emerald-200">
        <b>
          Hôm nay · {flow.index + 1}/{flow.queue.length}
        </b>
        <span className="block truncate text-emerald-800/80 dark:text-emerald-300/80">{LABEL[current]}</span>
      </span>
      <button
        onClick={go}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-3 py-1.5 text-xs font-bold text-white"
      >
        {next ? (
          <>
            Xong, tiếp: {LABEL[next]} <ArrowRight className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            Xong cả ngày <Check className="w-3.5 h-3.5" />
          </>
        )}
      </button>
      <button onClick={stopFlow} aria-label="Dừng luồng hôm nay" title="Dừng, không đi tiếp việc kế" className="shrink-0 p-1 rounded-md text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
