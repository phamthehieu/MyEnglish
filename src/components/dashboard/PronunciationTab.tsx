import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Ear,
  Lightbulb,
  Mic,
  RotateCcw,
  Snail,
  Volume2,
  X,
} from "lucide-react";
import type { PronunciationItem, PronunciationLesson, PronunciationQuizItem } from "@/types/pronunciation";
import type { PhonemeChartGroup } from "@/data/phonemes";
import {
  getMastery,
  MASTERY_ACCURACY,
  MASTERY_MIN_DAYS,
  summarizeMastery,
  type MasterySummary,
  type SoundMastery as MasteryEntry,
} from "@/services/pronunciationMastery";
import {
  getPronunciationProgress,
  isLessonPassed,
  loadPhonemeLessons,
  loadPronunciationLessons,
  nextPronunciationLesson,
  recordPronunciationQuiz,
  recordSayAloud,
  PRONUNCIATION_PASS_RATIO,
  type PronunciationLessonProgress,
  type PronunciationProgress,
} from "@/services/pronunciation";
import { handleSpeak, SLOW_RATE, AUTO_SPEAK_DELAY_MS } from "../review/speech";
import { PAGE_CONTAINER } from "./shared";
import { buildPhonemeChallenge, type PhonemeChallengeSession } from "@/services/phonemeMatcher";
import { getWordsLite } from "@/services/db";
import { MicCheck } from "./PronunciationMicCheck";
import SoundSession, { lessonFromPair } from "./SoundSession";
import SoundIntro from "./SoundIntro";

/** The three steps of a lesson, one on screen at a time so the exercise is never below the theory */
type Step = "learn" | "say" | "quiz";

/** Questions needed to pass a quiz of `total` questions */
function passMark(total: number): number {
  return Math.ceil(total * PRONUNCIATION_PASS_RATIO - 1e-9);
}

/**
 * Window keyboard shortcuts for the step on screen. `handler` returns true when it used the key. Typing
 * fields and open dialogs keep their keys; a focused button is blurred so Space/Enter do not click it too.
 */
function useShortcuts(handler: (e: KeyboardEvent) => boolean | void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (e.key === "Enter" && active && (active.tagName === "BUTTON" || active.tagName === "A")) return;
      if (ref.current(e)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-[10px] font-mono font-semibold text-slate-600 dark:text-zinc-300">
      {children}
    </kbd>
  );
}

function ProgressBar({ value, tone = "violet" }: { value: number; tone?: "violet" | "emerald" }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${tone === "emerald" ? "bg-emerald-500" : "bg-violet-500"}`}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

const MASTERY_LABEL: Record<MasterySummary["level"], string> = { new: "Chưa học", learning: "Đang học", mastered: "Thành thạo" };
const MASTERY_BAR: Record<MasterySummary["level"], string> = { new: "bg-slate-300 dark:bg-zinc-600", learning: "bg-amber-500", mastered: "bg-emerald-500" };

/** Tooltip text of a mastery summary */
function masteryHint(m: MasterySummary): string {
  if (m.level === "new") return "Chưa luyện";
  return `${MASTERY_LABEL[m.level]} ${m.percent}% · ${m.answers} câu gần nhất${m.accuracy !== null ? ` đúng ${Math.round(m.accuracy * 100)}%` : ""} · ${m.goodDays}/${MASTERY_MIN_DAYS} ngày đạt · ${m.wordsMet}/${m.wordsTarget} từ`;
}

/** The thin bar under a sound on the chart */
function MasteryBar({ summary }: { summary: MasterySummary }) {
  return (
    <div className="mt-1.5 h-1 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden" aria-label={masteryHint(summary)}>
      <div className={`h-full rounded-full transition-all ${MASTERY_BAR[summary.level]}`} style={{ width: `${summary.percent}%` }} />
    </div>
  );
}

/** What the mastery of one lesson is made of, so the learner sees what to practise next */
function MasteryPanel({ summary }: { summary: MasterySummary }) {
  const rows: Array<{ label: string; value: string; done: boolean }> = [
    {
      label: `Đúng ≥ ${Math.round(MASTERY_ACCURACY * 100)}% ở các câu gần nhất`,
      value: summary.accuracy === null ? "chưa có câu nào" : `${Math.round(summary.accuracy * 100)}% (${summary.answers} câu)`,
      done: summary.accuracy !== null && summary.accuracy >= MASTERY_ACCURACY && summary.answers >= 10,
    },
    {
      label: `Đạt ở ${MASTERY_MIN_DAYS} ngày khác nhau`,
      value: `${Math.min(summary.goodDays, MASTERY_MIN_DAYS)}/${MASTERY_MIN_DAYS} ngày`,
      done: summary.goodDays >= MASTERY_MIN_DAYS,
    },
    {
      label: "Đã nghe hoặc đọc các từ mẫu",
      value: `${Math.min(summary.wordsMet, summary.wordsTarget)}/${summary.wordsTarget} từ`,
      done: summary.wordsMet >= summary.wordsTarget,
    },
  ];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Độ thành thạo</span>
        <span className="font-bold text-slate-800 dark:text-zinc-200">
          {MASTERY_LABEL[summary.level]} · {summary.percent}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${MASTERY_BAR[summary.level]}`} style={{ width: `${summary.percent}%` }} />
      </div>
      <ul className="space-y-1 text-xs text-slate-600 dark:text-zinc-400">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className={r.done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>{r.done ? "✓" : "○"}</span>
              {r.label}
            </span>
            <span className="font-medium text-slate-800 dark:text-zinc-200 shrink-0">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small round button that speaks `text` (slow with `slow`) */
function PlayButton({ text, slow, title, className = "" }: { text: string; slow?: boolean; title?: string; className?: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleSpeak(text, slow ? SLOW_RATE : undefined);
      }}
      title={title ?? (slow ? "Nghe chậm" : "Nghe")}
      className={`p-2 rounded-lg shrink-0 ${
        slow
          ? "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          : "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50"
      } ${className}`}
    >
      {slow ? <Snail className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}

/** One word with its IPA: the whole tile plays it, the snail plays it slowly */
function SoundItem({ item }: { item: PronunciationItem }) {
  return (
    <div className="flex items-stretch rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:border-violet-300 dark:hover:border-violet-700">
      <button
        onClick={() => handleSpeak(item.text)}
        title="Nghe"
        className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-left hover:bg-violet-50/60 dark:hover:bg-violet-950/20"
      >
        <Volume2 className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900 dark:text-white">{item.text}</span>
          <span className="block text-sm font-mono text-slate-500 dark:text-zinc-400">{item.ipa}</span>
          {item.note && <span className="block text-xs text-slate-500 dark:text-zinc-400">{item.note}</span>}
        </span>
      </button>
      <button
        onClick={() => handleSpeak(item.text, SLOW_RATE)}
        title="Nghe chậm"
        className="px-2.5 border-l border-slate-100 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
      >
        <Snail className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Step 1: the theory folded to two lines, then the examples and minimal pairs to listen to */
function LearnStep({ lesson, onNext, onQuiz }: { lesson: PronunciationLesson; onNext: () => void; onQuiz: () => void }) {
  const [theoryOpen, setTheoryOpen] = useState(false);
  useShortcuts((e) => {
    if (e.key === "Enter") {
      onNext();
      return true;
    }
  });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
        <button
          onClick={() => setTheoryOpen((o) => !o)}
          aria-expanded={theoryOpen}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-amber-800 dark:text-amber-300"
        >
          <Lightbulb className="w-4 h-4 shrink-0" />
          <span className="flex-1">Giải thích và cách phát âm</span>
          <span className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80">{theoryOpen ? "Thu gọn" : "Đọc đầy đủ"}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${theoryOpen ? "rotate-180" : ""}`} />
        </button>
        <div className="px-4 pb-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          {theoryOpen ? (
            <>
              {lesson.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <ul className="list-disc pl-5 space-y-1 pt-1">
                {lesson.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="line-clamp-2">{lesson.intro[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Bấm vào từ để nghe</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
          {lesson.examples.map((item) => (
            <SoundItem key={item.text} item={item} />
          ))}
        </div>
      </div>

      {lesson.pairs && lesson.pairs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Cặp dễ nhầm: nghe sự khác nhau</p>
          <div className="grid gap-2 min-[1000px]:grid-cols-2">
            {lesson.pairs.map((pair) => (
              <div key={`${pair.a.text}-${pair.b.text}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                <SoundItem item={pair.a} />
                <span className="text-xs text-slate-400">vs</span>
                <SoundItem item={pair.b} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button onClick={onQuiz} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800">
          Làm bài nghe ngay
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
        >
          Tiếp: Đọc to theo <ArrowRight className="w-4 h-4" /> <Kbd>Enter</Kbd>
        </button>
      </div>
    </div>
  );
}


/** Step 2: listen, say it aloud, rate yourself: never graded, each word logged as a "say_aloud" event */
function SayAloud({
  lessonId,
  lesson,
  items,
  onQuiz,
}: {
  lessonId: string;
  lesson: PronunciationLesson;
  items: PronunciationItem[];
  onQuiz: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const total = items.length;
  const finished = index >= total;
  const item = finished ? undefined : items[index];

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => handleSpeak(item.text), AUTO_SPEAK_DELAY_MS);
    return () => clearTimeout(t);
  }, [item, round]);

  const rate = (ok: boolean) => {
    if (!item) return;
    recordSayAloud(lessonId, item.text, ok);
    if (ok) setOkCount((n) => n + 1);
    setIndex((i) => i + 1);
  };
  const again = () => {
    setIndex(0);
    setOkCount(0);
    setRound((r) => r + 1);
  };

  useShortcuts((e) => {
    if (finished) {
      if (e.key === "Enter") onQuiz();
      else if (e.key.toLowerCase() === "r") again();
      else return false;
      return true;
    }
    if (!item) return false;
    const k = e.key.toLowerCase();
    if (e.key === " ") handleSpeak(item.text);
    else if (k === "s") handleSpeak(item.text, SLOW_RATE);
    else if (e.key === "1" || e.key === "Enter") rate(true);
    else if (e.key === "2") rate(false);
    else return false;
    return true;
  });

  if (total === 0) return null;

  if (finished) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 space-y-3 text-center">
        <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
          Đã đọc to {total} từ, tự chấm đọc được {okCount}/{total} 👏
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400">Giờ kiểm tra tai bằng bài nghe nhé.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={again} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 text-sm inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
            <RotateCcw className="w-4 h-4" /> Đọc lại vòng nữa <Kbd>R</Kbd>
          </button>
          <button onClick={onQuiz} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
            Làm bài nghe <ArrowRight className="w-4 h-4" /> <Kbd>Enter</Kbd>
          </button>
        </div>
      </div>
    );
  }
  if (!item) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
            <Mic className="w-4 h-4" /> Nghe rồi đọc to thành tiếng
          </span>
          <span>
            Từ {index + 1}/{total}
          </span>
        </div>
        <ProgressBar value={index / total} tone="emerald" />
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{item.text}</div>
          <div className="text-base font-mono text-slate-500 dark:text-zinc-400">{item.ipa}</div>
          {item.note && <div className="text-xs text-slate-500 dark:text-zinc-400">{item.note}</div>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleSpeak(item.text)}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4" /> Nghe <Kbd>Space</Kbd>
            </button>
            <button
              onClick={() => handleSpeak(item.text, SLOW_RATE)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-200"
            >
              <Snail className="w-4 h-4" /> Chậm <Kbd>S</Kbd>
            </button>
          </div>
          <MicCheck lesson={lesson} item={item} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => rate(true)}
            className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Mình đọc được <Kbd>1</Kbd>
          </button>
          <button
            onClick={() => rate(false)}
            className="py-3 rounded-xl border-2 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            Chưa chắc, từ khác <Kbd>2</Kbd>
          </button>
        </div>
      </div>
      <p className="text-xs text-center text-slate-500 dark:text-zinc-400">
        Nghe 2 lần, đọc to (không đọc thầm), rồi tự so với tiếng máy. Phần này không chấm điểm.
      </p>
    </div>
  );
}

/** Plain lowercase words can be played back after answering, to hear the contrast (not "/t/" or "COM-pu-ter") */
const SPEAKABLE = /^[a-z]+$/;

/** Step 3: the graded listening quiz. Saved with recordPronunciationQuiz once the last question is answered */
function Quiz({
  lesson,
  nextLesson,
  onOpenNext,
  onReview,
  onBack,
}: {
  lesson: PronunciationLesson;
  nextLesson: () => PronunciationLesson | null;
  onOpenNext: (id: string) => void;
  onReview: () => void;
  onBack: () => void;
}) {
  const total = lesson.quiz.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<PronunciationQuizItem[]>([]);
  const [result, setResult] = useState<{ correct: number; passed: boolean; next: PronunciationLesson | null } | null>(null);
  const q = result ? undefined : lesson.quiz[index];

  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => handleSpeak(q.say), AUTO_SPEAK_DELAY_MS);
    return () => clearTimeout(t);
  }, [q]);

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setWrong([]);
    setResult(null);
  };

  const choose = (opt: string) => {
    if (!q || picked) return;
    setPicked(opt);
    if (opt === q.answer) setCorrect((n) => n + 1);
    else setWrong((w) => [...w, q]);
  };
  const next = () => {
    if (!picked) return;
    if (index + 1 >= total) {
      const passed = recordPronunciationQuiz(lesson.id, correct, total, new Date(), lesson.quiz.map((x) => x.say));
      setResult({ correct, passed, next: passed ? nextLesson() : null });
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  };

  const primary = () => {
    if (!result) return;
    if (result.next) onOpenNext(result.next.id);
    else if (result.passed) onBack();
    else restart();
  };

  useShortcuts((e) => {
    if (result) {
      if (e.key === "Enter") primary();
      else if (e.key.toLowerCase() === "r") restart();
      else return false;
      return true;
    }
    if (!q) return false;
    const k = e.key.toLowerCase();
    if (e.key === " ") handleSpeak(q.say);
    else if (k === "s") handleSpeak(q.say, SLOW_RATE);
    else if (e.key === "Enter" && picked) next();
    else if (!picked && /^[1-9]$/.test(e.key) && Number(e.key) <= q.options.length) choose(q.options[Number(e.key) - 1]);
    else return false;
    return true;
  });

  if (result) {
    const pct = Math.round((result.correct * 100) / total);
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className={`text-4xl font-bold ${result.passed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-zinc-100"}`}>
            {result.correct}/{total}
          </div>
          {result.passed ? (
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">Hoàn thành bài! 🎉 ({pct}%)</p>
          ) : (
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              Cần đúng {passMark(total)}/{total} để xong bài. Nghe lại các câu sai vài lần rồi thử lại nhé, tai sẽ quen dần.
            </p>
          )}
        </div>
        <ProgressBar value={result.correct / total} tone={result.passed ? "emerald" : "violet"} />
        {wrong.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Câu sai: nghe lại</p>
            {wrong.map((w, i) => (
              <div key={`${w.say}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 px-3 py-1.5">
                <PlayButton text={w.say} />
                <PlayButton text={w.say} slow />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{w.say}</span>
                {w.answer !== w.say && <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">→ {w.answer}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {result.next ? (
            <button onClick={primary} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
              Bài tiếp: {result.next.title} <ArrowRight className="w-4 h-4" /> <Kbd>Enter</Kbd>
            </button>
          ) : result.passed ? (
            <button onClick={onBack} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
              Về danh sách bài <Kbd>Enter</Kbd>
            </button>
          ) : (
            <button onClick={restart} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Làm lại <Kbd>Enter</Kbd>
            </button>
          )}
          {(result.passed || result.next) && (
            <button onClick={restart} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 text-sm inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
              <RotateCcw className="w-4 h-4" /> Làm lại <Kbd>R</Kbd>
            </button>
          )}
          {!result.passed && (
            <button onClick={onReview} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 text-sm inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
              <BookOpen className="w-4 h-4" /> Nghe lại từ mẫu
            </button>
          )}
          {result.next && (
            <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800">
              Danh sách bài
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!q) return null;

  const answeredRight = picked !== null && picked === q.answer;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300">
            <Ear className="w-4 h-4" /> Nghe và chọn
          </span>
          <span>
            Câu {index + 1}/{total} · đúng {correct}
          </span>
        </div>
        <ProgressBar value={(index + (picked ? 1 : 0)) / total} />
        <div className="flex flex-col items-center gap-3 py-1">
          <div className="flex gap-2">
            <button
              onClick={() => handleSpeak(q.say)}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Volume2 className="w-5 h-5" /> Nghe lại <Kbd>Space</Kbd>
            </button>
            <button
              onClick={() => handleSpeak(q.say, SLOW_RATE)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-200"
            >
              <Snail className="w-4 h-4" /> Chậm <Kbd>S</Kbd>
            </button>
          </div>
          <p className="text-base font-medium text-center text-slate-800 dark:text-zinc-200">{q.question}</p>
        </div>
        <div className={`grid grid-cols-1 gap-2 ${q.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {q.options.map((opt, i) => {
            const isAnswer = opt === q.answer;
            const style = !picked
              ? "border-slate-200 dark:border-zinc-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
              : isAnswer
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                : opt === picked
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                  : "border-slate-200 dark:border-zinc-800 opacity-50";
            return (
              <div key={opt} className="relative">
                <button
                  onClick={() => choose(opt)}
                  disabled={!!picked}
                  className={`w-full min-h-[3.5rem] px-3 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-white disabled:cursor-default ${style}`}
                >
                  <span className="absolute left-2.5 top-2.5">
                    {picked && isAnswer ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : picked && opt === picked ? (
                      <X className="w-4 h-4 text-rose-500" />
                    ) : (
                      <Kbd>{i + 1}</Kbd>
                    )}
                  </span>
                  {opt}
                </button>
                {picked && SPEAKABLE.test(opt) && <PlayButton text={opt} title={`Nghe "${opt}"`} className="absolute right-1.5 top-1/2 -translate-y-1/2" />}
              </div>
            );
          })}
        </div>
        {picked && (
          <div
            className={`rounded-xl px-4 py-3 space-y-2 ${
              answeredRight ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/20"
            }`}
          >
            <p className={`text-sm ${answeredRight ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
              <span className="font-bold">{answeredRight ? "Đúng rồi! " : `Chưa đúng. Đáp án: ${q.answer}. `}</span>
              {q.explanation}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
                Từ vừa nghe: <span className="font-semibold text-slate-900 dark:text-white">{q.say}</span>
                <PlayButton text={q.say} className="!p-1" />
              </span>
              <button
                onClick={next}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                {index + 1 >= total ? "Xem kết quả" : "Câu tiếp"} <Kbd>Enter</Kbd>
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="desktop-only text-xs text-center text-slate-500 dark:text-zinc-400">
        Phím tắt:<Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> chọn · <Kbd>Space</Kbd> nghe lại · <Kbd>S</Kbd> nghe chậm · <Kbd>Enter</Kbd> câu tiếp. Đúng{" "}
        {passMark(total)}/{total} câu là xong bài.
      </p>
    </div>
  );
}

const STEPS: { id: Step; label: string; icon: typeof Ear }[] = [
  { id: "learn", label: "Nghe mẫu", icon: Volume2 },
  { id: "say", label: "Đọc to", icon: Mic },
  { id: "quiz", label: "Bài nghe", icon: Ear },
];

function LessonView({
  lesson,
  number,
  count,
  progress,
  masteryEntry,
  initialStep,
  nextLesson,
  onOpen,
  onBack,
  backLabel,
  unit,
}: {
  lesson: PronunciationLesson;
  number: number;
  count: number;
  progress: PronunciationLessonProgress | undefined;
  masteryEntry: MasteryEntry | undefined;
  initialStep: Step;
  nextLesson: () => PronunciationLesson | null;
  onOpen: (id: string, step: Step) => void;
  onBack: () => void;
  /** Where "back" goes: "Danh sách bài" or "Bảng 44 âm" */
  backLabel: string;
  /** "Bài" or "Âm" */
  unit: string;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const passed = isLessonPassed(progress);
  const mastery = summarizeMastery(masteryEntry, lesson.examples.length);
  const sayItems = dedupeByText([...lesson.examples, ...(lesson.pairs ?? []).flatMap((p) => [p.a, p.b])]);
  useShortcuts((e) => {
    if (e.key === "Escape") {
      onBack();
      return true;
    }
  });
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </button>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            {unit} {number}/{count}
            {passed ? " · đã xong ✓" : progress ? ` · tốt nhất ${progress.best}/${progress.total}` : ""}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{lesson.title}</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{lesson.tagline}</p>
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/70">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={active}
                onClick={() => setStep(s.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] ${
                    active ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300"
                  }`}
                >
                  {s.id === "quiz" && passed ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <Icon className="w-4 h-4 hidden sm:block" />
                <span className="truncate">
                  {s.label}
                  {s.id === "quiz" && <span className="hidden min-[1000px]:inline font-normal text-xs opacity-70"> · {lesson.quiz.length} câu</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {step === "learn" && mastery.level !== "new" && <MasteryPanel summary={mastery} />}
      {step === "learn" && <LearnStep lesson={lesson} onNext={() => setStep("say")} onQuiz={() => setStep("quiz")} />}
      {step === "say" && <SayAloud lessonId={lesson.id} lesson={lesson} items={sayItems} onQuiz={() => setStep("quiz")} />}
      {step === "quiz" && (
        <Quiz lesson={lesson} nextLesson={nextLesson} onOpenNext={(id) => onOpen(id, "learn")} onReview={() => setStep("learn")} onBack={onBack} />
      )}
    </div>
  );
}

function dedupeByText(items: PronunciationItem[]): PronunciationItem[] {
  const seen = new Set<string>();
  return items.filter((it) => !seen.has(it.text) && (seen.add(it.text), true));
}

/** Status of one lesson in the list */
function lessonStatus(p: PronunciationLessonProgress | undefined, isNext: boolean): { label: string; tone: "done" | "next" | "tried" | "new" } {
  if (isLessonPassed(p)) return { label: `Xong · ${p!.best}/${p!.total}`, tone: "done" };
  if (p) return { label: `Tốt nhất ${p.best}/${p.total} · cần ${passMark(p.total)}`, tone: isNext ? "next" : "tried" };
  return { label: isNext ? "Học tiếp bài này" : "Chưa học", tone: isNext ? "next" : "new" };
}

/** The IPA chart: the 44 sounds in three groups; a sound opens its practice lesson */
function IpaChart({
  chart,
  progress,
  mastery,
  wordCounts,
  nextSound,
  onOpen,
}: {
  chart: PhonemeChartGroup[];
  progress: PronunciationProgress;
  mastery: Record<string, MasteryEntry>;
  /** Words each sound lesson teaches, by lesson id */
  wordCounts: Record<string, number>;
  nextSound: PronunciationLesson | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {nextSound && (
        <button
          onClick={() => onOpen(nextSound.id)}
          className="w-full text-left rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-zinc-900 p-4 flex items-center gap-3 hover:border-violet-400"
        >
          <span className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center text-lg font-bold font-mono shrink-0">
            {nextSound.title.match(/\/(.+?)\//)?.[1]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Âm tiếp theo</span>
            <span className="block text-base font-bold text-slate-900 dark:text-white truncate">{nextSound.title}</span>
          </span>
          <ArrowRight className="w-5 h-5 text-violet-500 shrink-0" />
        </button>
      )}
      {chart.map((group) => (
        <div key={group.kind} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {group.label} · {group.entries.length}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
            {group.entries.map((e) => {
              const p = progress[e.lessonId];
              const done = isLessonPassed(p);
              const m = summarizeMastery(mastery[e.lessonId], wordCounts[e.lessonId] ?? 6);
              return (
                <button
                  key={e.lessonId}
                  onClick={() => onOpen(e.lessonId)}
                  title={`Luyện âm /${e.sym}/ như trong "${e.key}"${done ? " (đã xong)" : p ? ` (tốt nhất ${p.best}/${p.total})` : ""} · ${masteryHint(m)}`}
                  className={`relative rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    done
                      ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:border-emerald-500"
                      : p
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:border-amber-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-violet-400 dark:hover:border-violet-600"
                  }`}
                >
                  {done && <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  <span className="block text-2xl font-mono font-bold text-slate-900 dark:text-white leading-tight">{e.sym}</span>
                  <span className="block text-xs text-slate-500 dark:text-zinc-400 truncate">{e.key}</span>
                  <MasteryBar summary={m} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500 dark:text-zinc-400">
        Bảng theo chuẩn 44 âm. Chạm vào một âm để nghe mẫu, đọc to, đọc thử cho máy nghe (Android) và làm bài nghe. Giọng đọc của app là giọng Mỹ nên một vài âm (/ɒ/, /əʊ/, /ɪə/, /eə/, /ʊə/) nghe hơi khác ký hiệu; bài học có ghi chú.
      </p>
    </div>
  );
}

/** Pronunciation: the 44-sound IPA chart and the topic lessons (sounds Vietnamese speakers miss, endings, stress, IT words) */
export default function PronunciationTab({ resetKey }: { resetKey?: number }) {
  const [lessons, setLessons] = useState<PronunciationLesson[]>([]);
  const [phonemes, setPhonemes] = useState<PronunciationLesson[]>([]);
  const [chart, setChart] = useState<PhonemeChartGroup[]>([]);
  const [view, setView] = useState<"chart" | "topics">("chart");
  const [progress, setProgress] = useState<PronunciationProgress>(getPronunciationProgress);
  const [open, setOpen] = useState<{ id: string; step: Step; n: number; session: boolean; intro?: boolean } | null>(null);

  // Confusable Phoneme discrimination challenge state
  const [phonemeSession, setPhonemeSession] = useState<PhonemeChallengeSession | null>(null);
  const [showPhonemeModal, setShowPhonemeModal] = useState(false);

  useEffect(() => {
    getWordsLite()
      .then((words) => {
        // Only offered when a recently learned word has one of the two sounds: with none, the pair would be arbitrary
        const session = buildPhonemeChallenge(words);
        setPhonemeSession(session.userWordsA.length + session.userWordsB.length > 0 ? session : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOpen(null);
  }, [resetKey]);

  useEffect(() => {
    loadPronunciationLessons().then(setLessons).catch(() => setLessons([]));
    loadPhonemeLessons()
      .then((p) => {
        setPhonemes(p.lessons);
        setChart(p.chart);
      })
      .catch(() => {
        setPhonemes([]);
        setChart([]);
      });
  }, []);
  const [mastery, setMastery] = useState(getMastery);
  const wordCounts = useMemo(() => Object.fromEntries(phonemes.map((l) => [l.id, l.examples.length])), [phonemes]);
  const refresh = useCallback(() => {
    setProgress(getPronunciationProgress());
    setMastery(getMastery());
  }, []);
  useEffect(() => {
    window.addEventListener("myenglish-pronunciation-updated", refresh);
    return () => window.removeEventListener("myenglish-pronunciation-updated", refresh);
  }, [refresh]);

  const openLesson = useCallback(
    (id: string, step: Step, session = false, intro = false) => setOpen((o) => ({ id, step, session, intro, n: (o?.n ?? 0) + 1 })),
    []
  );
  // A lesson belongs to one of two series (the 44 sounds, the topics): "next" and the numbering stay inside it
  const seriesOf = useCallback((id: string) => (phonemes.some((p) => p.id === id) ? phonemes : lessons), [phonemes, lessons]);
  const nextLesson = useCallback(
    () => nextPronunciationLesson(open ? seriesOf(open.id) : lessons, getPronunciationProgress()),
    [open, seriesOf, lessons]
  );
  const next = nextPronunciationLesson(lessons, progress);
  const nextSound = nextPronunciationLesson(phonemes, progress);
  const nextProgress = next ? progress[next.id] : undefined;
  // Enter on the topic list starts the lesson shown at the top
  useShortcuts((e) => {
    if (open || view !== "topics" || !next || e.key !== "Enter") return false;
    openLesson(next.id, nextProgress ? "quiz" : "learn");
    return true;
  });

  if (showPhonemeModal && phonemeSession) {
    return (
      <div className={PAGE_CONTAINER}>
        <SoundSession
          key={phonemeSession.pair.id}
          lesson={lessonFromPair(phonemeSession.pair)}
          pair={phonemeSession.pair}
          onBack={() => setShowPhonemeModal(false)}
        />
      </div>
    );
  }

  const openSeries = open ? seriesOf(open.id) : lessons;
  const openIndex = open ? openSeries.findIndex((l) => l.id === open.id) : -1;
  if (open && openIndex >= 0) {
    const lesson = openSeries[openIndex];
    const isSound = openSeries === phonemes;
    if (isSound && open.intro) {
      return (
        <div className={PAGE_CONTAINER}>
          <SoundIntro
            key={`${lesson.id}-${open.n}`}
            lesson={lesson}
            onPractice={() => openLesson(lesson.id, "learn", true)}
            onFree={() => openLesson(lesson.id, "learn")}
            onBack={() => setOpen(null)}
          />
        </div>
      );
    }
    if (isSound && open.session) {
      return (
        <div className={PAGE_CONTAINER}>
          <SoundSession
            key={`${lesson.id}-${open.n}`}
            lesson={lesson}
            nextLesson={nextLesson()}
            onNext={(id) => openLesson(id, "learn", true)}
            onBack={() => setOpen(null)}
            onFree={() => openLesson(lesson.id, "learn")}
          />
        </div>
      );
    }
    return (
      <div className={PAGE_CONTAINER}>
        <LessonView
          key={`${lesson.id}-${open.n}`}
          lesson={lesson}
          number={openIndex + 1}
          count={openSeries.length}
          progress={progress[lesson.id]}
          masteryEntry={mastery[lesson.id]}
          initialStep={open.step}
          nextLesson={nextLesson}
          onOpen={openLesson}
          onBack={() => setOpen(null)}
          backLabel={isSound ? "Bảng 44 âm" : "Danh sách bài"}
          unit={isSound ? "Âm" : "Bài"}
        />
      </div>
    );
  }

  const soundsPassed = phonemes.filter((l) => isLessonPassed(progress[l.id])).length;

  const nextIndex = next ? lessons.indexOf(next) : -1;
  const passedCount = lessons.filter((l) => isLessonPassed(progress[l.id])).length;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Phát âm</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Mỗi bài ~5 phút: nghe mẫu → đọc to → bài nghe. Đúng {Math.round(PRONUNCIATION_PASS_RATIO * 100)}% là xong bài.
            </p>
          </div>
          {(view === "chart" ? phonemes.length : lessons.length) > 0 && (
            <div className="w-40 space-y-1">
              <div className="text-xs min-[1000px]:text-right text-slate-500 dark:text-zinc-400">
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{view === "chart" ? soundsPassed : passedCount}</span>/
                {view === "chart" ? phonemes.length : lessons.length} {view === "chart" ? "âm xong" : "bài xong"}
              </div>
              <ProgressBar
                value={view === "chart" ? soundsPassed / phonemes.length : passedCount / lessons.length}
                tone="emerald"
              />
            </div>
          )}
        </div>

        {/* Dynamic Confusable Phoneme Challenge Card */}
        {phonemeSession && (
          <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-zinc-900 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                ⚡
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    Cặp âm dễ nhầm
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-zinc-400">
                    /{phonemeSession.pair.symA}/ vs /{phonemeSession.pair.symB}/
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  {phonemeSession.pair.title}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowPhonemeModal(true)}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold shadow-md inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Ear className="w-4 h-4" />
              Luyện phân biệt ngay
            </button>
          </div>
        )}

        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/70">
          {(
            [
              ["chart", "Bảng 44 âm"],
              ["topics", "Bài theo chủ đề"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`py-2 px-2 rounded-lg text-sm font-semibold transition-colors ${
                view === id
                  ? "bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "chart" ? (
          chart.length > 0 && <IpaChart chart={chart} progress={progress} mastery={mastery} wordCounts={wordCounts} nextSound={nextSound} onOpen={(id) => openLesson(id, "learn", false, true)} />
        ) : next ? (
          <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-zinc-900 p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center text-lg font-bold shrink-0">{nextIndex + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  {nextProgress ? "Đang học dở" : passedCount === 0 ? "Bắt đầu từ đây" : "Bài tiếp theo"}
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{next.title}</div>
                <div className="text-sm text-slate-600 dark:text-zinc-400">{next.tagline}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 pt-1">
                  {next.examples.length} từ mẫu · {next.quiz.length} câu nghe
                  {nextProgress ? ` · tốt nhất ${nextProgress.best}/${nextProgress.total}, cần ${passMark(nextProgress.total)}` : ""}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextProgress ? (
                <>
                  <button
                    onClick={() => openLesson(next.id, "quiz")}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold inline-flex items-center gap-1.5"
                  >
                    <Ear className="w-4 h-4" /> Làm lại bài nghe ({next.quiz.length} câu) <Kbd>Enter</Kbd>
                  </button>
                  <button
                    onClick={() => openLesson(next.id, "learn")}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 text-sm font-semibold text-slate-700 dark:text-zinc-200"
                  >
                    Nghe lại từ mẫu
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openLesson(next.id, "learn")}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold inline-flex items-center gap-1.5"
                  >
                    Bắt đầu luyện <ArrowRight className="w-4 h-4" /> <Kbd>Enter</Kbd>
                  </button>
                  <button
                    onClick={() => openLesson(next.id, "quiz")}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 text-sm font-semibold text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1.5"
                  >
                    <Ear className="w-4 h-4" /> Làm bài nghe ngay
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          lessons.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Xong cả {lessons.length} bài! 🎉 Thỉnh thoảng làm lại một bài nghe để giữ tai quen.
              </p>
            </div>
          )
        )}

        {view === "topics" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Tất cả bài</p>
          <div className="grid gap-2 min-[1000px]:grid-cols-2">
            {lessons.map((l, i) => {
              const status = lessonStatus(progress[l.id], l.id === next?.id);
              const badge =
                status.tone === "done"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  : status.tone === "next"
                    ? "bg-violet-600 text-white"
                    : status.tone === "tried"
                      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400";
              const statusText =
                status.tone === "done"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : status.tone === "next"
                    ? "text-violet-700 dark:text-violet-300"
                    : status.tone === "tried"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-500 dark:text-zinc-400";
              return (
                <button
                  key={l.id}
                  onClick={() => openLesson(l.id, "learn")}
                  title={l.tagline}
                  className={`group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-white dark:bg-zinc-900 hover:border-violet-300 dark:hover:border-violet-700 ${
                    status.tone === "next" ? "border-violet-300 dark:border-violet-800" : "border-slate-200 dark:border-zinc-800"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${badge}`}>
                    {status.tone === "done" ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{l.title}</span>
                    <span className={`block text-xs ${statusText}`}>{status.label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-zinc-600 group-hover:text-violet-500" />
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
