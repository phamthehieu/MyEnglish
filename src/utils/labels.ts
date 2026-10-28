/**
 * Words the learner reads on screen. Keep one Vietnamese term per idea here, so the same thing is not
 * called by two names in two places. The stored values (topic keys, ratings) are not changed: only what is shown.
 */

/** The topic every word falls back to; kept as the stored value, shown as "Chung" */
const DEFAULT_TOPIC = "General Tech";

/** A word's topic as the learner should read it */
export function topicLabel(topic: string | null | undefined): string {
  const t = (topic ?? "").trim();
  return !t || t === DEFAULT_TOPIC ? "Chung" : t;
}

/** What the memory algorithm knows about a word, in plain words ("Mới", "nhớ 3 ngày") */
export function memoryLabel(stability: number | null | undefined): string {
  if (!stability || stability <= 0) return "Mới";
  const days = Math.max(1, Math.round(stability));
  return days >= 365 ? `nhớ ${Math.round(days / 365)} năm` : days >= 30 ? `nhớ ${Math.round(days / 30)} tháng` : `nhớ ${days} ngày`;
}

/** The button that marks a word as not remembered (it comes back soon) */
export const FORGOT_ACTION = "Không nhớ, xem đáp án";
