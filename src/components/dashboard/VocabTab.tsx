import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Eye, EyeOff, Layers, Loader2, Search, Volume2, Zap } from "lucide-react";
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
  levelReadyToAdvance,
  levelWeights,
  loadLevelProgress,
  markCatalogWordsKnown,
  nextUnstudiedEntries,
  suggestNextLevel,
  toggleStudyLevel,
  type LevelProgress,
} from "@/services/vocabFeed";
import { estimateNewWordsPerDay, levelEtaDays } from "@/services/progress";
import { getStudyLimits } from "@/services/srs";
import { useWordsStore } from "@/stores/wordsStore";
import { PAGE_CONTAINER, handleSpeak } from "./shared";

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
export function LevelPicker({ value, onChange, disabled }: { value: StudyLevel[]; onChange: (levels: StudyLevel[]) => void; disabled?: boolean }) {
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
                on ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950" : "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
              }`}
            >
              {level}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-base font-semibold ${on ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-white"}`}>{LEVEL_NAMES[level]}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-600 dark:text-zinc-400">{CATALOG_LEVEL_COUNTS[level]} từ</span>
            </span>
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                on ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950" : "border-2 border-slate-200 dark:border-zinc-700"
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
    <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
      Chạm một cấp để thêm vào. Chạm cấp ở đầu hoặc cuối để bỏ. Đã giỏi các cấp đầu? Bỏ chúng đi để bắt đầu từ cấp cao hơn.
    </p>
    </div>
  );
}

export function mixDescription(levels: StudyLevel[]): string {
  const skipped = levels[0] !== "A1" ? ` Bạn bỏ qua các cấp thấp hơn ${levels[0]}.` : "";
  if (levels.length === 1) return `Học các từ ${levels[0]}, từ IT trước, rồi theo độ phổ biến.${skipped}`;
  const ratio = levels.map((_, i) => levels.length - i).join(":");
  return `Từ mới trộn các cấp ${levels.join(", ")} theo tỉ lệ ${ratio} (cấp thấp nhiều hơn). Trong mỗi cấp, từ IT học trước.${skipped}`;
}

function useLevelProgress() {
  const [progress, setProgress] = useState<LevelProgress[] | null>(null);
  // The newest request wins: an older, slower response must not overwrite it
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
      seqRef.current++; // unmounted: drop a response still on its way
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

/** "~12 ngày", "~5 tháng" */
function formatEta(days: number): string {
  return days <= 60 ? `~${days} ngày` : `~${Math.round(days / 30)} tháng`;
}

/**
 * The path A1 → C1 in one row: per level whether it is studied, its words met and remembered, and (studied
 * levels) the days left at the current pace. A click chooses levels as LevelPicker does (toggleStudyLevel).
 */
function LevelRoadmap({
  progress,
  levels,
  onChange,
  onMarkLevel,
  disabled,
}: {
  progress: LevelProgress[];
  levels: StudyLevel[];
  onChange: (levels: StudyLevel[]) => void;
  onMarkLevel?: (level: StudyLevel) => void;
  disabled?: boolean;
}) {
  const pick = (level: StudyLevel) => onChange(toggleStudyLevel(levels, level));
  // The level mix shares the new words among the chosen levels that still have some
  const open = progress.filter((p) => levels.includes(p.level) && p.total - p.met > 0);
  const weights = levelWeights(open.map((p) => p.level));
  const weightSum = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
  const perDay = estimateNewWordsPerDay(getStudyLimits().newCardsPerDay);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {STUDY_LEVELS.map((level) => {
        const p = progress.find((x) => x.level === level);
        const on = levels.includes(level);
        const total = Math.max(1, p?.total ?? CATALOG_LEVEL_COUNTS[level]);
        const met = p?.met ?? 0;
        const remembered = p?.remembered ?? 0;
        const pct = (n: number) => `${Math.min(100, Math.round((n * 100) / total))}%`;
        const allMet = met >= total;
        const ready = !!p && levelReadyToAdvance(p);
        const eta = on && p && !allMet ? levelEtaDays(total - met, perDay, (weights.get(level) ?? 0) / weightSum) : 0;
        const badge = !on
          ? { text: "Chưa mở", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" }
          : allMet
            ? { text: "Đã gặp hết", cls: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300" }
            : ready
              ? { text: "Vững rồi", cls: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300" }
              : { text: "Đang học", cls: "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300" };
        const next = toggleStudyLevel(levels, level);
        const action =
          next.length > levels.length
            ? `Bấm để học thêm ${level}`
            : next.length === levels.length
              ? "Cần học ít nhất một cấp"
              : next[0] !== levels[0]
                ? `Bấm để bắt đầu từ ${next[0]}`
                : `Bấm để bỏ ${level}`;
        return (
          <div key={level} className="flex min-w-0 flex-col gap-2">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && pick(level)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                pick(level);
              }
            }}
            aria-pressed={on}
            title={`${level} · ${LEVEL_NAMES[level]}: ${met}/${total} từ đã gặp, ${remembered} nhớ lâu${p?.known ? `, ${p.known} đã biết` : ""}. ${action}.`}
            className={`group flex-1 cursor-pointer select-none space-y-2 rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            } ${
              on
                ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10"
                : "border-dashed border-slate-300 bg-white hover:border-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className={`text-lg font-bold leading-none ${on ? "text-teal-800 dark:text-teal-200" : "text-slate-700 dark:text-zinc-300"}`}>{level}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
            </div>
            <span className={`block text-xs ${on ? "text-slate-700 dark:text-zinc-300" : "text-slate-600 dark:text-zinc-400"}`}>{LEVEL_NAMES[level]}</span>
            <span className="relative block h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-800">
              <span className="absolute inset-y-0 left-0 bg-teal-200 dark:bg-teal-800" style={{ width: pct(met) }} />
              <span className="absolute inset-y-0 left-0 bg-green-600" style={{ width: pct(remembered) }} />
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-1 text-xs tabular-nums">
              <span className={on ? "text-slate-700 dark:text-zinc-200" : "text-slate-600 dark:text-zinc-400"}>
                {met}/{total}
              </span>
              {remembered > 0 && <span className="text-green-700 dark:text-green-400">{remembered} nhớ lâu</span>}
            </span>
            <span className="block text-xs text-slate-600 dark:text-zinc-400 min-h-[16px]">
              {on ? (allMet ? "Chỉ còn ôn" : eta > 0 ? `Gặp hết sau ${formatEta(eta)}` : "") : "+ Chạm để thêm vào lộ trình"}
            </span>
          </div>
          {!allMet && onMarkLevel && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onMarkLevel(level)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              <CheckCheck className="w-4 h-4 shrink-0" />
              Đã biết cả cấp {level}
            </button>
          )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Offer the next level: when the chosen levels are met (80%) and remembered for the long run (50%), or when
 * they have no new word left to give (the daily new words would stop).
 */
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
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
          <Layers className="w-4 h-4 text-teal-700 dark:text-teal-300" /> Lộ trình từ vựng Oxford
        </span>
        <button onClick={onOpen} className="-mr-2 inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10">
          Đổi cấp · Lướt từ đã biết
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

  // The newest load wins: switching level quickly must not show the previous level's words
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
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-zinc-800/70 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Bạn đã gặp hết các từ {level}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {entries.map((e) => (
            // The whole row ticks the word (the listen and meaning buttons do their own thing)
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
              <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-zinc-400 truncate">{e.ipaUs[0] ?? e.ipaUk[0]}</span>
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
      {/* The action stays in view while the list scrolls */}
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
    // An older search finishing after a newer one must not replace its results
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
          placeholder="Tìm trong 5.004 từ Oxford (ví dụ: deploy, meeting)…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-enable-grammarly="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </label>
      {!query.trim() ? (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Gặp một từ ở chỗ làm và muốn học ngay? Tìm nó rồi bấm <span className="font-semibold">Học sớm</span>: từ đó thành từ mới tiếp theo, kể cả khi thuộc cấp chưa mở.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Không có trong bộ Oxford 5000.</p>
      ) : null}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
        {results.map((e) => (
          <div key={e.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button onClick={() => handleSpeak(e.word)} title="Nghe" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300">
              <Volume2 className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{e.word}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">{e.cefr}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-zinc-300 truncate" title={e.vn}>
                <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{e.ipaUs[0] ?? e.ipaUk[0]}</span>
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

/** "Lộ trình từ vựng": levels, progress, skimming known words, and searching the deck */
export default function VocabTab() {
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [levels, setLevels] = useState<StudyLevel[]>(getStudyLevels);
  const [saving, setSaving] = useState(false);
  const { progress, reload } = useLevelProgress();
  const [modalLevel, setModalLevel] = useState<StudyLevel | null>(null);

  useEffect(() => {
    ensureCatalogSeeded().catch(() => {});
  }, []);

  const onChanged = () => {
    reload();
    refreshWords();
  };

  const choose = async (next: StudyLevel[]) => {
    setSaving(true);
    try {
      setLevels(await changeStudyLevels(next));
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const totals = progress?.reduce(
    (t, p) => ({ total: t.total + p.total, met: t.met + p.met, remembered: t.remembered + p.remembered, known: t.known + p.known }),
    { total: 0, met: 0, remembered: 0, known: 0 }
  );
  const perDay = estimateNewWordsPerDay(getStudyLimits().newCardsPerDay);
  const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5";

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

      {/* Title and the whole path in numbers */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            5.004 từ Oxford 3000 và 5000 (A1–C1), có nghĩa tiếng Việt, câu ví dụ và phát âm.
          </p>
        </div>
        {totals && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800" title="Từ đã học ít nhất một lần, kể cả từ đánh dấu đã biết">
              Đã gặp <b className="font-mono text-slate-900 dark:text-white">{totals.met.toLocaleString("vi-VN")}</b>
              <span className="text-slate-500 dark:text-zinc-400">/{totals.total.toLocaleString("vi-VN")}</span>
            </span>
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-700 dark:bg-green-500/10 dark:text-green-300" title="Đã ôn thật và sẽ không quên trong ít nhất 3 tuần">
              Nhớ lâu <b className="font-mono">{totals.remembered.toLocaleString("vi-VN")}</b>
            </span>
            {totals.known > 0 && (
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
                Đã biết <b className="font-mono text-slate-900 dark:text-white">{totals.known}</b>
              </span>
            )}
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300" title="Hạn mức thẻ mới mỗi ngày (Cài đặt) chia cho từ mới và thẻ nhớ ra từ, nên khoảng một nửa là từ mới">
              ~<b className="font-mono">{perDay}</b> từ mới/ngày
            </span>
          </div>
        )}
      </div>

      {/* The path: choose the levels and see each one's progress in one row */}
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cấp đang học</h3>
          <span className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-full bg-teal-200 dark:bg-teal-800" /> Đã gặp</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-full bg-green-600" /> Nhớ lâu</span>
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Chạm vào một cấp để thêm hoặc bỏ khỏi lộ trình. "Nhớ lâu" là từ đã ôn thật và sẽ không quên trong ít nhất 3 tuần. Cấp nào bạn đã giỏi, bấm "Đã biết cả cấp" dưới ô cấp đó.
        </p>
        {progress ? (
          <LevelRoadmap
            progress={progress}
            levels={levels}
            onChange={choose}
            onMarkLevel={setModalLevel}
            disabled={saving}
          />
        ) : (
          <LevelPicker value={levels} onChange={choose} disabled={saving} />
        )}
        <p className="text-sm text-slate-600 dark:text-zinc-400">{mixDescription(levels)}</p>
        {progress && (
          <NextLevelNotice progress={progress} levels={levels} onOpen={(next) => choose([...levels, next])} busy={saving} />
        )}
      </section>

      {/* Skim the next words (main) and search the deck (side) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <section className={`${card} min-w-0 space-y-3`}>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Lướt nhanh từ đã biết
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400">Tích những từ sắp học mà bạn chắc chắn đã biết, để dành thời gian cho từ thật sự mới.</p>
          </div>
          <Skim levels={levels} onChanged={onChanged} />
        </section>

        <section className={`${card} min-w-0 space-y-3 order-first lg:order-none lg:sticky lg:top-4`}>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Tìm từ và học sớm
          </h3>
          <CatalogSearch onChanged={onChanged} />
        </section>
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Nguồn: bộ thẻ Anki "5000 Từ vựng Tiếng Anh (Oxford 5000, A1–C1)". Từ, cấp CEFR và phiên âm theo Oxford 3000/5000; nghĩa và câu ví dụ do tác giả bộ thẻ biên soạn.
      </p>
    </div>
  );
}
