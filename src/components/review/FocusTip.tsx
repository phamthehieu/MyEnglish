import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { getLearningEventsSince } from "@/services/learningEvents";
import { FOCUS_XP_PER_MIN, getFocusSettings } from "@/services/focusSession";

/** Below this many completed focus sessions, the end of a normal session suggests one */
const TIP_UNTIL_SESSIONS = 3;

/**
 * End of a normal session: "next time, try a focus session" for a learner who has not made it a habit yet
 * (fewer than TIP_UNTIL_SESSIONS completed in the last 90 days). Nothing once they have.
 */
export default function FocusTip({ onStart }: { onStart: (minutes: number) => void }) {
  const [show, setShow] = useState(false);
  const minutes = getFocusSettings().minutes;

  useEffect(() => {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    getLearningEventsSince(since, ["focus_completed"])
      .then((events) => setShow(events.length < TIP_UNTIL_SESSIONS))
      .catch(() => setShow(false));
  }, []);

  if (!show) return null;
  return (
    <div className="w-full p-4 rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/30 text-left flex flex-wrap items-center gap-3">
      <Crosshair className="w-5 h-5 text-teal-600 dark:text-teal-300 shrink-0" />
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="text-sm font-bold text-teal-800 dark:text-teal-200">Lần sau thử phiên tập trung?</div>
        <p className="text-xs text-slate-600 dark:text-zinc-300">
          Học trọn {minutes} phút, không popup, không thông báo. Hoàn thành được thêm {minutes * FOCUS_XP_PER_MIN} XP.
        </p>
      </div>
      <button
        onClick={() => onStart(minutes)}
        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
      >
        Thử ngay {minutes}′
      </button>
    </div>
  );
}
