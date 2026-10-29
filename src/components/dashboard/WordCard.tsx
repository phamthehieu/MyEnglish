import { memo } from "react";
import { Volume2, Trash2, ChevronRight, Tag, Clock } from "lucide-react";
import { parseTerms, type WordDetail } from "@/types/database";
import { getRetrievabilityInfo } from "@/services/smartReview";
import { librarySchedule } from "@/services/librarySchedule";
import { topicLabel, memoryLabel } from "@/utils/labels";

const EMPTY_TERMS: ReturnType<typeof parseTerms> = [];

export interface WordCardMeta {
  synonyms: ReturnType<typeof parseTerms>;
  rInfo: ReturnType<typeof getRetrievabilityInfo>;
  leech: boolean;
}

interface WordCardProps {
  item: WordDetail;
  meta: WordCardMeta | undefined;
  isSelected: boolean;
  onSelect: (word: WordDetail) => void;
  onSpeak: (text: string, e?: React.MouseEvent) => void;
  onDelete: (wordId: string, wordText: string, e?: React.MouseEvent) => void;
  onOpenTrajectory?: (word: WordDetail) => void;
}

// Memoized gallery card; derived data is precomputed by the parent
const WordCard = memo(function WordCard({
  item,
  meta,
  isSelected,
  onSelect,
  onSpeak,
  onDelete,
  onOpenTrajectory,
}: WordCardProps) {
  const synonyms = meta?.synonyms ?? EMPTY_TERMS;
  const rInfo = meta?.rInfo ?? getRetrievabilityInfo(item.srs);
  const leech = meta?.leech ?? false;

  // The session's rules: a recall card waiting for the new-card budget, or one buried until tomorrow, is not due
  const schedule = librarySchedule(item);
  const relativeInfo = schedule.info;

  const total = item.stats?.totalAttempts ?? (item.srs.repetitions || 0);
  const wrong = item.stats?.wrongCount ?? (item.srs.lapses || 0);
  const correct = item.stats?.correctCount ?? Math.max(0, total - wrong);
  const accuracy = item.stats?.accuracy ?? (total > 0 ? Math.round((correct / total) * 100) : 0);

  // "Mới" / "Nhớ 3 ngày": how long the word is expected to stay in memory
  const memory = memoryLabel(item.srs.stability || item.srs.interval);
  const memoryText = memory.charAt(0).toUpperCase() + memory.slice(1);

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex min-w-0 cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-colors ${
        isSelected
          ? "border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-zinc-900"
          : "border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <div className="space-y-3">
        {/* Word header & actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="min-w-0 break-words text-lg font-semibold text-slate-900 transition-colors group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-300">
                {item.word}
              </h3>
              {item.part_of_speech && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {item.part_of_speech}
                </span>
              )}
              <button
                onClick={(e) => onSpeak(item.word, e)}
                title="Nghe phát âm"
                aria-label="Nghe phát âm"
                className="-my-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-teal-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-teal-300"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-zinc-400">
              {item.phonetic && <span className="font-mono text-slate-600 dark:text-zinc-400">{item.phonetic}</span>}
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {topicLabel(item.topic)}
              </span>
            </div>

            {/* Meaning Box */}
            <div className="mt-2 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/50">
              <span className="mb-0.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Nghĩa:
              </span>
              <p className="text-sm text-slate-800 dark:text-zinc-200 font-normal line-clamp-2 leading-relaxed">
                {item.meaning_vn}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => onDelete(item.id, item.word, e)}
            title="Xoá từ này"
            type="button"
            aria-label={`Xoá từ ${item.word}`}
            className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 [@media(hover:none)]:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Memory state: one plain line instead of several tiny badges */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-700 dark:text-zinc-300">
          <span title="Thuật toán dự đoán bạn sẽ còn nhớ từ này trong khoảng thời gian này">{memoryText}</span>
          {rInfo.level !== "new" && (
            <span
              className={`inline-flex items-center gap-1.5 ${rInfo.textColorClass}`}
              title={`Khả năng nhớ lúc này: ${rInfo.percent}% (${rInfo.label})`}
            >
              <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden inline-block">
                <span
                  className={`block h-full ${rInfo.colorClass} rounded-full`}
                  style={{ width: `${rInfo.percent}%` }}
                />
              </span>
              Còn nhớ {rInfo.percent}%
            </span>
          )}
          {leech && (
            <span
              className="font-semibold text-red-700 dark:text-red-300"
              title={`Bạn đã quên từ này ${item.srs.lapses ?? 0} lần, nên nó được ôn bằng bài dễ hơn kèm mẹo nhớ`}
            >
              🐛 Từ khó
            </span>
          )}
        </div>

        {/* Schedule & History Banner */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Relative Next Review Badge (clickable for trajectory) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTrajectory?.(item);
            }}
            title={`Lịch nhắc lại: ${relativeInfo.label} (${relativeInfo.exactDateStr}). Bấm để xem lộ trình nhắc lại.`}
            className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${relativeInfo.badgeClass}`}
          >
            <Clock className="w-3.5 h-3.5 opacity-80" />
            <span>{relativeInfo.label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Attempts & Accuracy */}
          {total > 0 ? (
            <span
              className="text-xs text-slate-700 dark:text-zinc-300"
              title={`Lịch sử: ${total} lần ôn (${correct} đúng, ${wrong} sai)`}
            >
              Ôn {total} lần · đúng {accuracy}%
            </span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-zinc-400">Chưa ôn lần nào</span>
          )}
        </div>

        {/* First Example preview */}
        {item.examples.length > 0 && (
          <div className="space-y-1 rounded-xl bg-slate-50 p-2.5 dark:bg-zinc-800/50">
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 leading-relaxed line-clamp-2">
              "{item.examples[0].sentence_en}"
            </p>
            {item.examples[0].sentence_vn && (
              <p className="line-clamp-1 text-xs text-slate-600 dark:text-zinc-400">
                {item.examples[0].sentence_vn}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer tags */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
        <div className="flex gap-1.5 flex-wrap max-w-[75%] overflow-hidden">
          {synonyms.slice(0, 2).map((s, idx) => (
            <span
              key={idx}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {s.word}
            </span>
          ))}
          {synonyms.length > 2 && (
            <span className="text-xs text-slate-600 dark:text-zinc-400 self-center">
              +{synonyms.length - 2}
            </span>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-0.5 font-semibold text-teal-700 transition-colors dark:text-teal-300">
          Chi tiết <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
});

export default WordCard;
