import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import StudyTimesField from "./StudyTimesField";
import { SETTINGS_GROUP } from "./SettingsSection";
import { Button } from "@/components/ui/kit";
import { getReminderSettings, saveReminderSettings } from "@/services/reminderSettings";
import { anchorTimesOf } from "@/services/reminderMoments";
import {
  disableWebReminders,
  enableWebReminders,
  timesToSend,
  updateWebReminderTimes,
  webPushState,
  type WebPushState,
} from "@/services/webPush";

const GROUP = `${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 md:shadow-sm space-y-4`;

/**
 * "Nhắc học" in the web app: the browser's notifications at the learner's study times, sent by the server
 * (src/services/webPush.ts). The times are the same setting as in the apps.
 */
export default function WebReminders() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [settings, setSettings] = useState(getReminderSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const times = anchorTimesOf(settings.anchors ?? []);
  const sent = timesToSend(times, settings.nightQuiet);

  useEffect(() => {
    void webPushState().then(setState);
  }, []);

  const run = async (work: () => Promise<WebPushState | void>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await work();
      if (next) setState(next);
      if (done) setMessage(done);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const changeTimes = (anchors: string[]) => {
    const next = saveReminderSettings({ anchors });
    setSettings(next);
    if (state === "on") void run(() => updateWebReminderTimes(timesToSend(anchorTimesOf(next.anchors), next.nightQuiet)), "Đã lưu giờ nhắc.");
  };

  if (state === null) return null;

  if (state === "unsupported") {
    return (
      <div className={GROUP}>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          Trình duyệt này chưa nhận được thông báo nhắc học. Hãy dùng Chrome, Edge hoặc Safari, hoặc app trên điện thoại
          Android hay máy tính.
        </p>
      </div>
    );
  }

  if (state === "needs-install") {
    return (
      <div className={GROUP}>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          Trên iPhone, Safari chỉ gửi thông báo cho app đã thêm vào màn hình chính. Bấm nút <strong>Chia sẻ</strong> (ô vuông có
          mũi tên lên) ở thanh dưới Safari → <strong>Thêm vào MH chính</strong> → <strong>Thêm</strong>. Sau đó mở MyEnglish từ biểu
          tượng mới trên màn hình chính và bật nhắc học ở đây. Cần iOS 16.4 trở lên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={GROUP}>
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 shrink-0">
            <BellRing className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              {state === "on" ? "Đang bật nhắc học" : "Nhắc học bằng thông báo"}
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 leading-snug">
              {state === "on"
                ? sent.length > 0
                  ? `Thông báo đến lúc ${sent.join(", ")} mỗi ngày, kể cả khi đã đóng trang.`
                  : "Chưa có giờ nào để nhắc: chọn giờ học bên dưới."
                : state === "blocked"
                  ? "Bạn đã chặn thông báo của trang này. Mở cài đặt trang web của trình duyệt (biểu tượng ổ khóa cạnh địa chỉ) và cho phép Thông báo, rồi tải lại trang."
                  : "Trình duyệt sẽ báo đúng giờ học bạn chọn, kể cả khi đã đóng trang."}
            </p>
          </div>
        </div>
        {state !== "blocked" && (
          <Button
            block
            variant={state === "on" ? "secondary" : "primary"}
            disabled={busy || (state === "off" && sent.length === 0)}
            onClick={() =>
              void (state === "on"
                ? run(disableWebReminders, "Đã tắt nhắc học trên trình duyệt này.")
                : run(() => enableWebReminders(sent), "Đã bật nhắc học."))
            }
          >
            {busy ? "Đang lưu…" : state === "on" ? "Tắt nhắc học" : "Bật nhắc học"}
          </Button>
        )}
        {state === "off" && sent.length === 0 && <p className="text-sm text-amber-800 dark:text-amber-300">Chọn ít nhất một giờ học bên dưới trước.</p>}
        {message && <p className="text-sm text-slate-700 dark:text-zinc-300" role="status">{message}</p>}
      </div>
      <StudyTimesField anchors={settings.anchors ?? []} active nightQuiet={settings.nightQuiet} onChange={changeTimes} />
    </div>
  );
}
