import { useEffect, useState } from "react";
import { Snail, Volume2, X } from "lucide-react";
import {
  BLOCK_PASS,
  buildPlacementBlock,
  placementStep,
  START_LEVEL,
  type AdaptiveQuestion,
  type PlacementBlockLevel,
} from "@/services/placement";
import { PLACEMENT_A0_VOCAB, PLACEMENT_GRAMMAR, PLACEMENT_LISTENING } from "@/data/placementBank";
import type { LevelChoice } from "@/services/onboarding";
import { handleSpeak, SLOW_RATE, AUTO_SPEAK_DELAY_MS } from "./review/speech";
import { Button, Card, ProgressBar } from "./ui/kit";

const DONT_KNOW = "Tôi không biết";
const BANK = { grammar: PLACEMENT_GRAMMAR, listening: PLACEMENT_LISTENING, a0: PLACEMENT_A0_VOCAB };
const KIND_LABEL: Record<AdaptiveQuestion["kind"], string> = { vocab: "Từ vựng", grammar: "Ngữ pháp", listening: "Nghe" };
/** The test usually ends within 6–12 questions; the bar is measured against the longest run */
const TYPICAL_MAX_QUESTIONS = 12;

const RESULT_TEXT: Record<PlacementBlockLevel, string> = {
  A0: "Mất gốc (A0): bắt đầu từ các từ A1 của bộ Oxford (từ IT trước), phát âm và ngữ pháp cơ bản. Đi chậm mà chắc.",
  A1: "A1: bạn biết những từ cơ bản nhất. Học tiếp các từ A1 và ngữ pháp nền để đọc được câu ngắn.",
  A2: "A2: bạn hiểu câu ngắn, quen thuộc. Học trộn từ A1 và A2; từ nào đã biết thì bấm “Đã biết” để bỏ qua.",
  B1: "B1: bạn đọc được tài liệu đơn giản. Học từ chuyên ngành và ngữ pháp trung cấp.",
  B2: "B2: bạn đọc tài liệu khá tốt. Tập trung từ chuyên sâu, viết và diễn đạt tự nhiên.",
  C1: "C1: trình độ cao. Tập trung sắc thái, văn phong và từ hiếm.",
};

/**
 * Adaptive placement: blocks of 3 questions (a word, a grammar gap, a listening item) starting at A2,
 * one level up after a passed block, one down after a failed one; below A1 a block of very easy words
 * tells an absolute beginner (A0) apart. Usually 6–12 questions. "Tôi không biết" discourages guessing.
 */
export default function PlacementTest({ onDone, onClose }: { onDone: (level: LevelChoice) => void; onClose: () => void }) {
  const [block, setBlock] = useState<AdaptiveQuestion[]>(() => buildPlacementBlock(START_LEVEL, BANK));
  const [index, setIndex] = useState(0);
  const [correctInBlock, setCorrectInBlock] = useState(0);
  const [asked, setAsked] = useState(0);
  const [result, setResult] = useState<PlacementBlockLevel | null>(null);
  const q = block[index];

  useEffect(() => {
    if (q?.kind === "listening" && q.say) {
      const t = setTimeout(() => handleSpeak(q.say!), AUTO_SPEAK_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [q]);

  const answer = (choice: string) => {
    if (!q || result) return;
    const correct = correctInBlock + (choice === q.answer ? 1 : 0);
    setAsked((n) => n + 1);
    if (index + 1 < block.length) {
      setCorrectInBlock(correct);
      setIndex(index + 1);
      return;
    }
    const step = placementStep(q.level, correct >= Math.min(BLOCK_PASS, block.length));
    if ("result" in step) {
      setResult(step.result);
    } else {
      setBlock(buildPlacementBlock(step.next, BANK));
      setIndex(0);
      setCorrectInBlock(0);
    }
  };

  return (
    <div className="popup-backdrop-enter fixed inset-0 z-50 overflow-y-auto bg-[#F7F8FA] dark:bg-zinc-950">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4">
        <div className="sticky top-0 z-10 -mx-4 bg-[#F7F8FA]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur dark:bg-zinc-950/95">
          <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={onClose}
                className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-zinc-400">Kiểm tra trình độ</h3>
            <div />
          </div>
          <ProgressBar value={result ? 100 : (asked / TYPICAL_MAX_QUESTIONS) * 100} className="mt-2 h-1.5" />
        </div>

        {!result && q ? (
          <div className="flex-1 space-y-5 pb-6 pt-3">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Câu {asked + 1} · {KIND_LABEL[q.kind]} · Không chắc thì chọn "Tôi không biết", đừng đoán.
            </p>
            <Card className="space-y-3 py-6 md:py-6">
              {q.kind === "listening" ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => handleSpeak(q.say!)}>
                    <Volume2 className="h-5 w-5" /> Nghe lại
                  </Button>
                  <Button variant="secondary" onClick={() => handleSpeak(q.say!, SLOW_RATE)}>
                    <Snail className="h-5 w-5" /> Chậm
                  </Button>
                </div>
              ) : (
                <div className={`text-center text-slate-900 dark:text-white ${q.kind === "vocab" ? "text-3xl font-bold font-mono" : "text-lg font-semibold leading-snug"}`}>
                  {q.prompt}
                </div>
              )}
              <p className="text-center text-sm text-slate-600 dark:text-zinc-400">{q.question}</p>
            </Card>
            <div className="space-y-3">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  className="flex min-h-16 w-full items-center rounded-2xl border border-slate-200 bg-white p-4 text-left text-base font-medium text-slate-900 transition-colors hover:border-teal-700 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-teal-400 dark:hover:bg-teal-400/10"
                >
                  {opt}
                </button>
              ))}
              <Button variant="ghost" block onClick={() => answer(DONT_KNOW)} className="text-slate-600 dark:text-zinc-400">
                {DONT_KNOW}
              </Button>
            </div>
          </div>
        ) : result ? (
          <>
            <div className="flex-1 space-y-4 pb-6 pt-3">
              <Card className="space-y-3 text-base leading-relaxed text-slate-800 dark:text-zinc-200">
                <p>{RESULT_TEXT[result]}</p>
              </Card>
              <p className="text-sm text-slate-600 dark:text-zinc-400">Có thể đổi trình độ bất cứ lúc nào trong phần Cài đặt.</p>
            </div>
            <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-[#F7F8FA]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
              <Button size="lg" block onClick={() => onDone(result)}>
                Học theo trình độ này
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
