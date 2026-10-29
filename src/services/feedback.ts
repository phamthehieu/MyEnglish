/**
 * The learner's feedback ("Góp ý"): a message sent to the Supabase table `feedback` through send_feedback
 * (migration 0008), which also posts it to the developer's Telegram. No account needed. None of the study data goes
 * with it: only the app version, the platform and the levels studied, so a report can be reproduced.
 */
import { getSupabase } from "./supabase";
import { getDeviceId } from "./sync/state";
import { CURRENT_VERSION } from "./updateService";
import { getStudyLevels } from "./vocabFeed";

export type FeedbackKind = "bug" | "content" | "idea" | "other";

export const FEEDBACK_KINDS: ReadonlyArray<{ id: FeedbackKind; label: string; hint: string }> = [
  { id: "bug", label: "Lỗi", hint: "Bạn bấm gì, app làm gì, và bạn mong app làm gì?" },
  { id: "content", label: "Nội dung sai", hint: "Từ, câu hay bài nào bị sai, sai chỗ nào?" },
  { id: "idea", label: "Ý tưởng", hint: "Bạn muốn app có thêm gì, hoặc làm khác đi thế nào?" },
  { id: "other", label: "Khác", hint: "Bạn muốn nhắn gì cho người làm app?" },
];

/** Same bounds as the table (0008_feedback.sql) */
export const FEEDBACK_MAX = 2000;
export const CONTACT_MAX = 200;

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  contact?: string;
}

export type CheckedFeedback = { ok: true; message: string; contact: string | null } | { ok: false; error: string };

/** The trimmed fields, or why the form cannot be sent yet */
export function checkFeedback({ message, contact }: FeedbackInput): CheckedFeedback {
  const m = message.trim();
  const c = (contact ?? "").trim();
  if (!m) return { ok: false, error: "Bạn viết vài dòng rồi gửi nhé." };
  if (m.length > FEEDBACK_MAX) return { ok: false, error: `Góp ý dài quá, tối đa ${FEEDBACK_MAX} ký tự.` };
  if (c.length > CONTACT_MAX) return { ok: false, error: `Thông tin liên hệ dài quá, tối đa ${CONTACT_MAX} ký tự.` };
  return { ok: true, message: m, contact: c || null };
}

export function platformName(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent || ""): string {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "khác";
}

/** The learner-facing text for an error of send_feedback */
export function feedbackErrorText(message: string): string {
  if (message.includes("feedback_limit")) return "Hôm nay bạn đã gửi 5 góp ý rồi, mai gửi tiếp nhé. Cảm ơn bạn!";
  if (message.includes("feedback_busy")) return "Máy chủ đang bận, bạn thử lại sau ít phút nhé.";
  return "Chưa gửi được. Bạn kiểm tra mạng rồi bấm gửi lại nhé.";
}

export async function sendFeedback(input: FeedbackInput): Promise<void> {
  const checked = checkFeedback(input);
  if (!checked.ok) throw new Error(checked.error);
  const client = getSupabase();
  if (!client) throw new Error("Bản app này chưa kết nối máy chủ nên chưa gửi được góp ý.");
  let error: { message: string } | null;
  try {
    ({ error } = await client.rpc("send_feedback", {
      p_device: await getDeviceId(),
      p_kind: input.kind,
      p_message: checked.message,
      p_contact: checked.contact,
      p_context: { version: CURRENT_VERSION, platform: platformName(), levels: getStudyLevels().join(", ") },
    }));
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) };
  }
  if (error) throw new Error(feedbackErrorText(error.message));
}
