import { useState } from "react";
import { Check, Clock, Plus } from "lucide-react";
import { ANCHOR_SUGGESTIONS, anchorKey, anchorTimesOf, MAX_ANCHORS, type ReminderAnchor } from "@/services/reminderMoments";
import { NIGHT_QUIET_END, NIGHT_QUIET_START } from "@/services/reminderSettings";

const inNight = (time: string) => {
  const hour = Number(time.slice(0, 2));
  return hour >= NIGHT_QUIET_START || hour < NIGHT_QUIET_END;
};
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The study times of the day ("Giờ học cố định"): the suggested times and the learner's own as chips that turn
 * on and off with a tap, and any other time from two selects. Saved as "HH:MM", which also turns the old presets
 * into times. Chips stay in place when tapped (no native time input: on Android it opens its dialog whenever the
 * page moves focus onto it).
 */
export default function StudyTimesField({
  anchors,
  active,
  nightQuiet,
  onChange,
}: {
  anchors: readonly ReminderAnchor[];
  /** Reminders are on: the times can be changed */
  active: boolean;
  nightQuiet: boolean;
  onChange: (anchors: string[]) => void;
}) {
  const chosen = anchorTimesOf(anchors);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const full = chosen.length >= MAX_ANCHORS;
  const toggle = (time: string) => {
    if (chosen.includes(time)) onChange(chosen.filter((t) => t !== time));
    else if (!full) onChange(anchorTimesOf([...chosen, time]));
  };
  const labels = new Map(ANCHOR_SUGGESTIONS.map((s) => [s.time, s.label]));
  const chips = [...new Set([...ANCHOR_SUGGESTIONS.map((s) => s.time), ...chosen])].sort();
  const custom = anchorKey(hour, minute);
  const quiet = nightQuiet ? chosen.filter(inNight) : [];
  const select =
    "min-h-11 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-base tabular-nums text-slate-900 dark:text-zinc-100 disabled:opacity-50 focus:outline-none focus:border-teal-700";

  return (
    <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          Giờ học cố định:
        </span>
        <span className="rounded-full bg-teal-50 dark:bg-teal-400/10 px-2.5 py-1 text-xs tabular-nums text-teal-800 dark:text-teal-300 font-semibold">
          {chosen.length}/{MAX_ANCHORS} giờ
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-zinc-400 leading-snug">
        Chạm để chọn giờ bạn hay rảnh, mỗi giờ nhắc một lần mỗi ngày. Giờ này không bị tính vào số lần nhắc tối đa.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Giờ học">
        {chips.map((time) => {
          const on = chosen.includes(time);
          const label = labels.get(time);
          return (
            <button
              key={time}
              onClick={() => toggle(time)}
              disabled={!active || (!on && full)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border text-sm font-medium transition-colors disabled:opacity-40 ${
                on
                  ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                  : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span className="tabular-nums font-semibold">{time}</span>
              {label && <span className={on ? "text-teal-50" : "text-slate-500 dark:text-zinc-400"}>{label}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Giờ khác:</span>
        <select value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={!active || full} aria-label="Giờ" className={select}>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {pad(h)}
            </option>
          ))}
        </select>
        <span className="font-bold text-slate-500">:</span>
        <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} disabled={!active || full} aria-label="Phút" className={select}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {pad(m)}
            </option>
          ))}
        </select>
        <button
          onClick={() => toggle(custom)}
          disabled={!active || full || chosen.includes(custom)}
          className="min-h-11 px-4 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 disabled:opacity-50 text-sm font-semibold"
        >
          Thêm
        </button>
      </div>
      {full && <p className="text-sm text-slate-500 dark:text-zinc-400">Đã đủ {MAX_ANCHORS} giờ. Bỏ bớt một giờ để thêm giờ khác.</p>}

      {quiet.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
          {quiet.join(", ")} nằm trong giờ không nhắc ban đêm ({NIGHT_QUIET_START}:00–{pad(NIGHT_QUIET_END)}:00) nên sẽ không nhắc. Đổi giờ
          khác hoặc tắt &quot;Không nhắc ban đêm&quot; bên dưới.
        </p>
      )}
      {!active && <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">Bật nhắc học ở trên để dùng giờ học cố định.</p>}
    </div>
  );
}
