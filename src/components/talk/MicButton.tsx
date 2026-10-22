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
        className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 animate-pulse"
      >
        <Square className="w-4 h-4 fill-white" /> Đang nghe… nói xong thì bấm để dừng
      </button>
    );
  }
  const busy = mic.phase !== "idle";
  return (
    <button
      onClick={onStart}
      disabled={busy}
      className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {mic.phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang nghe lại…"}
        </>
      ) : (
        <>
          <Mic className="w-4 h-4" /> {idleLabel}
        </>
      )}
    </button>
  );
}
