import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button, Card } from "../ui/kit";
import { isWeb } from "@/lib/platform";

const DISMISS_KEY = "myenglish_install_card_dismissed_v1";
const DISMISS_DAYS = 30;

/* The browser's install prompt (Chrome, Edge); not in TypeScript's DOM types */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const installed = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const iosSafari = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * The web app, not yet installed: an offer to put it on the home screen (full screen, opens offline, reminders on an
 * iPhone). Chrome and Edge install it with their own prompt; Safari on an iPhone has no prompt, so the steps are
 * shown. Gone once installed, or for 30 days when closed.
 */
export default function InstallAppCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => !isWeb() || installed() || dismissedRecently());
  const ios = !hidden && iosSafari();

  useEffect(() => {
    if (hidden) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // shown by the card's button, not by the browser at a moment of its own
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [hidden]);

  if (hidden || (!ios && !prompt)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* shown again next time */
    }
    setHidden(true);
  };

  return (
    <Card className="relative space-y-3">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Để sau"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="pr-10">
        <div className="text-base font-semibold text-slate-900 dark:text-zinc-100">Cài MyEnglish lên màn hình chính</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Mở bằng một chạm như app, toàn màn hình, học được cả khi không có mạng{ios ? ", và nhận thông báo nhắc học" : ""}.
        </p>
      </div>
      {ios ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          <li>
            Bấm nút <Share className="inline h-4 w-4 align-text-bottom" aria-label="Chia sẻ" /> <strong>Chia sẻ</strong> ở thanh dưới Safari.
          </li>
          <li>
            Kéo xuống, chọn <strong>Thêm vào MH chính</strong>, rồi bấm <strong>Thêm</strong>.
          </li>
          <li>Từ giờ mở MyEnglish bằng biểu tượng mới trên màn hình chính.</li>
        </ol>
      ) : (
        <Button
          block
          onClick={async () => {
            if (!prompt) return;
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            setPrompt(null);
            if (outcome === "accepted") setHidden(true);
          }}
        >
          <Download className="h-5 w-5" /> Cài app
        </Button>
      )}
    </Card>
  );
}
