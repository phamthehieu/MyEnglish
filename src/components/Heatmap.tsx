import { useMemo, useState, useEffect, useRef } from "react";
import { Calendar, Zap, Target, Settings2 } from "lucide-react";
import type { WordDetail } from "@/types/database";
import {
  calculateStreakAndGoal,
  getActivityLogs,
  getLocalDateString,
  setDailyGoal,
} from "@/services/streak";

interface HeatmapProps {
  words: WordDetail[];
  /** Words still due today, as the dashboard counts them: lets "every due word reviewed" count as the goal */
  dueRemaining?: number | null;
}

interface DayData {
  dateStr: string; // YYYY-MM-DD
  count: number;
  formattedDate: string;
}

export default function Heatmap({ words, dueRemaining = null }: HeatmapProps) {
  const [logsVersion, setLogsVersion] = useState(0);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("10");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleUpdate = () => setLogsVersion((v) => v + 1);
    window.addEventListener("myenglish-activity-updated", handleUpdate);
    return () => window.removeEventListener("myenglish-activity-updated", handleUpdate);
  }, []);

  const streakStats = useMemo(() => {
    return calculateStreakAndGoal(words, dueRemaining);
  }, [words, logsVersion, dueRemaining]);

  // Days a streak freeze covered (missed days that kept the streak alive)
  const frozenDays = useMemo(() => new Set(streakStats.frozenDates), [streakStats.frozenDates]);

  // Compute activity per day (study sessions)
  const { weeks, totalActivity, activeDays } = useMemo(() => {
    const activityMap = new Map<string, number>();

    // Study logs from localStorage
    const logs = getActivityLogs();
    for (const [dateStr, count] of Object.entries(logs)) {
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + count);
    }

    // Generate past 20 weeks (140 days) ending today
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ~20 weeks ending today; start on a Sunday so each row matches its weekday label
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 20 * 7 + 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const totalDaysToShow = Math.round((today.getTime() - startDate.getTime()) / 86_400_000) + 1;

    let uniqueActive = 0;
    let sumTotal = 0;

    for (let i = 0; i < totalDaysToShow; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const dateStr = getLocalDateString(cur);
      const count = activityMap.get(dateStr) || 0;
      sumTotal += count;
      if (count > 0) uniqueActive++;

      days.push({
        dateStr,
        count,
        formattedDate: cur.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      });
    }

    // Group into 7-day columns (weeks)
    const weekCols: DayData[][] = [];
    let currentWeek: DayData[] = [];

    days.forEach((day, idx) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === days.length - 1) {
        weekCols.push(currentWeek);
        currentWeek = [];
      }
    });

    return {
      weeks: weekCols,
      totalActivity: sumTotal,
      activeDays: uniqueActive,
    };
  }, [logsVersion]);

  const selectedDay = useMemo(
    () => (selectedDate ? weeks.flat().find((d) => d.dateStr === selectedDate) ?? null : null),
    [weeks, selectedDate]
  );

  // Open on the latest weeks (today is at the right end)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Color intensity follows the daily goal: reaching it is the darkest step (clean contrast in both modes)
  const getColorClass = (count: number, goal: number) => {
    if (count === 0) return "bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800/80";
    const share = count / Math.max(1, goal);
    if (share < 0.25) return "bg-teal-100 dark:bg-teal-950 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300";
    if (share < 0.5) return "bg-teal-300 dark:bg-teal-800 border-teal-400 dark:border-teal-700 text-teal-950 dark:text-teal-200";
    if (share < 1) return "bg-teal-500 dark:bg-teal-600 border-teal-600 dark:border-teal-500 text-white";
    return "bg-teal-700 dark:bg-teal-400 border-teal-800 dark:border-teal-300 text-white dark:text-zinc-950 font-bold";
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(goalInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDailyGoal(parsed);
      setIsEditingGoal(false);
    }
  };

  return (
    // The card around it (and the streak numbers) come from AnalyticsView
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-zinc-400 text-xs">
            <span>Số ngày có học</span>
            <Calendar className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums flex items-baseline gap-1">
            <span>{activeDays}</span>
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-normal">ngày</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">có làm bài trong 20 tuần qua</p>
        </div>

        <div className="min-w-0 rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-zinc-400 text-xs">
            <span>Tổng số câu đã làm</span>
            <Zap className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums flex items-baseline gap-1">
            <span>{totalActivity}</span>
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-normal">câu</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">trong 20 tuần qua</p>
        </div>
      </div>

      {/* DAILY GOAL PROGRESS CARD */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Target className="w-4 h-4 text-teal-700 dark:text-teal-300" />
            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Mục tiêu hằng ngày</span>
            {streakStats.goalReached && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300">
                Đã đạt mục tiêu hôm nay! 🎉
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums text-slate-600 dark:text-zinc-400">
              <span className="text-slate-900 dark:text-zinc-100 font-bold">{streakStats.todayCount}</span> / {streakStats.dailyGoal} câu
            </span>
            <button
              onClick={() => {
                setGoalInput(String(streakStats.dailyGoal));
                setIsEditingGoal(!isEditingGoal);
              }}
              title="Cài đặt mục tiêu"
              aria-label="Đổi mục tiêu hằng ngày"
              className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              streakStats.goalReached ? "bg-green-600" : "bg-teal-700 dark:bg-teal-500"
            }`}
            style={{ width: `${streakStats.goalPercentage}%` }}
          />
        </div>

        {/* Goal Edit Inline Form */}
        {isEditingGoal && (
          <form onSubmit={handleSaveGoal} autoComplete="off" className="pt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-zinc-400">Đặt mục tiêu số câu/ngày:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-gramm="false"
              data-enable-grammarly="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className="w-20 px-3 min-h-11 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 tabular-nums text-base focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            <button
              type="submit"
              className="px-5 min-h-11 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold transition-colors"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setIsEditingGoal(false)}
              className="px-4 min-h-11 rounded-2xl font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              Huỷ
            </button>
          </form>
        )}
      </div>

      {/* HEATMAP GRID */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
          <span className="font-medium text-slate-800 dark:text-zinc-300">Những ngày bạn đã học (20 tuần gần nhất)</span>
          <div className="flex items-center gap-1.5 text-xs">
            <span>Ít</span>
            <div className="flex gap-1 items-center">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800" />
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-100 dark:bg-teal-950 border border-teal-200 dark:border-teal-900" />
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-300 dark:bg-teal-800 border border-teal-400 dark:border-teal-700" />
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 dark:bg-teal-600 border border-teal-600 dark:border-teal-500" />
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-700 dark:bg-teal-400 border border-teal-800 dark:border-teal-300" />
            </div>
            <span>Đạt mục tiêu</span>
            {frozenDays.size > 0 && (
              <span className="ml-2" title="Ngày này dùng 1 lượt đóng băng để giữ chuỗi">
                🧊 đóng băng
              </span>
            )}
          </div>
        </div>

        {/* Heatmap Matrix */}
        <div ref={scrollRef} className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
            {/* Day of week labels: one slot per row so they line up with the cells */}
            <div className="flex flex-col gap-1 pr-2 text-xs text-slate-600 dark:text-zinc-400 select-none">
              {["CN", "", "T3", "", "T5", "", "T7"].map((label, i) => (
                <span key={i} className="h-4 leading-4">
                  {label}
                </span>
              ))}
            </div>

            {/* Weeks columns */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day) => {
                  const frozen = frozenDays.has(day.dateStr);
                  const isSelected = selectedDate === day.dateStr;
                  return (
                    <button
                      type="button"
                      key={day.dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : day.dateStr)}
                      aria-label={frozen ? `${day.formattedDate}: ngày đóng băng giữ chuỗi` : `${day.formattedDate}: ${day.count} câu`}
                      aria-pressed={isSelected}
                      title={
                        frozen
                          ? `${day.formattedDate}: Ngày này dùng 1 lượt đóng băng để giữ chuỗi`
                          : `${day.count} câu vào ${day.formattedDate}`
                      }
                      className={`w-4 h-4 rounded-sm border transition-transform hover:scale-125 cursor-pointer p-0 ${
                        frozen
                          ? "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                          : getColorClass(day.count, streakStats.dailyGoal)
                      } ${isSelected ? "ring-2 ring-slate-900 ring-offset-1 ring-offset-slate-50 dark:ring-zinc-100 dark:ring-offset-zinc-900" : ""}`}
                    >
                      {frozen && (
                        <span className="flex h-full w-full items-center justify-center text-[10px] leading-none select-none" aria-hidden="true">
                          🧊
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* A tap shows the day here (a hover tooltip does not exist on a phone) */}
        <p className="text-xs text-slate-700 dark:text-zinc-300 min-h-[1.25rem]" aria-live="polite">
          {selectedDay
            ? frozenDays.has(selectedDay.dateStr)
              ? `${selectedDay.formattedDate}: ngày dùng 1 lượt đóng băng để giữ chuỗi`
              : `${selectedDay.formattedDate}: ${selectedDay.count > 0 ? `${selectedDay.count} câu` : "chưa học"}`
            : "Chạm vào một ô để xem ngày đó học được bao nhiêu câu."}
        </p>
      </div>
    </div>
  );
}
