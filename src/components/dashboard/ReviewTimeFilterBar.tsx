import { Clock } from "lucide-react";
import type { ReviewTimeBucket } from "@/utils/reviewSchedule";

interface ReviewTimeFilterBarProps {
  selectedBucket: ReviewTimeBucket;
  onSelectBucket: (bucket: ReviewTimeBucket) => void;
  bucketCounts: Record<ReviewTimeBucket, number>;
}

interface BucketConfig {
  id: ReviewTimeBucket;
  label: string;
  icon?: React.ReactNode;
  activeClass: string;
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    id: "all",
    label: "Tất cả",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "due",
    label: "Đến hạn",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "today",
    label: "Hôm nay",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "1-3d",
    label: "1 - 3 ngày",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "4-7d",
    label: "4 - 7 ngày",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "future",
    label: "> 7 ngày",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "waiting",
    label: "Chờ lượt",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
  {
    id: "new",
    label: "Chưa học",
    activeClass:
      "bg-teal-700 text-white border-teal-700 font-semibold dark:bg-teal-600 dark:border-teal-600",
  },
];

export default function ReviewTimeFilterBar({
  selectedBucket,
  onSelectBucket,
  bucketCounts,
}: ReviewTimeFilterBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
      <div className="flex items-center gap-1.5 shrink-0 select-none pr-1 text-sm text-slate-600 dark:text-zinc-400">
        <Clock className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
        <span>Lịch nhắc lại:</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {BUCKET_CONFIGS.map((config) => {
          const isSelected = selectedBucket === config.id;
          const count = bucketCounts[config.id] || 0;

          // Don't clutter with 0-count items except 'all' and 'due'
          if (count === 0 && config.id !== "all" && config.id !== "due" && !isSelected) {
            return null;
          }

          return (
            <button
              key={config.id}
              onClick={() => onSelectBucket(config.id)}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                isSelected
                  ? config.activeClass
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {config.id === "due" && count > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              <span>{config.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums border ${
                  isSelected
                    ? "bg-white/20 text-white border-transparent"
                    : "bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/50"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
