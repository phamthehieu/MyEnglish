import { useEffect, useState } from "react";
import { AlarmClock, ArrowRight, Check, Flame, Timer } from "lucide-react";
import { Button, Card } from "../ui/kit";
import type { StreakStats } from "@/services/streak";
import { loadWorkloadForecast } from "@/services/progress";
import { minutesFor } from "@/services/comeback";
import { dayCloseStatus, nextReviewText, type NextReview } from "@/services/dayClose";
import type { NextStep } from "./todayPlan";

/** The daily goal as a ring that fills up */
function GoalRing({ percent, reached }: { percent: number; reached: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-zinc-800" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          className="stroke-teal-700 dark:stroke-teal-500 transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {reached ? (
          <Check className="w-6 h-6 text-green-600" strokeWidth={3} />
        ) : (
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">{p}%</span>
        )}
      </div>
    </div>
  );
}

interface DayCloseCardProps {
  streakStats: StreakStats;
  /** Learning cards that come due later today */
  laterToday: number;
  /** Hour of the day ("Tối nay" in the evening, "Lát nữa" before) */
  hour: number;
  nextStep: NextStep;
  onNextStep: (step: NextStep) => void;
  /** Nothing studied today yet: the one button is the 3-card session instead */
  onQuickStart: () => void;
  /** A quiet link for more ("Học thêm từ mới", "Ôn thêm thẻ tồn"...) */
  more: { label: string; onClick: () => void } | null;
  /** When the next card comes due, and about how many */
  nextReview: NextReview | null;
  /** Cards due right now (new ones included) */
  dueNow: number;
  /** Fixed clock for previews */
  now?: Date;
  /** Opens the feedback form; shown only once the day is done, never while studying */
  onFeedback?: () => void;
}

/**
 * Everything on today's list is done: close the day. Once the goal is reached, a loud "Hôm nay xong ✓" says the
 * learner may stop, with the exact next review ("Lượt ôn tới: 14:30, khoảng 6 thẻ"). Then the streak, what
 * tomorrow holds, and exactly one light next step.
 */
export default function DayCloseCard({
  streakStats,
  laterToday,
  hour,
  nextStep,
  onNextStep,
  onQuickStart,
  more,
  nextReview,
  dueNow,
  now,
  onFeedback,
}: DayCloseCardProps) {
  const [tomorrow, setTomorrow] = useState<number | null>(null);
  useEffect(() => {
    loadWorkloadForecast(2)
      .then((f) => setTomorrow(f.days[1]?.reviews ?? 0))
      .catch(() => setTomorrow(null));
  }, [streakStats.todayCount]);

  const studied = streakStats.todayCount > 0;
  const reached = streakStats.goalReached;
  const status = dayCloseStatus({ goalReached: reached, todayCount: streakStats.todayCount, dailyGoal: streakStats.dailyGoal, dueNow });
  const tomorrowLine =
    tomorrow === null
      ? null
      : tomorrow > 0
        ? `Mai ~${tomorrow} thẻ, ~${minutesFor(tomorrow)} phút.`
        : "Mai chưa có thẻ nào đến hạn.";
  const streakLine = (
    <>
      <Flame className="w-4 h-4 text-orange-500" />
      <span className="font-semibold">Chuỗi {streakStats.currentStreak} ngày</span>
      <span className="opacity-50">·</span>
      <span>
        {streakStats.todayCount}/{streakStats.dailyGoal} câu {reached ? "(đạt mục tiêu)" : "hôm nay"}
      </span>
    </>
  );

  return (
    <Card className="space-y-4">
      {status.done ? (
        // The learner must know for sure they can stop
        <div className="flex items-center gap-4" data-testid="day-done">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <Check className="h-8 w-8" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{status.title}</p>
            <p className="text-slate-600 dark:text-zinc-300">{status.note}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <GoalRing percent={streakStats.goalPercentage} reached={reached} />
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-bold text-slate-900 dark:text-white">{status.title}</p>
            <p className="text-slate-600 dark:text-zinc-300">{status.note}</p>
          </div>
        </div>
      )}

      <p className="inline-flex flex-wrap items-center gap-1.5 text-slate-700 dark:text-zinc-300">{streakLine}</p>

      {/* What comes next: the next review, and tomorrow */}
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
          <AlarmClock className="h-5 w-5" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-slate-900 dark:text-white">{nextReviewText(nextReview, now)}</p>
          <p className="text-slate-600 dark:text-zinc-400">
            {tomorrowLine ?? "Mai quay lại nhé, app sẽ nhắc đúng lúc cần ôn."}
            {laterToday > 0 && ` ${hour >= 17 ? "Tối nay" : "Lát nữa"} còn ~${laterToday} thẻ ôn lại cho chắc.`}
          </p>
        </div>
      </div>

      {studied ? (
        <Button block size="lg" variant={status.done ? "secondary" : "primary"} onClick={() => onNextStep(nextStep)}>
          {nextStep.label} <ArrowRight className="h-5 w-5" />
        </Button>
      ) : (
        <Button block size="lg" onClick={onQuickStart}>
          <Timer className="h-5 w-5" /> Chỉ 1 phút: ôn nhanh 3 thẻ
        </Button>
      )}

      {(more || (status.done && onFeedback)) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {more && (
            <button onClick={more.onClick} className="min-h-10 rounded-lg px-2 font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10">
              Muốn học thêm? {more.label}
            </button>
          )}
          {status.done && onFeedback && (
            <button onClick={onFeedback} className="min-h-10 rounded-lg px-2 text-slate-500 underline-offset-2 hover:underline dark:text-zinc-400">
              Góp ý cho app
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
