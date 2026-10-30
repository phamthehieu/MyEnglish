import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Layers, Loader2, Play, Sparkles, Zap } from "lucide-react";
import type { GrammarBookFile, GrammarBookLesson } from "@/types/grammarBook";
import { getEffectiveLessonIds, toggleLessonSelection } from "@/services/grammarPath";
import { getLessonProgress } from "@/services/grammarService";
import {
  buildLearnSession,
  buildLessonExerciseSession,
  finishLearnSession,
  lessonExerciseMode,
  lessonHasExercises,
  lessonStatus,
  markLessonRead,
  type GrammarSessionMode,
  type SessionEntry,
} from "@/services/grammarSession";
import { getBookChapter } from "@/services/grammarBook";
import { SHOW_DEV_TOOLS } from "@/lib/devTools";
import { formatNextReviewRelative } from "@/utils/reviewSchedule";
import HandbookView from "./HandbookView";
import GrammarPlayer from "./GrammarPlayer";
import GrammarExerciseImportModal from "./GrammarExerciseImportModal";
import { LessonStatusChip, MasteryBar } from "./PathPicker";
import { Button } from "@/components/ui/kit";

export type GrammarLessonTab = "handbook" | "practice" | "diagnostic";

interface GrammarLessonViewProps {
  lesson: GrammarBookLesson;
  chapterId: string;
  initialTab?: GrammarLessonTab;
  onBack: () => void;
  /** Opens another lesson (from a question that uses it) */
  onOpenLesson?: (lessonId: string) => void;
}

interface PlayerState {
  entries: SessionEntry[];
  mode: GrammarSessionMode;
  title: string;
  subtitle?: string;
  onFinish: (results: Array<{ entry: SessionEntry; correct: boolean }>, info: { early: boolean }) => void | Promise<void>;
}

const TABS: Array<{ id: GrammarLessonTab; label: string; icon: typeof BookOpen }> = [
  { id: "handbook", label: "Sổ tay", icon: BookOpen },
  { id: "practice", label: "Bài tập", icon: Layers },
  { id: "diagnostic", label: "Kiểm tra nhanh", icon: Zap },
];

export default function GrammarLessonView({ lesson, chapterId, initialTab = "handbook", onBack, onOpenLesson }: GrammarLessonViewProps) {
  const [tab, setTab] = useState<GrammarLessonTab>(initialTab === "practice" ? "handbook" : initialTab);
  const [chapter, setChapter] = useState<GrammarBookFile | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Null while the lesson's questions are being looked up
  const [hasExercises, setHasExercises] = useState<boolean | null>(null);
  // The quick check found no question usable now (e.g. all of them use a lesson not learnt yet)
  const [quickEmpty, setQuickEmpty] = useState(false);
  // Re-render when progress or the path changes (values below are read on each render)
  const [, setTick] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Progress and path changes come through this event
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("myenglish-grammar-updated", bump);
    return () => window.removeEventListener("myenglish-grammar-updated", bump);
  }, []);

  // A lesson with no auto-checked question (theory only, or only self-graded ones) can be read and marked as learnt
  useEffect(() => {
    let cancelled = false;
    setHasExercises(null);
    setQuickEmpty(false);
    lessonHasExercises(lesson.id)
      .then((found) => {
        if (!cancelled) setHasExercises(found);
      })
      .catch(() => {
        if (!cancelled) setHasExercises(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  // The chapter (notes, number)
  useEffect(() => {
    let cancelled = false;
    getBookChapter(chapterId)
      .then((ch) => {
        if (!cancelled) setChapter(ch);
      })
      .catch((err) => console.warn("Failed to load the chapter:", err));
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const progress = getLessonProgress(lesson.id);
  const status = lessonStatus(lesson.id);
  const studied = status !== "new";
  // No question to practise with: reading the handbook is all there is to do
  const noQuestions = hasExercises === false || quickEmpty;
  const onPath = getEffectiveLessonIds().includes(lesson.id);
  const name = lesson.titleVn || lesson.title;
  const chapterNo = chapter?.chapter?.order ?? (parseInt(chapterId.replace(/\D/g, ""), 10) || 0);
  const nextReview = studied ? formatNextReviewRelative(progress.nextReviewDate) : null;

  const goTab = (next: GrammarLessonTab, scrollTop = false) => {
    // "Bài tập" is not a page: it starts the lesson's exercises at once
    if (next === "practice") {
      void startExercises();
      return;
    }
    setTab(next);
    setMessage(null);
    if (scrollTop) requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  };

  const closePlayer = () => {
    setPlayer(null);
    setTick((t) => t + 1);
  };

  /** A question that uses another lesson opens that lesson; this lesson's own handbook is shown here */
  const openFromPlayer = (lessonId: string) => {
    if (lessonId === lesson.id) {
      setTab("handbook");
      setMessage(null);
      closePlayer();
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
      return;
    }
    onOpenLesson?.(lessonId);
  };

  /** Reading is the whole lesson when it has no questions: it is studied from now on (no FSRS card needed) */
  const markRead = () => {
    markLessonRead(lesson.id);
    setMessage("Đã ghi nhận: bài này tính là đã học.");
    setTick((t) => t + 1);
  };

  const startQuickCheck = async () => {
    setStarting("learn");
    setMessage(null);
    try {
      const entries = await buildLearnSession(lesson.id);
      if (entries.length === 0) {
        setQuickEmpty(true);
        setMessage("Chưa có câu hỏi nào dùng riêng bài này để kiểm tra. Đọc xong, bạn có thể đánh dấu bài là đã học.");
        return;
      }
      setPlayer({
        entries,
        mode: "learn",
        title: `Kiểm tra nhanh: ${name}`,
        subtitle: lesson.titleVn ? lesson.title : undefined,
        onFinish: async (results, info) => {
          // Ending early does not grade the lesson: its first schedule needs the whole quick check
          if (info.early || results.length === 0) return;
          try {
            await finishLearnSession(lesson.id, results.map((r) => r.correct));
          } catch (err) {
            console.warn("Failed to record the quick check:", err);
          }
        },
      });
    } catch (err) {
      console.warn("Failed to build the quick check:", err);
      setMessage("Không tạo được bài kiểm tra. Hãy thử lại.");
    } finally {
      setStarting(null);
    }
  };

  /** Every question of this lesson alone (no other tense), never seen or missed first */
  const startExercises = async () => {
    if (starting) return;
    setStarting("practice");
    setMessage(null);
    try {
      const entries = await buildLessonExerciseSession(lesson.id);
      if (entries.length === 0) {
        setMessage("Dữ liệu sách chưa có câu nào chỉ dùng riêng bài này.");
        return;
      }
      setPlayer({
        entries,
        mode: lessonExerciseMode(lesson.id),
        title: `Bài tập: ${name}`,
        subtitle: !studied
          ? `${entries.length} câu luyện tập tự do · Làm vài câu kiểm tra để tính % tiến độ`
          : `${entries.length} câu chỉ dùng ${name}`,
        onFinish: () => {},
      });
    } catch (err) {
      console.warn("Failed to build the lesson's exercises:", err);
      setMessage("Không tạo được bài tập. Hãy thử lại.");
    } finally {
      setStarting(null);
    }
  };

  // Opened straight on "Bài tập" (e.g. from the path): start at once, the handbook stays underneath
  const autoStarted = useRef(false);
  useEffect(() => {
    if (initialTab !== "practice" || autoStarted.current) return;
    autoStarted.current = true;
    setTab("handbook");
    void startExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (player) {
    return (
      <div className="mx-auto max-w-4xl pb-12">
        <GrammarPlayer
          entries={player.entries}
          mode={player.mode}
          title={player.title}
          subtitle={player.subtitle}
          onFinish={player.onFinish}
          onExit={closePlayer}
          onOpenLesson={openFromPlayer}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-12 animate-in fade-in duration-200">
      <div ref={topRef} />

      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            title="Quay lại danh sách"
            aria-label="Quay lại danh sách"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                Ch.{chapterNo} · Bài {lesson.order}
              </span>
              {lesson.page ? <span>tr. {lesson.page}</span> : null}
            </div>
            <h1 className="mt-1 break-words text-xl font-semibold text-slate-900 dark:text-zinc-100">{name}</h1>
            {lesson.titleVn && lesson.title && lesson.title !== lesson.titleVn && (
              <p className="break-words text-xs text-slate-500 dark:text-zinc-400">{lesson.title}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LessonStatusChip status={status} />
          {studied ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300">
              Thuộc
              <MasteryBar mastery={progress.mastery} className="w-16" />
              <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{progress.mastery}%</span>
            </span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-zinc-300">Chưa kiểm tra</span>
          )}
          {nextReview && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5" />
              Ôn lại: {nextReview.label}
            </span>
          )}
          {SHOW_DEV_TOOLS && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-teal-300 dark:hover:bg-teal-400/10"
              title="Thêm bài tập bằng AI cho riêng bài học này"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Thêm bài tập AI</span>
            </button>
          )}
          <label
            title="Bật: bài này nằm trong lịch học hằng ngày. Tắt: bỏ qua bài này."
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:border-zinc-800 dark:text-zinc-300"
          >
            <input
              type="checkbox"
              checked={onPath}
              onChange={() => toggleLessonSelection(lesson.id)}
              className="h-4 w-4 accent-teal-700"
            />
            Trên lộ trình (lịch học hằng ngày)
          </label>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => goTab(id)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-center text-sm font-semibold leading-tight transition-colors ${
              tab === id
                ? "bg-teal-700 text-white dark:bg-teal-600"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {message && tab !== "diagnostic" && <Notice text={message} tone={message.startsWith("Đã ghi nhận") ? "ok" : "warn"} />}

      {tab === "handbook" && (
        <div>
          <HandbookView blocks={lesson.blocks} title={lesson.title} titleVn={lesson.titleVn} chapterNotes={chapter?.chapterNotes ?? []} />
          {noQuestions ? (
            <ReadOnlyPanel studied={studied} quickEmpty={quickEmpty} onMark={markRead} onBack={onBack} />
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center md:p-5">
              <p className="flex-1 text-sm text-slate-700 dark:text-zinc-300">
                {studied
                  ? "Đọc xong rồi? Làm bài tập của riêng thì này để nhớ lâu hơn."
                  : "Đọc xong sổ tay rồi? Làm vài câu kiểm tra (tối đa 8 câu) để bắt đầu học bài này."}
              </p>
              <Button
                onClick={() => (studied ? void startExercises() : void startQuickCheck())}
                disabled={starting !== null}
                className="w-full shrink-0 sm:w-auto"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : studied ? <Layers className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {studied ? "Làm bài tập" : "Làm vài câu kiểm tra"}
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "diagnostic" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
              <Zap className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Kiểm tra nhanh (tối đa 8 câu)</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {studied
                  ? "Làm lại để xem bạn còn nhớ bài này đến đâu. Kết quả cập nhật độ thuộc và lịch ôn."
                  : "Lần đầu, kết quả bài kiểm tra này quyết định khi nào bạn gặp lại bài để ôn. Nên đọc Sổ tay trước."}
              </p>
            </div>
          </div>
          {studied && progress.lastAttemptDate && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Điểm gần nhất: <strong className="font-semibold tabular-nums text-slate-800 dark:text-zinc-200">{progress.score}%</strong> · Độ thuộc: {progress.mastery}%
            </p>
          )}
          {message && <Notice text={message} tone={message.startsWith("Đã ghi nhận") ? "ok" : "warn"} />}
          {noQuestions ? (
            <ReadOnlyPanel studied={studied} quickEmpty={quickEmpty} onMark={markRead} onBack={onBack} />
          ) : (
            <Button size="lg" onClick={startQuickCheck} disabled={starting !== null} className="w-full sm:w-auto">
              {starting === "learn" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              Bắt đầu
            </Button>
          )}
        </div>
      )}

      <GrammarExerciseImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        initialChapterId={chapterId}
        initialLessonId={lesson.id}
        initialLessonTitle={lesson.titleVn || lesson.title}
        onImportComplete={() => {
          lessonHasExercises(lesson.id).then((found) => setHasExercises(found));
        }}
      />
    </div>
  );
}

function Notice({ text, tone = "warn" }: { text: string; tone?: "warn" | "ok" }) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "ok"
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      {text}
    </p>
  );
}

/** A lesson with no questions (or none usable yet): read it, mark it, then go back to the list */
function ReadOnlyPanel({ studied, quickEmpty, onMark, onBack }: { studied: boolean; quickEmpty: boolean; onMark: () => void; onBack: () => void }) {
  const hint = quickEmpty
    ? "Chưa có câu hỏi nào dùng riêng bài này để kiểm tra. Đọc xong thì đánh dấu để tính là đã học."
    : "Bài này chưa có câu hỏi có đáp án để kiểm tra. Đọc xong thì đánh dấu để tính là đã học.";
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center md:p-5">
      <p className="flex-1 text-sm text-slate-700 dark:text-zinc-300">{studied ? "Bạn đã học xong bài này." : hint}</p>
      {studied ? (
        <Button variant="secondary" onClick={onBack} className="w-full shrink-0 sm:w-auto">
          Về danh sách bài
        </Button>
      ) : (
        <Button onClick={onMark} className="w-full shrink-0 sm:w-auto">
          <CheckCircle2 className="h-4 w-4" />
          Đã đọc xong, tính là đã học
        </Button>
      )}
    </div>
  );
}
