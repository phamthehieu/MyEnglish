import { ArrowRight, Check, X } from "lucide-react";
import { stopFlow } from "@/services/dayFlow";
import { FLOW_LABEL, useDayFlow } from "./DayFlowContext";

/**
 * The bar of the day's flow, on every tab while the flow runs: which thing the learner is on, whether it is done, and
 * one button to go to the next (or back to Today), so they never go back to the list to choose. A thing not done yet
 * can still be passed over, and the button says so.
 */
export default function DayFlowBar() {
  const { flow, current, currentDone, next, go } = useDayFlow();
  if (!flow || !current) return null;

  return (
    <div role="status" aria-label="Luồng hôm nay" className="bar-enter shrink-0 flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5">
      <span className="min-w-0 flex-1 text-xs text-emerald-900 dark:text-emerald-200">
        <b>
          Hôm nay · {flow.index + 1}/{flow.queue.length}
        </b>
        <span className="block truncate text-emerald-800/80 dark:text-emerald-300/80">
          {FLOW_LABEL[current]}
          {currentDone ? " · đã xong ✓" : ""}
        </span>
      </span>
      <button
        onClick={go}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg active:scale-[0.98] px-3 text-xs font-bold ${
          currentDone
            ? "min-h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            : "min-h-9 border border-emerald-600/40 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
        }`}
      >
        {next ? (
          <>
            {currentDone ? "Tiếp" : "Bỏ qua, sang"}: {FLOW_LABEL[next]} <ArrowRight className="w-3.5 h-3.5" />
          </>
        ) : currentDone ? (
          <>
            Xong, về Hôm nay <Check className="w-3.5 h-3.5" />
          </>
        ) : (
          <>Về Hôm nay</>
        )}
      </button>
      <button onClick={stopFlow} aria-label="Dừng luồng hôm nay" title="Dừng, không đi tiếp việc kế" className="shrink-0 p-1 rounded-md text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
