import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { OPEN_DICTIONARY_EVENT } from "@/services/dictionary";
import DictionaryTab from "./DictionaryTab";
import { useBackHandler } from "@/lib/backNavigation";

/**
 * Global Quick Dictionary Modal.
 * Uses a fixed full-height sheet anchored to the top on mobile so the header and search bar
 * NEVER jump or shift when typing, when result counts change, or when the virtual keyboard opens.
 */
export default function DictionaryQuickModal() {
  const [open, setOpen] = useState(false);
  const [initialWord, setInitialWord] = useState<string>("");

  useBackHandler(() => {
    if (open) {
      setOpen(false);
      return true;
    }
    return false;
  }, open);

  useEffect(() => {
    const onOpenEvent = (e: Event) => {
      const custom = e as CustomEvent<{ word?: string }>;
      setInitialWord(custom.detail?.word ?? "");
      setOpen(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const selection = window.getSelection()?.toString().trim() ?? "";
        if (selection && selection.length <= 45) {
          setInitialWord(selection);
        }
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_DICTIONARY_EVENT, onOpenEvent);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_DICTIONARY_EVENT, onOpenEvent);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tra nhanh Từ điển Anh-Việt & Anh-Anh"
      className="fixed inset-0 z-50 flex flex-col justify-start sm:justify-center sm:items-center bg-black/60 backdrop-blur-2xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full h-full sm:h-[84vh] sm:max-h-[84vh] sm:max-w-3xl flex flex-col sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-zinc-800 bg-[#f7f8fa] dark:bg-zinc-950 shadow-2xl overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Locked Modal Header */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
                Từ điển Đa năng (Anh - Việt · Anh - Anh · Việt - Anh)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                161.500+ từ Offline · Chạm vào bất kỳ từ nào để nghe và xem chi tiết
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng cửa sổ từ điển"
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded DictionaryTab with fixed top search bar and independent scroll body */}
        <DictionaryTab
          initialWord={initialWord}
          isModal
          onCloseModal={() => setOpen(false)}
        />
      </div>
    </div>
  );
}
