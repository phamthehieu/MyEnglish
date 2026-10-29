import type { ReactNode } from "react";
import { ArrowLeft, Loader2, Mic, Square, X } from "lucide-react";
import type { MicHandle } from "./useMic";

/**
 * The quiet top line of a speaking practice (same as the review session's): a round back/close button, what is
 * being practised, how far along, and a thin teal bar. `right` replaces the count when there is no bar to show.
 */
export function PracticeTop({
  onBack,
  backLabel,
  close = false,
  label,
  count,
  percent,
  right,
}: {
  onBack?: () => void;
  backLabel: string;
  /** An X instead of an arrow (leaving a running practice) */
  close?: boolean;
  label: ReactNode;
  count?: ReactNode;
  percent?: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {close ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="min-w-0 truncate text-slate-500 dark:text-zinc-400">{label}</span>
          {count != null && <span className="shrink-0 text-teal-800 dark:text-teal-300">{count}</span>}
        </div>
        {percent != null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-teal-700 transition-[width] duration-300 dark:bg-teal-500" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/** The round mic in the middle, its label under it: the whole thing is one button */
const WRAP = "group mx-auto flex w-full flex-col items-center gap-2 rounded-2xl py-1 text-sm font-semibold disabled:cursor-not-allowed";
const CIRCLE = "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform group-active:scale-95";

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
      <button onClick={mic.stop} className={WRAP}>
        <span className={`${CIRCLE} bg-red-600 ring-8 ring-red-500/15 animate-pulse group-hover:bg-red-700 motion-reduce:animate-none`}>
          <Square className="h-6 w-6 fill-white" />
        </span>
        <span className="max-w-xs text-center text-red-700 dark:text-red-300">Đang nghe… Đọc xong thì dừng lại, máy sẽ tự chấm (hoặc bấm để dừng)</span>
      </button>
    );
  }
  const busy = mic.phase !== "idle";
  return (
    <button onClick={onStart} disabled={busy} className={WRAP}>
      <span className={`${CIRCLE} ${busy ? "bg-teal-700/60 dark:bg-teal-600/60" : "bg-teal-700 group-hover:bg-teal-800 dark:bg-teal-600 dark:group-hover:bg-teal-500"}`}>
        {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
      </span>
      <span className="text-center text-teal-800 dark:text-teal-300">
        {busy ? (mic.phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang chấm…") : idleLabel}
      </span>
    </button>
  );
}
