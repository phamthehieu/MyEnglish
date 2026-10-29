import { useEffect } from "react";
import { HelpCircle, Search } from "lucide-react";
import type { PretestQuestion, PretestResult } from "@/services/pretest";
import { highlightWord } from "./highlightWord";

interface PretestCardProps {
  question: PretestQuestion;
  phonetic?: string | null;
  onDone: (result: PretestResult) => void;
}

/**
 * Guess the meaning of a new word from a sentence, before its introduction card.
 * Keys: 1–3 pick an option, 0 / ? = "Chưa đoán được".
 */
export default function PretestCard({ question, phonetic, onDone }: PretestCardProps) {
  const pick = (i: number | null) => {
    const option = i === null ? null : question.options[i];
    onDone({ correct: !!option?.isCorrect, chosen: option?.text ?? null });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(n - 1);
      } else if (e.key === "0" || e.key === "?") {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(null);
      }
    };
    // Capture phase: the session's own shortcuts must not see these keys while guessing
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [question]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-teal-700 dark:text-teal-300">
          <Search className="w-3.5 h-3.5" />
          <span>Từ mới · Đoán nghĩa trước khi học</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Đoán sai cũng không sao: đoán trước rồi mới xem nghĩa giúp nhớ lâu hơn đọc thẳng. Lượt này không tính điểm.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{question.word}</span>
          {phonetic && <span className="font-mono text-teal-700 dark:text-teal-300 text-sm">{phonetic}</span>}
        </div>
        <p className="text-base italic text-slate-700 dark:text-zinc-300 pl-3 border-l-2 border-teal-700/50 dark:border-teal-400/50">
          "{highlightWord(question.sentence, question.word)}"
        </p>
      </div>

      <div className="space-y-2">
        {question.options.map((o, i) => (
          <button
            key={o.text}
            onClick={() => pick(i)}
            className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-700/50 hover:bg-slate-50 dark:hover:border-teal-400/50 dark:hover:bg-zinc-800/50 text-left text-base font-medium text-slate-900 dark:text-zinc-100 transition-colors"
          >
            <kbd className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-600 dark:text-zinc-400">
              {i + 1}
            </kbd>
            <span>{o.text}</span>
          </button>
        ))}
        <button
          onClick={() => pick(null)}
          className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-left text-base text-slate-600 dark:text-zinc-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <kbd className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold">0</kbd>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Chưa đoán được
          </span>
        </button>
      </div>
    </div>
  );
}

/** One line above the introduction card: how the guess went */
export function PretestFeedback({ result }: { result: PretestResult }) {
  if (result.correct) {
    return (
      <div className="px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-sm text-green-800 dark:text-green-300">
        🎯 Đoán đúng từ ngữ cảnh! Đọc lại nghĩa và ví dụ bên dưới cho chắc.
      </div>
    );
  }
  return (
    <div className="px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-400/10 border border-teal-700/20 dark:border-teal-400/30 text-sm text-teal-800 dark:text-teal-300">
      {result.chosen ? <>Bạn đoán "{result.chosen}". </> : null}
      Nghĩa đúng ở ngay dưới. Lần đoán vừa rồi vẫn giúp bạn nhớ từ này tốt hơn.
    </div>
  );
}
