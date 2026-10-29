import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, Play, RotateCcw, Search, Volume2 } from "lucide-react";
import type { WordDetail } from "@/types/database";
import { useWordsStore } from "@/stores/wordsStore";
import {
  classifyKnownWords,
  filterKnown,
  levelCounts,
  levelOf,
  loadKnownMarks,
  pageButtons,
  pageOf,
  type KnownEntry,
  type KnownResultFilter,
  type KnownSort,
  type KnownStatus,
} from "@/services/knownWords";
import { KNOWN_CHECK_MAX_DAYS, KNOWN_CHECK_MIN_DAYS } from "@/services/reviewRecorder";
import { formatNextReviewRelative } from "@/utils/reviewSchedule";
import { handleSpeak, PAGE_CONTAINER } from "./shared";

interface KnownTabProps {
  /** Make these words' checks due now and review them */
  onCheckNow: (words: WordDetail[]) => void;
}

type View = "waiting" | "checked";

const PAGE_SIZE = 30;
/** Most words in one "Kiểm tra ngay" session */
const CHECK_MAX = 20;

const dateVn = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const RESULT: Record<Exclude<KnownStatus, "waiting">, { label: string; cls: string }> = {
  confirmed: { label: "Đã xác nhận", cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30" },
  failed: { label: "Kiểm tra sai, đang học lại", cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30" },
};

/**
 * "Đã biết": the words marked as already known, waiting for their one check, and those already checked with
 * the result (see services/knownWords).
 */
export default function KnownTab({ onCheckNow }: KnownTabProps) {
  const words = useWordsStore((s) => s.words);
  const setSelectedWord = useWordsStore((s) => s.setSelectedWord);
  const [marks, setMarks] = useState<Map<string, string> | null>(null);
  const [view, setView] = useState<View>("waiting");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [result, setResult] = useState<KnownResultFilter>("all");
  const [sort, setSort] = useState<KnownSort>("check");
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stale = false;
    loadKnownMarks()
      .then((m) => !stale && setMarks(m))
      .catch(() => !stale && setMarks(new Map()));
    return () => {
      stale = true;
    };
  }, [words]);

  const entries = useMemo(() => (marks ? classifyKnownWords(words, marks) : []), [words, marks]);
  const waiting = entries.filter((e) => e.status === "waiting");
  const checked = entries.filter((e) => e.status !== "waiting");
  const confirmed = checked.filter((e) => e.status === "confirmed").length;
  const failed = checked.length - confirmed;

  const list = useMemo(() => filterKnown(entries, { view, level, result, query, sort }), [entries, view, level, result, query, sort]);
  // Levels of the group on screen, with their counts
  const levels = useMemo(() => levelCounts(view === "waiting" ? waiting : checked), [view, waiting, checked]);
  // Any change of filter starts again from page 1; a level absent from the group goes back to all
  useEffect(() => setPage(1), [view, level, result, query, sort]);
  useEffect(() => {
    if (level !== "all" && !levels.some((l) => l.level === level)) setLevel("all");
  }, [levels, level]);
  const current = pageOf(list, page, PAGE_SIZE);
  // The words of the waiting group as filtered (a level chosen: that level only), soonest check first
  const checkLevel = view === "waiting" && level !== "all" ? level : null;
  const checkPool = checkLevel ? waiting.filter((e) => levelOf(e.word) === checkLevel) : waiting;
  const toCheck = checkPool.slice(0, CHECK_MAX).map((e) => e.word);
  const goTo = (p: number) => {
    setPage(p);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-teal-700 text-white dark:bg-teal-600"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    }`;


  return (
    <div className={`${PAGE_CONTAINER} space-y-4`}>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
        <div>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
              Những từ bạn đánh dấu "Đã biết" khi gặp lần đầu. App hỏi lại mỗi từ một lần sau {KNOWN_CHECK_MIN_DAYS}–{KNOWN_CHECK_MAX_DAYS} ngày để
              xác nhận: trả lời đúng thì từ được tính là đã học, sai thì học lại như từ thường.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
          {[
            ["Chờ kiểm tra", waiting.length, "chưa được hỏi lại"],
            ["Đã xác nhận", confirmed, "trả lời đúng khi kiểm tra"],
            ["Kiểm tra sai", failed, "đang học lại"],
          ].map(([label, value, sub]) => (
            <div key={label as string} className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-800/60">
              <div className="text-sm text-slate-600 dark:text-zinc-400">{label}</div>
              <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{marks ? value : "…"}</div>
              <div className="text-xs text-slate-600 dark:text-zinc-400">{sub}</div>
            </div>
          ))}
        </div>

        {waiting.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onCheckNow(toCheck)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <Play className="w-4 h-4 fill-white" /> Kiểm tra ngay {toCheck.length} từ{checkLevel ? ` ${checkLevel}` : ""}
            </button>
            <span className="text-sm text-slate-600 dark:text-zinc-400">
              Không cần chờ: trả lời đúng là từ được xác nhận luôn.
              {checkPool.length > CHECK_MAX ? ` ${CHECK_MAX} từ đến lượt sớm nhất trước.` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["waiting", `Chờ kiểm tra (${waiting.length})`],
            ["checked", `Đã kiểm tra (${checked.length})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
              view === v
                ? "bg-teal-700 text-white dark:bg-teal-600"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="relative w-full sm:w-auto sm:ml-auto">
          <Search className="w-4 h-4 text-slate-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-2xl border border-slate-300 bg-white pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:w-56 sm:text-sm"
          />
        </label>
      </div>

      {/* Classification: level, result (checked words), order */}
      <div ref={listTopRef} className="scroll-mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {levels.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo cấp độ">
            <span className="mr-1 text-sm text-slate-600 dark:text-zinc-400">Cấp độ</span>
            <button onClick={() => setLevel("all")} className={chip(level === "all")}>
              Tất cả
            </button>
            {levels.map((l) => (
              <button key={l.level} onClick={() => setLevel(l.level)} className={chip(level === l.level)}>
                {l.level} <span className="opacity-60">{l.count}</span>
              </button>
            ))}
          </div>
        )}
        {view === "checked" && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo kết quả">
            <span className="mr-1 text-sm text-slate-600 dark:text-zinc-400">Kết quả</span>
            {(
              [
                ["all", "Tất cả"],
                ["confirmed", "Đã xác nhận"],
                ["remembered", "Nhớ lâu"],
                ["failed", "Kiểm tra sai"],
              ] as const
            ).map(([r, label]) => (
              <button key={r} onClick={() => setResult(r)} className={chip(result === r)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <label className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-400">
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as KnownSort)}
            className="min-h-11 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="check">{view === "waiting" ? "Sắp kiểm tra" : "Mới kiểm tra"}</option>
            <option value="marked">Mới đánh dấu</option>
            <option value="az">A → Z</option>
          </select>
        </label>
      </div>

      {!marks ? (
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {query || level !== "all" || result !== "all"
            ? "Không có từ nào khớp bộ lọc."
            : view === "waiting"
              ? 'Không có từ nào đang chờ kiểm tra. Khi gặp từ mới mà bạn đã biết, bấm "Đã biết" để bỏ qua phần giới thiệu.'
              : "Chưa có từ nào được kiểm tra."}
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-500 dark:text-zinc-400">
            Hiển thị {current.from}–{current.to} trên {list.length} từ
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {current.items.map((e) => (
              <KnownRow key={e.word.id} entry={e} onOpen={() => setSelectedWord(e.word)} onCheck={() => onCheckNow([e.word])} />
            ))}
          </div>
          {current.pages > 1 && (
            <nav className="flex items-center justify-center gap-1" aria-label="Phân trang">
              <button
                onClick={() => goTo(current.page - 1)}
                disabled={current.page === 1}
                aria-label="Trang trước"
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageButtons(current.page, current.pages).map((n, i) =>
                n == null ? (
                  <span key={`gap-${i}`} className="px-1 text-sm text-slate-500 dark:text-zinc-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => goTo(n)}
                    aria-current={n === current.page ? "page" : undefined}
                    className={`h-11 min-w-11 rounded-full px-2 text-sm font-semibold transition-colors ${
                      n === current.page
                        ? "bg-teal-700 text-white dark:bg-teal-600"
                        : "text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => goTo(current.page + 1)}
                disabled={current.page === current.pages}
                aria-label="Trang sau"
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function KnownRow({ entry, onOpen, onCheck }: { entry: KnownEntry; onOpen: () => void; onCheck: () => void }) {
  const { word: w, status, markedAt, checkAt, rememberedLong } = entry;
  const check = checkAt ? formatNextReviewRelative(checkAt, false) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
      <button onClick={onOpen} className="min-h-11 min-w-0 flex-1 basis-[220px] text-left">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-base font-semibold text-slate-900 dark:text-white">{w.word}</span>
          {w.phonetic && <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">{w.phonetic}</span>}
          {w.cefr_level && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">{w.cefr_level}</span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-1">{w.meaning_vn}</p>
      </button>

      <div className="text-xs text-slate-600 dark:text-zinc-400 sm:w-32">
        <div className="text-slate-600 dark:text-zinc-400">Đánh dấu</div>
        {dateVn(markedAt)}
      </div>

      <div className="text-xs sm:w-56">
        {status === "waiting" ? (
          <>
            <div className="text-slate-600 dark:text-zinc-400 inline-flex items-center gap-1">
              <CircleHelp className="w-3 h-3" /> Kiểm tra
            </div>
            <div>
              {check ? (
                <span title={check.exactDateStr} className={`rounded-full px-2 py-0.5 font-semibold ${check.badgeClass.replace("animate-pulse", "")}`}>
                  {check.diffMs <= 0 ? "Đến lượt kiểm tra" : check.label}
                </span>
              ) : (
                "—"
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-slate-600 dark:text-zinc-400">Kết quả</div>
            <span className={`inline-block rounded-full border px-2 py-0.5 font-semibold ${RESULT[status].cls}`}>
              {RESULT[status].label}
              {status === "confirmed" && rememberedLong ? " · Nhớ lâu" : ""}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={(e) => handleSpeak(w.word, e)}
          aria-label={`Nghe "${w.word}"`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
        >
          <Volume2 className="w-4 h-4" />
        </button>
        {status === "waiting" && (
          <button
            onClick={onCheck}
            title="Hỏi lại từ này ngay để xác nhận"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-teal-700/30 bg-white px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            <RotateCcw className="w-3 h-3" /> Kiểm tra ngay
          </button>
        )}
      </div>
    </div>
  );
}
