import { Trash2 } from "lucide-react";
import { deleteWord } from "@/services/db";
import { useWordsStore } from "@/stores/wordsStore";

interface DeleteWordModalProps {
  wordToDelete: { id: string; word: string };
  setWordToDelete: (value: { id: string; word: string } | null) => void;
  isDeleting: boolean;
  setIsDeleting: (value: boolean) => void;
  setMessage: (msg: string | null) => void;
}

/** IN-APP DELETE CONFIRMATION MODAL */
export default function DeleteWordModal({
  wordToDelete,
  setWordToDelete,
  isDeleting,
  setIsDeleting,
  setMessage,
}: DeleteWordModalProps) {
  const handleConfirmDelete = async () => {
    if (!wordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteWord(wordToDelete.id);
      const { selectedWord, setSelectedWord, refreshWords } = useWordsStore.getState();
      if (selectedWord?.id === wordToDelete.id) {
        setSelectedWord(null);
      }
      setMessage(`Đã xoá từ "${wordToDelete.word}" khỏi thư viện.`);
      setWordToDelete(null);
      await refreshWords();
    } catch (err) {
      console.error("Failed to delete word:", err);
      setMessage(`Lỗi khi xoá từ: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-150 dark:bg-black/60 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in zoom-in-95 duration-150 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Xác nhận xoá từ vựng</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400">Hành động này sẽ xoá vĩnh viễn khỏi thư viện</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
          Bạn có chắc chắn muốn xoá từ{" "}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
            {wordToDelete.word}
          </span>{" "}
          khỏi từ điển? Toàn bộ ví dụ, phân tích ngữ pháp và tiến độ ôn tập sẽ bị xoá.
        </p>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => setWordToDelete(null)}
            disabled={isDeleting}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
          >
            Huỷ bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 text-base font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? "Đang xoá..." : "Xoá từ vựng"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
