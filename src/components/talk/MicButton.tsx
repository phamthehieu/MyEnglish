import { Loader2, Mic, Square } from "lucide-react";
import type { MicHandle } from "./useMic";

/** The one button for speaking: start, stop, and what it is doing meanwhile */
export default function MicButton({
  mic,
  onStart,
  idleLabel = "Bấm để nói",
}: {
  mic: MicHandle;
  onStart: () => void;
  idleLabel?: string;
}) {
  if (mic.phase === "listening") {
    return (
      <button
        onClick={mic.stop}
        className="w-full min-h-[48px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 animate-pulse"
      >
        <Square className="w-4 h-4 shrink-0 fill-white" /> <span>Đang nghe… Đọc xong thì dừng lại, máy sẽ tự chấm (hoặc bấm để dừng)</span>
      </button>
    );
  }
  const busy = mic.phase !== "idle";
  return (
    <button
      onClick={onStart}
      disabled={busy}
      className="w-full min-h-[48px] py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {mic.phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang chấm…"}
        </>
      ) : (
        <>
          <Mic className="w-4 h-4" /> {idleLabel}
        </>
      )}
    </button>
  );
}
