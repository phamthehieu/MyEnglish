import { Tag, Bug, Zap } from "lucide-react";
import type { ReviewCard } from "@/types/database";
import { getRetrievabilityInfo, isLeech, type ExerciseType, type XPReward } from "@/services/smartReview";
import type { StudyMode } from "@/hooks/useReviewSession";
import { isSimpleMode } from "@/services/learnerProfile";
import { memoryLabel, topicLabel } from "@/utils/labels";
import { EXERCISE_LABEL_VN } from "./exerciseLabels";

interface CardBadgesProps {
  currentWord: ReviewCard;
  showXPPopup: boolean;
  lastXPReward: XPReward | null;
  effectiveExerciseType: ExerciseType;
  mode: StudyMode;
}

/** Card top badges: part of speech, topic, memory state, often-forgotten flag, recall chance, XP popup, exercise type */
export default function CardBadges({
  currentWord,
  showXPPopup,
  lastXPReward,
  effectiveExerciseType,
  mode,
}: CardBadgesProps) {
  // Simple mode: no scheduler numbers (S, D, recall %), the word "Leech" becomes "Từ hay quên"
  const simple = isSimpleMode();
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {currentWord.part_of_speech && (
          <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold">
            {currentWord.part_of_speech}
          </span>
        )}
        <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" />
          {topicLabel(currentWord.topic)}
        </span>
        {!simple && (
          <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
            {currentWord.srs.stability && currentWord.srs.stability > 0
              ? `${memoryLabel(currentWord.srs.stability)} • độ khó ${currentWord.srs.difficulty || 5}/10`
              : memoryLabel(0)}
          </span>
        )}
        {simple && (currentWord.srs.reps ?? 0) === 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">
            Từ mới
          </span>
        )}
        {/* Often-forgotten word: a calm label, not an alarm */}
        {isLeech(currentWord.srs) && (
          <span
            title="Từ này đã quên nhiều lần: đọc kỹ ví dụ và mẹo nhớ"
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center gap-1"
          >
            <Bug className="w-2.5 h-2.5" />
            Từ hay quên
          </span>
        )}
        {/* Retrievability Mini Bar */}
        {!simple && (() => {
          const rInfo = getRetrievabilityInfo(currentWord.srs);
          if (rInfo.level === "new") return null;
          return (
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${rInfo.bgColorClass} ${rInfo.textColorClass} border-current/20`}>
              <span className="font-semibold">{rInfo.percent}%</span>
              <span className={`w-8 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden inline-block`}>
                <span className={`block h-full ${rInfo.colorClass} rounded-full transition-all`} style={{ width: `${rInfo.percent}%` }} />
              </span>
              <span className="text-[10px]">{rInfo.label}</span>
            </span>
          );
        })()}
      </div>

      <div className="flex items-center gap-2">
        {/* XP Floating Popup */}
        {showXPPopup && lastXPReward && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 animate-bounce font-mono flex items-center gap-1">
            <Zap className="w-3 h-3" />
            +{lastXPReward.totalXP} XP
          </span>
        )}
        <span className="text-xs text-slate-600 dark:text-zinc-400 shrink-0">
          {EXERCISE_LABEL_VN[effectiveExerciseType]}
          {mode === "mixed" && !simple && " • Thích ứng"}
        </span>
      </div>
    </div>
  );
}
