import { useMemo } from "react";
import { Play, CheckCircle, Sparkles, RotateCcw, AlertCircle, Crosshair, CalendarDays, Layers, ArrowRight, Dumbbell } from "lucide-react";
import { useWordsStore } from "@/stores/wordsStore";
import { PAGE_CONTAINER, type LibraryStats } from "./shared";
import WeeklyProgressCard from "../WeeklyProgressCard";
import ComebackCard from "./ComebackCard";
import type { ComebackStatus } from "@/services/comeback";
import { forecastSessionLoad, getUnmasteredWords, youngWordCap, type TodayWork } from "@/services/smartReview";
import { isSimpleMode } from "@/services/learnerProfile";
import { getStudyLimits } from "@/services/srs";
import { minutesFor } from "@/services/comeback";
import { getFocusSettings } from "@/services/focusSettings";
import { CEFR_LEVELS } from "@/services/knownWords";
import { memoryLabel } from "@/utils/labels";
import { Badge, Button, Card } from "../ui/kit";

interface ReviewTabProps {
  dueCount: number;
  todayWork?: TodayWork;
  /** Back after a break: today's share of the backlog replaces the queue overview */
  comeback?: ComebackStatus | null;
  libraryStats: LibraryStats;
  availableTopics: string[];
  handleStartReview: (onlyDue?: boolean, topicFilter?: string) => void;
  /** Timed focus session (minutes) */
  onStartFocus?: (minutes: number) => void;
  /** The word library showing the words due */
  onOpenDueWords?: () => void;
  /** Still passed by the parent; this tab no longer posts messages */
  setMessage: (msg: string | null) => void;
}

/** Due words shown as chips before "and N more" */
const DUE_CHIPS = 24;
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/**
 * The review landing, as one overview: today's work and every way to start it, the next 7 days of reviews and
 * this week's progress on the side, then the levels and the words waiting, compact enough to see at a glance.
 */
export default function ReviewTab({
  dueCount,
  todayWork,
  comeback,
  libraryStats,
  availableTopics,
  handleStartReview,
  onStartFocus,
  onOpenDueWords,
}: ReviewTabProps) {
  const words = useWordsStore((s) => s.words);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);
  const inComeback = !!comeback && !comeback.caughtUp;
  const unmasteredCount = useMemo(() => getUnmasteredWords(words).length, [words]);
  const isCapped = unmasteredCount >= youngWordCap();
  const simple = isSimpleMode();
  const dueWordCount = libraryStats.dueWords.length;
  const reviews = todayWork?.reviews ?? dueCount;
  const newToday = todayWork?.newToday ?? 0;
  const focusMinutes = getFocusSettings().minutes;

  // Reviews of the next 7 days, counted the way sessions pick cards (today = the "Thẻ ôn" of today's work).
  // One more day is read so the average covers the 7 days after today.
  const forecast = useMemo(() => {
    const f = forecastSessionLoad(words, 8);
    const upcoming = f.days.slice(1, 8);
    const upcomingPerDay = upcoming.reduce((sum, d) => sum + d.reviews, 0) / upcoming.length;
    return { days: f.days.slice(0, 7), laterToday: f.laterToday, upcomingPerDay, overloaded: upcomingPerDay > getStudyLimits().maxSessionSize };
  }, [words]);

  // Levels in CEFR order (other topics after them)
  const levels = useMemo(() => {
    const rank = (t: string) => {
      const i = (CEFR_LEVELS as readonly string[]).indexOf(t.toUpperCase());
      return i < 0 ? 99 : i;
    };
    return [...availableTopics].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [availableTopics]);

  const startLabel =
    dueCount > 0
      ? reviews > 0 && newToday > 0
        ? "Bắt đầu học"
        : reviews > 0
          ? "Bắt đầu ôn tập"
          : "Học từ mới"
      : isCapped
        ? `Ôn từ chưa thuộc (${unmasteredCount})`
        : "Học thêm từ mới";
  const tomorrow = forecast?.days[1]?.reviews ?? null;
  const maxDay = forecast ? Math.max(1, ...forecast.days.map((d) => d.reviews)) : 1;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-6">
          {comeback && <ComebackCard comeback={comeback} onStart={() => handleStartReview(true)} />}

          {/* Today: how much, and every way to start */}
          {!inComeback && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="teal">Lịch ôn theo trí nhớ của bạn</Badge>
                {dueCount > 0 && <span className="text-sm text-slate-500 dark:text-zinc-400">~{minutesFor(reviews + newToday * 2)} phút</span>}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {dueCount > 0 ? `Hôm nay: ${[reviews > 0 ? `${reviews} thẻ ôn` : "", newToday > 0 ? `${newToday} từ mới` : ""].filter(Boolean).join(" · ")}` : "Đã xong phần hôm nay"}
                </h2>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {dueCount > 0 ? "Từ được hỏi lại đúng lúc bạn sắp quên." : tomorrow != null ? `Ngày mai: ${tomorrow} thẻ ôn.` : "Quay lại vào ngày mai nhé."}
                </p>
              </div>

              <Button size="lg" block onClick={() => handleStartReview(true)} disabled={words.length === 0}>
                {dueCount > 0 ? <Play className="h-5 w-5" /> : isCapped ? <RotateCcw className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                {startLabel}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {onStartFocus && (
                  <Button variant="secondary" onClick={() => onStartFocus(focusMinutes)} disabled={words.length === 0} title="Chỉ học, tắt nhắc nhở và mọi thứ khác" className="whitespace-nowrap px-3">
                    <Crosshair className="hidden h-4 w-4 shrink-0 min-[380px]:block" /> Tập trung
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => handleStartReview(false)}
                  disabled={words.length === 0}
                  title="Ôn thêm mọi từ, không đổi lịch ôn"
                  className={`whitespace-nowrap px-3 ${onStartFocus ? "" : "col-span-2"}`}
                >
                  <Dumbbell className="hidden h-4 w-4 shrink-0 min-[380px]:block" /> Luyện thêm
                </Button>
              </div>

              {dueCount === 0 && isCapped && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Bạn có {unmasteredCount} từ đang học chưa vững. Củng cố các từ này trước khi học thêm từ mới.
                </p>
              )}
            </Card>
          )}

          {/* Levels: one row each */}
          {levels.length > 0 && (
            <Card className="space-y-3">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                  <Layers className="h-5 w-5 text-teal-700 dark:text-teal-300" /> Theo cấp độ
                </h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">Ôn: các từ đến hạn của cấp. Luyện: ôn thêm, không đổi lịch.</p>
              </div>
              <div className="space-y-2">
                {levels.map((top) => {
                  const { total, due } = libraryStats.perTopic[top.trim().toLowerCase()] || { total: 0, due: 0 };
                  return (
                    <div key={top} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-zinc-800/50">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                        {top}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900 dark:text-white">{total} từ</span>
                        <span className={`block text-sm ${due > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-zinc-400"}`}>
                          {due > 0 ? `${due} đến hạn` : "Chưa có từ đến hạn"}
                        </span>
                      </span>
                      {due > 0 && (
                        <button
                          onClick={() => handleStartReview(true, top)}
                          className="min-h-10 shrink-0 rounded-xl bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                        >
                          Ôn
                        </button>
                      )}
                      <button
                        onClick={() => handleStartReview(false, top)}
                        className="min-h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        Luyện
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Words waiting: chips, the rest in the library */}
          {inComeback ? null : dueWordCount > 0 ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Từ đang chờ ôn <span className="font-normal text-slate-400 dark:text-zinc-500">({dueWordCount})</span>
                </h3>
                {onOpenDueWords && (
                  <button onClick={onOpenDueWords} className="min-h-10 px-2 text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center gap-1">
                    Xem tất cả <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
                {libraryStats.dueWords.slice(0, DUE_CHIPS).map((w) => {
                  const reviewed = !!w.srs.stability && w.srs.stability > 0;
                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWord(w)}
                      title={simple || !reviewed ? w.meaning_vn : `${w.meaning_vn} · ${memoryLabel(w.srs.stability)}`}
                      className="text-left min-h-14 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-600/50 transition-colors min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{w.word}</span>
                        {!reviewed && <span className="text-xs font-semibold px-1.5 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300 shrink-0">Mới</span>}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-zinc-400 truncate">{w.meaning_vn}</div>
                    </button>
                  );
                })}
              </div>
              {dueWordCount > DUE_CHIPS && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  và {dueWordCount - DUE_CHIPS} từ khác{onOpenDueWords ? ", bấm \"Xem tất cả\" để xem trong Từ đã học" : ""}.
                </p>
              )}
            </section>
          ) : (
            <Card className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">Không còn từ nào đang chờ ôn</div>
                <div className="text-sm text-slate-500 dark:text-zinc-400">Muốn ôn thêm thì bấm "Luyện thêm", lịch ôn không bị ảnh hưởng.</div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Side column: what is coming, how the week goes ── */}
        <aside className="min-w-0 grid gap-6 items-start md:grid-cols-2 lg:grid-cols-1 lg:sticky lg:top-0">
          <WeeklyProgressCard words={words} compact />

          <Card className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-700 dark:text-teal-300" /> 7 ngày tới
            </h3>
            <>
                <div className="flex items-end gap-1.5 h-24">
                  {forecast.days.map((d, i) => {
                    const [y, m, dd] = d.date.split("-").map(Number);
                    const day = i === 0 ? "Nay" : i === 1 ? "Mai" : WEEKDAY[new Date(y, m - 1, dd).getDay()];
                    return (
                      <div
                        key={d.date}
                        className="flex-1 h-full flex flex-col items-center justify-end gap-1"
                        title={
                          i === 0
                            ? `Hôm nay: ${d.reviews} thẻ ôn${forecast.laterToday > 0 ? `, thêm ${forecast.laterToday} thẻ đang học đến lượt muộn hơn trong ngày` : ""}`
                            : `${d.date}: ${d.reviews} thẻ ôn (đã có lịch, sẽ tăng thêm khi bạn học)`
                        }
                      >
                        <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400">{d.reviews || ""}</span>
                        <div
                          className={`w-full rounded-t-md ${i === 0 ? "bg-teal-700 dark:bg-teal-500" : "bg-teal-100 dark:bg-teal-400/25"}`}
                          style={{ height: `${d.reviews > 0 ? Math.max(6, (d.reviews / maxDay) * 64) : 2}px` }}
                        />
                        <span className={`text-[11px] ${i === 0 ? "font-bold text-slate-700 dark:text-zinc-200" : "text-slate-600 dark:text-zinc-400"}`}>{day}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Trung bình {Math.round(forecast.upcomingPerDay)} thẻ/ngày.
                  {forecast.overloaded ? " Lịch đang dày: nên giảm số từ mới mỗi ngày." : ""}
                </p>
              </>
          </Card>
        </aside>
      </div>
    </div>
  );
}

