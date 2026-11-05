import { Fragment, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers,
} from "lucide-react";
import type { GrammarBookFile, GrammarBookLesson } from "@/types/grammarBook";
import {
  getEffectiveLessonIds,
  isLessonStudied,
  selectChapterLessons,
  toggleLessonSelection,
} from "@/services/grammarPath";
import { getDueGrammarLessons, getLessonProgress } from "@/services/grammarService";
import { lessonStatus } from "@/services/grammarSession";
import { formatNextReviewRelative } from "@/utils/reviewSchedule";
import { buildTenseGrid, TENSE_COLUMNS, TENSE_ROWS } from "@/utils/tenseGrid";
import type { GrammarLessonTab } from "./GrammarLessonView";
import SpeakingGrammar from "./SpeakingGrammar";

export type PathPickerMode = "path" | "practice";
export type LessonStatus = ReturnType<typeof lessonStatus>;

interface PathPickerProps {
  chapters: GrammarBookFile[];
  onOpenLesson: (lessonId: string, tab?: GrammarLessonTab) => void;
  onPractice: (lessonIds: string[]) => void;
  /** Controlled mode; when omitted the picker keeps its own */
  mode?: PathPickerMode;
  onModeChange?: (mode: PathPickerMode) => void;
}

const STATUS_STYLE: Record<LessonStatus, { label: string; className: string }> = {
  new: { label: "Mới", className: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" },
  learning: { label: "Đang học", className: "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300" },
  due: { label: "Đến hạn", className: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  mastered: { label: "Đã thuộc", className: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300" },
};

const CARD_STYLE: Record<LessonStatus, { accent: string; surface: string; dot: string }> = {
  new: {
    accent: "bg-slate-300 dark:bg-zinc-600",
    surface: "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800",
    dot: "bg-slate-300 dark:bg-zinc-500",
  },
  learning: {
    accent: "bg-teal-700 dark:bg-teal-500",
    surface: "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800",
    dot: "bg-teal-700 dark:bg-teal-500",
  },
  due: {
    accent: "bg-amber-500",
    surface:
      "border-amber-200 bg-amber-50/60 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15",
    dot: "bg-amber-500",
  },
  mastered: {
    accent: "bg-green-600",
    surface: "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800",
    dot: "bg-green-600",
  },
};

const LEGEND_ORDER: LessonStatus[] = ["new", "learning", "due", "mastered"];

export function LessonStatusChip({ status }: { status: LessonStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

export function MasteryBar({ mastery, className = "w-16 sm:w-24" }: { mastery: number; className?: string }) {
  const value = Math.max(0, Math.min(100, mastery));
  return (
    <span className={`inline-block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800 ${className}`}>
      <span
        className={`block h-full rounded-full ${value >= 80 ? "bg-green-600" : "bg-teal-700 dark:bg-teal-500"}`}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

function ProgressRing({ value, size = 18, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-200 dark:stroke-zinc-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        className={`transition-[stroke-dashoffset] duration-300 ${
          pct >= 80 ? "stroke-green-600" : "stroke-teal-700 dark:stroke-teal-500"
        }`}
      />
    </svg>
  );
}

interface LessonRow {
  lesson: GrammarBookLesson;
  chapterTitle: string;
  status: LessonStatus;
  mastery: number;
  reviewText: string | null;
}

function reviewText(label: string): string {
  const clean = label.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (/^(Đến hạn|Quá hạn)/.test(clean)) return clean;
  return `Ôn ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

function sentenceCase(text: string): string {
  const s = text.trim();
  if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toLowerCase() === lower.charAt(0)
    ? lower.charAt(0).toUpperCase() + lower.slice(1)
    : s;
}

function useMeasuredWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width];
}

interface LessonCardProps {
  row: LessonRow;
  mode: PathPickerMode;
  onPath: boolean;
  picked: boolean;
  isNext: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function LessonCard({ row, mode, onPath, picked, isNext, onOpen, onToggle }: LessonCardProps) {
  const { lesson, status, mastery } = row;
  const isPractice = mode === "practice";
  const style = CARD_STYLE[status];
  const name = lesson.titleVn || lesson.title;
  const showEn = !!lesson.titleVn && !!lesson.title && lesson.title !== lesson.titleVn;
  const dimmed = !isPractice && !onPath;

  return (
    <div role="group" aria-label={name} className="relative flex h-full min-w-0 flex-col">
      <button
        type="button"
        onClick={isPractice ? onToggle : onOpen}
        aria-pressed={isPractice ? picked : undefined}
        title={showEn ? `${name} · ${lesson.title}` : name}
        className={`relative flex min-h-[96px] w-full flex-1 flex-col overflow-hidden rounded-2xl border px-3 pb-2.5 pt-3.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${style.surface} ${
          picked ? "ring-2 ring-teal-700 dark:ring-teal-400" : ""
        } ${dimmed ? "opacity-60 hover:opacity-100" : ""}`}
      >
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${style.accent}`} />

        {isPractice && (
          <span
            aria-hidden="true"
            className={`absolute right-2 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border transition ${
              picked
                ? "border-teal-700 bg-teal-700 !text-white"
                : "border-slate-300 bg-white/70 dark:border-zinc-600 dark:bg-zinc-900/60"
            }`}
          >
            {picked && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
        )}

        <span
          className={`line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100 ${
            isPractice ? "pr-7" : ""
          }`}
        >
          {name}
        </span>
        {showEn && <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-zinc-400">{lesson.title}</span>}

        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ProgressRing value={mastery} />
            <span className="tabular-nums text-slate-600 dark:text-zinc-300">{Math.round(mastery)}%</span>
          </span>
          <span
            className={`max-w-full truncate ${
              status === "due" ? "font-semibold text-amber-800 dark:text-amber-300" : "text-slate-500 dark:text-zinc-400"
            }`}
          >
            {status === "new" ? "Mới" : row.reviewText}
          </span>
        </span>
      </button>

      {!isPractice && (
        <button
          type="button"
          role="switch"
          aria-checked={onPath}
          aria-label="Trên lộ trình"
          title={onPath ? "Bài này nằm trong lịch học hằng ngày" : "Không học: bài này không có trong lộ trình"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-xl px-1.5 text-left text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-zinc-300"
        >
          <span
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              onPath ? "bg-teal-700 dark:bg-teal-500" : "bg-slate-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                onPath ? "translate-x-3" : ""
              }`}
            />
          </span>
          <span className="min-w-0 truncate">{onPath ? "Trên lộ trình" : "Không học"}</span>
        </button>
      )}

      {isNext && (
        <span className="pointer-events-none absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-teal-700 px-2 py-0.5 text-xs font-semibold !text-white dark:bg-teal-600">
          <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
          Tiếp theo
        </span>
      )}
    </div>
  );
}

type TenseItem = { id: string; title: string; row: LessonRow };

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{children}</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
    </div>
  );
}

const TABLE_MIN_WIDTH = 680;
const COLUMN_HEAD =
  "flex items-end justify-center px-1 pb-0.5 text-center text-xs font-semibold leading-tight text-slate-500 dark:text-zinc-400";
const ROW_HEAD =
  "flex items-center justify-center rounded-2xl bg-slate-100 px-1 text-center text-xs font-semibold leading-tight text-slate-600 dark:bg-zinc-800/70 dark:text-zinc-300";

function ChapterBody({ rows, renderCard }: { rows: LessonRow[]; renderCard: (row: LessonRow) => ReactNode }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  const tense = useMemo(
    () => buildTenseGrid<TenseItem>(rows.map((row) => ({ id: row.lesson.id, title: row.lesson.title, row }))),
    [rows]
  );

  const plainColumns = width < 440 ? 1 : width < 720 ? 2 : 3;
  const cardGrid = (items: LessonRow[]) => (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${plainColumns}, minmax(0, 1fr))` }}>
      {items.map(renderCard)}
    </div>
  );

  if (rows.length === 0) {
    return <p className="px-1 py-2 text-xs text-slate-500 dark:text-zinc-400">Chương này chưa có bài học.</p>;
  }

  if (!tense) {
    return <div ref={ref}>{cardGrid(rows)}</div>;
  }

  const { cells, near, others } = tense;
  const asTable = width >= TABLE_MIN_WIDTH;

  return (
    <div ref={ref} className="space-y-4">
      {asTable ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: "3.75rem repeat(4, minmax(0, 1fr))" }}>
          <div aria-hidden="true" />
          {TENSE_COLUMNS.map((col) => (
            <div key={col.aspect} className={COLUMN_HEAD}>
              {col.label}
            </div>
          ))}

          {TENSE_ROWS.map((r) => (
            <Fragment key={r.time}>
              <div className={ROW_HEAD}>{r.label}</div>
              {TENSE_COLUMNS.map((col) => {
                const item = cells.get(`${r.time}:${col.aspect}`);
                return item ? (
                  renderCard(item.row)
                ) : (
                  <div
                    key={col.aspect}
                    aria-hidden="true"
                    className="min-h-[96px] rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800"
                  />
                );
              })}
            </Fragment>
          ))}

          {near && (
            <>
              <div className={ROW_HEAD}>Tương lai gần</div>
              {renderCard(near.row)}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {TENSE_ROWS.map((r) => {
            const items = TENSE_COLUMNS.map((col) => cells.get(`${r.time}:${col.aspect}`)).filter(
              (item): item is TenseItem => !!item
            );
            if (r.time === "future" && near) items.push(near);
            if (items.length === 0) return null;
            return (
              <div key={r.time} className="space-y-2">
                <SubHeading>{r.label}</SubHeading>
                <div className="grid grid-cols-2 gap-2">{items.map((item) => renderCard(item.row))}</div>
              </div>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Bài khác</SubHeading>
          {cardGrid(others.map((item) => item.row))}
        </div>
      )}
    </div>
  );
}

function pickDefaultChapter(chapters: GrammarBookFile[]): string | null {
  const first = chapters.find((ch) => (ch.lessons ?? []).some((l) => !isLessonStudied(l.id))) ?? chapters[0];
  return first ? first.chapterId : null;
}

const LESSONS_PER_WEEK = 5;

interface WeekModule {
  weekNumber: number;
  title: string;
  subtitle: string;
  days: LessonRow[];
  studiedCount: number;
  masteredCount: number;
}

/**
 * Weekly & Daily Roadmap View (matches the screenshot: "Tuần 1" expanded with numbered circles & sub-steps,
 * and "Tuần 2..N" with Ngày 1..Ngày 6 rows and time estimates).
 */
function WeeklySyllabusView({
  allRows,
  nextLessonId,
  onOpenLesson,
  onPractice,
}: {
  allRows: LessonRow[];
  nextLessonId: string | null;
  onOpenLesson: (lessonId: string, tab?: GrammarLessonTab) => void;
  onPractice: (lessonIds: string[]) => void;
}) {
  const weeks = useMemo<WeekModule[]>(() => {
    const out: WeekModule[] = [];
    for (let i = 0; i < allRows.length; i += LESSONS_PER_WEEK) {
      const chunk = allRows.slice(i, i + LESSONS_PER_WEEK);
      if (chunk.length === 0) continue;
      const weekNumber = out.length + 1;
      const uniqueChapters = [...new Set(chunk.map((r) => r.chapterTitle))];
      const title = uniqueChapters.slice(0, 2).join(" & ");
      const lessonNames = chunk
        .slice(0, 3)
        .map((r) => r.lesson.titleVn || r.lesson.title)
        .join(", ");
      const studiedCount = chunk.filter((r) => r.status !== "new").length;
      const masteredCount = chunk.filter((r) => r.status === "mastered").length;
      out.push({
        weekNumber,
        title: title || `Chặng ${weekNumber}`,
        subtitle: `Nắm vững và vận dụng: ${lessonNames}${chunk.length > 3 ? "..." : ""}`,
        days: chunk,
        studiedCount,
        masteredCount,
      });
    }
    return out;
  }, [allRows]);

  // Default expanded week is the week containing `nextLessonId` (or Week 1)
  const activeWeekNum = useMemo(() => {
    if (nextLessonId) {
      const found = weeks.find((w) => w.days.some((d) => d.lesson.id === nextLessonId));
      if (found) return found.weekNumber;
    }
    const firstIncomplete = weeks.find((w) => w.studiedCount < w.days.length);
    return firstIncomplete?.weekNumber ?? 1;
  }, [weeks, nextLessonId]);

  const [expandedWeek, setExpandedWeek] = useState<number>(activeWeekNum);

  useEffect(() => {
    setExpandedWeek(activeWeekNum);
  }, [activeWeekNum]);

  if (weeks.length === 0) return null;

  return (
    <div className="space-y-4">
      {weeks.map((week) => {
        const isExpanded = expandedWeek === week.weekNumber;
        const isCurrentWeek = activeWeekNum === week.weekNumber;
        const allDone = week.studiedCount >= week.days.length && week.days.length > 0;
        const weekLessonIds = week.days.map((d) => d.lesson.id);

        if (isExpanded) {
          // Expanded Week View (Just like "Tuần 1" in the user's screenshot: numbered circles 1..5, each with Theory / Practice / Quick Test rows)
          return (
            <div
              key={week.weekNumber}
              className="overflow-hidden rounded-3xl border-2 border-teal-600/35 bg-white shadow-sm dark:border-teal-500/40 dark:bg-zinc-900"
            >
              {/* Week Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-500/15 bg-teal-50/70 px-4 py-3.5 dark:bg-teal-950/30 md:px-6">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      Tuần {week.weekNumber}
                    </span>
                    <span className="rounded-full bg-teal-700 px-2.5 py-0.5 text-[11px] font-bold text-white dark:bg-teal-500 dark:text-slate-950">
                      {allDone ? "Đã hoàn thành ✓" : isCurrentWeek ? "Đang học" : "Chi tiết tuần"}
                    </span>
                    <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">· {week.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">{week.subtitle}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-white/80 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-600/20 dark:bg-zinc-800 dark:text-teal-300">
                    {week.studiedCount}/{week.days.length} ngày
                  </span>
                </div>
              </div>

              {/* Numbered Day Blocks (1..5) + Day 6 Weekly Synthesis */}
              <div className="divide-y divide-slate-100 p-4 dark:divide-zinc-800/80 md:p-6 space-y-5">
                {week.days.map((row, idx) => {
                  const dayNum = idx + 1;
                  const lessonName = row.lesson.titleVn || row.lesson.title;
                  const isDone = row.status !== "new";
                  const isNext = row.lesson.id === nextLessonId;

                  return (
                    <div key={row.lesson.id} className={`${idx > 0 ? "pt-5" : ""} space-y-2.5`}>
                      {/* Day Header with Numbered Circle */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                              isDone
                                ? "bg-emerald-600 text-white"
                                : isNext
                                  ? "bg-teal-700 text-white ring-4 ring-teal-500/20 dark:bg-teal-500 dark:text-slate-950"
                                  : "bg-teal-700/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300"
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : dayNum}
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              Ngày {dayNum}: {lessonName}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                              {row.chapterTitle} · 3 bước khép kín (~20 phút)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {row.mastery > 0 && (
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                              {Math.round(row.mastery)}%
                            </span>
                          )}
                          <LessonStatusChip status={row.status} />
                        </div>
                      </div>

                      {/* Sub-steps inside the Day (Matches the light-teal rows inside Tuần 1 of the screenshot) */}
                      <div className="ml-3.5 border-l-2 border-teal-600/20 pl-4 space-y-1.5 dark:border-teal-500/20">
                        {/* Step 1: Sổ tay Lý thuyết & Công thức */}
                        <button
                          type="button"
                          onClick={() => onOpenLesson(row.lesson.id, "handbook")}
                          className="group flex w-full items-center justify-between gap-2 rounded-xl bg-teal-50/70 px-3 py-2 text-left transition-colors hover:bg-teal-100/80 dark:bg-teal-500/10 dark:hover:bg-teal-500/20"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 rounded-md bg-teal-700/15 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-400/20 dark:text-teal-300">
                              Lý thuyết
                            </span>
                            <span className="truncate text-xs font-medium text-slate-800 dark:text-zinc-200">
                              Công thức, cách dùng & ví dụ: {lessonName}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-teal-700 group-hover:underline dark:text-teal-300">
                            {isDone ? "Xem lại" : "Vào học →"}
                          </span>
                        </button>

                        {/* Step 2: Bài tập thực hành */}
                        <button
                          type="button"
                          onClick={() => onOpenLesson(row.lesson.id, "practice")}
                          className="group flex w-full items-center justify-between gap-2 rounded-xl bg-teal-50/70 px-3 py-2 text-left transition-colors hover:bg-teal-100/80 dark:bg-teal-500/10 dark:hover:bg-teal-500/20"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300">
                              Bài tập
                            </span>
                            <span className="truncate text-xs font-medium text-slate-800 dark:text-zinc-200">
                              Luyện tập vận dụng câu thực tế ({lessonName})
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-teal-700 group-hover:underline dark:text-teal-300">
                            {row.mastery >= 80 ? `Đã đạt ${Math.round(row.mastery)}%` : "Làm bài →"}
                          </span>
                        </button>

                        {/* Step 3: Kiểm tra nhanh */}
                        <button
                          type="button"
                          onClick={() => onOpenLesson(row.lesson.id, "diagnostic")}
                          className="group flex w-full items-center justify-between gap-2 rounded-xl bg-teal-50/70 px-3 py-2 text-left transition-colors hover:bg-teal-100/80 dark:bg-teal-500/10 dark:hover:bg-teal-500/20"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-400/20 dark:text-amber-300">
                              Kiểm tra
                            </span>
                            <span className="truncate text-xs font-medium text-slate-800 dark:text-zinc-200">
                              Kiểm tra nhanh mức độ nắm bài (10 câu)
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-teal-700 group-hover:underline dark:text-teal-300">
                            Kiểm tra →
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Final Day of the Week: Synthesis & Review */}
                <div className="pt-5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600/15 text-xs font-extrabold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                        {week.days.length + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Ngày {week.days.length + 1}: Ôn tập & Tổng kết Tuần {week.weekNumber}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Trộn ngẫu nhiên câu hỏi từ cả {week.days.length} bài trong tuần để chống quên
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-3.5 border-l-2 border-purple-500/20 pl-4">
                    <button
                      type="button"
                      onClick={() => onPractice(weekLessonIds)}
                      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-purple-50/80 px-3 py-2.5 text-left transition-colors hover:bg-purple-100/80 dark:bg-purple-500/10 dark:hover:bg-purple-500/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Tổng hợp
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          Làm bài kiểm tra tổng hợp Tuần {week.weekNumber} ({week.days.length} chủ điểm)
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-purple-700 group-hover:underline dark:text-purple-300">
                        Bắt đầu ôn →
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Compact Week Card (Just like "Tuần 2, Tuần 3, Tuần 4..." in the screenshot: lists Ngày 1..Ngày 6 with ~20 phút on the right)
        return (
          <div
            key={week.weekNumber}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all hover:border-teal-500/40 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Clickable Week Header */}
            <button
              type="button"
              onClick={() => setExpandedWeek(week.weekNumber)}
              className="flex w-full items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-left transition-colors hover:bg-slate-100/70 dark:border-zinc-800/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70 md:px-5"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Tuần {week.weekNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">— {week.title}</span>
                    {allDone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Hoàn thành
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{week.subtitle}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
                <span>
                  {week.studiedCount}/{week.days.length} bài
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </button>

            {/* Compact Day 1..Day 6 List (Matches the lower half of the screenshot) */}
            <div className="divide-y divide-slate-100 px-4 py-1 dark:divide-zinc-800/60 md:px-5">
              {week.days.map((row, idx) => {
                const dayNum = idx + 1;
                const lessonName = row.lesson.titleVn || row.lesson.title;
                const isDone = row.status !== "new";
                return (
                  <button
                    key={row.lesson.id}
                    type="button"
                    onClick={() => onOpenLesson(row.lesson.id, "handbook")}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-xs transition-colors hover:text-teal-700 dark:hover:text-teal-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-12 shrink-0 font-mono text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                        Ngày {dayNum}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          isDone
                            ? "text-slate-900 dark:text-zinc-100"
                            : "text-slate-700 dark:text-zinc-300"
                        }`}
                      >
                        {lessonName}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isDone ? (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {Math.round(row.mastery)}% ✓
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">20 phút</span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Day N+1: Weekly Review Row */}
              <button
                type="button"
                onClick={() => onPractice(weekLessonIds)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-xs transition-colors hover:text-teal-700 dark:hover:text-teal-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-12 shrink-0 font-mono text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                    Ngày {week.days.length + 1}
                  </span>
                  <span className="truncate font-semibold text-teal-800 dark:text-teal-300">
                    Ôn tập & Kiểm tra tổng hợp Tuần {week.weekNumber}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-slate-400 dark:text-zinc-500">15 phút</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PathPicker({
  chapters,
  onOpenLesson,
  onPractice,
  mode: modeProp,
  onModeChange,
}: PathPickerProps) {
  const [innerMode, setInnerMode] = useState<PathPickerMode>(modeProp ?? "path");
  const mode = modeProp ?? innerMode;
  const [viewStyle, setViewStyle] = useState<"weekly" | "chapters" | "speaking">("weekly");

  const changeMode = (next: PathPickerMode) => {
    setInnerMode(next);
    onModeChange?.(next);
  };

  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [defaultOpen, setDefaultOpen] = useState<string | null>(() => pickDefaultChapter(chapters));

  useEffect(() => {
    if (defaultOpen === null && chapters.length > 0) setDefaultOpen(pickDefaultChapter(chapters));
  }, [chapters, defaultOpen]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("myenglish-grammar-updated", bump);
    return () => window.removeEventListener("myenglish-grammar-updated", bump);
  }, []);

  useEffect(() => {
    if (mode !== "practice") setPicked(new Set());
  }, [mode]);

  const pathSet = useMemo(() => new Set(getEffectiveLessonIds()), [chapters, tick]);

  const summaries = useMemo(() => {
    const now = new Date();
    const due = new Set(getDueGrammarLessons(now));
    return chapters.map((chapter) => {
      const chTitle = sentenceCase(chapter.chapter?.titleVn || chapter.chapter?.title || chapter.chapterId);
      const rows: LessonRow[] = (chapter.lessons ?? []).map((lesson) => {
        const status = lessonStatus(lesson.id, now, due);
        const progress = getLessonProgress(lesson.id);
        return {
          lesson,
          chapterTitle: chTitle,
          status,
          mastery: progress.mastery,
          reviewText: status === "new" ? null : reviewText(formatNextReviewRelative(progress.nextReviewDate).label),
        };
      });
      return { chapter, rows, studied: rows.filter((r) => r.status !== "new").length };
    });
  }, [chapters, tick]);

  const allPathRows = useMemo(
    () => summaries.flatMap((s) => s.rows).filter((r) => pathSet.has(r.lesson.id)),
    [summaries, pathSet]
  );

  const nextLessonId = useMemo(() => {
    for (const { rows } of summaries) {
      for (const r of rows) if (r.status === "new" && pathSet.has(r.lesson.id)) return r.lesson.id;
    }
    return null;
  }, [summaries, pathSet]);

  const [pathNote, setPathNote] = useState<string | null>(null);
  const isPractice = mode === "practice";
  const isChecked = (id: string) => (isPractice ? picked.has(id) : pathSet.has(id));

  const toggleLesson = (id: string) => {
    if (!isPractice) {
      setPathNote(toggleLessonSelection(id) ? null : "Lộ trình cần ít nhất một bài.");
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChapter = (ids: string[]) => {
    const all = ids.length > 0 && ids.every(isChecked);
    if (!isPractice) {
      void selectChapterLessons(ids, !all).then((ok) => setPathNote(ok ? null : "Lộ trình cần ít nhất một bài."));
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const pickedInBookOrder = summaries.flatMap((s) => s.rows.map((r) => r.lesson.id)).filter((id) => picked.has(id));

  const renderCard = (row: LessonRow) => (
    <LessonCard
      key={row.lesson.id}
      row={row}
      mode={mode}
      onPath={pathSet.has(row.lesson.id)}
      picked={picked.has(row.lesson.id)}
      isNext={row.lesson.id === nextLessonId}
      onOpen={() => onOpenLesson(row.lesson.id)}
      onToggle={() => toggleLesson(row.lesson.id)}
    />
  );

  return (
    <section className="space-y-4">
      <div className="space-y-2 px-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              {isPractice
                ? "Luyện theo thì & Chủ điểm"
                : viewStyle === "weekly"
                  ? "Nội dung khóa học · Lộ trình theo Tuần"
                  : viewStyle === "speaking"
                    ? "Ngữ pháp thực tế khi giao tiếp"
                    : "Tra cứu theo Chương sách"}
            </h2>
          </div>

          <div role="tablist" aria-label="Chế độ hiển thị" className="inline-flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={!isPractice && viewStyle === "weekly"}
              onClick={() => {
                changeMode("path");
                setViewStyle("weekly");
              }}
              className={`min-h-9 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                !isPractice && viewStyle === "weekly"
                  ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              📅 Theo Tuần & Ngày
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isPractice && viewStyle === "chapters"}
              onClick={() => {
                changeMode("path");
                setViewStyle("chapters");
              }}
              className={`min-h-9 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                !isPractice && viewStyle === "chapters"
                  ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              📚 Theo Chương
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isPractice && viewStyle === "speaking"}
              onClick={() => {
                changeMode("path");
                setViewStyle("speaking");
              }}
              className={`min-h-9 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                !isPractice && viewStyle === "speaking"
                  ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              💬 Khi nói
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isPractice}
              onClick={() => changeMode("practice")}
              className={`min-h-9 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                isPractice
                  ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              ⚡ Chọn bài luyện riêng
            </button>
          </div>
        </div>

        {!isPractice && viewStyle === "weekly" ? (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
            Lộ trình chia sẵn theo từng <b>Tuần (Ngày 1 → Ngày 6)</b>. Tuần đang học được mở rộng thành 3 bước: <b>Lý thuyết → Bài tập → Kiểm tra nhanh</b>. Bấm vào bất kỳ tuần nào để xem chi tiết.
          </p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              {isPractice
                ? "Tích chọn 1 hoặc nhiều bài ngữ pháp bên dưới để tạo đề luyện tập tổng hợp."
                : 'Công tắc "Trên lộ trình" ở mỗi bài: bật là bài đó nằm trong lịch học hằng ngày, tắt là bỏ qua.'}
            </p>
            {!isPractice && pathNote && <p className="text-sm text-amber-800 dark:text-amber-300">{pathNote}</p>}
            <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
              {LEGEND_ORDER.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${CARD_STYLE[s].dot}`} />
                  {STATUS_STYLE[s].label}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 1. Weekly & Daily Syllabus View (Default) */}
      {!isPractice && viewStyle === "speaking" ? (
        <SpeakingGrammar onOpenLesson={onOpenLesson} />
      ) : !isPractice && viewStyle === "weekly" ? (
        <WeeklySyllabusView
          allRows={allPathRows.length > 0 ? allPathRows : summaries.flatMap((s) => s.rows)}
          nextLessonId={nextLessonId}
          onOpenLesson={onOpenLesson}
          onPractice={onPractice}
        />
      ) : (
        /* 2. Chapter / Tense Matrix View & Multi-select Practice View */
        <div className="space-y-3">
          {summaries.map(({ chapter, rows, studied }) => {
            const ids = rows.map((r) => r.lesson.id);
            const isOpen = openOverride[chapter.chapterId] ?? chapter.chapterId === defaultOpen;
            const allChecked = ids.length > 0 && ids.every(isChecked);
            const order = chapter.chapter?.order ?? (parseInt(chapter.chapterId.replace(/\D/g, ""), 10) || 0);
            const titleVn = sentenceCase(chapter.chapter?.titleVn || chapter.chapter?.title || chapter.chapterId);
            const percent = rows.length > 0 ? Math.round((studied / rows.length) * 100) : 0;

            return (
              <div key={chapter.chapterId}>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenOverride((prev) => ({ ...prev, [chapter.chapterId]: !isOpen }))}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-zinc-400 ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-teal-50 px-2.5 text-xs font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                        Ch.{order}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-slate-900 dark:text-zinc-100">
                        {titleVn}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-[1.625rem] text-xs text-slate-500 dark:text-zinc-400">
                    <span className="h-2 min-w-0 flex-1 max-w-[14rem] overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <span
                        className={`block h-full rounded-full transition-[width] duration-300 ${
                          percent >= 100 ? "bg-green-600" : "bg-teal-700 dark:bg-teal-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      {studied}/{rows.length} đã học
                    </span>
                    {ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleChapter(ids)}
                        className="ml-auto shrink-0 whitespace-nowrap min-h-10 rounded-full border border-teal-700/30 px-3 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-50 dark:border-teal-400/40 dark:text-teal-300 dark:hover:bg-teal-400/10"
                      >
                        {allChecked ? "Bỏ cả chương" : "Chọn cả chương"}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 px-0.5">
                    <ChapterBody rows={rows} renderCard={renderCard} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isPractice && (
        <div className="sticky bottom-2 z-20 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            disabled={pickedInBookOrder.length === 0}
            onClick={() => onPractice(pickedInBookOrder)}
            className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-base font-semibold !text-white shadow-sm transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="truncate">Luyện {pickedInBookOrder.length} bài đã chọn</span>
          </button>
          <button
            type="button"
            onClick={() => changeMode("path")}
            className="min-h-12 shrink-0 rounded-2xl px-4 text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            Huỷ
          </button>
        </div>
      )}
    </section>
  );
}
