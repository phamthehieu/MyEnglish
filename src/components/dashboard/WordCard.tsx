import { memo } from "react";
import { Volume2, Trash2, ChevronRight, Tag, Clock, Sparkles } from "lucide-react";
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
      className={`group relative rounded-2xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
        isSelected
          ? "bg-cyan-50/60 dark:bg-zinc-900 border-cyan-500 dark:border-cyan-500/80 shadow-lg shadow-cyan-500/10 dark:shadow-cyan-950/50 ring-1 ring-cyan-500/50"
          : "bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/80 dark:hover:bg-zinc-900/90 shadow-sm"
      }`}
    >
      <div className="space-y-3">
        {/* Word header & actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors break-words">
                {item.word}
              </h3>
              {item.part_of_speech && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 font-semibold">
                  {item.part_of_speech}
                </span>
              )}
              <button
                onClick={(e) => onSpeak(item.word, e)}
                title="Nghe phát âm"
                aria-label="Nghe phát âm"
                className="w-10 h-10 -my-2 flex items-center justify-center text-slate-600 hover:text-cyan-600 dark:text-zinc-400 dark:hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-zinc-400">
              {item.phonetic && <span className="font-mono text-cyan-700 dark:text-cyan-400/90">{item.phonetic}</span>}
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {topicLabel(item.topic)}
              </span>
            </div>

            {/* Meaning Box */}
            <div className="mt-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/80">
              <span className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold block mb-0.5">
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
            aria-label="Xoá từ này"
            className="shrink-0 w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
              className="font-semibold text-rose-700 dark:text-rose-300"
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
            className={`text-xs px-3 min-h-9 rounded-full border flex items-center gap-1.5 transition-all hover:scale-105 ${relativeInfo.badgeClass}`}
          >
            <Clock className="w-3.5 h-3.5 opacity-80" />
            <span>{relativeInfo.label}</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
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
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-950/90 p-2.5 border border-slate-200 dark:border-zinc-800/80 space-y-1">
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 leading-relaxed line-clamp-2">
              "{item.examples[0].sentence_en}"
            </p>
            {item.examples[0].sentence_vn && (
              <p className="text-xs text-cyan-800 dark:text-cyan-300/80 italic line-clamp-1">
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
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 text-xs font-mono border border-slate-200 dark:border-zinc-700/50"
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

        <span className="flex items-center gap-0.5 text-slate-600 dark:text-zinc-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors font-medium">
          Chi tiết <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
});

export default WordCard;
