import { useMemo, useState } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { Button } from "../ui/kit";
import { addMetWords, preselected, splitMetText } from "@/services/metWords";
import { AI_VOCAB_ENABLED } from "@/services/features";

/**
 * "Lưu từ": a text met at work (shared to the app, or chosen in another app's selection menu) shown as its
 * sentences; a tap picks a word, which is learnt soon with the sentence it was met in.
 */
export default function CaptureSheet({ text, onClose, onSaved }: { text: string; onClose: () => void; onSaved: () => void }) {
  const sentences = useMemo(() => splitMetText(text), [text]);
  // base → the sentence it was picked in
  const [picked, setPicked] = useState<Map<string, string>>(() => {
    const first = preselected(sentences);
    return new Map(first.map((base) => [base, sentences[0]?.text ?? ""]));
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggle = (base: string, sentence: string) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(base)) next.delete(base);
      else next.set(base, sentence);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const { accepted, refused } = await addMetWords(picked);
      onSaved();
      setResult(
        (accepted > 0
          ? `Đã lưu ${accepted} từ: ${AI_VOCAB_ENABLED ? "AI sẽ phân tích nghĩa" : "bạn sẽ học sớm"}, kèm câu bạn gặp làm ví dụ.`
          : "Chưa lưu được từ nào.") + (refused.length ? ` Không có trong bộ từ của app: ${refused.join(", ")}.` : "")
      );
    } catch (err) {
      setResult(`Chưa lưu được: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Lưu từ">
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
            <BookmarkPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-slate-900 dark:text-zinc-100">Lưu từ vào MyEnglish</div>
            <div className="text-sm text-slate-500 dark:text-zinc-400">{result ? "Xong" : "Chạm vào từ bạn muốn học"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {sentences.length === 0 ? (
            <p className="text-base text-slate-700 dark:text-zinc-300">Không thấy từ tiếng Anh nào trong đoạn này.</p>
          ) : (
            sentences.map((s, i) => (
              <p key={i} className="text-lg leading-[2.4rem] text-slate-800 dark:text-zinc-200">
                {s.words.map((w, j) => {
                  const on = picked.has(w.base);
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={!!result}
                      onClick={() => toggle(w.base, s.text)}
                      aria-pressed={on}
                      className={`mr-1.5 inline rounded-lg px-1.5 py-1 transition-colors ${
                        on
                          ? "bg-teal-700 font-semibold text-white dark:bg-teal-500 dark:text-zinc-950"
                          : "bg-slate-100 hover:bg-teal-50 dark:bg-zinc-800 dark:hover:bg-teal-400/10"
                      }`}
                    >
                      {w.raw}
                    </button>
                  );
                })}
              </p>
            ))
          )}
          {picked.size > 0 && !result && (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Sẽ học: {[...picked.keys()].join(", ")}
            </p>
          )}
          {result && <p className="rounded-xl bg-teal-50 p-3 text-base text-teal-900 dark:bg-teal-400/10 dark:text-teal-100" role="status">{result}</p>}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          {result ? (
            <Button block size="lg" onClick={onClose}>
              Xong
            </Button>
          ) : (
            <Button block size="lg" disabled={picked.size === 0 || saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : picked.size > 0 ? `Lưu ${picked.size} từ` : "Chọn từ để lưu"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
