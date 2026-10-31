import { AlarmClock, ArrowRight, AudioLines, BookOpen, Check, Flame, Footprints, GraduationCap, Zap } from "lucide-react";
import { Button, Card, Badge, ProgressBar } from "../ui/kit";
import type { TodayTask, TodayTaskId } from "./todayPlan";

const TASK_ICON: Record<TodayTaskId, typeof BookOpen> = {
  speaking: Footprints,
  vocab: BookOpen,
  grammar: GraduationCap,
  pronunciation: AudioLines,
  reflex: Zap,
};

/** What the main button says for the first thing not done yet */
function primaryLabel(task: TodayTask, first: boolean): string {
  if (task.id === "vocab") return `Học hôm nay (~${task.minutes} phút)`;
  if (task.id === "speaking") return `${first ? "Bắt đầu" : "Tiếp"}: lộ trình nói (~${task.minutes} phút)`;
  const what = task.id === "grammar" ? "1 bài ngữ pháp" : task.id === "pronunciation" ? "Phát âm" : "Luyện phản xạ";
  return `${first ? "" : "Tiếp: "}${what} (~${task.minutes} phút)`;
}

interface TodayChecklistProps {
  tasks: TodayTask[];
  primary: TodayTask;
  /** Line above the list (e.g. the comeback plan) */
  heading: string;
  onRun: (task: TodayTask) => void;
  quickMode: "hidden" | "normal" | "urgent";
  onQuickStart: () => void;
  streak: number;
  /** Starts everything not done as one flow (the main button, when more than one thing is left) */
  onStartFlow?: () => void;
  /** A timed focus session on the words */
  onFocus?: () => void;
  focusMinutes?: number;
  /** The daily goal is reached: what is left on the list is extra, and the learner may stop */
  goalReached?: boolean;
  /** "Lượt ôn tới: 14:30, khoảng 6 thẻ" */
  nextReviewLine?: string;
}

/**
 * Today as a short list, each thing with its status, its minutes and a way straight into it, then how much is done
 * and ONE main button (everything left, one after the other). "Chỉ 1 phút" (3 cards) keeps the streak on a busy day;
 * in the evening, with nothing studied yet, it comes up top as a warning.
 */
export default function TodayChecklist({
  tasks,
  primary,
  heading,
  onRun,
  quickMode,
  onQuickStart,
  streak,
  onStartFlow,
  onFocus,
  focusMinutes,
  goalReached = false,
  nextReviewLine,
}: TodayChecklistProps) {
  // The day's progress counts the day's own things; the extras beyond the minutes chosen are listed apart
  const core = tasks.filter((t) => !t.optional);
  const extra = tasks.filter((t) => t.optional);
  const left = core.filter((t) => !t.done);
  const doneCount = core.length - left.length;
  const minutesLeft = left.reduce((sum, t) => sum + t.minutes, 0);
  const percent = core.length ? Math.round((doneCount / core.length) * 100) : 0;
  const flow = !!onStartFlow && left.length > 1;
  // "You may stop" only once the words are done: a goal met with grammar or speaking leaves due cards to pile up
  const wordsLeft = tasks.some((t) => t.id === "vocab" && !t.done);
  const mayStop = goalReached && !wordsLeft;
  const label = flow ? (doneCount > 0 ? "Tiếp tục hôm nay" : "Bắt đầu hôm nay") : primaryLabel(primary, tasks.indexOf(primary) === 0);

  return (
    <Card className="space-y-4">
      {quickMode === "urgent" && (
        <div className="-mx-1 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <Flame className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            {streak > 0 ? `Sắp mất chuỗi ${streak} ngày, chỉ cần 1 phút` : "Tối rồi, 1 phút là đủ bắt đầu chuỗi ngày học"}
          </p>
          <Button size="sm" onClick={onQuickStart} className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500">
            Học 1 phút
          </Button>
        </div>
      )}

      {mayStop && (
        <div className="-mx-1 flex items-center gap-3 rounded-xl bg-green-50 px-3 py-2.5 dark:bg-green-500/10" data-testid="goal-reached">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-bold text-green-800 dark:text-green-200">Đạt mục tiêu hôm nay. Dừng ở đây cũng được.</span>
            <span className="block text-green-700 dark:text-green-300">
              {left.length > 0 ? "Phần còn lại bên dưới là thêm nếu bạn muốn. " : null}
              {nextReviewLine && (
                <span className="inline-flex items-center gap-1">
                  <AlarmClock className="h-3.5 w-3.5" /> {nextReviewLine}
                </span>
              )}
            </span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{heading}</h2>
        <Badge tone="teal" className="shrink-0">
          {doneCount}/{core.length} việc
        </Badge>
      </div>

      <ol className="space-y-2">
        {[...core, ...extra].map((task, i) => {
          const Icon = TASK_ICON[task.id];
          const isPrimary = task === primary;
          const body = (
            <>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  task.done ? "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500" : "bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-semibold leading-snug ${
                    task.done ? "text-slate-500 line-through decoration-slate-300 dark:text-zinc-500 dark:decoration-zinc-600" : "text-slate-900 dark:text-zinc-100"
                  }`}
                >
                  {task.title}
                </span>
                <span className="block text-sm text-slate-500 dark:text-zinc-400">
                  {task.done ? "Đã xong" : [task.detail, `~${task.minutes} phút`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {task.done ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white dark:bg-teal-600">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              ) : (
                <span className={`h-7 w-7 shrink-0 rounded-full border-2 ${isPrimary ? "border-teal-600" : "border-slate-300 dark:border-zinc-600"}`} />
              )}
            </>
          );
          return (
            <li key={task.id}>
              {i === core.length && (
                <p className="px-1 pb-2 pt-1 text-sm font-semibold text-slate-500 dark:text-zinc-400">Thêm nếu muốn</p>
              )}
              {task.done ? (
                <div className="flex min-h-16 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-800/40">{body}</div>
              ) : (
                <button
                  onClick={() => onRun(task)}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                    isPrimary
                      ? "border-teal-600/60 bg-white dark:border-teal-500/50 dark:bg-zinc-900"
                      : "border-slate-200 bg-white hover:border-teal-600/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-500/40"
                  }`}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600 dark:text-zinc-400">
            {doneCount}/{core.length} việc · còn ~{minutesLeft} phút
          </span>
          <span className="font-semibold text-teal-700 dark:text-teal-300">{percent}% hoàn thành</span>
        </div>
        <ProgressBar value={percent} />
      </div>

      <Button size="lg" block onClick={() => (flow ? onStartFlow!() : onRun(primary))}>
        {label}
        <ArrowRight className="h-5 w-5" />
      </Button>

      {(quickMode !== "hidden" || onFocus) && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {quickMode !== "hidden" && (
            <button onClick={onQuickStart} title="3 thẻ ôn nhanh, đủ để giữ chuỗi ngày học" className="min-h-10 rounded-lg px-3 font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10">
              Chỉ 1 phút
            </button>
          )}
          {quickMode !== "hidden" && onFocus && <span className="text-slate-300 dark:text-zinc-600">·</span>}
          {onFocus && (
            <button
              onClick={onFocus}
              title="Học trong một phiên có hẹn giờ: ẩn mọi thứ khác, tắt nhắc nhở"
              className="min-h-10 rounded-lg px-3 font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              Tập trung {focusMinutes ?? 10} phút
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
