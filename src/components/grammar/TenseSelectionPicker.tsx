import { useMemo } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { DEFAULT_INITIAL_TENSE_IDS } from "@/services/grammarPath";

export interface TenseItemConfig {
  id: string;
  titleVn: string;
  titleEn: string;
  formula: string;
  hint: string;
  group: "present" | "past" | "future";
  groupLabel: string;
  isDefault?: boolean;
  recommendedBadge?: string;
}

export const TENSE_OPTIONS: TenseItemConfig[] = [
  // Nhóm Hiện tại (Present)
  {
    id: "ch01-l01",
    titleVn: "Thì hiện tại đơn",
    titleEn: "The Present Simple Tense",
    formula: "S + V(s/es)",
    hint: "Thói quen, sự thật hiển nhiên (I work, She studies)",
    group: "present",
    groupLabel: "Các thì hiện tại (Present)",
    isDefault: true,
    recommendedBadge: "Khuyên dùng cho người mất gốc",
  },
  {
    id: "ch01-l02",
    titleVn: "Thì hiện tại tiếp diễn",
    titleEn: "The Present Continuous Tense",
    formula: "S + am/is/are + V-ing",
    hint: "Hành động đang diễn ra (I am doing homework)",
    group: "present",
    groupLabel: "Các thì hiện tại (Present)",
  },
  {
    id: "ch01-l03",
    titleVn: "Thì hiện tại hoàn thành",
    titleEn: "The Present Perfect Tense",
    formula: "S + have/has + V3/ed",
    hint: "Hành động đã xảy ra có kết quả ở hiện tại (I have seen)",
    group: "present",
    groupLabel: "Các thì hiện tại (Present)",
  },
  {
    id: "ch01-l04",
    titleVn: "Thì hiện tại hoàn thành tiếp diễn",
    titleEn: "The Present Perfect Continuous Tense",
    formula: "S + have/has been + V-ing",
    hint: "Bắt đầu ở quá khứ và kéo dài liên tục đến nay",
    group: "present",
    groupLabel: "Các thì hiện tại (Present)",
  },

  // Nhóm Quá khứ (Past)
  {
    id: "ch01-l05",
    titleVn: "Thì quá khứ đơn",
    titleEn: "The Past Simple Tense",
    formula: "S + V2/ed",
    hint: "Đã xảy ra và kết thúc trong quá khứ (I went, He saw)",
    group: "past",
    groupLabel: "Các thì quá khứ (Past)",
  },
  {
    id: "ch01-l06",
    titleVn: "Thì quá khứ tiếp diễn",
    titleEn: "The Past Continuous Tense",
    formula: "S + was/were + V-ing",
    hint: "Đang diễn ra tại một thời điểm quá khứ",
    group: "past",
    groupLabel: "Các thì quá khứ (Past)",
  },
  {
    id: "ch01-l07",
    titleVn: "Thì quá khứ hoàn thành",
    titleEn: "The Past Perfect Tense",
    formula: "S + had + V3/ed",
    hint: "Xảy ra trước một mốc hoặc hành động quá khứ khác",
    group: "past",
    groupLabel: "Các thì quá khứ (Past)",
  },
  {
    id: "ch01-l08",
    titleVn: "Thì quá khứ hoàn thành tiếp diễn",
    titleEn: "The Past Perfect Continuous Tense",
    formula: "S + had been + V-ing",
    hint: "Kéo dài liên tục trước một thời điểm quá khứ",
    group: "past",
    groupLabel: "Các thì quá khứ (Past)",
  },

  // Nhóm Tương lai (Future)
  {
    id: "ch01-l09",
    titleVn: "Thì tương lai đơn",
    titleEn: "The simple Future Tense",
    formula: "S + will + V(inf)",
    hint: "Quyết định tức thì, lời hứa, dự đoán (I will call you)",
    group: "future",
    groupLabel: "Các thì tương lai (Future)",
  },
  {
    id: "ch01-l10",
    titleVn: "Tương lai gần",
    titleEn: "Near Future (be going to)",
    formula: "S + am/is/are going to + V",
    hint: "Kế hoạch hoặc dấu hiệu sắp xảy ra (It is going to rain)",
    group: "future",
    groupLabel: "Các thì tương lai (Future)",
  },
  {
    id: "ch01-l11",
    titleVn: "Thì tương lai tiếp diễn",
    titleEn: "The Future Continuous Tense",
    formula: "S + will be + V-ing",
    hint: "Sẽ đang xảy ra vào thời điểm tương lai",
    group: "future",
    groupLabel: "Các thì tương lai (Future)",
  },
  {
    id: "ch01-l12",
    titleVn: "Thì tương lai hoàn thành",
    titleEn: "The Future Perfect Tense",
    formula: "S + will have + V3/ed",
    hint: "Sẽ hoàn tất trước thời điểm nào đó trong tương lai",
    group: "future",
    groupLabel: "Các thì tương lai (Future)",
  },
  {
    id: "ch01-l13",
    titleVn: "Thì tương lai hoàn thành tiếp diễn",
    titleEn: "The Future Perfect Continuous Tense",
    formula: "S + will have been + V-ing",
    hint: "Kéo dài liên tục đến một thời điểm tương lai",
    group: "future",
    groupLabel: "Các thì tương lai (Future)",
  },
];

interface TenseSelectionPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export default function TenseSelectionPicker({ value, onChange, className = "" }: TenseSelectionPickerProps) {
  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      if (value.length <= 1) {
        // Must keep at least 1 tense selected
        return;
      }
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectOnlyDefault = () => {
    onChange([...DEFAULT_INITIAL_TENSE_IDS]);
  };

  const selectGroup = (group: "present" | "past" | "future") => {
    const groupIds = TENSE_OPTIONS.filter((t) => t.group === group).map((t) => t.id);
    const allInGroupSelected = groupIds.every((id) => selectedSet.has(id));
    if (allInGroupSelected) {
      const remaining = value.filter((id) => !groupIds.includes(id));
      onChange(remaining.length > 0 ? remaining : [...DEFAULT_INITIAL_TENSE_IDS]);
    } else {
      onChange(Array.from(new Set([...value, ...groupIds])));
    }
  };

  const groups: Array<{ key: "present" | "past" | "future"; title: string }> = [
    { key: "present", title: "CÁC THÌ HIỆN TẠI (PRESENT)" },
    { key: "past", title: "CÁC THÌ QUÁ KHỨ (PAST)" },
    { key: "future", title: "CÁC THÌ TƯƠNG LAI (FUTURE)" },
  ];

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Top summary & fast action */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 py-1.5 text-sm text-slate-700 dark:text-zinc-300">
          <span className="font-semibold">Đã chọn:</span>
          <span className="inline-flex items-center justify-center rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-bold text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
            {value.length} / {TENSE_OPTIONS.length} thì
          </span>
          {value.length === 1 && value.includes("ch01-l01") && (
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              (Thì hiện tại đơn - Tối ưu cho người mất gốc)
            </span>
          )}
        </div>

        {!(value.length === 1 && value.includes("ch01-l01")) && (
          <button
            type="button"
            onClick={selectOnlyDefault}
            className="-mr-2 inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            <RotateCcw className="h-4 w-4" />
            Về mặc định (chỉ Hiện tại đơn)
          </button>
        )}
      </div>

      {/* Groups */}
      <div className="space-y-5">
        {groups.map(({ key, title }) => {
          const items = TENSE_OPTIONS.filter((t) => t.group === key);
          const allInGroupSelected = items.every((t) => selectedSet.has(t.id));

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600 dark:text-zinc-400">
                  {title}
                </span>
                <button
                  type="button"
                  onClick={() => selectGroup(key)}
                  className="-mr-2 min-h-12 shrink-0 rounded-xl px-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                >
                  {allInGroupSelected ? "Bỏ chọn nhóm" : "Chọn cả nhóm"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {items.map((item) => {
                  const isChecked = selectedSet.has(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggle(item.id)}
                      className={`relative flex min-h-16 w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
                        isChecked
                          ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`text-base font-semibold ${isChecked ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-white"}`}>
                            {item.titleVn}
                          </span>
                          {item.recommendedBadge && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-teal-500 dark:text-zinc-950">
                              <Sparkles className="h-3 w-3" />
                              {item.recommendedBadge}
                            </span>
                          )}
                        </div>

                        <span className="block text-sm text-slate-600 dark:text-zinc-400">
                          {item.titleEn}
                        </span>

                        <div className="flex flex-wrap items-center gap-x-2 pt-0.5">
                          <span className={`inline-block rounded-lg px-2 py-1 font-mono text-sm font-semibold text-teal-800 dark:text-teal-300 ${isChecked ? "bg-white dark:bg-zinc-900" : "bg-slate-50 dark:bg-zinc-800"}`}>
                            {item.formula}
                          </span>
                        </div>

                        <p className="pt-0.5 text-sm leading-snug text-slate-600 dark:text-zinc-400">
                          {item.hint}
                        </p>
                      </div>

                      {/* Check indicator */}
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                          isChecked
                            ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950"
                            : "border-2 border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="pt-1 text-center text-sm text-slate-600 dark:text-zinc-400">
        💡 Bạn có thể bật/tắt thêm các thì và 30 chương ngữ pháp khác trong tab <b>Ngữ pháp</b> bất cứ lúc nào.
      </p>
    </div>
  );
}
