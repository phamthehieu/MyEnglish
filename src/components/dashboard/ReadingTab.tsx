import { useEffect, useMemo, useRef, useState } from "react";
import { isMobilePlatform } from "@/lib/platform";
import { BookOpenText, Check, Pencil, Plus, Quote, Sparkles, X } from "lucide-react";
import { useWordsStore } from "@/stores/wordsStore";
import { analyzeText, logEncounters, type BankStatus, type ReadingAnalysis } from "@/services/reading";
import { pipeline } from "@/services/pipeline";
import { addUserContextExample } from "@/services/db";
import { PAGE_CONTAINER } from "./shared";
import { isFoundationMode } from "@/services/learnerProfile";
import { COMMON_WORDS, FUNCTION_WORDS } from "@/data/commonWords";
import { AI_VOCAB_ENABLED } from "@/services/features";
import { pullWordFromDeck } from "@/services/vocabFeed";

const DRAFT_KEY = "myenglish_reading_draft_v1";
/** Long texts are cut so highlighting stays instant */
const MAX_CHARS = 20_000;
const MAX_CANDIDATES_SHOWN = 15;
const PASTE_KEYS =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "⌘V"
    : "Ctrl+V";

const STATUS_STYLE: Record<BankStatus, string> = {
  mastered: "border-b-2 border-green-400/70 dark:border-green-500/60",
  learning: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 rounded px-0.5",
  new: "bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-100 rounded px-0.5",
};
const STATUS_LABEL: Record<BankStatus, string> = { mastered: "Đã thuộc", learning: "Đang học", new: "Mới thêm" };

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(text: string): void {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

/**
 * Reading mode: paste real text and see your words in it. Bank words open their details; unfamiliar words
 * are picked and added with the sentence they appear in; a learning word's sentence can be kept as an example.
 */
export default function ReadingTab({ resetKey }: { resetKey?: number }) {
  const words = useWordsStore((s) => s.words);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [text, setText] = useState(readDraft);
  const [reading, setReading] = useState<string | null>(null);
  // base form -> sentence it was picked from
  const [picked, setPicked] = useState<Map<string, string>>(() => new Map());
  const [savedSentences, setSavedSentences] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Clears the message after a while: a newer message restarts the wait, and leaving the tab cancels it
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMessage = (text: string, clearAfterMs?: number) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = null;
    setMessage(text);
    if (clearAfterMs) {
      messageTimerRef.current = setTimeout(() => {
        messageTimerRef.current = null;
        setMessage(null);
      }, clearAfterMs);
    }
  };
  useEffect(
    () => () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    },
    []
  );
  // A beginner only "knows" function words: everyday words (because, change, need…) are offered to learn
  const knownCommon = useMemo(() => (isFoundationMode() ? FUNCTION_WORDS : COMMON_WORDS), []);

  useEffect(() => {
    setReading(null);
  }, [resetKey]);

  const lastAnalyzedRef = useRef<{
    text: string;
    words: typeof words;
    knownCommon: ReadonlySet<string>;
    result: ReadingAnalysis;
  } | null>(null);

  const getAnalysis = (cleanText: string): ReadingAnalysis => {
    const cached = lastAnalyzedRef.current;
    if (
      cached &&
      cached.text === cleanText &&
      cached.words === words &&
      cached.knownCommon === knownCommon
    ) {
      return cached.result;
    }
    const result = analyzeText(cleanText, words, knownCommon);
    lastAnalyzedRef.current = { text: cleanText, words, knownCommon, result };
    return result;
  };

  const analysis: ReadingAnalysis | null = useMemo(
    () => (reading ? getAnalysis(reading) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reading, words, knownCommon]
  );

  const startReading = () => {
    const clean = text.slice(0, MAX_CHARS).trim();
    if (!clean) return;
    saveDraft(clean);
    const computed = getAnalysis(clean);
    setReading(clean);
    setPicked(new Map());
    setSavedSentences(new Set());
    const met = logEncounters(computed.bankHits);
    if (met > 0) {
      showMessage(
        `Bạn gặp lại ${met} từ đang học trong bài này. Gặp từ trong văn bản thật giúp bạn hiểu cách dùng của nó.`,
        5000
      );
    }
  };

  const togglePick = (base: string, sentence: string) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(base)) next.delete(base);
      else next.set(base, sentence);
      return next;
    });

  const addPicked = async () => {
    setAdding(true);
    let accepted = 0;
    const refused: string[] = [];
    for (const [base, sentence] of picked) {
      if (!AI_VOCAB_ENABLED) {
        // The Oxford deck is the only source of words: words it has are learnt next, with this sentence
        const r = await pullWordFromDeck(base, sentence).catch(() => ({ status: "not_in_deck", word: base }));
        if (r.status === "not_in_deck") refused.push(base);
        else accepted++;
        continue;
      }
      const res = await pipeline.enqueue(base, { context: sentence });
      if (res.accepted) accepted++;
      else refused.push(base);
    }
    setAdding(false);
    setPicked(new Map());
    refreshWords();
    showMessage(
      (AI_VOCAB_ENABLED
        ? `Đã thêm ${accepted} từ vào sổ, kèm câu bạn gặp chúng làm ví dụ. AI đang phân tích nghĩa (cần AI: vào Cài đặt để nhập khóa Gemini${isMobilePlatform() ? "" : " hoặc cài AI CLI"}).`
        : `${accepted} từ sẽ được học sớm, kèm câu bạn gặp chúng làm ví dụ.`) +
        (refused.length ? ` ${AI_VOCAB_ENABLED ? "Không thêm được" : "Không có trong bộ từ của app"}: ${refused.join(", ")}.` : "")
    );
  };

  const keepSentence = async (wordId: string, sentence: string) => {
    const ok = await addUserContextExample(wordId, sentence).catch(() => false);
    setSavedSentences((prev) => new Set(prev).add(wordId));
    if (ok) refreshWords();
    showMessage(
      ok ? "Đã lưu câu này làm ví dụ: bài điền từ sẽ dùng câu của bạn trước." : "Câu này đã có trong ví dụ của từ.",
      4000
    );
  };

  if (!analysis) {
    return (
      <div className={`${PAGE_CONTAINER} space-y-4`}>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Đọc với sổ từ của bạn
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-2xl">
            Dán một đoạn tài liệu, mô tả PR, email hay bài viết tiếng Anh. App tô màu những từ bạn đã thuộc và đang học, gợi ý
            từ lạ đáng học, và lưu câu bạn gặp chúng làm ví dụ.
          </p>
        </div>
        {message && (
          <div className="flex items-start justify-between gap-3 py-1 pl-4 pr-1 rounded-2xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-sm text-teal-900 dark:text-teal-200">
            <span className="min-w-0 py-2.5">{message}</span>
            <button onClick={() => setMessage(null)} aria-label="Đóng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100 hover:bg-white/60 dark:hover:bg-black/20">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-3.5 md:p-5 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isMobilePlatform() ? "Dán văn bản tiếng Anh vào đây…" : `Dán văn bản tiếng Anh vào đây (${PASTE_KEYS})…`}
          rows={14}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-enable-grammarly="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className="w-full p-4 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base text-slate-800 dark:text-zinc-200 leading-relaxed focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            {text.length > MAX_CHARS ? `Chỉ đọc ${MAX_CHARS.toLocaleString()} ký tự đầu` : `${text.length.toLocaleString()} ký tự`}
          </span>
          <div className="flex items-center gap-2">
            {text && (
              <button
                onClick={() => {
                  setText("");
                  saveDraft("");
                }}
                className="min-h-12 px-4 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Xóa
              </button>
            )}
            <button
              onClick={startReading}
              disabled={!text.trim()}
              className="inline-flex items-center gap-2 min-h-12 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-base font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BookOpenText className="w-4 h-4" />
              Đọc
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  const shownCandidates = analysis.candidates.slice(0, MAX_CANDIDATES_SHOWN);
  const counts = { mastered: 0, learning: 0, new: 0 } as Record<BankStatus, number>;
  for (const h of analysis.bankHits) counts[h.status]++;

  return (
    <div className={`${PAGE_CONTAINER} space-y-4`}>
      {message && (
        <div className="flex items-start justify-between gap-3 py-1 pl-4 pr-1 rounded-2xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-sm text-teal-900 dark:text-teal-200">
          <span className="min-w-0 py-2.5">{message}</span>
          <button onClick={() => setMessage(null)} aria-label="Đóng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100 hover:bg-white/60 dark:hover:bg-black/20">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-300 flex-wrap">
          <span className={STATUS_STYLE.mastered}>Đã thuộc ({counts.mastered})</span>
          <span className={STATUS_STYLE.learning}>Đang học ({counts.learning})</span>
          <span className={STATUS_STYLE.new}>Mới thêm ({counts.new})</span>
          <span className="border-b border-dotted border-slate-400">Từ lạ ({analysis.candidates.length})</span>
        </div>
        <button
          onClick={() => setReading(null)}
          className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-sm font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10"
        >
          <Pencil className="w-3.5 h-3.5" />
          Sửa / dán bài khác
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <article className="min-w-0 p-3.5 md:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] text-base leading-8 text-slate-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
          {analysis.segments.map((seg, i) => {
            const t = seg.token;
            if (!t || t.kind === "common") {
              return <span key={i}>{seg.text}</span>;
            }
            if (t.kind === "bank") {
              return (
                <span
                  key={i}
                  onClick={() => setSelectedWord(t.word)}
                  title={`${STATUS_LABEL[t.status]}: ${t.word.meaning_vn}`}
                  className={`cursor-pointer ${STATUS_STYLE[t.status]}`}
                >
                  {seg.text}
                </span>
              );
            }
            const on = picked.has(t.base);
            return (
              <span
                key={i}
                onClick={() => togglePick(t.base, t.sentence)}
                title={on ? "Bỏ chọn" : `Chọn "${t.base}" để thêm vào sổ`}
                className={`cursor-pointer ${on ? "bg-teal-200 dark:bg-teal-500/30 rounded px-0.5" : "border-b border-dotted border-slate-400 dark:border-zinc-500 hover:bg-teal-50 dark:hover:bg-teal-500/10"}`}
              >
                {seg.text}
              </span>
            );
          })}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-4">
          {picked.size > 0 && (
            <div className="p-4 rounded-2xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 space-y-3">
              <div className="text-sm font-semibold text-teal-900 dark:text-teal-200">Đã chọn {picked.size} từ</div>
              <div className="flex flex-wrap gap-1.5">
                {[...picked.keys()].map((b) => (
                  <button
                    key={b}
                    onClick={() => togglePick(b, "")}
                    className="inline-flex items-center gap-1 px-3 min-h-10 rounded-full bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-500/30 text-sm text-teal-800 dark:text-teal-200"
                  >
                    {b}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <button
                onClick={addPicked}
                disabled={adding}
                className="hidden lg:flex w-full items-center justify-center gap-1.5 min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Thêm vào sổ kèm câu ví dụ
              </button>
            </div>
          )}

          {analysis.bankHits.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Từ của bạn trong bài</h3>
              {analysis.bankHits.map((h) => (
                <div key={h.word.id} className="px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setSelectedWord(h.word)} className="min-w-0 text-sm font-semibold text-slate-900 dark:text-zinc-100 hover:underline text-left break-words">
                      {h.word.word}
                      {h.count > 1 && <span className="ml-1 font-normal text-slate-500 dark:text-zinc-400">×{h.count}</span>}
                    </button>
                    <span className={`shrink-0 text-xs ${STATUS_STYLE[h.status]}`}>{STATUS_LABEL[h.status]}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-1">{h.word.meaning_vn}</p>
                  {h.status !== "mastered" && h.sentence && (
                    <button
                      onClick={() => keepSentence(h.word.id, h.sentence)}
                      disabled={savedSentences.has(h.word.id)}
                      title={h.sentence}
                      className="inline-flex items-center gap-1 min-h-10 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline disabled:no-underline disabled:text-green-700 dark:disabled:text-green-400"
                    >
                      {savedSentences.has(h.word.id) ? <Check className="w-3 h-3" /> : <Quote className="w-3 h-3" />}
                      {savedSentences.has(h.word.id) ? "Đã lưu câu" : "Lưu câu này làm ví dụ"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {shownCandidates.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                <Sparkles className="w-3 h-3" />
                Từ lạ có thể đáng học
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {shownCandidates.map((c) => {
                  const on = picked.has(c.base);
                  return (
                    <button
                      key={c.base}
                      onClick={() => togglePick(c.base, c.sentence)}
                      title={c.sentence}
                      className={`px-3 min-h-10 rounded-full border text-sm transition-colors ${on ? "bg-teal-700 border-teal-700 !text-white dark:bg-teal-600 dark:border-teal-600" : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}
                    >
                      {c.base}
                      {c.count > 1 && <span className="opacity-60"> ×{c.count}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Bấm vào từ trong bài hoặc ở đây để chọn. Danh sách chỉ loại các từ rất phổ biến, nên vẫn có thể có từ bạn đã biết.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* On a phone the list of picked words is far down: this bar stays in view */}
      {picked.size > 0 && (
        <div className="lg:hidden sticky bottom-2 z-20 flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-4 pr-2 shadow-md">
          <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">Đã chọn {picked.size} từ</span>
          <button
            onClick={addPicked}
            disabled={adding}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-12 px-5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 !text-white text-base font-semibold shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Thêm vào sổ
          </button>
        </div>
      )}
    </div>
  );
}