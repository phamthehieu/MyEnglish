import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { Rating, type Grade } from "ts-fsrs";
import {
  gradeMistakeAnswer,
  mistakePrompt,
  recordMistakeReview,
  MISTAKE_CATEGORY_LABEL,
  type Mistake,
} from "@/services/mistakes";
import { recordDailyActivity } from "@/services/streak";

interface MistakeReviewProps {
  mistakes: Mistake[];
  onDone: (stats: { reviewed: number; correct: number }) => void;
}

/** "Fix what you once wrote": the learner's sentence with the mistake put back, retype the right part */
export default function MistakeReview({ mistakes, onDone }: MistakeReviewProps) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [hint, setHint] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const m = mistakes[index];

  useEffect(() => {
    setInput("");
    setResult(null);
    setHint(false);
    inputRef.current?.focus();
  }, [index]);

  if (!m) return null;
  const prompt = mistakePrompt(m);

  const check = () => {
    if (result !== null) return;
    setResult(gradeMistakeAnswer(input, m.right_text));
  };

  const next = async (grade: Grade) => {
    await recordMistakeReview(m, grade).catch((err) => console.warn("Mistake review not saved:", err));
    recordDailyActivity(1);
    const s = { reviewed: stats.reviewed + 1, correct: stats.correct + (grade === Rating.Again ? 0 : 1) };
    setStats(s);
    if (index + 1 >= mistakes.length) onDone(s);
    else setIndex(index + 1);
  };

  const ok = result !== null && result !== Rating.Again;

  return (
    <div className="border-t border-slate-100 pt-4 dark:border-zinc-800 md:p-5 md:rounded-2xl md:border md:border-slate-200 md:dark:border-zinc-800 md:bg-white md:dark:bg-zinc-900 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="min-w-0 truncate text-slate-500 dark:text-zinc-400">Sửa lỗi bạn từng viết</span>
          <span className="shrink-0 tabular-nums text-teal-800 dark:text-teal-300">
            {index + 1} / {mistakes.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-teal-700 transition-[width] duration-300 dark:bg-teal-500" style={{ width: `${((index + 1) / Math.max(1, mistakes.length)) * 100}%` }} />
        </div>
      </div>

      <div className="text-lg leading-relaxed text-slate-800 dark:text-zinc-200 break-words">
        {prompt ? (
          <>
            {prompt.before}
            <span className="px-1 rounded bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 font-semibold underline decoration-wavy decoration-red-400">
              {prompt.wrong}
            </span>
            {prompt.after}
          </>
        ) : (
          <>
            Bạn từng viết:{" "}
            <span className="px-1 rounded bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 font-semibold">{m.wrong_text}</span>
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (result === null) check();
          else if (ok) next(Rating.Good);
          else next(Rating.Again);
        }}
        autoComplete="off"
        className="space-y-2"
      >
        <label className="block text-sm text-slate-500 dark:text-zinc-400">Gõ lại phần tô đỏ cho đúng:</label>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={result !== null}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-enable-grammarly="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className="w-full min-h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 disabled:opacity-80"
          placeholder="Cách viết đúng…"
        />
        {result === null && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHint(true)}
                disabled={hint}
                className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border border-amber-200 dark:border-amber-500/40 bg-white dark:bg-zinc-900 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:bg-amber-50 dark:disabled:bg-amber-500/10"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                {hint ? `Loại lỗi: ${MISTAKE_CATEGORY_LABEL[m.category ?? "other"]}` : "Gợi ý loại lỗi"}
              </button>
              <button type="button" onClick={() => setResult(Rating.Again)} className="min-h-11 px-3.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">
                Không nhớ
              </button>
            </div>
            <button type="submit" disabled={!input.trim()} className="w-full min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-[17px] font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Kiểm tra
            </button>
          </div>
        )}
      </form>

      {result !== null && (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-2xl border text-sm space-y-1.5 break-words ${ok ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-900 dark:text-green-100" : "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-100"}`}
          >
            <div className="flex flex-wrap items-center gap-1.5 font-semibold">
              {ok ? <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400" /> : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              {ok ? "Đúng rồi!" : "Chưa đúng."} Cách viết đúng: <span>{m.right_text}</span>
            </div>
            {m.why_vn && <p>{m.why_vn}</p>}
            {m.sentence && <p className="italic opacity-80">{m.sentence}</p>}
          </div>
          <div className="space-y-3">
            {!ok && input.trim() && (
              <button
                onClick={() => next(Rating.Hard)}
                className="w-full min-h-12 px-5 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-base font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10"
              >
                Tôi chỉ gõ nhầm
              </button>
            )}
            <button
              onClick={() => next(ok ? Rating.Good : Rating.Again)}
              autoFocus
              className="w-full inline-flex items-center justify-center gap-2 min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-[17px] font-semibold shadow-sm"
            >
              Tiếp
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
