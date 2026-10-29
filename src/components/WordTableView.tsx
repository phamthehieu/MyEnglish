import { useState, useMemo, useEffect } from "react";
import { librarySchedule } from "@/services/librarySchedule";
import { handleSpeak } from "./review/speech";
import { Volume2, Trash2, ArrowUpDown, ChevronRight, Tag, Sparkles, Clock } from "lucide-react";
import type { WordDetail } from "@/types/database";
import type { ReviewTimeRelativeInfo } from "@/utils/reviewSchedule";
import ReviewTrajectoryModal from "./review/ReviewTrajectoryModal";
import { topicLabel } from "@/utils/labels";

interface WordTableViewProps {
  words: WordDetail[];
  onSelectWord: (word: WordDetail) => void;
  onDeleteWord: (id: string, word: string, e: React.MouseEvent) => void;
  // Changing this resets pagination (e.g. search/filter changed)
  resetKey?: string;
}

const PAGE_SIZE = 60;

type SortField =
  | "word"
  | "topic"
  | "created_at"
  | "next_review"
  | "ease_factor"
  | "repetitions"
  | "accuracy";

type SortOrder = "asc" | "desc";

export default function WordTableView({
  words,
  onSelectWord,
  onDeleteWord,
  resetKey,
}: WordTableViewProps) {
  const [sortField, setSortField] = useState<SortField>("next_review");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [trajectoryWord, setTrajectoryWord] = useState<WordDetail | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [resetKey, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "next_review" || field === "word" ? "asc" : "desc");
    }
  };

  // Each word's schedule as a session sees it, computed once per words change
  const scheduleOf = useMemo(() => {
    const now = new Date();
    return new Map(words.map((w) => [w.id, librarySchedule(w, now)]));
  }, [words]);

  const sortedWords = useMemo(() => {
    return [...words].sort((a, b) => {
      let cmp = 0;
      if (sortField === "word") {
        cmp = a.word.localeCompare(b.word);
      } else if (sortField === "topic") {
        cmp = topicLabel(a.topic).localeCompare(topicLabel(b.topic));
      } else if (sortField === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "next_review") {
        // When the word really comes back (see librarySchedule); never-studied words last, newest first
        const sa = scheduleOf.get(a.id);
        const sb = scheduleOf.get(b.id);
        const ka = sa?.sortAt ?? null;
        const kb = sb?.sortAt ?? null;
        if (ka == null && kb == null) cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        else if (ka == null || kb == null) cmp = ka == null ? 1 : -1;
        else cmp = ka - kb || a.word.localeCompare(b.word);
      } else if (sortField === "ease_factor") {
        cmp = (a.srs.stability || a.srs.interval) - (b.srs.stability || b.srs.interval);
      } else if (sortField === "repetitions") {
        const totalA = a.stats?.totalAttempts ?? (a.srs.repetitions || 0);
        const totalB = b.stats?.totalAttempts ?? (b.srs.repetitions || 0);
        cmp = totalA - totalB;
      } else if (sortField === "accuracy") {
        const accA = a.stats?.accuracy ?? 0;
        const accB = b.stats?.accuracy ?? 0;
        cmp = accA - accB;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [words, sortField, sortOrder, scheduleOf]);

  const visibleWords = useMemo(() => sortedWords.slice(0, visibleCount), [sortedWords, visibleCount]);
  const remaining = sortedWords.length - visibleWords.length;

  // Per-row derived data (due flag + relative review schedule info) computed only for visible rows
  const rowMeta = useMemo(() => {
    const now = new Date();
    const meta = new Map<string, { isDue: boolean; relative: ReviewTimeRelativeInfo }>();
    for (const item of visibleWords) {
      const s = scheduleOf.get(item.id) ?? librarySchedule(item, now);
      meta.set(item.id, { isDue: s.isDue, relative: s.info });
    }
    return meta;
  }, [visibleWords, scheduleOf]);

  if (words.length === 0) {
    return null;
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900">
        {/* Phones: one stacked card per word instead of the wide table */}
        <ul className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {visibleWords.map((item) => {
            const relative = rowMeta.get(item.id)?.relative;
            return (
              <li
                key={item.id}
                onClick={() => onSelectWord(item)}
                className="cursor-pointer px-4 py-3 active:bg-slate-50 dark:active:bg-zinc-800/40"
              >
                <div className="flex items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="break-words text-base font-semibold text-slate-900 dark:text-white">{item.word}</span>
                      {item.phonetic && (
                        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">{item.phonetic}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-zinc-300 leading-snug line-clamp-2">{item.meaning_vn}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleSpeak(item.word, e)}
                    aria-label={`Nghe phát âm ${item.word}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-100 dark:text-zinc-400 dark:active:bg-zinc-800"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onDeleteWord(item.id, item.word, e)}
                    aria-label={`Xoá từ ${item.word}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-red-50 active:text-red-600 dark:text-zinc-400 dark:active:bg-red-500/10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      relative?.badgeClass || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Clock className="w-3 h-3 opacity-70" />
                    Ôn: {relative?.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
                    <Tag className="w-3 h-3 opacity-70" />
                    {topicLabel(item.topic)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrajectoryWord(item);
                    }}
                    aria-label="Xem lộ trình các lần ôn tiếp theo"
                    className="-my-2 ml-auto flex h-11 w-11 items-center justify-center rounded-full text-teal-700 active:bg-teal-50 dark:text-teal-300 dark:active:bg-teal-400/10"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="select-none border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                <th
                  onClick={() => handleSort("word")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Từ vựng</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("topic")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Chủ đề</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Nghĩa tiếng Việt</th>
                <th
                  onClick={() => handleSort("repetitions")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Đúng / Sai</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("ease_factor")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>
                      <span title="Số ngày thuật toán dự đoán bạn còn nhớ từ này">Mức nhớ</span>
                    </span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">
                  <span title="Số ngày từ lần ôn trước đến lần ôn kế tiếp">Ôn lại sau</span>
                </th>
                <th
                  onClick={() => handleSort("next_review")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Lần ôn kế tiếp</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {visibleWords.map((item) => {
                const meta = rowMeta.get(item.id);
                const relative = meta?.relative;

                // Attempt stats
                const total = item.stats?.totalAttempts ?? (item.srs.repetitions || 0);
                const wrong = item.stats?.wrongCount ?? (item.srs.lapses || 0);
                const correct = item.stats?.correctCount ?? Math.max(0, total - wrong);
                const accuracy = item.stats?.accuracy ?? (total > 0 ? Math.round((correct / total) * 100) : 0);

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectWord(item)}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Word Column */}
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base transition-colors group-hover:text-teal-700 dark:group-hover:text-teal-300">
                          {item.word}
                        </span>
                        {item.phonetic && (
                          <span className="text-xs font-mono font-normal text-slate-500 dark:text-zinc-400">
                            {item.phonetic}
                          </span>
                        )}
                        <button
                          onClick={(e) => handleSpeak(item.word, e)}
                          title="Nghe phát âm"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* Topic Column */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                        <Tag className="w-2.5 h-2.5 opacity-70" />
                        {topicLabel(item.topic)}
                      </span>
                    </td>

                    {/* Meaning Column */}
                    <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-normal text-sm max-w-md line-clamp-2 leading-relaxed">
                      {item.meaning_vn}
                    </td>

                    {/* Appearances / Correct vs Wrong */}
                    <td className="py-3 px-4 text-center tabular-nums">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            total > 0
                              ? "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200"
                              : "text-slate-500 dark:text-zinc-400"
                          }`}
                        >
                          {total > 0 ? `${total} lần` : "Chưa ôn"}
                        </span>
                        {total > 0 && (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-center gap-1 text-[11px]">
                              <span className="text-green-700 dark:text-green-400 font-bold">
                                {correct}✓
                              </span>
                              <span className="text-slate-300 dark:text-zinc-700">/</span>
                              <span className="text-red-700 dark:text-red-400 font-bold">
                                {wrong}✗
                              </span>
                              <span className="text-slate-500 dark:text-zinc-400 font-semibold">
                                ({accuracy}%)
                              </span>
                            </div>
                            <div className="w-16 h-1.5 bg-red-100 dark:bg-red-500/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600 rounded-full transition-all"
                                style={{ width: `${accuracy}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Stability / Ease Factor */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700 dark:text-zinc-300">
                      {item.srs.stability && item.srs.stability > 0
                        ? `${Number(item.srs.stability).toFixed(1)} ngày`
                        : `${item.srs.interval} ngày`}
                    </td>

                    {/* Interval */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-500 dark:text-zinc-400">
                      {item.srs.interval} ngày
                    </td>

                    {/* Next Review Status & Countdown */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          title={relative?.exactDateStr}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            relative?.badgeClass || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {relative?.urgency === "overdue" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          )}
                          <Clock className="w-3 h-3 opacity-70" />
                          <span>{relative?.label}</span>
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrajectoryWord(item);
                          }}
                          title="Xem lộ trình các lần ôn tiếp theo"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => onDeleteWord(item.id, item.word, e)}
                          title="Xoá từ này"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-500 dark:text-zinc-400 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {remaining > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-zinc-800 flex justify-center">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-700/30 bg-white px-5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10"
            >
              Xem thêm ({remaining} từ còn lại)
            </button>
          </div>
        )}
      </div>

      {/* Trajectory Modal */}
      {trajectoryWord && (
        <ReviewTrajectoryModal
          isOpen={!!trajectoryWord}
          onClose={() => setTrajectoryWord(null)}
          word={trajectoryWord}
        />
      )}
    </>
  );
}
