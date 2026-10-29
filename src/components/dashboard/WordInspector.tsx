import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Sparkles,
  Volume2,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  Code2,
  Copy,
  Terminal,
  Layers,
  Tag,
  GraduationCap,
  Snail,
  Brain,
  Lightbulb,
  History,
  PauseCircle,
  PlayCircle,
  Link2,
  Info,
  MoreVertical,
} from "lucide-react";
import { updateWordTopic, PREDEFINED_TOPICS } from "@/services/db";
import { parseTerms, parseCollocations, type SRSReview, type TermWithMeaning, type WordDetail } from "@/types/database";
import { useWordsStore } from "@/stores/wordsStore";
import { getCatalogEntries, type CatalogEntry } from "@/services/vocabCatalog";
import { pipeline } from "@/services/pipeline";
import { handleSpeak, type DashboardTab } from "./shared";
import { SLOW_RATE } from "../review/speech";
import { AI_VOCAB_ENABLED } from "@/services/features";
import { pullMessage, pullWordFromDeck } from "@/services/vocabFeed";
import { WORD_STATUS_LABELS, wordStatus } from "@/services/wordStatus";
import { calculateRetrievability, isLeechWord } from "@/services/smartReview";
import { setWordSuspended } from "@/services/reviewRecorder";
import { generateSmartMnemonic, getStoredMnemonic } from "@/services/aiMnemonic";
import { formatNextReviewRelative } from "@/utils/reviewSchedule";
import ReviewTrajectoryModal from "../review/ReviewTrajectoryModal";

interface WordInspectorProps {
  requestDeleteWord: (wordId: string, wordText: string, e?: React.MouseEvent) => void;
  expandedTerms: Record<string, boolean>;
  toggleTermExpanded: (termKey: string, e?: React.MouseEvent) => void;
  copiedSnippet: boolean;
  handleCopyCode: (code: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setMessage: (msg: string | null) => void;
}

const STATE_LABEL: Record<number, string> = { 0: "Chưa học", 1: "Đang học", 2: "Đang ôn", 3: "Học lại" };

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  } catch {
    return [];
  }
}

const dateVn = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const inStudy = (s: Partial<SRSReview> | null | undefined): s is SRSReview => !!s && (s.state ?? 0) > 0;

/** A titled block of the panel; `id` is the target of the section bar */
function Section({ id, icon, title, right, children }: { id: string; icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-2 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-zinc-100">
          {icon}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/60">
      <div className="text-xs text-slate-600 dark:text-zinc-400 truncate">{label}</div>
      <div className={`truncate text-base font-bold tabular-nums ${tone || "text-slate-900 dark:text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 dark:text-zinc-400 truncate">{sub}</div>}
    </div>
  );
}

/**
 * RIGHT SLIDE-OVER WORD DETAIL INSPECTOR (renders nothing when no word is selected). An overlay above the
 * page, so it never squeezes the main content; MainDashboard closes it on a tab change or a session start.
 * Everything known about the word, in order: how to say it, its meanings, examples, related words, a memory
 * hook, and its two memory cards (recognise the meaning / recall the word) with their schedules and history.
 */
export default function WordInspector({
  requestDeleteWord,
  expandedTerms,
  toggleTermExpanded,
  copiedSnippet,
  handleCopyCode,
  setActiveTab,
  setMessage,
}: WordInspectorProps) {
  const selectedWord = useWordsStore((s) => s.selectedWord);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);
  const setWords = useWordsStore((s) => s.setWords);
  const allWords = useWordsStore((s) => s.words);
  const inDeck = (term: string) => allWords.some((w) => w.word.trim().toLowerCase() === term.trim().toLowerCase());
  const scrollRef = useRef<HTMLDivElement>(null);

  const [catalogEntry, setCatalogEntry] = useState<CatalogEntry | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCatalogEntry(null);
    if (!selectedWord?.catalog_id) return;
    getCatalogEntries([selectedWord.catalog_id])
      .then(([e]) => !cancelled && setCatalogEntry(e ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedWord?.catalog_id]);

  // Memory hook: the saved one, or one made on request (algorithmic, no AI needed)
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // On a phone the numbers and the section bar are folded away, so the header does not fill the screen
  const [showSummary, setShowSummary] = useState(false);
  useEffect(() => {
    setMnemonic(selectedWord ? getStoredMnemonic(selectedWord.id, selectedWord.meaning_vn) : null);
    setShowHistory(false);
    setMenuOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedWord?.id]);

  /** Related terms are not added automatically (that bypassed the daily new-word limit); the learner chooses */
  const addRelatedTerm = (term: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!AI_VOCAB_ENABLED) {
      pullWordFromDeck(term)
        .then((r) => setMessage(pullMessage(r)))
        .catch(() => {});
      return;
    }
    pipeline.enqueue(term).then((res) =>
      setMessage(res.accepted ? `Đã thêm "${term}" vào sổ từ, AI đang phân tích...` : `Không thể thêm "${term}": ${res.reason}`)
    );
  };

  const patchWord = (id: string, patch: Partial<WordDetail>) => {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    setSelectedWord((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const handleUpdateTopic = async (wordId: string, newTopic: string) => {
    const cleanTopic = newTopic.trim() || "General Tech";
    try {
      await updateWordTopic(wordId, cleanTopic);
      patchWord(wordId, { topic: cleanTopic });
      setMessage(`Đã cập nhật chủ đề sang "${cleanTopic}"!`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Failed to update topic:", err);
      setMessage(`Lỗi cập nhật chủ đề: ${err}`);
    }
  };

  const toggleSuspended = async (w: WordDetail) => {
    const on = !w.suspended;
    try {
      await setWordSuspended(w.id, on);
      patchWord(w.id, { suspended: on ? 1 : 0 });
      setMessage(on ? `Đã tạm ngưng "${w.word}": từ này không được hỏi lại cho đến khi bạn bật lại` : `Đã đưa "${w.word}" trở lại lịch ôn`);
    } catch (err) {
      setMessage(`Không đổi được trạng thái: ${err}`);
    }
  };

  if (!selectedWord) return null;
  const w = selectedWord;
  const status = wordStatus(w);
  const now = new Date();
  const leech = isLeechWord(w);
  const lapses = Math.max(w.srs?.lapses ?? 0, w.srsProduction?.lapses ?? 0);
  const studied = [w.srs, w.srsProduction].filter(inStudy);
  const recall = studied.length > 0 ? Math.min(...studied.map((s) => calculateRetrievability(s, now))) : null;
  const nextTimes = studied.map((s) => new Date(s.next_review_date).getTime()).filter(Number.isFinite);
  const nextAt = nextTimes.length > 0 ? new Date(Math.min(...nextTimes)) : null;
  const next = nextAt ? formatNextReviewRelative(nextAt, false, now) : null;
  const stats = w.stats;

  const ipaUs = catalogEntry?.ipaUs.length ? catalogEntry.ipaUs : w.phonetic ? [w.phonetic] : [];
  const ipaUk = catalogEntry?.ipaUk ?? [];
  const senses = catalogEntry?.senses ?? [];
  const posList = senses.length > 0 ? Array.from(new Set(senses.map((s) => s.pos))) : w.part_of_speech ? [w.part_of_speech] : [];
  const variants = Array.from(new Set([...(catalogEntry?.variants ?? []), ...parseList(w.variants)]));
  const forms = Array.from(new Set([...(catalogEntry?.irregular ?? []), ...parseList(w.forms)])).filter(
    (f) => f.toLowerCase() !== w.word.toLowerCase()
  );
  const colls = parseCollocations(w.collocations);
  const syns = parseTerms(w.synonyms);
  const ants = parseTerms(w.antonyms);
  const cefr = catalogEntry?.cefr ?? w.cefr_level ?? null;

  const nav: Array<[string, string]> = [
    ["wi-meaning", "Nghĩa"],
    ...(w.examples.length > 0 ? ([["wi-examples", `Ví dụ (${w.examples.length})`]] as Array<[string, string]>) : []),
    ...(colls.length + syns.length + ants.length > 0 ? ([["wi-related", "Từ liên quan"]] as Array<[string, string]>) : []),
    ["wi-mnemonic", "Mẹo nhớ"],
    ...(w.code_snippet ? ([["wi-code", "Đoạn mã"]] as Array<[string, string]>) : []),
    ["wi-memory", "Trí nhớ & lịch ôn"],
    ["wi-info", "Thông tin"],
  ];
  const jump = (id: string) => scrollRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Chi tiết từ ${w.word}`}>
      {/* Dimmed page behind: a click closes the panel */}
      <div
        aria-hidden="true"
        onClick={() => setSelectedWord(null)}
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 animate-in fade-in duration-150"
      />
      <aside className="relative h-full w-full max-w-[640px] md:w-[580px] lg:w-[640px] border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col animate-in slide-in-from-right duration-200 shadow-xl">
        {/* ── Header: the word, how to say it, where it stands ── */}
        <div className="shrink-0 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-5 pt-4 pb-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <BookOpen className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Chi tiết từ vựng
                </div>
                <h2 className="break-words text-3xl font-bold text-slate-900 select-text dark:text-white">{w.word}</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {posList.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {p}
                    </span>
                  ))}
                  {cefr && (
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">{cefr}</span>
                  )}
                  {catalogEntry && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      Oxford {catalogEntry.list}
                    </span>
                  )}
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300">
                    {WORD_STATUS_LABELS[status]}
                  </span>
                  {leech && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Từ khó</span>}
                  {!!w.suspended && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">Đang tạm ngưng</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Delete lives in a menu, away from the close button */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Thêm tùy chọn"
                    aria-expanded={menuOpen}
                    title="Thêm tùy chọn"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[11rem] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                      <button
                        onClick={(e) => {
                          setMenuOpen(false);
                          requestDeleteWord(w.id, w.word, e);
                        }}
                        className="flex min-h-11 w-full items-center gap-2 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" /> Xoá từ này
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedWord(null)}
                  aria-label="Đóng chi tiết từ vựng"
                  title="Đóng (Esc)"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pronunciation: US and UK IPA, normal and slow */}
            <div className="flex flex-wrap items-center gap-2 text-sm select-text">
              {ipaUs.length > 0 && (
                <span className="font-mono text-slate-700 dark:text-zinc-200">
                  <span className="text-xs font-sans font-bold text-slate-600 dark:text-zinc-400 mr-1">US</span>
                  {ipaUs.join(", ")}
                </span>
              )}
              {ipaUk.length > 0 && ipaUk.join() !== ipaUs.join() && (
                <span className="font-mono text-slate-700 dark:text-zinc-200">
                  <span className="text-xs font-sans font-bold text-slate-600 dark:text-zinc-400 mr-1">UK</span>
                  {ipaUk.join(", ")}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => handleSpeak(w.word)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-teal-700 px-4 font-semibold text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  <Volume2 className="w-4 h-4" /> Nghe
                </button>
                <button
                  onClick={() => handleSpeak(w.word, SLOW_RATE)}
                  title="Nghe chậm"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-teal-700/30 bg-white px-4 font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                >
                  <Snail className="w-4 h-4" /> Chậm
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSummary((v) => !v)}
              aria-expanded={showSummary}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10 sm:hidden"
            >
              {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showSummary ? "Ẩn chỉ số và mục lục" : "Xem chỉ số và mục lục"}
            </button>

            {/* Four numbers at a glance */}
            <div className={`${showSummary ? "grid" : "hidden"} sm:grid grid-cols-2 sm:grid-cols-4 gap-2`}>
              <Stat
                label="Nhớ lúc này"
                value={recall == null ? "—" : `${Math.round(recall * 100)}%`}
                tone={
                  recall == null
                    ? ""
                    : recall >= 0.85
                      ? "text-green-700 dark:text-green-400"
                      : recall >= 0.7
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-red-700 dark:text-red-400"
                }
                sub={recall == null ? "chưa học" : "thẻ yếu hơn"}
              />
              <Stat
                label="Ôn tiếp"
                value={w.suspended ? "—" : next ? (next.diffMs <= 0 ? "Đến hạn" : next.shortLabel) : "—"}
                tone={next && next.diffMs <= 0 && !w.suspended ? "text-amber-700 dark:text-amber-400" : ""}
                sub={w.suspended ? "đang tạm ngưng" : nextAt ? dateVn(nextAt.toISOString()) : "chưa có lịch"}
              />
              <Stat
                label="Đúng / sai"
                value={stats && stats.totalAttempts > 0 ? `${stats.correctCount}/${stats.wrongCount}` : "—"}
                sub={stats && stats.totalAttempts > 0 ? `${stats.accuracy}% chính xác` : "chưa trả lời"}
              />
              <Stat label="Đã quên" value={`${lapses} lần`} tone={lapses >= 2 ? "text-red-700 dark:text-red-400" : ""} sub={leech ? "từ khó" : " "} />
            </div>
          </div>

          {/* Section bar: jump to any part of the panel */}
          <nav className={`${showSummary ? "flex" : "hidden"} sm:flex px-5 pb-3 flex-wrap gap-2`} aria-label="Các phần chi tiết">
            {nav.map(([id, label]) => (
              <button
                key={id}
                onClick={() => jump(id)}
                className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content: meanings, examples and messages can be selected and copied ── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-7 select-text">
          {/* Meaning: the short one, then every sense of the dictionary entry */}
          <Section id="wi-meaning" icon={<Sparkles className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />} title="Nghĩa tiếng Việt">
            <p className="text-lg font-medium leading-relaxed text-slate-900 dark:text-zinc-100">{w.meaning_vn}</p>
            {senses.length > 1 && (
              <ol className="space-y-1.5 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
                {senses.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-800 dark:text-zinc-200">
                    <span className="font-mono text-xs text-slate-600 dark:text-zinc-400 w-4 shrink-0 pt-0.5">{i + 1}.</span>
                    <span className="w-14 shrink-0 pt-0.5 text-xs italic text-slate-500 dark:text-zinc-400">{s.pos}</span>
                    <span>{s.vn}</span>
                  </li>
                ))}
              </ol>
            )}
            {(forms.length > 0 || variants.length > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-zinc-300">
                {forms.length > 0 && (
                  <span>
                    <span className="text-slate-600 dark:text-zinc-400">Dạng khác: </span>
                    <span className="font-mono">{forms.join(", ")}</span>
                  </span>
                )}
                {variants.length > 0 && (
                  <span>
                    <span className="text-slate-600 dark:text-zinc-400">Cách viết khác: </span>
                    <span className="font-mono">{variants.join(", ")}</span>
                  </span>
                )}
              </div>
            )}
          </Section>

          {/* Examples: sense, sentence, translation, grammar */}
          {w.examples.length > 0 && (
            <Section
              id="wi-examples"
              icon={<Code2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />}
              title="Câu ví dụ"
              right={<span className="text-xs text-slate-600 dark:text-zinc-400">{w.examples.length} câu</span>}
            >
              <div className="space-y-3">
                {w.examples.map((ex, idx) => {
                  const sense = ex.sense_index != null ? senses[ex.sense_index] : undefined;
                  const source =
                    ex.source === "user_context" ? "Câu bạn gặp" : ex.source === "catalog" ? "Oxford" : ex.source === "ai" || !ex.source ? "AI viết" : ex.source;
                  return (
                    <div key={ex.id || idx} className="space-y-2 rounded-xl bg-slate-50 p-3.5 dark:bg-zinc-800/60">
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="font-bold text-teal-700 dark:text-teal-300">#{idx + 1}</span>
                        {sense && (
                          <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300">
                            {sense.pos} · {sense.vn}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">{source}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-base font-semibold leading-relaxed text-slate-900 dark:text-white">{ex.sentence_en}</p>
                        <button
                          onClick={() => handleSpeak(ex.sentence_en)}
                          title="Nghe cả câu"
                          aria-label="Nghe cả câu"
                          className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-teal-300"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {ex.sentence_vn && <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{ex.sentence_vn}</p>}
                      {ex.grammar_analysis && ex.grammar_analysis.trim() && (
                        <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Phân tích câu</div>
                          <p className="text-xs font-mono text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{ex.grammar_analysis}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setSelectedWord(null);
                  setActiveTab("grammar");
                }}
                className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
              >
                <GraduationCap className="w-4 h-4" /> Mở trung tâm ngữ pháp
              </button>
            </Section>
          )}

          {/* Collocations, synonyms, antonyms */}
          {colls.length + syns.length + ants.length > 0 && (
            <Section id="wi-related" icon={<Link2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />} title="Từ liên quan">
              {colls.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Cụm từ thường gặp
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {colls.map((c, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {syns.length > 0 && (
                <TermList
                  kind="syn"
                  title="Từ đồng nghĩa"
                  terms={syns}
                  expandedTerms={expandedTerms}
                  toggle={toggleTermExpanded}
                  inDeck={inDeck}
                  onAdd={addRelatedTerm}
                />
              )}
              {ants.length > 0 && (
                <TermList
                  kind="ant"
                  title="Từ trái nghĩa"
                  terms={ants}
                  expandedTerms={expandedTerms}
                  toggle={toggleTermExpanded}
                  inDeck={inDeck}
                  onAdd={addRelatedTerm}
                />
              )}
            </Section>
          )}

          {/* Memory hook */}
          <Section id="wi-mnemonic" icon={<Lightbulb className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />} title="Mẹo nhớ">
            {mnemonic ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 dark:bg-zinc-800/60 dark:text-zinc-100">
                {mnemonic}
              </p>
            ) : (
              <button
                onClick={() => {
                  const id = w.id;
                  generateSmartMnemonic(w).then((m) => useWordsStore.getState().selectedWord?.id === id && setMnemonic(m));
                }}
                className="inline-flex min-h-11 items-center rounded-2xl border border-teal-700/30 bg-white px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
              >
                Tạo mẹo nhớ cho từ này
              </button>
            )}
          </Section>

          {/* Code snippet (words added with one) */}
          {w.code_snippet && (
            <Section
              id="wi-code"
              icon={<Terminal className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />}
              title="Đoạn mã ngữ cảnh"
              right={
                <button
                  onClick={() => handleCopyCode(w.code_snippet!)}
                  className="flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                >
                  {copiedSnippet ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-600" /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Sao chép
                    </>
                  )}
                </button>
              }
            >
              <pre className="rounded-xl bg-[#0d1117] p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre border border-zinc-800">
                <code>{w.code_snippet}</code>
              </pre>
            </Section>
          )}

          {/* The two memory cards and their schedules */}
          <Section
            id="wi-memory"
            icon={<Brain className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />}
            title="Trí nhớ & lịch ôn"
            right={
              <button onClick={() => setShowHistory(true)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10">
                <History className="w-3.5 h-3.5" /> Lịch sử ôn
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MemoryCard title="Nhận ra nghĩa" hint="Thấy từ tiếng Anh, chọn hoặc nhớ nghĩa" srs={w.srs} now={now} suspended={!!w.suspended} />
              <MemoryCard
                title="Tự nhớ ra từ"
                hint="Thấy nghĩa, tự gõ ra từ tiếng Anh"
                srs={w.srsProduction ?? null}
                now={now}
                suspended={!!w.suspended}
                emptyText="Chưa mở: thẻ này mở khi bạn nhận ra nghĩa vững (khoảng 3 ngày trở lên)."
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Độ bền: số ngày trí nhớ còn giữ được ở mức tốt. Độ khó: 1 (dễ) đến 10 (khó). Nhớ lúc này: khả năng bạn còn nhớ ngay bây giờ.
            </p>
            <button
              onClick={() => toggleSuspended(w)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                w.suspended
                  ? "border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {w.suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              {w.suspended ? "Ôn lại từ này" : "Tạm ngưng ôn từ này"}
            </button>
          </Section>

          {/* Where the word comes from */}
          <Section id="wi-info" icon={<Info className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />} title="Thông tin">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-slate-600 dark:text-zinc-400">Ngày thêm</dt>
              <dd className="text-slate-700 dark:text-zinc-200">{dateVn(w.created_at)}</dd>
              <dt className="text-slate-600 dark:text-zinc-400">Nguồn</dt>
              <dd className="text-slate-700 dark:text-zinc-200">{w.catalog_id ? `Bộ từ Oxford ${catalogEntry?.list ?? ""}`.trim() : "Bạn tự thêm"}</dd>
              {catalogEntry?.it && (
                <>
                  <dt className="text-slate-600 dark:text-zinc-400">Nhóm</dt>
                  <dd className="text-slate-700 dark:text-zinc-200">Từ hay dùng trong IT (được học trước)</dd>
                </>
              )}
              {stats && stats.totalAttempts > 0 && (
                <>
                  <dt className="text-slate-600 dark:text-zinc-400">Đã trả lời</dt>
                  <dd className="text-slate-700 dark:text-zinc-200">
                    {stats.totalAttempts} lần · {stats.correctCount} đúng · {stats.wrongCount} sai ({stats.accuracy}%)
                  </dd>
                </>
              )}
            </dl>
            {!w.catalog_id && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Tag className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                <span className="text-slate-600 dark:text-zinc-400">Chủ đề</span>
                <select
                  value={w.topic || "General Tech"}
                  onChange={(e) => handleUpdateTopic(w.id, e.target.value)}
                  className="min-h-11 rounded-2xl border border-slate-300 bg-white px-3 text-slate-800 focus:border-teal-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  {PREDEFINED_TOPICS.map((top) => (
                    <option key={top} value={top}>
                      {top}
                    </option>
                  ))}
                  {w.topic && !PREDEFINED_TOPICS.includes(w.topic as (typeof PREDEFINED_TOPICS)[number]) && <option value={w.topic}>{w.topic}</option>}
                </select>
              </div>
            )}
          </Section>
        </div>
      </aside>

      <ReviewTrajectoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} word={w} />
    </div>
  );
}

/** One of the word's two memory cards: state, stability, difficulty, reviews, lapses, last and next review */
function MemoryCard({
  title,
  hint,
  srs,
  now,
  suspended,
  emptyText = "Chưa học",
}: {
  title: string;
  hint: string;
  srs: SRSReview | null;
  now: Date;
  suspended: boolean;
  emptyText?: string;
}) {
  const studied = inStudy(srs);
  const r = studied ? Math.round(calculateRetrievability(srs, now) * 100) : null;
  const next = studied ? formatNextReviewRelative(srs.next_review_date, false, now) : null;
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          <div className="text-xs text-slate-600 dark:text-zinc-400 truncate">{hint}</div>
        </div>
        {studied && (
          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
            {STATE_LABEL[srs.state ?? 0]}
          </span>
        )}
      </div>
      {!studied ? (
        <p className="text-xs text-slate-600 dark:text-zinc-400">{emptyText}</p>
      ) : (
        <>
          {r != null && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${r >= 85 ? "bg-green-600" : r >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${r}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">nhớ {r}%</span>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-600 dark:text-zinc-400">Độ bền</dt>
            <dd className="font-mono text-slate-800 dark:text-zinc-200 text-right">{(srs.stability ?? 0).toFixed(1)} ngày</dd>
            <dt className="text-slate-600 dark:text-zinc-400">Độ khó</dt>
            <dd className="font-mono text-slate-800 dark:text-zinc-200 text-right">{(srs.difficulty ?? 0).toFixed(1)}/10</dd>
            <dt className="text-slate-600 dark:text-zinc-400">Số lần ôn</dt>
            <dd className="font-mono text-slate-800 dark:text-zinc-200 text-right">{srs.reps ?? srs.repetitions ?? 0}</dd>
            <dt className="text-slate-600 dark:text-zinc-400">Số lần quên</dt>
            <dd className={`font-mono text-right ${(srs.lapses ?? 0) >= 2 ? "text-red-700 dark:text-red-400" : "text-slate-800 dark:text-zinc-200"}`}>
              {srs.lapses ?? 0}
            </dd>
            <dt className="text-slate-600 dark:text-zinc-400">Ôn gần nhất</dt>
            <dd className="text-slate-800 dark:text-zinc-200 text-right">{dateVn(srs.last_review)}</dd>
            <dt className="text-slate-600 dark:text-zinc-400">Ôn tiếp</dt>
            <dd className="text-right">
              {suspended ? (
                <span className="text-slate-600 dark:text-zinc-400">tạm ngưng</span>
              ) : next ? (
                <span title={next.exactDateStr} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${next.badgeClass.replace("animate-pulse", "")}`}>
                  {next.diffMs <= 0 ? next.label : `${next.label}`}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </>
      )}
    </div>
  );
}

/** Synonyms or antonyms: each term with its IPA, meaning, a way to add it, and its example sentences on click */
function TermList({
  kind,
  title,
  terms,
  expandedTerms,
  toggle,
  inDeck,
  onAdd,
}: {
  kind: "syn" | "ant";
  title: string;
  terms: TermWithMeaning[];
  expandedTerms: Record<string, boolean>;
  toggle: (key: string, e?: React.MouseEvent) => void;
  inDeck: (term: string) => boolean;
  onAdd: (term: string, e?: React.MouseEvent) => void;
}) {
  const tone =
    kind === "syn"
      ? { dot: "bg-teal-600", text: "text-teal-800 dark:text-teal-300", border: "border-teal-600 dark:border-teal-400/60" }
      : { dot: "bg-slate-400", text: "text-slate-800 dark:text-zinc-200", border: "border-slate-400 dark:border-zinc-500" };
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${tone.dot}`} /> {title} <span className="text-slate-600 dark:text-zinc-400 font-normal">({terms.length})</span>
      </div>
      <div className="space-y-1.5">
        {terms.map((t, idx) => {
          const key = `${kind}-${t.word}`;
          const open = !!expandedTerms[key];
          const examples = t.examples ?? [];
          return (
            <div
              key={idx}
              className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${open ? tone.border : "border-slate-200 dark:border-zinc-800"}`}
            >
              <div
                onClick={() => examples.length > 0 && toggle(key)}
                className={`px-3 py-2 flex items-start justify-between gap-2 ${examples.length > 0 ? "cursor-pointer" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-base font-semibold ${tone.text}`}>{t.word}</span>
                    {t.phonetic && <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">{t.phonetic}</span>}
                    <button
                      onClick={(e) => handleSpeak(t.word, e)}
                      title="Phát âm"
                      aria-label="Phát âm"
                      className="-my-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    {inDeck(t.word) ? (
                      <span className="text-xs text-slate-600 dark:text-zinc-400">đã có trong sổ</span>
                    ) : (
                      <button
                        onClick={(e) => onAdd(t.word, e)}
                        title="Thêm từ này vào sổ để học"
                        className="inline-flex min-h-10 items-center rounded-2xl border border-teal-700/30 bg-white px-3 text-xs font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
                      >
                        + Thêm vào sổ
                      </button>
                    )}
                  </div>
                  {t.meaning_vn && <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">{t.meaning_vn}</p>}
                </div>
                {examples.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400 shrink-0">
                    {examples.length} ví dụ
                    {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                )}
              </div>
              {open && examples.length > 0 && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-zinc-800 pt-2">
                  {examples.map((ex, i) => (
                    <div key={i} className="text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{ex.sentence_en}</p>
                        <button onClick={(e) => handleSpeak(ex.sentence_en, e)} title="Nghe câu" aria-label="Nghe câu" className="-my-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300">
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {ex.meaning_vn && <p className="text-slate-600 dark:text-zinc-300">{ex.meaning_vn}</p>}
                      {ex.structure && <p className="font-mono text-xs text-slate-600 dark:text-zinc-400">Cấu trúc: {ex.structure}</p>}
                      {ex.why_used && <p className="text-xs text-slate-600 dark:text-zinc-400">Vì sao: {ex.why_used}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
