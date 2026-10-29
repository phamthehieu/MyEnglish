import { useState, useEffect } from "react";
import { PenLine, Sparkles, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import GiveUpButton from "../review/GiveUpButton";
import { Rating } from "@/services/srs";
import type { WordDetail } from "@/types/database";
import { gradeSentenceWithAI, type SentenceGrade } from "@/services/ai";
import { ratingFromSentenceGrade, recordFreeWritingUse } from "@/services/smartReview";
import { getConciseMeaning } from "@/services/meaningText";
import { applyCorrections, saveMistakes } from "@/services/mistakes";
import { getActiveCefrLevel } from "@/services/pipeline";

interface FreeWritingExerciseProps {
  word: WordDetail;
  level?: string;
  /** Rating is final (derived from the AI grade); attempts = 1 when the answer failed */
  onComplete: (isCorrect: boolean, attempts: number, rating: Rating) => void;
  onSpeak: (text: string) => void;
  /** AI unavailable: the session switches to a typed recall exercise instead */
  onFallback: () => void;
}

/**
 * Output practice for words known well: recall the English word from its meaning AND use it in a
 * sentence of your own. The AI checks meaning, grammar and collocation, and explains corrections.
 * Generating your own sentence is the strongest form of retrieval (generation effect).
 */
export default function FreeWritingExercise({ word, level, onComplete, onSpeak, onFallback }: FreeWritingExerciseProps) {
  const [sentence, setSentence] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<SentenceGrade | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [savedMistakes, setSavedMistakes] = useState(0);

  useEffect(() => {
    setSentence("");
    setGrading(false);
    setGrade(null);
    setHintShown(false);
    setRating(null);
    setSavedMistakes(0);
  }, [word.id]);

  const submit = async () => {
    if (grading || grade || sentence.trim().length < 3) return;
    setGrading(true);
    try {
      const g = await gradeSentenceWithAI(word.word, word.meaning_vn, sentence.trim(), level ?? (await getActiveCefrLevel()));
      recordFreeWritingUse();
      let r = ratingFromSentenceGrade(g);
      // The first letter was given: the word itself was not recalled unaided
      if (hintShown && r === Rating.Good) r = Rating.Hard;
      setGrade(g);
      setRating(r);
      onSpeak(word.word);
      // Each correction goes to the mistake notebook, to be fixed again later
      if (g.corrections.length > 0) {
        const corrected = applyCorrections(sentence.trim(), g.corrections);
        saveMistakes(
          g.corrections.map((c) => ({ wrong: c.wrong, right: c.right, whyVn: c.whyVn, sentence: corrected })),
          { source: "free_writing", wordId: word.id }
        )
          .then((res) => setSavedMistakes(res.added + res.repeated))
          .catch(() => {});
      }
    } catch (err) {
      console.warn("AI sentence grading failed, falling back:", err);
      onFallback();
    } finally {
      setGrading(false);
    }
  };

  const ok = rating !== null && rating >= Rating.Hard;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
          <PenLine className="w-3 h-3" />
          <span>Tự viết câu (AI chấm)</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-zinc-200">
          Viết <strong>một câu tiếng Anh</strong> dùng từ có nghĩa:
        </p>
        <p className="text-base font-semibold text-slate-900 dark:text-white">{getConciseMeaning(word.meaning_vn, word.word)}</p>
        {word.part_of_speech && <p className="text-sm text-slate-600 dark:text-zinc-400">({word.part_of_speech})</p>}
        {hintShown && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Gợi ý: {word.word.charAt(0).toUpperCase()}
            {word.word.slice(1).replace(/[a-z]/gi, " _")}
          </p>
        )}
      </div>

      <textarea
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={grading || !!grade}
        maxLength={300}
        rows={3}
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
        placeholder="Một câu ngắn là đủ. Ví dụ: I fixed a bug today."
        className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
      />

      {!grade ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setHintShown(true)}
            disabled={hintShown || grading}
            className="min-h-10 px-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-1 disabled:opacity-40"
          >
            <Lightbulb className="w-3.5 h-3.5" /> Gợi ý chữ cái đầu (tính là Khó)
          </button>
          <div className="flex gap-2">
            <GiveUpButton onConfirm={() => onComplete(false, 1, Rating.Again)} disabled={grading} label="Không nhớ ra từ" />
            <button
              type="button"
              onClick={submit}
              disabled={grading || sentence.trim().length < 3}
              className="px-5 min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
            >
              {grading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : null}
              {grading ? "AI đang chấm..." : "Chấm câu"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-2xl border text-sm space-y-2 ${
              ok
                ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/40 text-green-900 dark:text-green-100"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/40 text-red-900 dark:text-red-100"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>
                Từ cần dùng: <strong>{word.word}</strong> · Điểm {grade.score}/100
                {!grade.usesTargetWord && " · Câu chưa dùng đúng từ này"}
              </span>
            </div>
            {grade.explanationVn && <p>{grade.explanationVn}</p>}
            {grade.corrections.length > 0 && (
              <ul className="space-y-1">
                {grade.corrections.map((c, i) => (
                  <li key={i}>
                    <span className="line-through opacity-70">{c.wrong}</span> → <strong>{c.right}</strong>
                    {c.whyVn ? ` — ${c.whyVn}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {savedMistakes > 0 && <p className="opacity-80">Đã lưu {savedMistakes} lỗi vào Sổ lỗi (tab Viết) để ôn lại.</p>}
            {grade.betterVersion && (
              <p>
                Câu gợi ý: <em>{grade.betterVersion}</em>
              </p>
            )}
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => onComplete(ok, ok ? 0 : 1, rating as Rating)}
            className="w-full min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500 text-base font-semibold transition-colors"
          >
            Tiếp tục
          </button>
        </div>
      )}
    </div>
  );
}
