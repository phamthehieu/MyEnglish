import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MessageCircle, Snail, Volume2 } from "lucide-react";
import type { Situation } from "@/types/situation";
import { handleSpeak, SLOW_RATE } from "@/components/review/speech";
import { asrAvailable, playRecording } from "@/services/pronunciationCheck";
import { judgeSpoken, type SpokenVerdict } from "@/services/talk/engine";
import { recordLineTry } from "@/services/talk/progress";
import MicButton from "./MicButton";
import { useMic } from "./useMic";

const TONE: Record<SpokenVerdict["kind"], string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
  shaky: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  other: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  unclear: "border-slate-300 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  silent: "border-slate-300 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  error: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200",
};

/** Step 1: hear each sentence of the situation and say it, before the conversation */
export default function WarmUp({
  situation,
  onBack,
  onChat,
}: {
  situation: Situation;
  onBack: () => void;
  onChat: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<SpokenVerdict | null>(null);
  const mic = useMic();
  const canSpeak = asrAvailable();
  const line = situation.lines[index];
  const last = index === situation.lines.length - 1;

  // A new sentence: forget the last answer, stop listening, and say it once
  useEffect(() => {
    setVerdict(null);
    mic.cancel();
    const timer = window.setTimeout(() => handleSpeak(line.en), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.id]);

  const say = () =>
    mic.begin(situation, [line], (result, grammar) => {
      const v = judgeSpoken(result, grammar, new Set([line.id]));
      console.info(
        "[talk] warmup",
        line.id,
        v.kind,
        `raw="${result.text ?? ""}"`,
        `peak=${(result.peak ?? 0).toFixed(2)}`,
        `conf=${v.conf?.toFixed(2) ?? "-"}`,
        result.error ?? ""
      );
      recordLineTry(line.id, v.kind === "ok", v.heard);
      setVerdict(v);
    });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-zinc-400">
        <ArrowLeft className="w-4 h-4" /> Danh sách
      </button>

      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{situation.title_vi}</h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Khởi động · câu {index + 1}/{situation.lines.length}
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${((index + 1) / situation.lines.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
        <p className="text-2xl font-bold leading-snug text-slate-900 dark:text-white">{line.en}</p>
        <p className="text-sm text-slate-600 dark:text-zinc-400">{line.vi}</p>
        {line.note && <p className="text-xs text-violet-700 dark:text-violet-300">{line.note}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleSpeak(line.en)}
            className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Volume2 className="w-4 h-4" /> Nghe
          </button>
          <button
            onClick={() => handleSpeak(line.en, SLOW_RATE)}
            className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Snail className="w-4 h-4" /> Nghe chậm
          </button>
        </div>
      </div>

      {canSpeak ? (
        <div className="space-y-2">
          <MicButton mic={mic} onStart={say} idleLabel="Nói câu này" />
          {mic.problem && <p className="text-xs text-rose-600 dark:text-rose-400">{mic.problem}</p>}
          {verdict && (
            <div className={`rounded-xl border p-3 text-sm space-y-2 ${TONE[verdict.kind]}`} role="status">
              <p>{verdict.message}</p>
              {(verdict.kind === "ok" || verdict.kind === "shaky" || verdict.kind === "other") && (
                <button onClick={playRecording} className="text-xs font-semibold underline underline-offset-2 inline-flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">Tự nói và nghe lại giọng mình chỉ có trên điện thoại Android.</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 disabled:opacity-40 text-sm font-semibold"
          aria-label="Câu trước"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {last ? (
          <button
            onClick={onChat}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Vào trò chuyện
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="flex-1 py-2.5 rounded-xl border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            Câu tiếp <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
