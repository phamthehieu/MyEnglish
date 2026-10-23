import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Lightbulb, Mic, Volume2, X } from "lucide-react";
import type { PronunciationItem, PronunciationLesson } from "@/types/pronunciation";
import { CONFUSABLE_PHONEME_PAIRS, type ConfusablePhonemePair } from "@/services/phonemeMatcher";
import { recordPronunciationQuiz, recordSayAloud } from "@/services/pronunciation";
import { getMastery, lessonIdsForSounds, recordMasteryAnswers, summarizeMastery } from "@/services/pronunciationMastery";
import { shuffle } from "@/lib/utils";
import { playSound } from "@/services/sound";
import { handleSpeak, AUTO_SPEAK_DELAY_MS } from "../review/speech";
import { MicCheck } from "./PronunciationMicCheck";

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
    { text: p.wordA, ipa: p.ipaA },
    { text: p.wordB, ipa: p.ipaB },
  ]);
  return {
    id: pair.id,
    order: 0,
    title: `Cặp /${pair.symA}/ và /${pair.symB}/`,
    tagline: pair.differenceTip,
    intro: [pair.vietnamesePitfall],
    tips: [`${pair.nameA}: ${pair.mouthTipA}`, `${pair.nameB}: ${pair.mouthTipB}`],
    examples: items,
    pairs: pair.defaultPairs.map((p) => ({ a: { text: p.wordA, ipa: p.ipaA }, b: { text: p.wordB, ipa: p.ipaB } })),
    quiz: [],
  };
}

function buildRounds(lesson: PronunciationLesson, pair?: ConfusablePhonemePair): Round[] {
  const sym = lesson.title.match(/\/(.+?)\//)?.[1] ?? "";
  const need = ROUND_SIZE * 2;

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
    ["Nghe", "Bạn nghe thấy từ nào?", listen],
    ["Đọc", "Đọc to từ này", say],
    ["Phân biệt", "Từ này thuộc âm nào?", tell],
  ];
  return rounds.flatMap(([title, prompt, tasks]) =>
    [0, 1].flatMap((r) => {
      const slice = tasks.slice(r * ROUND_SIZE, (r + 1) * ROUND_SIZE);
      return slice.length > 0 ? [{ title, prompt, tasks: slice }] : [];
    })
  );
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

  useEffect(() => {
    if (!current) return;
    const word = current.task.kind === "say" ? current.task.item.text : current.task.say;
    const t = setTimeout(() => handleSpeak(word), AUTO_SPEAK_DELAY_MS);
    return () => clearTimeout(t);
  }, [current]);

  const advance = () => {
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
  };

  const rateSaid = (ok: boolean) => {
    if (!current || current.task.kind !== "say") return;
    recordSayAloud(lesson.id, current.task.item.text, ok);
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

  const header = (
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> {pair ? "Quay lại" : "Bảng âm"}
      </button>
      {onFree && (
        <button onClick={onFree} className="text-xs text-slate-500 dark:text-zinc-400 underline underline-offset-2">
          Học tự do
        </button>
      )}
    </div>
  );

  if (flat.length === 0) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        {header}
        <p className="text-sm text-slate-600 dark:text-zinc-400">Chưa có bài tập cho phần này.</p>
      </div>
    );
  }

  if (finished) {
    const summary = pair ? null : summarizeMastery(getMastery()[lesson.id], lesson.examples.length);
    return (
      <div className="max-w-md mx-auto space-y-6">
        {header}
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-8 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Xong {subject.toLowerCase()} /{sym}/</h2>
          {answered > 0 && (
            <p className="text-slate-600 dark:text-zinc-300">
              Đúng <span className="font-bold text-emerald-600 dark:text-emerald-400">{correct}/{answered}</span> câu
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {summary?.level === "mastered" ? "Thành thạo ✓" : summary?.level === "learning" ? `Thành thạo ${summary.percent}%` : ""}
          </p>
        </div>
        <div className="space-y-2">
          {nextLesson && onNext ? (
            <button onClick={() => onNext(nextLesson.id)} className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold">
              Âm tiếp theo
            </button>
          ) : (
            <button onClick={onBack} className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold">
              {pair ? "Xong" : "Về bảng âm"}
            </button>
          )}
          <button onClick={restart} className="w-full py-3 rounded-2xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold">
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
    <div className="max-w-md mx-auto space-y-5">
      {header}

      <div className="space-y-2">
        <div className="flex gap-1.5">
          {flat.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-emerald-500" : i === index ? "bg-violet-500" : "bg-slate-200 dark:bg-zinc-800"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold">
            {subject} /{sym}/ · {round.title}
            {roundCount > 1 ? ` ${roundNo}` : ""}
          </span>
          <span>
            {ti + 1}/{round.tasks.length}
          </span>
        </div>
      </div>

      {index === 0 && lesson.tips[0] && (
        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <button onClick={() => setTipOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Lightbulb className="w-4 h-4 shrink-0" />
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

      <p className="text-center text-lg font-bold text-slate-900 dark:text-white">{round.prompt}</p>

      {task.kind === "say" ? (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <div className="text-4xl font-bold text-slate-900 dark:text-white">{task.item.text}</div>
            <div className="font-mono text-slate-500 dark:text-zinc-400">{task.item.ipa}</div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => handleSpeak(task.item.text)}
              className="w-16 h-16 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              aria-label="Nghe"
            >
              <Volume2 className="w-7 h-7" />
            </button>
          </div>
          <MicCheck lesson={lesson} item={task.item} compact />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => rateSaid(true)} className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-2">
              <Mic className="w-4 h-4" /> Đã đọc
            </button>
            <button onClick={() => rateSaid(false)} className="py-3.5 rounded-2xl border-2 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold">
              Chưa chắc
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-center">
            <button
              onClick={() => handleSpeak(task.say)}
              className="w-20 h-20 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              aria-label="Nghe lại"
            >
              <Volume2 className="w-9 h-9" />
            </button>
          </div>
          <div className="space-y-2.5">
            {task.choices.map((c) => {
              const isAnswer = c.id === task.answer;
              const isPicked = picked === c.id;
              let style = "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:border-violet-400";
              if (picked !== null) {
                if (isAnswer) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200";
                else if (isPicked) style = "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200";
                else style = "border-transparent opacity-40 text-slate-500";
              }
              return (
                <button
                  key={c.id}
                  disabled={picked !== null}
                  onClick={() => choose(c.id)}
                  className={`w-full px-4 py-4 rounded-2xl border-2 text-left text-lg font-semibold flex items-center justify-between transition-colors ${style}`}
                >
                  <span>{c.label}</span>
                  {picked !== null && isAnswer && <Check className="w-5 h-5" />}
                  {picked !== null && isPicked && !isAnswer && <X className="w-5 h-5" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="space-y-3">
              <p className="text-sm text-center text-slate-600 dark:text-zinc-400">{task.explanation}</p>
              <button onClick={advance} className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold">
                {index + 1 >= flat.length ? "Xong" : "Tiếp"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
