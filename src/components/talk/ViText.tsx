import { useEffect, useState } from "react";
import { handleSpeak } from "@/components/review/speech";
import { viHints, type FixedPair, type ViSegment } from "@/services/viHints";

/**
 * The Vietnamese of a sentence to say, with its words that are paired with the English answer underlined: a tap
 * shows the English word under it (a tap on the English says it). `onHint` is called once per word opened, for the
 * exercises where a hint costs something. `off`: plain text (a test without hints). `speak`: false while the
 * microphone may be listening (the voice would be heard as the answer).
 */
export default function ViText({
  vi,
  en,
  fixed,
  onHint,
  off = false,
  speak = true,
}: {
  vi: string;
  en: string;
  fixed?: readonly FixedPair[];
  onHint?: () => void;
  off?: boolean;
  speak?: boolean;
}) {
  const [segments, setSegments] = useState<ViSegment[] | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const fixedKey = fixed?.map((f) => `${f.vi}=${f.en}`).join("|") ?? "";

  useEffect(() => {
    setSegments(null);
    setOpen(new Set());
    if (off) return;
    let live = true;
    viHints(vi, en, fixed)
      .then((s) => live && setSegments(s))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vi, en, fixedKey, off]);

  if (off || !segments || !segments.some((s) => s.en)) return <>{vi}</>;

  const reveal = (i: number) => {
    if (open.has(i)) return;
    setOpen((o) => new Set(o).add(i));
    onHint?.();
  };

  return (
    <>
      {segments.map((s, i) =>
        !s.en ? (
          <span key={i}>{s.text}</span>
        ) : open.has(i) ? (
          <span key={i} className="inline-flex flex-col items-center align-baseline leading-tight">
            <span>{s.text}</span>
            {speak ? (
              <button
                type="button"
                onClick={() => handleSpeak(s.en!)}
                aria-label={`Nghe ${s.en}`}
                className="mt-0.5 px-1.5 rounded-md bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300 text-sm font-semibold"
              >
                {s.en}
              </button>
            ) : (
              <span className="mt-0.5 px-1.5 rounded-md bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300 text-sm font-semibold">
                {s.en}
              </span>
            )}
          </span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => reveal(i)}
            aria-label={`${s.text}: xem từ tiếng Anh`}
            className="inline underline decoration-dotted decoration-2 decoration-teal-600 dark:decoration-teal-400 underline-offset-4 hover:text-teal-800 dark:hover:text-teal-300 [font:inherit]"
          >
            {s.text}
          </button>
        )
      )}
    </>
  );
}

/** One line under a sentence that has underlined words */
export function ViTextNote({ cost }: { cost?: string }) {
  return (
    <p className="text-xs text-slate-500 dark:text-zinc-400">
      Chạm chữ gạch chân để xem từ tiếng Anh{cost ? ` (${cost})` : ""}.
    </p>
  );
}
