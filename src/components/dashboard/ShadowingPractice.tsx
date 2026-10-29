import { useMemo, useRef, useState } from "react";
import { ArrowRight, Equal, Eye, Play, Repeat } from "lucide-react";
import { bareWord, countWords, gradeBlanks, gradeDictation, pickBlanks, type DictationResult } from "@/services/shadowingPractice";
import { SENTENCE_FONT, WORD_TONE } from "./shadowingStyle";

/** One sentence of the lesson, as the typing exercises need it */
interface Sentence {
  text: string;
  start: number;
  end: number;
}

/** The row at the top of a practice card: play, speed, repeat, and where the learner is in the lesson */
export interface PracticeBarProps {
  index: number;
  total: number;
  speed: number;
  loop: boolean;
  onPlay: () => void;
  onSpeed: () => void;
  onLoop: () => void;
}

function PracticeBar({ index, total, speed, loop, onPlay, onSpeed, onLoop }: PracticeBarProps) {
  const pill = "h-11 rounded-full inline-flex items-center justify-center text-sm font-semibold transition-colors";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className="h-12 w-12 shrink-0 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-sm inline-flex items-center justify-center"
          aria-label="Nghe câu này"
        >
          <Play className="w-5 h-5 fill-current" />
        </button>
        <button onClick={onSpeed} className={`${pill} min-w-[3.5rem] px-4 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums`} aria-label={`Tốc độ ${speed} lần. Bấm để đổi`}>
          {speed}×
        </button>
        <button
          onClick={onLoop}
          aria-pressed={loop}
          aria-label={loop ? "Đang lặp lại câu này. Bấm để tắt" : "Lặp lại câu này"}
          className={`${pill} gap-1.5 px-4 ${loop ? "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300 ring-1 ring-teal-700/40 dark:ring-teal-400/40" : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"}`}
        >
          <Repeat className="w-5 h-5" /> Lặp
        </button>
        <span className="ml-auto text-sm font-semibold tabular-nums text-teal-800 dark:text-teal-300">
          {index + 1} <span className="font-normal text-slate-500 dark:text-zinc-400">/ {total}</span>
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800"
        role="progressbar"
        aria-label="Tiến độ trong bài"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div className="h-full rounded-full bg-teal-700 dark:bg-teal-500 transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}

const CARD = "mb-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]";
const CHECK_BUTTON =
  "min-h-14 min-w-0 flex-1 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

/** "Kiểm tra", the eye that shows the answer, and "Tiếp" */
function Actions({
  canCheck,
  onCheck,
  onReveal,
  onNext,
  last,
}: {
  canCheck: boolean;
  onCheck: () => void;
  onReveal: () => void;
  onNext: () => void;
  last: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCheck} disabled={!canCheck} className={CHECK_BUTTON}>
        Kiểm tra
      </button>
      <button onClick={onReveal} title="Xem đáp án" className="min-h-12 shrink-0 rounded-2xl px-2 gap-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 inline-flex items-center justify-center">
        <Eye className="w-5 h-5" /> Xem đáp án
      </button>
      <button onClick={onNext} disabled={last} className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl px-2 text-base font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10 disabled:opacity-40">
        Tiếp <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/** Dictation: hear the sentence, type all of it. Remounted (keyed) for every sentence, so each starts empty. */
export function DictationCard({
  sentence,
  index,
  total,
  bar,
  onNext,
  onDone,
}: {
  sentence: Sentence;
  index: number;
  total: number;
  bar: Omit<PracticeBarProps, "index" | "total">;
  onNext: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [revealed, setRevealed] = useState(false);

  const check = () => {
    if (!typed.trim()) return;
    const r = gradeDictation(sentence.text, typed);
    setResult(r);
    setRevealed(false);
    if (r.correct) onDone();
  };
  const reveal = () => {
    setRevealed(true);
    onDone();
  };
  const wrong = result && !result.correct ? result.check.words.filter((w) => w.status === "wrong") : [];

  return (
    <div className={CARD}>
      <PracticeBar index={index} total={total} {...bar} />

      <div className="relative rounded-xl border border-slate-200 dark:border-zinc-700 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 dark:focus-within:border-teal-500 px-4 py-3">
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              check();
            }
          }}
          rows={2}
          placeholder="Gõ những gì bạn nghe được..."
          aria-label="Gõ lại câu bạn nghe được"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          className="block w-full resize-none bg-transparent pr-20 text-lg leading-snug text-slate-900 dark:text-zinc-100 outline-none placeholder:text-slate-500 dark:placeholder:text-zinc-500"
        />
        <span className="absolute right-4 top-3.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-500 dark:text-zinc-400">
          <Equal className="w-4 h-4" />
          {countWords(typed)}/{countWords(sentence.text)}
        </span>
      </div>

      <Actions canCheck={typed.trim() !== ""} onCheck={check} onReveal={reveal} onNext={onNext} last={index >= total - 1} />

      {revealed && (
        <p role="status" className="text-lg leading-snug text-slate-900 dark:text-zinc-100" style={SENTENCE_FONT}>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Đáp án</span>
          {sentence.text}
        </p>
      )}
      {!revealed && result?.correct && (
        <p role="status" className="text-base font-semibold text-green-600 dark:text-green-400">
          ✓ Chính xác! <span className="block mt-1 text-lg font-normal text-slate-900 dark:text-zinc-100" style={SENTENCE_FONT}>{sentence.text}</span>
        </p>
      )}
      {!revealed && result && !result.correct && (
        <div role="status" className="space-y-1.5">
          <p className="text-lg leading-snug" style={SENTENCE_FONT}>
            {result.check.words.map((w, i) => (
              <span key={i} className={WORD_TONE[w.status]}>
                {w.text}{" "}
              </span>
            ))}
          </p>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            <b className="text-slate-900 dark:text-zinc-100">
              {result.check.clear}/{result.check.judged}
            </b>{" "}
            từ đúng. Sửa lại rồi kiểm tra tiếp.
          </p>
          {wrong.map((w, i) => (
            <p key={i} className="text-sm text-red-600 dark:text-red-400">
              Bạn gõ "{w.heard}" thay vì "{bareWord(w.text)}"
            </p>
          ))}
          {result.check.words.some((w) => w.status === "missing") && <p className="text-sm text-red-600 dark:text-red-400">Gạch ngang: bạn chưa gõ từ đó.</p>}
          {result.check.extra.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">Thừa: {result.check.extra.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

/** Fill the blanks: the sentence with a few words missing. Remounted (keyed) for every sentence. */
export function ClozeCard({
  sentence,
  index,
  total,
  bar,
  unlearned,
  fontScale,
  onNext,
  onDone,
}: {
  sentence: Sentence;
  index: number;
  total: number;
  bar: Omit<PracticeBarProps, "index" | "total">;
  unlearned: (word: string) => boolean;
  fontScale: number;
  onNext: () => void;
  onDone: () => void;
}) {
  const tokens = useMemo(() => sentence.text.split(/\s+/).filter(Boolean), [sentence.text]);
  const blanks = useMemo(() => pickBlanks(tokens, unlearned), [tokens, unlearned]);
  const solutions = useMemo(() => blanks.map((i) => bareWord(tokens[i])), [blanks, tokens]);
  const [answers, setAnswers] = useState<string[]>(() => blanks.map(() => ""));
  const [graded, setGraded] = useState<boolean[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const check = () => {
    const g = gradeBlanks(answers, solutions);
    setGraded(g);
    if (g.every(Boolean)) onDone();
  };
  const reveal = () => {
    setAnswers(solutions);
    setGraded(solutions.map(() => true));
    setRevealed(true);
    onDone();
  };
  const change = (b: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === b ? value : a)));
    setGraded(null);
  };
  const allRight = graded !== null && graded.every(Boolean);
  const rightCount = graded ? graded.filter(Boolean).length : 0;

  return (
    <div className={CARD}>
      <PracticeBar index={index} total={total} {...bar} />

      {blanks.length === 0 ? (
        <p className="text-base text-slate-600 dark:text-zinc-400">Câu này ngắn quá nên không có chỗ trống. Bấm "Tiếp" để sang câu sau.</p>
      ) : (
        <p className="leading-[2.5] text-slate-900 dark:text-zinc-100" style={{ ...SENTENCE_FONT, fontSize: 18 * fontScale }}>
          {tokens.map((raw, i) => {
            const b = blanks.indexOf(i);
            if (b < 0) return <span key={i}>{bareWord(raw)} </span>;
            const state = graded ? (graded[b] ? "right" : "wrong") : "idle";
            return (
              <span key={i}>
                <input
                  ref={(el) => {
                    inputs.current[b] = el;
                  }}
                  value={answers[b] ?? ""}
                  readOnly={revealed}
                  onChange={(e) => change(b, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (b < blanks.length - 1) inputs.current[b + 1]?.focus();
                    else check();
                  }}
                  aria-label={`Chỗ trống ${b + 1} trên ${blanks.length}`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-gramm="false"
                  style={{ width: `${Math.max(4, solutions[b].length + 2)}ch` }}
                  className={`mx-0.5 rounded-xl border-2 bg-transparent px-1.5 py-0.5 text-center outline-none ${
                    state === "right"
                      ? "border-green-500 text-green-600 dark:text-green-400"
                      : state === "wrong"
                        ? "border-red-500 text-red-600 dark:text-red-400"
                        : "border-slate-300 dark:border-zinc-600 focus:border-teal-600 dark:focus:border-teal-400"
                  }`}
                />{" "}
              </span>
            );
          })}
        </p>
      )}

      <Actions canCheck={answers.some((a) => a.trim() !== "")} onCheck={check} onReveal={reveal} onNext={onNext} last={index >= total - 1} />

      {allRight && !revealed && <p role="status" className="text-base font-semibold text-green-700 dark:text-green-300">✓ Chính xác!</p>}
      {revealed && <p role="status" className="text-sm text-slate-600 dark:text-zinc-400">Đây là đáp án của câu này.</p>}
      {graded && !allRight && (
        <p role="status" className="text-sm text-red-600 dark:text-red-400">
          Đúng {rightCount}/{blanks.length} chỗ trống. Sửa lại các ô đỏ rồi kiểm tra tiếp.
        </p>
      )}
    </div>
  );
}

/** A sentence of the list that has not been answered yet: gray bars where its words would be */
export function SkeletonText({ words, seed }: { words: number; seed: number }) {
  const lines = Math.max(1, Math.min(4, Math.ceil(words / 6)));
  const widths = ["88%", "58%", "74%", "46%"];
  return (
    <span className="block space-y-2.5 py-1.5" aria-hidden="true">
      {Array.from({ length: lines }, (_, k) => (
        <span key={k} className="block h-3 rounded-full bg-slate-200 dark:bg-zinc-800" style={{ width: k === lines - 1 && lines > 1 ? widths[(seed + k) % 4] : k === 0 ? "88%" : widths[(seed + k) % 4] }} />
      ))}
    </span>
  );
}
