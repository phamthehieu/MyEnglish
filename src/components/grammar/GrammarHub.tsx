import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  CircleAlert,
  Eye,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/kit";
import { SHOW_DEV_TOOLS } from "@/lib/devTools";
import type { GrammarBookFile } from "@/types/grammarBook";
import {
  ensureGrammarBookSeeded,
  getAllBookChapters,
  getBookLoadError,
  getHiddenItemKeys,
  listUserAcceptedAnswers,
  removeUserAcceptedAnswer,
  unhideItem,
} from "@/services/grammarBook";
import { getTodayGrammarPlan, type TodayGrammarPlan } from "@/services/grammarPath";
import { getGrammarSummaryStats, initGrammarStorage } from "@/services/grammarService";
import { buildPracticeSession, buildReviewSession, type SessionEntry } from "@/services/grammarSession";
import PathPicker, { type PathPickerMode } from "./PathPicker";
import GrammarLessonView, { type GrammarLessonTab } from "./GrammarLessonView";
import GrammarImportDialog from "./GrammarImportDialog";
import GrammarTipCard from "./GrammarTipCard";
import { tipForStage } from "@/data/grammarTips";
import { SHOW_TIP_EVENT, SHOW_TIP_KEY } from "@/services/weakPoints";
import GrammarExerciseImportModal from "./GrammarExerciseImportModal";
import GrammarPlayer from "./GrammarPlayer";

import { PAGE_CONTAINER } from "../dashboard/shared";

interface GrammarHubProps {
  initialLessonId?: string | null;
  resetKey?: number;
}

type Stats = ReturnType<typeof getGrammarSummaryStats>;

/** What the learner has hidden or marked as accepted, kept here so each can be undone */
interface ManagedItems {
  hidden: string[];
  accepted: Array<{ itemKey: string; blankIndex: number; answer: string }>;
}

function readManagedItems(): ManagedItems {
  return { hidden: getHiddenItemKeys(), accepted: listUserAcceptedAnswers() };
}

interface PlayerState {
  entries: SessionEntry[];
  mode: "review" | "practice";
  title: string;
  subtitle?: string;
}

export default function GrammarHub({ initialLessonId = null, resetKey }: GrammarHubProps) {
  const [chapters, setChapters] = useState<GrammarBookFile[]>([]);
  const [plan, setPlan] = useState<TodayGrammarPlan | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [managed, setManaged] = useState<ManagedItems>(() => readManagedItems());
  const [activeLesson, setActiveLesson] = useState<{ chapterId: string; lessonId: string; tab: GrammarLessonTab } | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exerciseImportOpen, setExerciseImportOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PathPickerMode>("path");
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tipStage, setTipStage] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const stage = sessionStorage.getItem(SHOW_TIP_KEY);
        if (stage) {
          sessionStorage.removeItem(SHOW_TIP_KEY);
          setTipStage(stage);
        }
      } catch {
        /* no tip */
      }
    };
    read();
    window.addEventListener(SHOW_TIP_EVENT, read);
    return () => window.removeEventListener(SHOW_TIP_EVENT, read);
  }, []);
  const weakTip = tipStage ? tipForStage(tipStage) : undefined;

  const loadSeq = useRef(0);
  const initialHandled = useRef(false);
  const prevResetKey = useRef(resetKey);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((t) => window.clearTimeout(t));
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };

  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      await initGrammarStorage();
      let chs = await getAllBookChapters();
      if (chs.length === 0) {
        await ensureGrammarBookSeeded().catch(() => {});
        chs = await getAllBookChapters();
      }
      const nextPlan = await getTodayGrammarPlan();
      if (seq !== loadSeq.current) return;
      setChapters(chs);
      setPlan(nextPlan);
      setStats(getGrammarSummaryStats());
      setManaged(readManagedItems());
      setLoadError(getBookLoadError() !== null);

      if (initialLessonId && !initialHandled.current) {
        initialHandled.current = true;
        const ch = chs.find((c) => (c.lessons ?? []).some((l) => l.id === initialLessonId));
        if (ch) setActiveLesson({ chapterId: ch.chapterId, lessonId: initialLessonId, tab: "handbook" });
      }
    } catch (err) {
      console.warn("Failed to load the grammar hub:", err);
      if (seq === loadSeq.current) setLoadError(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [initialLessonId]);

  const playerOpen = useRef(false);
  playerOpen.current = player !== null;

  useEffect(() => {
    void loadData();
    const onUpdate = (e: Event) => {
      const bookChanged = !!(e as CustomEvent<{ book?: boolean } | undefined>).detail?.book;
      if (playerOpen.current && !bookChanged) return;
      void loadData();
    };
    window.addEventListener("myenglish-grammar-updated", onUpdate);
    return () => window.removeEventListener("myenglish-grammar-updated", onUpdate);
  }, [loadData]);

  useEffect(() => {
    if (prevResetKey.current === resetKey) return;
    prevResetKey.current = resetKey;
    setActiveLesson(null);
    setPlayer(null);
    setImportOpen(false);
    setExerciseImportOpen(false);
    setPickerMode("path");
    void loadData();
  }, [resetKey, loadData]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(false);
    void loadData();
  };

  const restoreHidden = (itemKey: string) => {
    unhideItem(itemKey);
    setManaged(readManagedItems());
  };

  const removeAccepted = (item: ManagedItems["accepted"][number]) => {
    removeUserAcceptedAnswer(item.itemKey, item.answer, item.blankIndex);
    setManaged(readManagedItems());
  };

  const openLesson = (lessonId: string, tab: GrammarLessonTab = "handbook") => {
    const ch = chapters.find((c) => (c.lessons ?? []).some((l) => l.id === lessonId));
    if (ch) setActiveLesson({ chapterId: ch.chapterId, lessonId, tab });
  };

  const startReview = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const entries = await buildReviewSession();
      if (entries.length === 0) {
        showNotice("Chưa có câu ôn tập phù hợp cho các bài đến hạn");
        return;
      }
      setPlayer({ entries, mode: "review", title: "Ôn tập ngữ pháp", subtitle: `${stats?.dueCount ?? 0} bài đến hạn` });
    } catch (err) {
      console.warn("Failed to build the review:", err);
      showNotice("Không tạo được bài ôn tập");
    } finally {
      setStarting(false);
    }
  };

  const startPractice = async (lessonIds: string[]) => {
    if (starting) return;
    setStarting(true);
    try {
      const entries = await buildPracticeSession(lessonIds);
      if (entries.length === 0) {
        showNotice("Chưa có câu nào chỉ dùng các bài này");
        return;
      }
      setPickerMode("path");
      const names = chapters
        .flatMap((c) => c.lessons ?? [])
        .filter((l) => lessonIds.includes(l.id))
        .map((l) => l.titleVn || l.title);
      setPlayer({
        entries,
        mode: "practice",
        title: "Luyện tập tổng hợp",
        subtitle: names.length <= 3 ? names.join(" + ") : `${names.slice(0, 3).join(" + ")} và ${names.length - 3} bài khác`,
      });
    } catch (err) {
      console.warn("Failed to build the practice:", err);
      showNotice("Không tạo được bài luyện");
    } finally {
      setStarting(false);
    }
  };

  const openPractice = () => {
    setPickerMode("practice");
    later(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (player) {
    return (
      <div className={PAGE_CONTAINER}>
        <GrammarPlayer
          entries={player.entries}
          mode={player.mode}
          title={player.title}
          subtitle={player.subtitle}
          onFinish={() => {}}
          onExit={() => {
            setPlayer(null);
            void loadData();
          }}
          onOpenLesson={(lessonId) => {
            setPlayer(null);
            openLesson(lessonId);
          }}
        />
      </div>
    );
  }

  if (activeLesson) {
    const lesson = chapters.flatMap((c) => c.lessons ?? []).find((l) => l.id === activeLesson.lessonId);
    if (lesson) {
      return (
        <div className={PAGE_CONTAINER}>
          <GrammarLessonView
            key={activeLesson.lessonId}
            lesson={lesson}
            chapterId={activeLesson.chapterId}
            initialTab={activeLesson.tab}
            onBack={() => {
              setActiveLesson(null);
              void loadData();
            }}
            onOpenLesson={(lessonId) => openLesson(lessonId)}
          />
        </div>
      );
    }
  }

  const hasBook = chapters.length > 0;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mx-auto max-w-5xl space-y-5 pb-6">
        {weakTip && (
          <section
            aria-label="Ngữ pháp hay sai"
            className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 p-3.5 md:p-5 space-y-3"
          >
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Điểm bạn hay sai gần đây:</p>
            <GrammarTipCard tip={weakTip} onOpenLesson={openLesson} />
            <button
              onClick={() => setTipStage(null)}
              className="min-h-11 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              Đã hiểu
            </button>
          </section>
        )}



        {loading && !hasBook ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : loadError && !hasBook ? (
          <div className="space-y-4 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-red-500/30 dark:bg-zinc-900 sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <CircleAlert className="h-7 w-7" />
            </span>
            <div className="mx-auto max-w-md space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Không tải được dữ liệu ngữ pháp</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                Có lỗi khi đọc dữ liệu trên máy này. Hãy thử lại. Nếu vẫn lỗi, hãy khởi động lại ứng dụng.
              </p>
            </div>
            <Button onClick={retryLoad} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : !hasBook ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
              <BookOpen className="h-7 w-7" />
            </span>
            <div className="mx-auto max-w-md space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Chưa có dữ liệu sách ngữ pháp</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {SHOW_DEV_TOOLS
                  ? "Dữ liệu lấy từ chính cuốn sách của bạn: nhờ AI chuyển từng chương sang file JSON bằng prompt có sẵn, rồi nhập các file vào đây."
                  : "Dữ liệu ngữ pháp chưa sẵn sàng. Hãy thử lại, hoặc khởi động lại ứng dụng."}
              </p>
            </div>
            <div className="flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
              {SHOW_DEV_TOOLS ? (
                <Button onClick={() => setExerciseImportOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  Nhập bài tập AI / Lịch sử
                </Button>
              ) : (
                <Button onClick={retryLoad}>
                  <RefreshCw className="h-4 w-4" />
                  Thử lại
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <CourseHeroBanner
              stats={stats}
              plan={plan}
              starting={starting}
              onReview={startReview}
              onOpenLesson={openLesson}
              onPractice={openPractice}
              onOpenImport={SHOW_DEV_TOOLS ? () => setExerciseImportOpen(true) : undefined}
            />



            <div ref={pickerRef} className="scroll-mt-2">
              <PathPicker
                chapters={chapters}
                onOpenLesson={openLesson}
                onPractice={startPractice}
                mode={pickerMode}
                onModeChange={setPickerMode}
              />
            </div>

            {SHOW_DEV_TOOLS && (
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex min-h-10 items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  title="Nhập dữ liệu gốc từ sách PDF"
                >
                  <Upload className="h-3 w-3" />
                  <span>Nhập dữ liệu sách</span>
                </button>
              </div>
            )}

            <ManagedItemsPanel managed={managed} onRestoreHidden={restoreHidden} onRemoveAccepted={removeAccepted} />
          </>
        )}
      </div>

      <GrammarImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImportComplete={() => void loadData()} />
      <GrammarExerciseImportModal
        isOpen={exerciseImportOpen}
        onClose={() => setExerciseImportOpen(false)}
        onImportComplete={() => void loadData()}
      />

      {notice && (
        <div
          role="status"
          className="fixed bottom-16 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

/**
 * Hero Banner at the top of GrammarHub (styled after the course header in the user's screenshot,
 * replacing the sales box on the right with the learner's real Today Action Card).
 */
function CourseHeroBanner({
  stats,
  plan,
  starting,
  onReview,
  onOpenLesson,
  onPractice,
  onOpenImport,
}: {
  stats: Stats | null;
  plan: TodayGrammarPlan | null;
  starting: boolean;
  onReview: () => void;
  onOpenLesson: (lessonId: string) => void;
  onPractice: () => void;
  onOpenImport?: () => void;
}) {
  const due = stats?.dueCount ?? 0;
  const total = stats?.totalLessons ?? 0;
  const mastered = stats?.masteredCount ?? 0;
  const learning = stats?.learningCount ?? 0;
  const studied = mastered + learning;
  const pct = total > 0 ? Math.min(100, Math.round((studied * 100) / total)) : 0;
  const lessonName = (l: { titleVn?: string; title: string }) => l.titleVn || l.title;

  const nextAction =
    due > 0
      ? {
          badge: `${due} bài đến hạn ôn`,
          title: `Ôn tập ${due} bài ngữ pháp sắp quên`,
          desc: "Ôn lại các công thức đến hạn trước khi học bài mới để nhớ lâu.",
          btnText: `Ôn tập ${due} bài ngay`,
          icon: <Clock className="h-4 w-4" />,
          onClick: onReview,
        }
      : plan?.relearn
        ? {
            badge: "Cần củng cố lại",
            title: lessonName(plan.relearn),
            desc: "Xem lại công thức và làm lại bài kiểm tra nhanh của chủ điểm này.",
            btnText: "Học lại bài này",
            icon: <RotateCcw className="h-4 w-4" />,
            onClick: () => onOpenLesson(plan.relearn!.id),
          }
        : plan?.nextLesson
          ? {
              badge: plan.newLessonDoneToday ? "Học vượt tiến độ" : "Bài học hôm nay",
              title: lessonName(plan.nextLesson),
              desc: "3 bước: Đọc lý thuyết ngắn → Làm bài tập thực hành → Kiểm tra nhanh.",
              btnText: plan.newLessonDoneToday ? "Học tiếp bài mới" : "Bắt đầu bài học hôm nay",
              icon: <Sparkles className="h-4 w-4" />,
              onClick: () => onOpenLesson(plan.nextLesson!.id),
            }
          : {
              badge: "Luyện tập tự chọn",
              title: "Luyện tập tổng hợp các thì & cấu trúc",
              desc: "Chọn các chủ điểm bạn muốn rèn phản xạ chắc chắn hơn.",
              btnText: "Chọn bài để luyện",
              icon: <Layers className="h-4 w-4" />,
              onClick: onPractice,
            };

  return (
    <section
      aria-label="Tổng quan khóa học ngữ pháp"
      className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#2B1B64] via-[#1E1B4B] to-[#0F172A] p-5 text-white shadow-lg md:p-7"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-teal-500/15 blur-3xl" />

      <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Left: Course Title, Description & Overall Progress */}
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-200">
            <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 font-bold text-teal-300 ring-1 ring-teal-400/30">
              Lộ trình Lấy gốc → Nâng cao
            </span>
            <span>· ~20 phút mỗi ngày</span>
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-100 hover:bg-white/20"
              >
                <Sparkles className="w-3 h-3" /> Nhập bài tập AI
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Lộ trình Ngữ pháp Tiếng Anh Cơ bản đến Nâng cao
          </h1>

          <p className="text-sm leading-relaxed text-indigo-100/85">
            Được chia thành từng <b>Tuần</b> và từng <b>Ngày học cụ thể</b>. Mỗi ngày tập trung làm chủ 1 chủ điểm qua 3
            bước khép kín: <b>Lý thuyết cô đọng → Bài tập thực tế → Kiểm tra phản xạ</b>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="rounded-xl bg-white/10 px-3 py-1.5 font-semibold text-white ring-1 ring-white/15">
              📚 {total} bài học
            </span>
            <span className="rounded-xl bg-teal-500/20 px-3 py-1.5 font-semibold text-teal-200 ring-1 ring-teal-400/30">
              ✓ {studied} đã học ({mastered} đã thuộc)
            </span>
            {due > 0 && (
              <span className="rounded-xl bg-amber-500/20 px-3 py-1.5 font-semibold text-amber-200 ring-1 ring-amber-400/30">
                ⏰ {due} bài đến hạn ôn
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-1 max-w-md">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span>Tiến độ toàn khóa</span>
              <span className="font-mono font-bold text-teal-300">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-teal-400 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Today's Active Study Card (Replaces the commercial price box in the screenshot) */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md md:p-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-2.5 py-0.5 text-xs font-bold text-teal-300">
              {nextAction.icon}
              {nextAction.badge}
            </span>
            <h2 className="text-lg font-extrabold leading-snug text-white">{nextAction.title}</h2>
            <p className="text-xs leading-relaxed text-indigo-100/80">{nextAction.desc}</p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={starting}
              onClick={nextAction.onClick}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 text-sm font-extrabold text-slate-950 shadow-sm transition-colors hover:bg-teal-300 disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{nextAction.btnText}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-indigo-200">
              {due > 0 && plan?.nextLesson ? (
                <button
                  type="button"
                  onClick={() => onOpenLesson(plan.nextLesson!.id)}
                  className="font-semibold text-teal-300 hover:underline"
                >
                  Học bài mới: {lessonName(plan.nextLesson)} →
                </button>
              ) : (
                <span>Học tuần tự từng ngày để nhớ lâu nhất</span>
              )}
              <button type="button" onClick={onPractice} className="ml-auto font-semibold text-indigo-200 hover:text-white hover:underline">
                Luyện tự chọn
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Hidden questions and self-accepted answers: folded away by default, only keys and answers are listed */
function ManagedItemsPanel({
  managed,
  onRestoreHidden,
  onRemoveAccepted,
}: {
  managed: ManagedItems;
  onRestoreHidden: (itemKey: string) => void;
  onRemoveAccepted: (item: ManagedItems["accepted"][number]) => void;
}) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white px-3.5 py-1 text-xs shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-slate-600 dark:text-zinc-300">
        <span className="flex min-w-0 items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5" />
          Công cụ: câu đã ẩn và đáp án tự công nhận
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>

      <div className="mb-3 mt-2 space-y-4">
        <section className="space-y-1.5">
          <h3 className="font-semibold text-slate-700 dark:text-zinc-200">Câu đã ẩn ({managed.hidden.length})</h3>
          {managed.hidden.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400">Chưa ẩn câu nào.</p>
          ) : (
            <ul className="space-y-1">
              {managed.hidden.map((itemKey) => (
                <li
                  key={itemKey}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-0.5 dark:bg-zinc-800/60"
                >
                  <span className="min-w-0 truncate font-mono text-slate-700 dark:text-zinc-300">{itemKey}</span>
                  <button
                    type="button"
                    onClick={() => onRestoreHidden(itemKey)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Hiện lại
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-1.5">
          <h3 className="font-semibold text-slate-700 dark:text-zinc-200">
            Đáp án mình tự công nhận ({managed.accepted.length})
          </h3>
          {managed.accepted.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400">Chưa có đáp án nào.</p>
          ) : (
            <ul className="space-y-1">
              {managed.accepted.map((item) => (
                <li
                  key={`${item.itemKey}-${item.blankIndex}-${item.answer}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-0.5 dark:bg-zinc-800/60"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-slate-500 dark:text-zinc-400">{item.itemKey}</span>
                    {item.blankIndex > 0 && (
                      <span className="text-slate-500 dark:text-zinc-400"> · ô {item.blankIndex + 1}</span>
                    )}
                    <span className="text-slate-700 dark:text-zinc-200">: {item.answer}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAccepted(item)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xoá
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}
