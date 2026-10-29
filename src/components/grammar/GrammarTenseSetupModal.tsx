import { useState } from "react";
import { BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { DEFAULT_INITIAL_TENSE_IDS, saveInitialTenses } from "@/services/grammarPath";
import TenseSelectionPicker from "./TenseSelectionPicker";
import { Button } from "../ui/kit";

interface GrammarTenseSetupModalProps {
  onDone: () => void;
}

export default function GrammarTenseSetupModal({ onDone }: GrammarTenseSetupModalProps) {
  const [selectedTenses, setSelectedTenses] = useState<string[]>([...DEFAULT_INITIAL_TENSE_IDS]);
  const [saving, setSaving] = useState(false);

  const handleConfirm = () => {
    setSaving(true);
    try {
      saveInitialTenses(selectedTenses);
      onDone();
    } catch (err) {
      console.warn("Failed to save initial tenses:", err);
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F7F8FA] dark:bg-zinc-950 animate-in fade-in duration-200">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex-1 space-y-6 pb-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                <BookOpen className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chọn thì bắt đầu học</h1>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 dark:text-teal-300">
                  <Sparkles className="h-3.5 w-3.5" /> Lộ trình ngữ pháp tinh gọn cho người mất gốc
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              Trước đây app tự động bật toàn bộ các chương và các thì, dễ gây ngợp khi làm bài và kiểm tra. Giờ đây bạn có thể chọn thì mình muốn tập trung học trước — mặc định là <b>Thì hiện tại đơn</b>.
            </p>
          </div>

          {/* Tense picker */}
          <TenseSelectionPicker value={selectedTenses} onChange={setSelectedTenses} />
        </div>

        {/* Bottom actions */}
        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-slate-200 bg-[#F7F8FA]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <Button size="lg" block onClick={handleConfirm} disabled={saving || selectedTenses.length === 0}>
            <CheckCircle2 className="h-5 w-5" />
            Xác nhận & Bắt đầu học
          </Button>
          <span className="block text-center text-sm text-slate-600 dark:text-zinc-400">
            Có thể thay đổi bất cứ lúc nào trong tab <b>Ngữ pháp</b>
          </span>
        </div>
      </div>
    </div>
  );
}
