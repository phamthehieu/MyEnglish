import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BookMarked, Loader2, Play, Sparkles, Trash2 } from "lucide-react";
import { useWordsStore } from "@/stores/wordsStore";
import { correctWritingWithAI, type MistakeCategory, type WritingFeedback } from "@/services/ai";
import {
  deleteMistake,
  getCategoryLesson,
  getDueMistakes,
  getMistakeSummary,
  listMistakes,
  recordStandupUse,
  saveMistakes,
  standupUsedToday,
  MISTAKE_CATEGORY_LABEL,
  STANDUP_PER_DAY,
  type Mistake,
  type MistakeSummary,
} from "@/services/mistakes";
import { recordDailyActivity } from "@/services/streak";
import { getActiveCefrLevel } from "@/services/pipeline";
import { bankStatus } from "@/services/reading";
import { shuffle } from "@/lib/utils";
import { isMobilePlatform } from "@/lib/platform";
import { PAGE_CONTAINER } from "./shared";
import MistakeReview from "./MistakeReview";

const DRAFT_KEY = "myenglish_standup_draft_v1";
const IS_MOBILE = isMobilePlatform();

interface WritingTabProps {
  onOpenGrammarLesson: (lessonId: string) => void;
  resetKey?: number;
}

/** Writing: a daily standup corrected by AI, and the notebook of the learner's own mistakes */
export default function WritingTab({ onOpenGrammarLesson, resetKey }: WritingTabProps) {
  const words = useWordsStore((s) => s.words);
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(() => standupUsedToday());
  const [summary, setSummary] = useState<MistakeSummary | null>(null);
  const [recent, setRecent] = useState<Mistake[]>([]);
  const [reviewing, setReviewing] = useState<Mistake[] | null>(null);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  // The grammar lesson behind each weak category; a category with no lesson in the book gets no link
  const [categoryLessons, setCategoryLessons] = useState<Partial<Record<MistakeCategory, { id: string; title: string }>>>({});

  const reload = () => {
    getMistakeSummary().then(setSummary).catch(() => {});
    listMistakes(12).then(setRecent).catch(() => {});
  };
  useEffect(reload, []);

  useEffect(() => {
    setReviewing(null);
  }, [resetKey]);

  // Checked once per visit: without an AI CLI the correction button is off, not an error after a click
  const [cliReady, setCliReady] = useState<boolean | null>(null);
  useEffect(() => {
    let customPath: string | undefined;
    try {
      customPath = localStorage.getItem("myenglish_custom_cli_path") || undefined;
    } catch {}
    invoke<{ installed: boolean }>("check_cli_status", { customPath })
      .then((res) => setCliReady(res.installed))
      .catch(() => setCliReady(false));
  }, []);

  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    const categories = summary.byCategory.slice(0, 4).map((c) => c.category);
    Promise.all(categories.map((c) => getCategoryLesson(c).catch(() => undefined))).then((found) => {
      if (cancelled) return;
      const next: Partial<Record<MistakeCategory, { id: string; title: string }>> = {};
      categories.forEach((c, i) => {
        const lesson = found[i];
        if (lesson) next[c] = lesson;
      });
      setCategoryLessons(next);
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  // A few words being learned, to try using them in today's update (output practice)
  const pickedSuggestionsRef = useRef<typeof words | null>(null);
  const hasWords = words.length > 0;
  const suggestions = useMemo(() => {
    if (pickedSuggestionsRef.current && pickedSuggestionsRef.current.length > 0) {
      return pickedSuggestionsRef.current;
    }
    if (!hasWords) return [];
    const picked = shuffle(words.filter((w) => bankStatus(w) === "learning" && !/\s/.test(w.word))).slice(0, 4);
    pickedSuggestionsRef.current = picked;
    return picked;
    // Picked once when words become available, not reshuffled on every word refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWords]);

  const updateText = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(DRAFT_KEY, v);
    } catch {}
  };

  const len = text.trim().length;
  const canSend = !busy && len >= 10 && len <= 600 && used < STANDUP_PER_DAY && cliReady !== false;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const fb = await correctWritingWithAI(text.trim(), await getActiveCefrLevel());
      recordStandupUse();
      setUsed(standupUsedToday());
      recordDailyActivity(1);
      setFeedback(fb);
      const res = await saveMistakes(
        fb.corrections.map((c) => ({ wrong: c.wrong, right: c.right, whyVn: c.whyVn, category: c.category, sentence: c.sentence })),
        { source: "standup" }
      );
      setSaved(res.added + res.repeated);
      reload();
    } catch (err) {
      setError(
        `Không sửa được bằng AI: ${err instanceof Error ? err.message : String(err)}. Vào Cài đặt để nhập khóa Gemini${IS_MOBILE ? "" : " (hoặc cài AI CLI)"}, rồi thử lại.`
      );
    } finally {
      setBusy(false);
    }
  };

  const startReview = async () => {
    setReviewResult(null);
    const due = await getDueMistakes();
    if (due.length > 0) setReviewing(due);
  };

  return (
    <div className={`${PAGE_CONTAINER} space-y-4`}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
          Viết và sửa lỗi
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-2xl">
          Viết vài câu về công việc hôm nay như khi báo cáo standup. AI sửa từng lỗi, và mỗi lỗi được lưu vào Sổ lỗi để bạn
          ôn lại cho đến khi không còn sai nữa.
        </p>
      </div>

      {/* Daily standup */}
      <div className="p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">Standup hôm nay</span>
          <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400">
            {used}/{STANDUP_PER_DAY} lượt sửa hôm nay
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Hôm qua bạn làm gì, hôm nay làm gì, có gì đang bị chặn? 2–4 câu là đủ.
        </p>
        {suggestions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-zinc-400">
            <span>Thử dùng từ đang học:</span>
            {suggestions.map((w) => (
              <span key={w.id} title={w.meaning_vn} className="px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300 font-semibold">
                {w.word}
              </span>
            ))}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => updateText(e.target.value)}
          rows={4}
          placeholder="Yesterday I fixed the login bug. Today I am working on the payment API. No blockers."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-enable-grammarly="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base text-slate-800 dark:text-zinc-200 leading-relaxed focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs ${len > 600 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-zinc-400"}`}>{len}/600 ký tự</span>
          <button
            onClick={send}
            disabled={!canSend}
            className="inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-base font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? "AI đang sửa…" : used >= STANDUP_PER_DAY ? "Hết lượt hôm nay" : "Nhờ AI sửa"}
          </button>
        </div>
        {cliReady === false && (
          <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Để nhờ AI sửa, vào Cài đặt nhập khóa Gemini{IS_MOBILE ? "" : " (hoặc cài AI CLI)"}. Bạn vẫn viết và ôn lại lỗi đã lưu bình thường.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {feedback && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3 text-sm text-slate-700 dark:text-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-zinc-100">
                {feedback.corrections.length === 0 ? "Không có lỗi nào 🎉" : `${feedback.corrections.length} lỗi cần sửa`}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-zinc-400">Điểm {feedback.score}/100</span>
            </div>
            {feedback.explanationVn && <p>{feedback.explanationVn}</p>}
            {feedback.corrections.length > 0 && (
              <ul className="space-y-2.5">
                {feedback.corrections.map((c, i) => (
                  <li key={i} className="flex flex-col gap-0.5 break-words">
                    <span>
                      <span className="line-through text-red-600 dark:text-red-400">{c.wrong}</span> →{" "}
                      <strong className="text-green-700 dark:text-green-400">{c.right}</strong>
                      <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {MISTAKE_CATEGORY_LABEL[c.category]}
                      </span>
                    </span>
                    {c.whyVn && <span className="text-slate-500 dark:text-zinc-400">{c.whyVn}</span>}
                  </li>
                ))}
              </ul>
            )}
            {feedback.betterVersion && (
              <p>
                Bản viết tự nhiên hơn: <em>{feedback.betterVersion}</em>
              </p>
            )}
            {saved > 0 && <p className="text-teal-700 dark:text-teal-300">Đã lưu {saved} lỗi vào Sổ lỗi. Ngày mai bạn sẽ được hỏi lại.</p>}
          </div>
        )}
      </div>

      {/* Mistake notebook */}
      <div className="p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-zinc-100">
            <BookMarked className="w-4 h-4 text-teal-700 dark:text-teal-300" />
            Sổ lỗi của bạn
          </span>
          {summary && summary.due > 0 && !reviewing && (
            <button
              onClick={startReview}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 text-sm font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Ôn {summary.due} lỗi đến hạn
            </button>
          )}
        </div>

        {reviewing ? (
          <MistakeReview
            mistakes={reviewing}
            onDone={({ reviewed, correct }) => {
              setReviewing(null);
              setReviewResult(`Xong ${reviewed} lỗi, sửa đúng ${correct}. Lỗi còn sai sẽ quay lại sớm hơn.`);
              reload();
            }}
          />
        ) : !summary || summary.total === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Chưa có lỗi nào. Lỗi từ bài standup ở trên và từ bài "Tự viết câu" trong phiên ôn sẽ được lưu ở đây.
          </p>
        ) : (
          <>
            {reviewResult && <p className="rounded-xl bg-green-50 dark:bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">{reviewResult}</p>}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {summary.total} lỗi đã lưu · {summary.due} cần ôn hôm nay · Bạn hay sai nhất:
              </div>
              {summary.byCategory.slice(0, 4).map(({ category, count }) => {
                const lesson = categoryLessons[category];
                const max = summary.byCategory[0].count;
                return (
                  <div key={category} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                    <span className="sm:w-48 sm:shrink-0 text-slate-700 dark:text-zinc-300">{MISTAKE_CATEGORY_LABEL[category]}</span>
                    <div className="flex flex-1 min-w-0 items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400 dark:bg-red-500/70" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                      </div>
                      <span className="w-6 text-right tabular-nums text-slate-500 dark:text-zinc-400">{count}</span>
                    </div>
                    {lesson && (
                      <button onClick={() => onOpenGrammarLesson(lesson.id)} className="sm:w-28 min-h-10 text-left text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline truncate">
                        Bài: {lesson.title}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Gần đây</div>
              {recent.map((m) => (
                <div key={m.id} className="group flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words text-slate-700 dark:text-zinc-300">
                    <span className="line-through text-red-600 dark:text-red-400">{m.wrong_text}</span> →{" "}
                    <strong className="text-green-700 dark:text-green-400">{m.right_text}</strong>
                    {m.occurrences > 1 && <span className="ml-1.5 text-xs text-red-600 dark:text-red-400">sai {m.occurrences} lần</span>}
                  </span>
                  <button
                    onClick={() => deleteMistake(m.id).then(reload)}
                    title="Xóa khỏi sổ (AI sửa sai, hoặc không cần ôn)"
                    type="button"
                    aria-label="Xóa khỏi sổ"
                    className="shrink-0 -my-2 -mr-2 w-11 h-11 inline-flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:bg-red-500/10 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
