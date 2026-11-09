import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Lightbulb, Snail, Sparkles, Volume2, X } from "lucide-react";
import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { CONFUSABLE_PHONEME_PAIRS, type ConfusablePhonemePair } from "@/services/phonemeMatcher";
import { recordPronunciationQuiz, recordSayAloud } from "@/services/pronunciation";
import { getMastery, lessonIdsForSounds, recordMasteryAnswers, summarizeMastery } from "@/services/pronunciationMastery";
import { shuffle } from "@/lib/utils";
import { playSound } from "@/services/sound";
import { handleSpeak, SLOW_RATE, AUTO_SPEAK_DELAY_MS } from "../review/speech";
import { MicCheck } from "./PronunciationMicCheck";
import { PracticeTop } from "../talk/MicButton";
import { asrAvailable, canCheck } from "@/services/pronunciationCheck";
import { getTeacherGuide, getWordCollocation } from "@/services/pronunciationTips";

/**
 * One short practice session for a sound, one thing on screen at a time: 2 rounds of listening, 2 of saying
 * words aloud, 2 of telling this sound from the one it is confused with, 3 questions each (18 in all).
 * Listening and telling answers are what is saved as the quiz result; saying aloud is self-rated.
 */
const ROUND_SIZE = 3;

interface Choice {
  id: string;
  label: string;
}

type Task =
  | { kind: "listen"; say: string; choices: Choice[]; answer: string; explanation: string }
  | { kind: "say"; item: PronunciationItem }
  | { kind: "tell"; say: string; choices: Choice[]; answer: string; explanation: string };

interface Round {
  title: string;
  prompt: string;
  tasks: Task[];
}

/** `n` items, repeating the list when it is shorter */
function take<T>(list: T[], n: number): T[] {
  if (list.length === 0) return [];
  return Array.from({ length: n }, (_, i) => list[i % list.length]);
}

/** A lesson-shaped stand-in for a pair of sounds, so the same session (and the microphone check) can run on it */
export function lessonFromPair(pair: ConfusablePhonemePair): PronunciationLesson {
  const items = pair.defaultPairs.flatMap((p) => [
    { text: p.wordA, ipa: p.ipaA, note: p.meaningA },
    { text: p.wordB, ipa: p.ipaB, note: p.meaningB },
  ]);
  return {
    id: pair.id,
    order: 0,
    title: `Cặp /${pair.symA}/ và /${pair.symB}/`,
    tagline: pair.differenceTip,
    intro: [pair.vietnamesePitfall],
    tips: [`${pair.nameA}: ${pair.mouthTipA}`, `${pair.nameB}: ${pair.mouthTipB}`],
    examples: items,
    pairs: pair.defaultPairs.map((p) => ({ a: { text: p.wordA, ipa: p.ipaA, note: p.meaningA }, b: { text: p.wordB, ipa: p.ipaB, note: p.meaningB } })),
    quiz: [],
  };
}

function buildRounds(lesson: PronunciationLesson, pair?: ConfusablePhonemePair): Round[] {
  const sym = lesson.title.match(/\/(.+?)\//)?.[1] ?? "";
  const need = ROUND_SIZE;

  // For a pair of sounds the listening questions are its minimal pairs: which of the two words was said
  const listen: Task[] = pair
    ? take(
        shuffle(
          pair.defaultPairs.flatMap((p) => [
            { say: p.wordA, other: p.wordB },
            { say: p.wordB, other: p.wordA },
          ])
        ),
        need
      ).map((q) => ({
        kind: "listen",
        say: q.say,
        choices: shuffle([{ id: q.say, label: q.say }, { id: q.other, label: q.other }]),
        answer: q.say,
        explanation: `Bạn vừa nghe "${q.say}", không phải "${q.other}".`,
      }))
    : take(shuffle(lesson.quiz), need).map((q) => ({
        kind: "listen",
        say: q.say,
        choices: q.options.map((o) => ({ id: o, label: o })),
        answer: q.answer,
        explanation: q.explanation,
      }));

  const say: Task[] = take(pair ? shuffle(lesson.examples) : lesson.examples, need).map((item) => ({ kind: "say", item }));

  const tell: Task[] = [];
  const partner = pair ?? CONFUSABLE_PHONEME_PAIRS.find((p) => p.symA === sym || p.symB === sym);
  if (partner) {
    const mineIsA = pair ? true : partner.symA === sym;
    const candidates = partner.defaultPairs.flatMap((p) => [
      { word: p.wordA, side: "A" },
      { word: p.wordB, side: "B" },
    ]);
    const choices: Choice[] = [
      { id: "A", label: partner.nameA },
      { id: "B", label: partner.nameB },
    ];
    for (const c of take(shuffle(candidates), need)) {
      const own = (c.side === "A") === mineIsA;
      tell.push({
        kind: "tell",
        say: c.word,
        choices,
        answer: c.side,
        explanation: `"${c.word}" ${own ? "có" : "thuộc"} âm ${c.side === "A" ? partner.nameA : partner.nameB}.`,
      });
    }
  } else if (lesson.pairs && lesson.pairs.length > 0) {
    // No confusable partner: the minimal pairs say what the sound is NOT (ship has /ɪ/, sheep has /iː/)
    const candidates = lesson.pairs.flatMap((p) => [
      { word: p.a.text, has: true },
      { word: p.b.text, has: false },
    ]);
    const choices: Choice[] = [
      { id: "has", label: `Có âm /${sym}/` },
      { id: "not", label: `Không có âm /${sym}/` },
    ];
    for (const c of take(shuffle(candidates), need)) {
      tell.push({
        kind: "tell",
        say: c.word,
        choices,
        answer: c.has ? "has" : "not",
        explanation: `"${c.word}" ${c.has ? "có" : "không có"} âm /${sym}/.`,
      });
    }
  }

  const rounds: Array<[string, string, Task[]]> = [
    ["Nghe", "Luyện tai: Bạn nghe thấy từ/cụm nào?", listen],
    ["Đọc câu", "Đọc to theo cụm từ & câu thực tế", say],
    ["Phân biệt", "Phản xạ: Từ này thuộc về âm nào?", tell],
  ];
  return rounds.flatMap(([title, prompt, tasks]) => {
    const slice = tasks.slice(0, ROUND_SIZE);
    return slice.length > 0 ? [{ title, prompt, tasks: slice }] : [];
  });
}

export default function SoundSession({
  lesson,
  pair,
  nextLesson = null,
  onNext,
  onBack,
  onFree,
}: {
  lesson: PronunciationLesson;
  /** Practising two sounds together instead of one lesson */
  pair?: ConfusablePhonemePair;
  nextLesson?: PronunciationLesson | null;
  onNext?: (id: string) => void;
  onBack: () => void;
  /** The classic three steps (listen to the examples, say, quiz); a pair has none */
  onFree?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  // A new attempt draws new questions
  const rounds = useMemo(() => buildRounds(lesson, pair), [lesson, pair, attempt]);
  const flat = useMemo(() => rounds.flatMap((r, ri) => r.tasks.map((task, ti) => ({ task, round: r, ri, ti }))), [rounds]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const saved = useRef(false);
  const heard = useRef<string[]>([]);

  const finished = index >= flat.length;
  const current = finished ? undefined : flat[index];
  // What the top line calls the practice: one sound, or the two of a pair
  const sym = pair ? `${pair.symA}/ – /${pair.symB}` : (lesson.title.match(/\/(.+?)\//)?.[1] ?? "");
  const subject = pair ? "Cặp âm" : "Âm";
  const hasAsr = asrAvailable();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  useEffect(() => {
    if (!current) return;
    const textToSpeak =
      current.task.kind === "say"
        ? getWordCollocation(
            current.task.item.text,
            current.task.item.note,
            current.task.item.phrase,
            current.task.item.phraseVn
          ).phrase
        : current.task.say;
    const t = setTimeout(() => handleSpeak(textToSpeak), AUTO_SPEAK_DELAY_MS);
    return () => clearTimeout(t);
  }, [current]);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const advance = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const choose = (id: string) => {
    if (!current || picked !== null || current.task.kind === "say") return;
    setPicked(id);
    const ok = id === current.task.answer;
    playSound(ok ? "correct" : "wrong");
    setAnswered((n) => n + 1);
    if (ok) setCorrect((n) => n + 1);
    heard.current.push(current.task.say);

    // Auto advance: 750ms on correct, 1600ms on wrong (time to read explanation), or tap "Tiếp" immediately
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      advance();
    }, ok ? 750 : 1600);
  };

  const rateSaid = (ok: boolean) => {
    if (!current || current.task.kind !== "say") return;
    recordSayAloud(lesson.id, current.task.item.text, ok);
    heard.current.push(current.task.item.text);
    advance();
  };

  // Save once, when the last question is done
  useEffect(() => {
    if (!finished || saved.current || flat.length === 0) return;
    saved.current = true;
    if (answered > 0) {
      if (pair) {
        // A pair is practice for both of its sounds: their progress bars fill from it
        lessonIdsForSounds([pair.symA, pair.symB])
          .then((ids) => recordMasteryAnswers(ids, correct, answered, heard.current))
          .catch(() => {});
      } else {
        recordPronunciationQuiz(lesson.id, correct, answered, new Date(), heard.current);
      }
    }
    playSound("complete");
  }, [finished, flat.length, answered, correct, lesson.id, pair]);

  const restart = () => {
    saved.current = false;
    heard.current = [];
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setAnswered(0);
    setAttempt((a) => a + 1);
  };

  // The quiet top line of the session: back, what is practised, how far along; "Học tự do" on the right
  const top = (progress?: { label: ReactNode; count: ReactNode; percent: number }) => (
    <PracticeTop
      onBack={onBack}
      backLabel={pair ? "Quay lại" : "Bảng âm"}
      label={progress?.label ?? `${subject} /${sym}/`}
      count={progress?.count}
      percent={progress?.percent}
      right={
        onFree && (
          <button
            onClick={onFree}
            className="shrink-0 min-h-10 px-3 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Học tự do
          </button>
        )
      }
    />
  );
  const header = top();

  const currentTask = current?.task;

  // React Rules of Hooks: Hooks MUST be called unconditionally at the top level before any early returns
  const contrastPair = useMemo(() => {
    if (!currentTask || currentTask.kind !== "say") return null;
    const targetWord = currentTask.item.text.toLowerCase();
    if (pair) {
      const found = pair.defaultPairs.find(
        (p) => p.wordA.toLowerCase() === targetWord || p.wordB.toLowerCase() === targetWord
      );
      if (found) {
        const isA = found.wordA.toLowerCase() === targetWord;
        return {
          current: {
            word: isA ? found.wordA : found.wordB,
            ipa: isA ? found.ipaA : found.ipaB,
            meaning: isA ? found.meaningA : found.meaningB,
            label: isA ? pair.nameA : pair.nameB,
          },
          partner: {
            word: isA ? found.wordB : found.wordA,
            ipa: isA ? found.ipaB : found.ipaA,
            meaning: isA ? found.meaningB : found.meaningA,
            label: isA ? pair.nameB : pair.nameA,
          },
        };
      }
    }
    if (lesson.pairs && lesson.pairs.length > 0) {
      const found = lesson.pairs.find(
        (p) => p.a.text.toLowerCase() === targetWord || p.b.text.toLowerCase() === targetWord
      );
      if (found) {
        const isA = found.a.text.toLowerCase() === targetWord;
        return {
          current: {
            word: isA ? found.a.text : found.b.text,
            ipa: isA ? found.a.ipa : found.b.ipa,
            meaning: isA ? found.a.note : found.b.note,
            label: `/${sym}/`,
          },
          partner: {
            word: isA ? found.b.text : found.a.text,
            ipa: isA ? found.b.ipa : found.a.ipa,
            meaning: isA ? found.b.note : found.a.note,
            label: "Âm đối lập",
          },
        };
      }
    }
    return null;
  }, [currentTask, pair, lesson.pairs, sym]);

  const teacherGuide = useMemo(() => {
    if (!currentTask || currentTask.kind !== "say") return null;
    return getTeacherGuide(currentTask.item.text, currentTask.item.ipa, sym, pair);
  }, [currentTask, sym, pair]);

  const collocation = useMemo(() => {
    if (!currentTask || currentTask.kind !== "say") return null;
    return getWordCollocation(
      currentTask.item.text,
      currentTask.item.note,
      currentTask.item.phrase,
      currentTask.item.phraseVn
    );
  }, [currentTask]);

  const cardScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cardScrollRef.current) {
      cardScrollRef.current.scrollTop = 0;
    }
  }, [index]);

  if (flat.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col h-full min-h-0 justify-between gap-2 pb-2 overflow-hidden">
        <div className="shrink-0">{header}</div>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto py-4">
          <div className="my-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)] text-center">
            <p className="text-base text-slate-700 dark:text-zinc-300">Chưa có bài tập cho phần này.</p>
          </div>
        </div>
        <div className="shrink-0 min-h-[56px]" />
      </div>
    );
  }

  if (finished) {
    const summary = pair ? null : summarizeMastery(getMastery()[lesson.id], lesson.examples?.length ?? 0);
    return (
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col h-full min-h-0 justify-between gap-2 pb-2 overflow-hidden">
        <div className="shrink-0">
          {top({ label: `${subject} /${sym}/`, count: null, percent: 100 })}
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto py-4">
          <div className="my-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 text-center space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Xong {subject.toLowerCase()} /{sym}/</h2>
            {answered > 0 && (
              <p className="text-slate-700 dark:text-zinc-300">
                Đúng <span className="font-bold text-green-700 dark:text-green-300">{correct}/{answered}</span> câu
              </p>
            )}
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {summary?.level === "mastered" ? "Thành thạo ✓" : summary?.level === "learning" ? `Thành thạo ${summary.percent}%` : ""}
            </p>
          </div>
        </div>
        <div className="shrink-0 space-y-2">
          {nextLesson && onNext ? (
            <button onClick={() => onNext(nextLesson.id)} className="w-full min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-98">
              Âm tiếp theo
            </button>
          ) : (
            <button onClick={onBack} className="w-full min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-98">
              {pair ? "Xong" : "Về bảng âm"}
            </button>
          )}
          <button onClick={restart} className="w-full min-h-14 px-5 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 text-[17px] font-semibold inline-flex items-center justify-center gap-2 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-transform active:scale-98">
            Học lại {pair ? "cặp này" : "âm này"}
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;
  const { task, round, ri, ti } = current;
  const roundCount = rounds.filter((r) => r.title === round.title).length;
  const roundNo = rounds.slice(0, ri + 1).filter((r) => r.title === round.title).length;

  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col h-full min-h-0 justify-between gap-2 overflow-hidden">
      <div className="shrink-0">
        {top({
          label: (
            <>
              {subject} /{sym}/ · {round.title}
              {roundCount > 1 ? ` ${roundNo}` : ""}
            </>
          ),
          count: `${ti + 1}/${round.tasks.length}`,
          percent: (index / flat.length) * 100,
        })}
      </div>

      {/* Main Exercise Card: scrolls internally when content is tall, never overflowing or crushing bottom bar */}
      <div ref={cardScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden my-1 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-3.5">
        {index === 0 && lesson.tips[0] && (
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50">
            <button onClick={() => setTipOpen((o) => !o)} className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 dark:text-zinc-300">
              <Lightbulb className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
              <span className="flex-1">Mẹo phát âm</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${tipOpen ? "rotate-180" : ""}`} />
            </button>
            {tipOpen && (
              <div className="px-3 pb-3 space-y-1.5 text-sm text-slate-700 dark:text-zinc-300">
                {(pair ? lesson.tips : lesson.tips.slice(0, 1)).map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-center space-y-0.5">
          <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">{round.prompt}</p>
          {task.kind === "say" && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Nghe mẫu rồi nhại lại theo ngữ cảnh câu ngắn bên dưới
            </p>
          )}
        </div>

        {task.kind === "say" ? (
          <div className="space-y-3.5">
            {/* Hero Real-Context Phrase / Sentence Display */}
            {collocation && (
              <div className="rounded-2xl border-2 border-teal-500/40 dark:border-teal-500/30 bg-teal-50/60 dark:bg-teal-950/30 p-3.5 sm:p-4 space-y-2 text-center">
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 bg-white/80 dark:bg-teal-900/50 px-3 py-0.5 rounded-full">
                  💬 Câu / Cụm từ thực tế
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug break-words">
                  "{collocation.phrase}"
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300">
                  Nghĩa: <span className="font-medium italic">{collocation.translation}</span>
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSpeak(collocation.phrase)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-2xs"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Nghe cả câu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeak(collocation.phrase, SLOW_RATE)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition-all active:scale-95 border border-slate-200 dark:border-zinc-700 shadow-2xs"
                  >
                    <Snail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Nghe chậm câu</span>
                  </button>
                </div>
              </div>
            )}

            {/* Target Word & IPA Focus Pill */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 shrink-0">
                  Từ trọng tâm:
                </span>
                <span className="text-lg font-extrabold text-teal-800 dark:text-teal-300 truncate">
                  {task.item.text}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                  {task.item.ipa}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSpeak(task.item.text)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nghe từ</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeak(task.item.text, SLOW_RATE)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  title="Nghe chậm từ này"
                >
                  <Snail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </button>
              </div>
            </div>

            {/* Minimal Pair Ear Tuning Contrast Bar (So sánh đối chiếu liền tai) */}
            {contrastPair && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  <span>🎧 Luyện tai: So sánh 2 từ đối lập</span>
                  <span className="font-normal lowercase text-slate-400">chạm để nghe</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSpeak(contrastPair.current.word)}
                    className="p-2.5 rounded-xl border-2 border-teal-500/70 bg-white dark:bg-zinc-900 text-left hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-all flex flex-col justify-center shadow-2xs active:scale-98"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-slate-900 dark:text-zinc-100">{contrastPair.current.word}</span>
                      <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      <span className="font-mono text-teal-700 dark:text-teal-300 font-semibold">{contrastPair.current.ipa}</span>
                      {contrastPair.current.meaning && <span> · {contrastPair.current.meaning}</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeak(contrastPair.partner.word)}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all flex flex-col justify-center opacity-85 hover:opacity-100 shadow-2xs active:scale-98"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-slate-700 dark:text-zinc-200">{contrastPair.partner.word}</span>
                      <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      <span className="font-mono">{contrastPair.partner.ipa}</span>
                      {contrastPair.partner.meaning && <span> · {contrastPair.partner.meaning}</span>}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Teacher Pedagogical Guide Box (Mẹo cơ mặt & Phonics) */}
            {teacherGuide && (
              <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-2 text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Mẹo giáo viên · {teacherGuide.soundTitle}</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <p>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">👄 Khẩu hình: </span>
                    {teacherGuide.mouthAnchor}
                  </p>
                  {teacherGuide.phonicsRule && (
                    <p>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">🔤 Mẹo mặt chữ: </span>
                      {teacherGuide.phonicsRule}
                    </p>
                  )}
                  {teacherGuide.pitfall && (
                    <p className="text-amber-800 dark:text-amber-300/90">
                      <span className="font-bold">⚠️ Tránh nhầm: </span>
                      {teacherGuide.pitfall}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleSpeak(task.say)}
                className="w-20 h-20 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 flex items-center justify-center active:scale-95 transition-transform shadow-xs"
                aria-label="Nghe lại"
              >
                <Volume2 className="w-9 h-9" />
              </button>
            </div>
            <div className="space-y-2.5">
              {task.choices.map((c) => {
                const isAnswer = c.id === task.answer;
                const isPicked = picked === c.id;
                let style = "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 hover:border-teal-600/50";
                if (picked !== null) {
                  if (isAnswer) style = "border-green-500 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200";
                  else if (isPicked) style = "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200";
                  else style = "border-slate-200 dark:border-zinc-800 opacity-50 text-slate-500";
                }
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => choose(c.id)}
                    className={`w-full min-h-14 px-4 py-3 rounded-xl border-2 text-left text-lg font-semibold flex items-center justify-between transition-colors ${style}`}
                  >
                    <span>{c.label}</span>
                    {picked !== null && isAnswer && <Check className="w-5 h-5 shrink-0" />}
                    {picked !== null && isPicked && !isAnswer && <X className="w-5 h-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="min-h-[22px] flex items-center justify-center">
              {picked !== null && task.explanation && (
                <p className="text-sm text-center text-slate-500 dark:text-zinc-400 animate-in fade-in duration-150">
                  {task.explanation}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 min-h-[56px] flex flex-col justify-end pt-1 pb-1">
        {task.kind === "say" ? (
          hasAsr && canCheck(lesson, task.item.text) ? (
            <div className="space-y-1.5">
              <MicCheck lesson={lesson} item={task.item} phrase={collocation?.phrase} compact onPassed={() => rateSaid(true)} />
              <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                <span>🤫 Không tiện nói to?</span>
                <button
                  type="button"
                  onClick={() => rateSaid(true)}
                  className="font-semibold text-teal-700 dark:text-teal-400 underline underline-offset-2 hover:text-teal-800 dark:hover:text-teal-300"
                >
                  Tự nhẩm · Qua câu →
                </button>
                <span className="text-slate-300 dark:text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={() => rateSaid(false)}
                  className="font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
                >
                  Chưa chắc
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1.5">
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
                Hãy đọc to câu mẫu trên rồi đánh giá kết quả:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => rateSaid(true)}
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-teal-600/30 dark:border-teal-500/30 bg-teal-50/60 hover:bg-teal-100/70 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-300 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-98 shadow-2xs"
                >
                  <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Đã đọc chuẩn ✓</span>
                </button>
                <button
                  type="button"
                  onClick={() => rateSaid(false)}
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-98 shadow-2xs"
                >
                  <span>Chưa chắc</span>
                </button>
              </div>
            </div>
          )
        ) : picked !== null ? (
          <button
            type="button"
            onClick={advance}
            className="w-full min-h-12 px-5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-base font-semibold shadow-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-98"
          >
            <span>Câu tiếp theo →</span>
          </button>
        ) : (
          <div className="w-full min-h-12" />
        )}
      </div>
    </div>
  );
}
