import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MessageCircle, Snail, Volume2 } from "lucide-react";
import type { Situation } from "@/types/situation";
import { handleSpeak, SLOW_RATE } from "@/components/review/speech";
import { asrAvailable, playRecording } from "@/services/pronunciationCheck";
import { judgeSpoken, type SpokenVerdict } from "@/services/talk/engine";
import { recordLineTry } from "@/services/talk/progress";
import { Button, Card } from "@/components/ui/kit";
import MicButton, { PracticeTop } from "./MicButton";
import { useMic } from "./useMic";

const TONE: Record<SpokenVerdict["kind"], string> = {
  ok: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200",
  shaky: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  other: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  unclear: "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  silent: "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
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
      <PracticeTop
        onBack={onBack}
        backLabel="Danh sách"
        label={situation.title_vi}
        count={`Khởi động · câu ${index + 1}/${situation.lines.length}`}
        percent={((index + 1) / situation.lines.length) * 100}
      />

      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-2xl font-bold leading-snug text-slate-900 dark:text-zinc-100">{line.en}</p>
          <p className="text-base text-slate-700 dark:text-zinc-300">{line.vi}</p>
          {line.note && <p className="text-sm text-teal-800 dark:text-teal-300">{line.note}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => handleSpeak(line.en)}>
            <Volume2 className="w-4 h-4" /> Nghe
          </Button>
          <Button variant="secondary" onClick={() => handleSpeak(line.en, SLOW_RATE)}>
            <Snail className="w-4 h-4" /> Nghe chậm
          </Button>
        </div>

        {canSpeak ? (
          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
            <MicButton mic={mic} onStart={say} idleLabel="Nói câu này" />
            {mic.problem && <p className="text-sm text-red-700 dark:text-red-300">{mic.problem}</p>}
            {verdict && (
              <div className={`rounded-xl border p-3 text-sm space-y-2 ${TONE[verdict.kind]}`} role="status">
                <p>{verdict.message}</p>
                {(verdict.kind === "ok" || verdict.kind === "shaky" || verdict.kind === "other") && (
                  <button onClick={playRecording} className="min-h-10 text-sm font-semibold underline underline-offset-2 inline-flex items-center gap-1">
                    <Volume2 className="w-4 h-4" /> Nghe lại giọng mình
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-zinc-400">Tự nói và nghe lại giọng mình chỉ có trên điện thoại Android.</p>
        )}
      </Card>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Câu trước"
          className="px-5"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {last ? (
          <Button size="lg" className="flex-1" onClick={onChat}>
            <MessageCircle className="w-5 h-5" /> Vào trò chuyện
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={() => setIndex((i) => i + 1)}>
            Câu tiếp <ArrowRight className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
