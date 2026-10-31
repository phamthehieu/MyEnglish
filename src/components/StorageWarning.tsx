import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { STORAGE_FAILED_EVENT, STORAGE_SAVED_EVENT } from "@/services/sqlite/webDatabase";

/**
 * Web app: the browser refused to write the study data several times in a row (storage full, Safari losing its
 * database). The learner is told before closing the page loses the session; it goes away once a write succeeds.
 */
export default function StorageWarning() {
  const [failing, setFailing] = useState(false);
  useEffect(() => {
    const fail = () => setFailing(true);
    const saved = () => setFailing(false);
    window.addEventListener(STORAGE_FAILED_EVENT, fail);
    window.addEventListener(STORAGE_SAVED_EVENT, saved);
    return () => {
      window.removeEventListener(STORAGE_FAILED_EVENT, fail);
      window.removeEventListener(STORAGE_SAVED_EVENT, saved);
    };
  }, []);
  if (!failing) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 shadow-lg dark:border-red-500/40 dark:bg-red-950 dark:text-red-100"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <p>
        Trình duyệt chưa lưu được bài học vừa rồi, app đang thử lại. Đừng đóng trang lúc này. Nếu báo mãi: giải phóng bộ
        nhớ máy, hoặc đăng nhập để đồng bộ.
      </p>
    </div>
  );
}
