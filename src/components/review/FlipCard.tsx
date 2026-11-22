import { Volume2, Eye, Snail } from "lucide-react";
import type { ReviewCard, TermWithMeaning } from "@/types/database";
import RevealedWordContent from "./RevealedWordContent";
import { handleSpeak, SLOW_RATE } from "./speech";
import { isTouchDevice } from "@/lib/platform";

interface FlipCardProps {
  currentWord: ReviewCard;
  synonyms: TermWithMeaning[];
  isFlipped: boolean;
  setIsFlipped: (value: boolean) => void;
  /** Introduction cards stay on the answer side: no way back to the front */
  isIntro?: boolean;
  introPrompt?: React.ReactNode;
}

/** MODE 1: STANDARD FLIP */
export default function FlipCard({ currentWord, synonyms, isFlipped, setIsFlipped, isIntro, introPrompt }: FlipCardProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between">
      {!isFlipped ? (
        <div key="front" className="flip-reveal flex-1 min-h-0 flex flex-col overflow-y-auto">
          <div className="my-auto flex flex-col items-center text-center space-y-4 py-6">
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Từ vựng
          </span>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
              {currentWord.word}
            </h2>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => handleSpeak(currentWord.word, e)}
                title="Nghe phát âm"
                aria-label="Nghe phát âm"
                className="min-w-12 min-h-12 inline-flex items-center justify-center rounded-full bg-teal-50 dark:bg-teal-400/10 hover:bg-teal-100 dark:hover:bg-teal-400/20 text-teal-700 dark:text-teal-300 transition-colors"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpeak(currentWord.word, SLOW_RATE);
                }}
                title="Nghe chậm"
                aria-label="Nghe chậm"
                className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
              >
                <Snail className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentWord.phonetic && (
            <span className="text-sm font-mono text-teal-700 dark:text-teal-300 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 px-3 py-1 rounded-full">
              {currentWord.phonetic}
            </span>
          )}

          {synonyms.length > 0 && (
            <div className="flex gap-1.5 justify-center flex-wrap pt-2">
              {synonyms.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="text-xs font-mono text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full"
                >
                  {s.word}
                </span>
              ))}
            </div>
          )}

          <div className="pt-8 text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            <span>{isTouchDevice() ? "Chạm vào thẻ để xem định nghĩa" : "Nhấn Space hoặc click vào thẻ để xem định nghĩa"}</span>
          </div>
          </div>
        </div>
      ) : (
        <div key="back" className="flip-reveal flex-1 min-h-0 flex flex-col justify-between space-y-3">
          <RevealedWordContent
            currentWord={currentWord}
            handleSpeak={handleSpeak}
            onFlipBack={isIntro ? undefined : () => setIsFlipped(false)}
          />
          {introPrompt}
        </div>
      )}
    </div>
  );
}
