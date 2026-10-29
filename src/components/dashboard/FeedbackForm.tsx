import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareHeart, Send, X } from "lucide-react";
import { CONTACT_MAX, FEEDBACK_KINDS, FEEDBACK_MAX, sendFeedback, type FeedbackKind } from "@/services/feedback";
import { isCloudConfigured } from "@/services/supabase";
import { useBackButton } from "@/hooks/useBackButton";

/**
 * The "Góp ý" form: a kind, a message, an optional way to answer. A failed send keeps what was written, so the
 * learner only taps "Gửi" again. Used in Settings and in the dialog opened from Today.
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCloudConfigured()) {
    return <p className="text-sm text-slate-600 dark:text-zinc-400">Bản app này chưa kết nối máy chủ nên chưa gửi được góp ý.</p>;
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Đã gửi. Cảm ơn bạn! Người làm app đọc hết từng góp ý.{contact.trim() ? " Bạn sẽ được trả lời qua liên hệ đã để lại." : ""}</span>
        </p>
        <button
          onClick={() => {
            setMessage("");
            setSent(false);
          }}
          className="min-h-11 px-4 py-2 rounded-2xl text-sm font-semibold border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10"
        >
          Gửi góp ý khác
        </button>
      </div>
    );
  }

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await sendFeedback({ kind, message, contact });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const hint = FEEDBACK_KINDS.find((k) => k.id === kind)?.hint;
  const field =
    "w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-3 text-base text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 dark:focus:border-teal-400";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Loại góp ý">
        {FEEDBACK_KINDS.map((k) => (
          <button
            key={k.id}
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`min-h-11 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              kind === k.id
                ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={FEEDBACK_MAX}
          rows={5}
          placeholder={hint}
          aria-label="Nội dung góp ý"
          className={`${field} resize-y`}
        />
        <p className="mt-1 text-right text-xs text-slate-500 dark:text-zinc-400">
          {message.length}/{FEEDBACK_MAX}
        </p>
      </div>

      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        maxLength={CONTACT_MAX}
        placeholder="Email hoặc Zalo nếu muốn được trả lời (không bắt buộc)"
        aria-label="Liên hệ"
        className={field}
      />

      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Gửi kèm phiên bản app, loại máy và trình độ bạn đang học để dễ tìm lỗi. Không gửi dữ liệu học của bạn.
      </p>

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      <button
        onClick={submit}
        disabled={sending || !message.trim()}
        className="min-h-12 px-5 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? "Đang gửi..." : "Gửi góp ý"}
      </button>
    </div>
  );
}

/** The form in a dialog (a sheet from the bottom on phones) */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackButton(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <MessageSquareHeart className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="feedback-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Góp ý cho app
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Gặp lỗi, thấy bài sai, hay muốn app có thêm gì? Nhắn ở đây nhé.</p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="w-11 h-11 -m-2 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <FeedbackForm />
      </div>
    </div>
  );
}
