/**
 * When a study reminder is due (shared by the Edge Function send-reminders and the app's tests: plain TypeScript,
 * no Deno or browser API).
 */

/** The function runs every 5 minutes; a reminder may go up to this long after its time (a late or missed run) */
export const SLOT_WINDOW_MINUTES = 15;

/** The date ("YYYY-MM-DD") and minute of the day at `now` in time zone `tz` */
export function localClock(now: Date, tz: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * The study time due now, as "YYYY-MM-DD HH:MM" (the key that makes it once a day), or null: a time reached less
 * than SLOT_WINDOW_MINUTES ago, not the one `lastSlot` already sent.
 */
export function dueSlot(times: readonly string[], tz: string, now: Date, lastSlot: string | null): string | null {
  const { date, minutes } = localClock(now, tz);
  for (const time of [...times].sort().reverse()) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!m) continue;
    const at = Number(m[1]) * 60 + Number(m[2]);
    const since = minutes - at;
    if (since >= 0 && since < SLOT_WINDOW_MINUTES) {
      const slot = `${date} ${time}`;
      return slot === lastSlot ? null : slot;
    }
  }
  return null;
}

/** The notification's words, varied by the day so the same line does not come every time */
const LINES = [
  "Đến giờ học rồi: vài phút ôn từ là đủ cho hôm nay.",
  "Mở MyEnglish ôn mấy từ sắp quên nhé, chỉ vài phút thôi.",
  "Giờ học của bạn đây: ôn nhanh vài từ rồi làm tiếp việc khác.",
  "Mỗi ngày một chút: vào ôn từ trước khi chúng trôi mất nhé.",
];

export function reminderText(slot: string): { title: string; body: string } {
  let h = 0;
  for (let i = 0; i < slot.length; i++) h = (h * 31 + slot.charCodeAt(i)) >>> 0;
  return { title: "MyEnglish", body: LINES[h % LINES.length] };
}
