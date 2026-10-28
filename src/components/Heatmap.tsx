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
    if (share < 0.25) return "bg-emerald-100 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300";
    if (share < 0.5) return "bg-emerald-300 dark:bg-emerald-800 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200";
    if (share < 1) return "bg-emerald-500 dark:bg-emerald-600 border-emerald-600 dark:border-emerald-500 text-white";
    return "bg-emerald-600 dark:bg-emerald-400 border-emerald-700 dark:border-emerald-300 text-white dark:text-zinc-950 font-bold";
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
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 text-xs">
            <span>Số ngày có học</span>
            <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
            <span>{activeDays}</span>
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-normal">ngày</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">có làm bài trong 20 tuần qua</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 text-xs">
            <span>Tổng số câu đã làm</span>
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
            <span>{totalActivity}</span>
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-normal">câu</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">trong 20 tuần qua</p>
        </div>
      </div>

      {/* DAILY GOAL PROGRESS CARD */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Mục tiêu hằng ngày</span>
            {streakStats.goalReached && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Đã đạt mục tiêu hôm nay! 🎉
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">
              <span className="text-slate-900 dark:text-white font-bold">{streakStats.todayCount}</span> / {streakStats.dailyGoal} câu
            </span>
            <button
              onClick={() => {
                setGoalInput(String(streakStats.dailyGoal));
                setIsEditingGoal(!isEditingGoal);
              }}
              title="Cài đặt mục tiêu"
              aria-label="Đổi mục tiêu hằng ngày"
              className="w-10 h-10 -my-2 -mr-2 flex items-center justify-center rounded text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              streakStats.goalReached
                ? "bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-md shadow-emerald-500/50"
                : "bg-gradient-to-r from-cyan-500 to-blue-500"
            }`}
            style={{ width: `${streakStats.goalPercentage}%` }}
          />
        </div>

        {/* Goal Edit Inline Form */}
        {isEditingGoal && (
          <form onSubmit={handleSaveGoal} autoComplete="off" className="pt-2 flex flex-wrap items-center gap-2 text-xs">
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
              className="w-20 px-2 min-h-10 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-4 min-h-10 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setIsEditingGoal(false)}
              className="px-3 min-h-10 text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800" />
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300 dark:bg-emerald-800 border border-emerald-400 dark:border-emerald-700" />
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-600 border border-emerald-600 dark:border-emerald-500" />
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400 border border-emerald-700 dark:border-emerald-300" />
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
          <div className="inline-flex gap-1 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800/80">
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
                          ? "bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700"
                          : getColorClass(day.count, streakStats.dailyGoal)
                      } ${isSelected ? "ring-2 ring-cyan-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-zinc-950" : ""}`}
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
