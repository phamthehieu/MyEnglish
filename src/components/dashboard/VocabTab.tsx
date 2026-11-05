import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Target,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import MarkLevelKnownModal from "./MarkLevelKnownModal";
import {
  CATALOG_LEVEL_COUNTS,
  STUDY_LEVELS,
  ensureCatalogSeeded,
  searchCatalog,
  type CatalogEntry,
  type StudyLevel,
} from "@/services/vocabCatalog";
import {
  UNLOCK_MET_SHARE,
  UNLOCK_REMEMBERED_SHARE,
  changeStudyLevels,
  getStudyLevels,
  learnEarly,
  levelWeights,
  loadLevelProgress,
  markCatalogWordsKnown,
  nextUnstudiedEntries,
  suggestNextLevel,
  toggleStudyLevel,
  type LevelProgress,
} from "@/services/vocabFeed";
import {
  LEVEL_FOLDER_META,
  getActivePackId,
  loadPackWords,
  loadPacksForLevel,
  prioritizePackForStudy,
  type PackWordItem,
  type VocabPack,
} from "@/services/vocabPacks";
import { estimateNewWordsPerDay, levelEtaDays } from "@/services/progress";
import { getStudyLimits } from "@/services/srs";
import { useWordsStore } from "@/stores/wordsStore";
import { PAGE_CONTAINER, handleSpeak } from "./shared";
import { triggerConfetti } from "@/utils/confetti";

const LEVEL_NAMES: Record<StudyLevel, string> = {
  A1: "Mới bắt đầu",
  A2: "Cơ bản",
  B1: "Trung cấp",
  B2: "Khá",
  C1: "Thành thạo",
};

/**
 * Levels to study: a run of consecutive levels, which may start above A1 for a learner who is past the first
 * ones (see toggleStudyLevel for what a tap does). The chosen levels are mixed, lower levels more often.
 */
export function LevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: StudyLevel[];
  onChange: (levels: StudyLevel[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {STUDY_LEVELS.map((level) => {
          const on = value.includes(level);
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(toggleStudyLevel(value, level))}
              className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                on
                  ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                  on
                    ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950"
                    : "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
                }`}
              >
                {level}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-base font-semibold ${
                    on ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {LEVEL_NAMES[level]}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-600 dark:text-zinc-400">
                  {CATALOG_LEVEL_COUNTS[level]} từ
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                  on
                    ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950"
                    : "border-2 border-slate-200 dark:border-zinc-700"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
        Chạm một cấp để chọn cấp đó. Lỡ chọn nhầm thì chạm lại cấp cũ, từ đã học vẫn giữ nguyên.
      </p>
    </div>
  );
}

export function mixDescription(levels: StudyLevel[]): string {
  const skipped = levels[0] !== "A1" ? ` Bạn bỏ qua các cấp thấp hơn ${levels[0]}.` : "";
  if (levels.length === 1)
    return `Học các từ ${levels[0]} theo thứ tự phổ biến nhất trong giao tiếp & công việc.${skipped}`;
  const ratio = levels.map((_, i) => levels.length - i).join(":");
  return `Từ mới trộn các cấp ${levels.join(", ")} theo tỉ lệ ${ratio} (cấp thấp nhiều hơn). Trong mỗi cấp, từ thông dụng học trước.${skipped}`;
}

function useLevelProgress() {
  const [progress, setProgress] = useState<LevelProgress[] | null>(null);
  const seqRef = useRef(0);
  const reload = useCallback(() => {
    const seq = ++seqRef.current;
    loadLevelProgress()
      .then((p) => {
        if (seq === seqRef.current) setProgress(p);
      })
      .catch(() => {
        if (seq === seqRef.current) setProgress(null);
      });
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("words-changed", reload);
    window.addEventListener("myenglish-study-levels-changed", reload);
    return () => {
      seqRef.current++;
      window.removeEventListener("words-changed", reload);
      window.removeEventListener("myenglish-study-levels-changed", reload);
    };
  }, [reload]);
  return { progress, reload };
}

function ProgressBars({ progress, levels }: { progress: LevelProgress[]; levels: StudyLevel[] }) {
  return (
    <div className="space-y-2.5">
      {progress
        .filter((p) => levels.includes(p.level))
        .map((p) => {
          const pct = (n: number) => `${Math.min(100, Math.round((n * 100) / Math.max(1, p.total)))}%`;
          return (
            <div key={p.level} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {p.level} · {LEVEL_NAMES[p.level]}
                </span>
                <span
                  className="text-slate-500 dark:text-zinc-400"
                  title={`Nhớ lâu: đã ôn thật và sẽ không quên trong ít nhất 3 tuần. Gợi ý mở cấp mới khi gặp ${Math.round(
                    UNLOCK_MET_SHARE * 100
                  )}% số từ và nhớ lâu ${Math.round(UNLOCK_REMEMBERED_SHARE * 100)}%.`}
                >
                  {p.met}/{p.total} đã gặp · {p.remembered} nhớ lâu{p.known > 0 ? ` · ${p.known} đã biết` : ""}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-teal-200 dark:bg-teal-800" style={{ width: pct(p.met) }} />
                <div className="absolute inset-y-0 left-0 bg-green-600" style={{ width: pct(p.remembered) }} />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function formatEta(days: number): string {
  return days <= 60 ? `~${days} ngày` : `~${Math.round(days / 30)} tháng`;
}

function NextLevelNotice({
  progress,
  levels,
  onOpen,
  busy,
}: {
  progress: LevelProgress[];
  levels: StudyLevel[];
  onOpen: (next: StudyLevel) => void;
  busy?: boolean;
}) {
  const suggestion = suggestNextLevel(progress, levels);
  if (!suggestion) return null;
  const { next, reason } = suggestion;
  const names = levels.join(", ");
  const text =
    reason === "exhausted"
      ? next
        ? `Bạn đã nhận hết từ mới của ${names}. Các từ đã nhận vẫn được ôn như bình thường, nhưng sẽ không có từ mới nữa cho đến khi mở thêm ${next}.`
        : "Bạn đã nhận hết 5.004 từ của bộ Oxford. Các từ đã nhận vẫn được ôn như bình thường."
      : `Bạn đã gặp hơn ${Math.round(UNLOCK_MET_SHARE * 100)}% số từ ${names} và nhớ lâu được hơn một nửa. Sẵn sàng học thêm cấp ${next}.`;
  return (
    <div
      className={`space-y-3 rounded-2xl border p-4 text-sm leading-relaxed ${
        reason === "exhausted"
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          : "border-teal-700/20 bg-teal-50 text-teal-900 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-100"
      }`}
    >
      <p>{text}</p>
      {next && (
        <button
          onClick={() => onOpen(next)}
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          Mở thêm {next} · {LEVEL_NAMES[next]}
        </button>
      )}
    </div>
  );
}

/** Today screen: progress of the chosen levels, and the next level when it is time */
export function TodayLevelCard({ onOpen }: { onOpen: () => void }) {
  const { progress } = useLevelProgress();
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [busy, setBusy] = useState(false);
  const levels = getStudyLevels();
  if (!progress) return null;
  const openNext = async (next: StudyLevel) => {
    setBusy(true);
    try {
      await changeStudyLevels([...levels, next]);
      refreshWords();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
          <Layers className="w-4 h-4 text-teal-700 dark:text-teal-300" /> Lộ trình từ vựng Oxford
        </span>
        <button
          onClick={onOpen}
          className="-mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
        >
          Chọn bộ từ · Đổi cấp
        </button>
      </div>
      <ProgressBars progress={progress} levels={levels} />
      <NextLevelNotice progress={progress} levels={levels} onOpen={openNext} busy={busy} />
    </div>
  );
}

function Skim({ levels, onChanged }: { levels: StudyLevel[]; onChanged: () => void }) {
  const [level, setLevel] = useState<StudyLevel>(levels[0]);
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!levels.includes(level)) setLevel(levels[0]);
  }, [levels, level]);

  const loadSeqRef = useRef(0);
  const load = useCallback(() => {
    const seq = ++loadSeqRef.current;
    setEntries(null);
    setPicked(new Set());
    setShown(new Set());
    nextUnstudiedEntries(level, 30)
      .then((list) => {
        if (seq === loadSeqRef.current) setEntries(list);
      })
      .catch(() => {
        if (seq === loadSeqRef.current) setEntries([]);
      });
  }, [level]);
  useEffect(() => {
    load();
    return () => {
      loadSeqRef.current++;
    };
  }, [load]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const markKnown = async () => {
    setBusy(true);
    try {
      const n = await markCatalogWordsKnown([...picked]);
      setMessage(`Đã đánh dấu ${n} từ là đã biết. Mỗi từ sẽ được hỏi lại một lần sau khoảng một tuần để chắc chắn.`);
      onChanged();
      load();
    } catch (err) {
      setMessage(`Không đánh dấu được: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const allShown = !!entries && entries.length > 0 && shown.size === entries.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {levels.length > 1 && (
          <div role="tablist" aria-label="Cấp" className="flex flex-wrap items-center gap-2">
            {levels.map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={l === level}
                onClick={() => setLevel(l)}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                  l === level
                    ? "bg-teal-700 text-white dark:bg-teal-600"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <span className="text-sm text-slate-500 dark:text-zinc-400">
          {entries ? `${entries.length} từ ${level} sắp học tiếp theo` : ""}
        </span>
        {entries && entries.length > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShown(allShown ? new Set() : new Set(entries.map((e) => e.id)))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {allShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {allShown ? "Ẩn nghĩa" : "Hiện nghĩa"}
            </button>
            <button
              onClick={() => setPicked(picked.size === entries.length ? new Set() : new Set(entries.map((e) => e.id)))}
              className="inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              {picked.size === entries.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          </span>
        )}
      </div>
      {!entries ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-zinc-800/70 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Bạn đã gặp hết các từ {level}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              onClick={() => setPicked((s) => toggle(s, e.id))}
              className={`flex min-h-12 min-w-0 cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-1 text-sm transition-colors ${
                picked.has(e.id)
                  ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10"
                  : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                checked={picked.has(e.id)}
                onClick={(ev) => ev.stopPropagation()}
                onChange={() => setPicked((s) => toggle(s, e.id))}
                aria-label={`Đã biết ${e.word}`}
                className="h-4 w-4 shrink-0 accent-teal-700"
              />
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleSpeak(e.word);
                }}
                title="Nghe"
                aria-label={`Nghe ${e.word}`}
                className="-mx-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <span className="min-w-0 shrink truncate font-semibold text-slate-900 dark:text-white">{e.word}</span>
              <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-zinc-400 truncate">
                {e.ipaUs[0] ?? e.ipaUk[0]}
              </span>
              {shown.has(e.id) ? (
                <span className="ml-auto text-xs text-slate-600 dark:text-zinc-300 truncate" title={e.vn}>
                  {e.vn}
                </span>
              ) : (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setShown((s) => toggle(s, e.id));
                  }}
                  className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-slate-600 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300"
                >
                  <Eye className="w-3 h-3" /> nghĩa
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {entries && entries.length > 0 && (
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:-mx-5 md:-mb-5 md:px-5">
          <button
            onClick={markKnown}
            disabled={picked.size === 0 || busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {picked.size > 0 ? `Đánh dấu ${picked.size} từ đã biết` : "Chọn từ bạn đã biết"}
          </button>
          {message ? (
            <p className="min-w-[200px] flex-1 text-sm text-green-700 dark:text-green-400">{message}</p>
          ) : (
            <p className="min-w-[200px] flex-1 text-sm text-slate-600 dark:text-zinc-400">
              Từ đã biết được bỏ qua phần học mới, chỉ hỏi lại một lần sau khoảng một tuần.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogSearch({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      searchCatalog(q, 30)
        .then((list) => {
          if (!stale) setResults(list);
        })
        .catch(() => {
          if (!stale) setResults([]);
        });
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const early = async (e: CatalogEntry) => {
    const res = await learnEarly(e.id);
    setMessage(
      res === "studied"
        ? `"${e.word}" đã có trong sổ từ của bạn.`
        : `"${e.word}" sẽ là từ mới tiếp theo trong buổi học tới.`
    );
    onChanged();
  };

  return (
    <div className="space-y-3">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900">
        <Search className="w-4 h-4 shrink-0 text-slate-500 dark:text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm trong 5.004 từ Oxford (ví dụ: schedule, meeting, report)…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      {!query.trim() ? (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Gặp một từ ở chỗ làm và muốn học ngay? Tìm nó rồi bấm <span className="font-semibold">Học sớm</span>: từ đó
          thành từ mới tiếp theo, kể cả khi thuộc cấp chưa mở.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Không có trong bộ Oxford 5000.</p>
      ) : null}
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
        {results.map((e) => (
          <div
            key={e.id}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              onClick={() => handleSpeak(e.word)}
              title="Nghe"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{e.word}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {e.cefr}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-zinc-300 truncate" title={e.vn}>
                <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                  {e.ipaUs[0] ?? e.ipaUk[0]}
                </span>
                {(e.ipaUs[0] ?? e.ipaUk[0]) ? " · " : ""}
                {e.vn}
              </div>
            </div>
            <button
              onClick={() => early(e)}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-2xl border border-teal-700/30 bg-white px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              <Zap className="w-3.5 h-3.5" /> Học sớm
            </button>
          </div>
        ))}
      </div>
      {message && <p className="text-sm text-teal-800 dark:text-teal-300">{message}</p>}
    </div>
  );
}

/**
 * Detailed view of a single Vocabulary Pack (01, 02...):
 * Lets the learner inspect all words in the pack, listen to pronunciation, mark words as known,
 * or prioritize this pack for immediate study.
 */
function PackDetailView({
  pack,
  isActivePack,
  onBack,
  onChanged,
}: {
  pack: VocabPack;
  isActivePack: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<PackWordItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unstudied" | "studied">("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hideMeaning, setHideMeaning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setItems(null);
    loadPackWords(pack.wordIds)
      .then((list) => setItems(list))
      .catch(() => setItems([]));
  }, [pack.wordIds]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "unstudied" && item.status !== "unstudied") return false;
      if (filter === "studied" && item.status === "unstudied") return false;
      if (q) {
        return item.entry.word.toLowerCase().includes(q) || item.entry.vn.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, filter, query]);

  const unstudiedIds = useMemo(
    () => (items ? items.filter((i) => i.status === "unstudied").map((i) => i.entry.id) : []),
    [items]
  );

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrioritize = async () => {
    setPrioritizing(true);
    try {
      const count = await prioritizePackForStudy(pack, 25);
      setBannerMsg(
        count > 0
          ? `Đã đưa ${count} từ mới của bộ "${pack.title}" lên đầu hàng đợi! Hãy qua tab Hôm nay để bắt đầu học ngay.`
          : `Tất cả từ trong bộ "${pack.title}" đã nằm trong danh sách học/ôn của bạn.`
      );
      onChanged();
      load();
    } finally {
      setPrioritizing(false);
    }
  };

  const handleMarkPickedKnown = async () => {
    if (picked.size === 0) return;
    setBusy(true);
    try {
      const count = await markCatalogWordsKnown([...picked]);
      setPicked(new Set());
      setBannerMsg(`Đã đánh dấu ${count} từ là Đã biết.`);
      triggerConfetti(2500);
      onChanged();
      load();
    } finally {
      setBusy(false);
    }
  };

  const numStr = String(pack.index).padStart(2, "0");
  const metPct = Math.min(100, Math.round((pack.met * 100) / Math.max(1, pack.total)));

  return (
    <div className="space-y-4">
      {/* Top Back Bar & Pack Hero */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-lg dark:border-zinc-800 md:p-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-200 transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách bộ {pack.level}
        </button>

        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 font-mono text-sm font-bold text-teal-300 ring-1 ring-teal-400/30">
                {numStr}
              </span>
              <span className="rounded-lg bg-teal-500/20 px-2.5 py-0.5 text-xs font-bold text-teal-300">
                {pack.level}
              </span>
              {pack.isThematic && (
                <span className="rounded-lg bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-200">
                  Chủ đề thông dụng
                </span>
              )}
              {isActivePack && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                  <Target className="w-3.5 h-3.5" /> Đang ưu tiên học
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{pack.title}</h2>
            <p className="text-sm leading-relaxed text-slate-300">{pack.description}</p>
          </div>

          <div className="grid w-full shrink-0 grid-cols-3 divide-x divide-white/15 rounded-2xl bg-white/10 py-3 text-center backdrop-blur-sm ring-1 ring-white/15 lg:w-auto lg:min-w-[300px]">
            <div className="px-2">
              <div className="font-mono text-xl font-bold text-white">{pack.total}</div>
              <div className="text-[11px] text-slate-300">từ vựng</div>
            </div>
            <div className="px-2">
              <div className="font-mono text-xl font-bold text-teal-300">{pack.met}</div>
              <div className="text-[11px] text-slate-300">đã học</div>
            </div>
            <div className="px-2">
              <div className="font-mono text-xl font-bold text-emerald-400">{pack.remembered}</div>
              <div className="text-[11px] text-slate-300">nhớ lâu</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={prioritizing || unstudiedIds.length === 0}
            onClick={handlePrioritize}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-teal-500 px-5 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-teal-400 disabled:opacity-50"
          >
            {prioritizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {isActivePack ? "Đưa thêm từ bộ này lên đầu hàng đợi" : "Ưu tiên học bộ từ này ngay"}
          </button>

          {unstudiedIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setPicked(picked.size === unstudiedIds.length ? new Set() : new Set(unstudiedIds))
              }
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <CheckCheck className="w-4 h-4 text-teal-300" />
              {picked.size === unstudiedIds.length ? "Bỏ chọn" : `Chọn ${unstudiedIds.length} từ chưa học`}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-300">
            <span>Tiến độ bộ: {metPct}%</span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-teal-400 transition-all" style={{ width: `${metPct}%` }} />
            </div>
          </div>
        </div>

        {bannerMsg && (
          <div className="mt-3 rounded-xl bg-teal-500/20 px-3.5 py-2 text-xs font-medium text-teal-200 ring-1 ring-teal-400/30">
            {bannerMsg}
          </div>
        )}
      </div>

      {/* Filter & Search Bar inside Pack */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: `Tất cả (${items?.length ?? pack.total})` },
              { id: "unstudied", label: `Chưa học (${unstudiedIds.length})` },
              { id: "studied", label: `Đã gặp (${(items?.length ?? pack.total) - unstudiedIds.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === t.id
                  ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/80">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lọc từ trong bộ..."
              className="w-36 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 sm:w-48"
            />
          </label>
          <button
            type="button"
            onClick={() => setHideMeaning((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {hideMeaning ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {hideMeaning ? "Hiện nghĩa" : "Che nghĩa để tự nhẩm"}
          </button>
        </div>
      </div>

      {/* Words Grid inside Pack */}
      {!items ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-zinc-800/70 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Không có từ nào khớp bộ lọc hiện tại.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filtered.map(({ entry: e, status }) => {
            const isPicked = picked.has(e.id);
            const ex = e.examples[0];
            const statusBadge =
              status === "remembered"
                ? { text: "Nhớ lâu ✓", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" }
                : status === "known"
                  ? { text: "Đã biết", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" }
                  : status === "learning"
                    ? { text: "Đang ôn", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" }
                    : { text: "Chưa học", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" };

            return (
              <div
                key={e.id}
                onClick={() => status === "unstudied" && togglePick(e.id)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                  status === "unstudied" ? "cursor-pointer" : ""
                } ${
                  isPicked
                    ? "border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-400/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                }`}
              >
                {status === "unstudied" && (
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={() => togglePick(e.id)}
                    aria-label={`Đã biết ${e.word}`}
                    className="mt-1.5 h-4 w-4 shrink-0 accent-teal-600"
                  />
                )}
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleSpeak(e.word);
                  }}
                  title={`Nghe phát âm ${e.word}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{e.word}</span>
                    {e.pos && (
                      <span className="text-xs italic text-slate-500 dark:text-zinc-400">({e.pos})</span>
                    )}
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
                      {e.ipaUs[0] ?? e.ipaUk[0]}
                    </span>
                    <span className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadge.cls}`}>
                      {statusBadge.text}
                    </span>
                  </div>

                  {hideMeaning ? (
                    <p className="text-xs italic text-slate-400 dark:text-zinc-500">
                      (Đã ẩn nghĩa — chạm nút Hiện nghĩa ở trên để đối chiếu)
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">{e.vn}</p>
                      {ex && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                          “{ex.en}” {ex.vi ? `— ${ex.vi}` : ""}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bottom bar when user selects words to mark as known */}
      {picked.size > 0 && (
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-500/40 bg-slate-900/95 px-5 py-3.5 text-white shadow-xl backdrop-blur">
          <span className="text-sm font-medium">
            Đã chọn <b className="text-teal-300">{picked.size}</b> từ bạn đã biết trong bộ này
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleMarkPickedKnown}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Đánh dấu {picked.size} từ Đã biết
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Vocabulary Tab:
 * Organized by CEFR Level Folders (A1 -> C1), each broken down into numbered Thematic & Foundation Packs (01, 02, 03...)
 * just like the folder-deck layout requested by the user.
 */
export default function VocabTab() {
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [levels, setLevels] = useState<StudyLevel[]>(getStudyLevels);
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel>(() => getStudyLevels()[0] ?? "A1");
  const [packs, setPacks] = useState<VocabPack[] | null>(null);
  const [packFilter, setPackFilter] = useState<"all" | "thematic" | "core">("all");
  const [openPackId, setOpenPackId] = useState<string | null>(null);
  const [activePackId, setActivePackIdState] = useState<string | null>(getActivePackId);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const { progress, reload } = useLevelProgress();
  const [modalLevel, setModalLevel] = useState<StudyLevel | null>(null);

  const loadPacksSeq = useRef(0);
  const reloadPacks = useCallback((lvl: StudyLevel) => {
    const seq = ++loadPacksSeq.current;
    loadPacksForLevel(lvl)
      .then((list) => {
        if (seq === loadPacksSeq.current) setPacks(list);
      })
      .catch(() => {
        if (seq === loadPacksSeq.current) setPacks([]);
      });
  }, []);

  useEffect(() => {
    ensureCatalogSeeded()
      .then(() => reloadPacks(selectedLevel))
      .catch(() => {});
  }, [selectedLevel, reloadPacks]);

  useEffect(() => {
    const onActivePack = () => setActivePackIdState(getActivePackId());
    window.addEventListener("myenglish-active-pack-changed", onActivePack);
    return () => window.removeEventListener("myenglish-active-pack-changed", onActivePack);
  }, []);

  const onChanged = useCallback(() => {
    reload();
    reloadPacks(selectedLevel);
    refreshWords();
  }, [reload, reloadPacks, selectedLevel, refreshWords]);

  const choose = async (next: StudyLevel[]) => {
    setSaving(true);
    try {
      const updated = await changeStudyLevels(next);
      setLevels(updated);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const folderMeta = LEVEL_FOLDER_META[selectedLevel];
  const levelProg = progress?.find((p) => p.level === selectedLevel);
  const totalWordsInLevel = levelProg?.total ?? CATALOG_LEVEL_COUNTS[selectedLevel];
  const metInLevel = levelProg?.met ?? 0;
  const rememberedInLevel = levelProg?.remembered ?? 0;
  const isLevelInRoadmap = levels.includes(selectedLevel);

  const visiblePacks = useMemo(() => {
    if (!packs) return [];
    if (packFilter === "thematic") return packs.filter((p) => p.isThematic);
    if (packFilter === "core") return packs.filter((p) => !p.isThematic);
    return packs;
  }, [packs, packFilter]);

  const openPack = useMemo(
    () => (openPackId && packs ? packs.find((p) => p.id === openPackId) ?? null : null),
    [openPackId, packs]
  );

  const perDay = estimateNewWordsPerDay(getStudyLimits().newCardsPerDay);
  const open = progress ? progress.filter((p) => levels.includes(p.level) && p.total - p.met > 0) : [];
  const weights = levelWeights(open.map((p) => p.level));
  const weightSum = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
  const etaDays =
    isLevelInRoadmap && levelProg && totalWordsInLevel > metInLevel
      ? levelEtaDays(totalWordsInLevel - metInLevel, perDay, (weights.get(selectedLevel) ?? 1) / weightSum)
      : 0;

  if (openPack) {
    return (
      <div className={`${PAGE_CONTAINER} space-y-4`}>
        <PackDetailView
          pack={openPack}
          isActivePack={activePackId === openPack.id}
          onBack={() => setOpenPackId(null)}
          onChanged={onChanged}
        />
      </div>
    );
  }

  return (
    <div className={`${PAGE_CONTAINER} space-y-4`}>
      {modalLevel && (
        <MarkLevelKnownModal
          level={modalLevel}
          progress={progress?.find((p) => p.level === modalLevel) ?? null}
          levels={levels}
          onClose={() => setModalLevel(null)}
          onDone={async (nextLevels?: StudyLevel[]) => {
            setModalLevel(null);
            if (nextLevels && nextLevels.length > levels.length) {
              await choose(nextLevels);
            } else {
              onChanged();
            }
          }}
        />
      )}

      {/* 1. Single-Row Horizontal Scrollable Level Bar (A1 -> C1) */}
      <div
        role="tablist"
        aria-label="Chọn cấp độ từ vựng"
        className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 scrollbar-none md:mx-0 md:px-0"
      >
        {STUDY_LEVELS.map((lvl) => {
          const selected = lvl === selectedLevel;
          const inRoadmap = levels.includes(lvl);
          const lp = progress?.find((p) => p.level === lvl);
          const pct = lp ? Math.min(100, Math.round((lp.met * 100) / Math.max(1, lp.total))) : 0;
          return (
            <button
              key={lvl}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setSelectedLevel(lvl);
                setOpenPackId(null);
              }}
              className={`group relative flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all ${
                selected
                  ? "border-indigo-500 bg-indigo-950 text-white shadow-sm dark:border-teal-400 dark:bg-teal-500/15 dark:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                  selected
                    ? "bg-teal-400 text-slate-950"
                    : inRoadmap
                      ? "bg-teal-50 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {lvl}
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold leading-none">
                  <span>{LEVEL_NAMES[lvl]}</span>
                  {inRoadmap && (
                    <span
                      title="Đang trong lộ trình học hằng ngày"
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    />
                  )}
                </div>
                <div
                  className={`mt-1 text-[11px] leading-none ${
                    selected ? "text-slate-300 dark:text-zinc-400" : "text-slate-500 dark:text-zinc-500"
                  }`}
                >
                  {CATALOG_LEVEL_COUNTS[lvl]} từ {pct > 0 ? `· ${pct}%` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Hero Level Banner ("Foundation A1 — Sơ cấp" + Balanced 3-Column Glass Stats Box) */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#2B1B64] via-[#1E1B4B] to-[#0F172A] p-4 text-white shadow-lg sm:p-6 md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-teal-500/15 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-200/90">
              <FolderOpen className="w-3.5 h-3.5 text-teal-300" />
              <span>5.004 từ vựng chuẩn Oxford 3000/5000 theo band A1 – C1</span>
              {etaDays > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-teal-200">
                  Dự kiến hoàn thành sau {formatEta(etaDays)}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
              {folderMeta.title}
            </h1>

            <p className="text-sm leading-relaxed text-indigo-100/85">{folderMeta.description}</p>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100 ring-1 ring-white/15">
                Oxford 3000 & 5000
              </span>
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200 ring-1 ring-teal-400/30">
                {folderMeta.badgeText}
              </span>
              {isLevelInRoadmap && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                  <Sparkles className="w-3 h-3" /> Đang trong lộ trình học hằng ngày
                </span>
              )}
            </div>

            {/* Action buttons on the banner */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => choose(toggleStudyLevel(levels, selectedLevel))}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold shadow-sm transition-all ${
                  isLevelInRoadmap
                    ? "bg-white text-slate-950 hover:bg-indigo-50"
                    : "bg-teal-400 text-slate-950 hover:bg-teal-300"
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                {isLevelInRoadmap
                  ? `Đang học cấp ${selectedLevel} (Chạm để đổi)`
                  : `Đặt cấp ${selectedLevel} vào lộ trình học`}
              </button>

              {metInLevel < totalWordsInLevel && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalLevel(selectedLevel)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-teal-300" />
                  Đã biết cả cấp {selectedLevel}
                </button>
              )}
            </div>
          </div>

          {/* Right Glass Stats Card: [Số bộ từ | Tổng số từ | Đã gặp / Nhớ lâu] */}
          <div className="grid w-full shrink-0 grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 py-3.5 text-center backdrop-blur-md lg:w-auto lg:min-w-[340px] lg:self-center">
            <div className="px-2">
              <div className="font-mono text-xl font-extrabold text-white sm:text-2xl">{packs ? packs.length : "—"}</div>
              <div className="mt-0.5 text-[11px] text-indigo-200 sm:text-xs">bộ từ</div>
            </div>
            <div className="px-2">
              <div className="font-mono text-xl font-extrabold text-white sm:text-2xl">
                {totalWordsInLevel.toLocaleString("vi-VN")}
              </div>
              <div className="mt-0.5 text-[11px] text-indigo-200 sm:text-xs">từ vựng</div>
            </div>
            <div className="px-2">
              <div className="font-mono text-xl font-extrabold text-teal-300 sm:text-2xl">
                {metInLevel.toLocaleString("vi-VN")}
              </div>
              <div className="mt-0.5 text-[11px] text-indigo-200 sm:text-xs">đã gặp ({rememberedInLevel} nhớ lâu)</div>
            </div>
          </div>
        </div>
      </div>

      {progress && (
        <NextLevelNotice
          progress={progress}
          levels={levels}
          onOpen={(next) => choose([...levels, next])}
          busy={saving}
        />
      )}

      {/* 3. Section: "Các bộ trong thư mục" + Integrated Search/Skim Toggle */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Các bộ trong thư mục</h2>
            {packs && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                {visiblePacks.length} bộ
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                { id: "all", label: "Tất cả" },
                { id: "thematic", label: "Chủ đề" },
                { id: "core", label: "Nền tảng" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPackFilter(f.id)}
                className={`min-h-9 rounded-xl px-3 font-semibold transition-colors ${
                  packFilter === f.id
                    ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowToolsDrawer((v) => !v)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 font-semibold transition-colors ${
                showToolsDrawer
                  ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-500/15 dark:text-teal-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Tìm & Lướt từ</span>
              {showToolsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Quick Search & Skim Drawer */}
        {showToolsDrawer && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Lướt nhanh từ đã biết</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Tích những từ sắp học mà bạn chắc chắn đã biết để dành thời gian cho từ thật sự mới.
                </p>
              </div>
              <Skim levels={levels} onChanged={onChanged} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 order-first lg:order-none">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Tìm từ và học sớm</h3>
              <CatalogSearch onChanged={onChanged} />
            </section>
          </div>
        )}

        {!packs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-slate-200 bg-slate-100/70 animate-pulse dark:border-zinc-800 dark:bg-zinc-900/70"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {visiblePacks.map((pack) => {
              const numStr = String(pack.index).padStart(2, "0");
              const pctMet = Math.min(100, Math.round((pack.met * 100) / Math.max(1, pack.total)));
              const pctRem = Math.min(100, Math.round((pack.remembered * 100) / Math.max(1, pack.total)));
              const isDone = pack.met >= pack.total && pack.total > 0;
              const isActive = activePackId === pack.id;

              return (
                <div
                  key={pack.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenPackId(pack.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenPackId(pack.id);
                    }
                  }}
                  className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    isActive
                      ? "border-teal-500 bg-teal-50/40 dark:border-teal-400/70 dark:bg-[#132226]"
                      : isDone
                        ? "border-emerald-500/30 bg-white dark:border-emerald-500/25 dark:bg-[#141C24]"
                        : "border-slate-200 bg-white hover:border-teal-500/40 dark:border-zinc-800/90 dark:bg-[#151D28] dark:hover:border-teal-500/40"
                  }`}
                >
                  <div>
                    {/* Top Row: [01 Badge] + [Title & Word Count] + [A1 Badge] */}
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-extrabold transition-colors ${
                          isDone
                            ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-teal-500/15 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
                        }`}
                      >
                        {numStr}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-300">
                          {pack.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{pack.total} từ</p>
                      </div>

                      <span className="shrink-0 rounded-md bg-teal-500/15 px-2 py-0.5 text-[11px] font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                        {pack.level}
                      </span>
                    </div>

                    {/* Middle Description */}
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                      {pack.description}
                    </p>
                  </div>

                  {/* Bottom Progress & Status Footer */}
                  <div className="mt-4 space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div
                        className="absolute inset-y-0 left-0 bg-teal-400/60 dark:bg-teal-600"
                        style={{ width: `${pctMet}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500"
                        style={{ width: `${pctRem}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                      <span>
                        Đã gặp <b className="text-slate-700 dark:text-zinc-200">{pack.met}/{pack.total}</b>
                        {pack.remembered > 0 ? ` · ${pack.remembered} nhớ lâu` : ""}
                      </span>

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-300">
                          <Target className="w-3 h-3" /> Đang học
                        </span>
                      ) : isDone ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Hoàn thành ✓</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-500 group-hover:text-teal-600 dark:text-zinc-400 dark:group-hover:text-teal-300">
                          <BookOpen className="w-3 h-3" /> Xem bộ từ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Nguồn: bộ thẻ Anki "5000 Từ vựng Tiếng Anh (Oxford 5000, A1–C1)". Từ, cấp CEFR và phiên âm theo Oxford
        3000/5000; được phân nhóm theo bộ chủ đề và bộ nền tảng giúp dễ học theo từng chặng ngắn.
      </p>
    </div>
  );
}
