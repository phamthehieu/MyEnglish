import type { RefObject } from "react";
import { Volume2, CheckCircle2, Eye, Keyboard, HelpCircle, RotateCcw, AlertCircle, SkipForward } from "lucide-react";
import type { ReviewCard } from "@/types/database";
import type { FeedbackMessage } from "@/hooks/useReviewSession";
import RevealedWordContent from "./RevealedWordContent";
import GiveUpButton from "./GiveUpButton";
import { handleSpeak } from "./speech";
import { maskTargetInMeaning } from "@/utils/exerciseHints";

interface SpellingCardProps {
  currentWord: ReviewCard;
  hasCheckedAnswer: boolean;
  inputRef: RefObject<HTMLInputElement>;
  userInput: string;
  setUserInput: (value: string) => void;
  feedbackMessage: FeedbackMessage | null;
  setFeedbackMessage: (msg: FeedbackMessage | null) => void;
  isAdvancing: boolean;
  isCorrect: boolean | null;
  isShaking: boolean;
  wrongAttempts: number;
  showHint: boolean;
  setShowHint: (value: boolean) => void;
  handleSkip: () => void;
  handleShowAnswer: () => void;
}

/** MODE 3: SPELLING RECALL (read the meaning, then type the word; audio only after answering) */
export default function SpellingCard({
  currentWord,
  hasCheckedAnswer,
  inputRef,
  userInput,
  setUserInput,
  feedbackMessage,
  setFeedbackMessage,
  isAdvancing,
  isCorrect,
  isShaking,
  wrongAttempts,
  showHint,
  setShowHint,
  handleSkip,
  handleShowAnswer,
}: SpellingCardProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between">
      {!hasCheckedAnswer ? (
        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 overflow-y-auto pr-1 scrollbar-thin">
          <div className="my-auto space-y-4 w-full">
            <div className="text-center space-y-1 shrink-0">
              <span className="text-sm text-teal-700 dark:text-teal-300 font-semibold flex items-center justify-center gap-1.5">
                <Keyboard className="w-4 h-4" />
                Luyện gõ từ
              </span>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Đọc nghĩa, tự nhớ ra từ tiếng Anh rồi gõ vào ô bên dưới. Phát âm sẽ được đọc sau khi trả lời.
              </p>
            </div>

            {/* Audio & Clue Card */}
            <div className="p-5 md:p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 text-center space-y-3.5 max-w-lg mx-auto w-full shrink-0">
              {/* No audio or IPA before answering: hearing the word would turn recall into dictation.
                  The pronunciation plays as feedback once the answer is checked. */}
              {currentWord.part_of_speech && (
                <div className="text-sm text-slate-600 dark:text-zinc-400">({currentWord.part_of_speech})</div>
              )}

              <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 text-base">
                <span className="text-xs text-teal-700 dark:text-teal-300 block font-semibold mb-1">
                  Nghĩa tiếng Việt:
                </span>
                <span className="font-medium">{maskTargetInMeaning(currentWord.meaning_vn, currentWord.word)}</span>
              </div>
            </div>

            {/* Spelling input - Centered and responsive */}
            <div className="space-y-3 max-w-lg mx-auto w-full shrink-0">
              <div className="relative w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    if (feedbackMessage?.type === "error") setFeedbackMessage(null);
                  }}
                  disabled={isAdvancing}
                  readOnly={isCorrect === true}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-gramm="false"
                  data-enable-grammarly="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  placeholder="Gõ từ tiếng Anh rồi xác nhận..."
                  className={`w-full bg-white dark:bg-zinc-900 border-2 rounded-2xl px-6 py-3.5 text-lg md:text-xl font-mono text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-zinc-400 focus:outline-none text-center tracking-widest font-bold transition-colors ${
                    isCorrect
                      ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-500/10 text-green-800 dark:text-green-200"
                      : isShaking
                      ? "border-red-600 dark:border-red-500 ring-4 ring-red-600/15 animate-shake"
                      : wrongAttempts > 0
                      ? "border-red-600/60 dark:border-red-500/60 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/15 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
                      : "border-slate-300 dark:border-zinc-700 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/15 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
                  }`}
                  autoFocus
                />
              </div>

              {/* Dedicated Stable Feedback & Hint Area - ALWAYS 48px so screen NEVER jumps */}
              <div className="h-[48px] min-h-[48px] flex items-center justify-center w-full">
                {feedbackMessage ? (
                  <div
                    className={`w-full h-full px-3.5 rounded-2xl border flex items-center justify-between gap-2 text-sm font-semibold text-center animate-in fade-in duration-150 ${
                      feedbackMessage.type === "success"
                        ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/40 text-green-800 dark:text-green-200"
                        : feedbackMessage.type === "error"
                        ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200"
                        : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {feedbackMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      )}
                      <span className="line-clamp-2 leading-tight">{feedbackMessage.text}</span>
                    </div>
                    {(showHint || wrongAttempts >= 2) && (
                      <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 shrink-0 ml-2">
                        {currentWord.word.slice(0, 2).toUpperCase()}
                        {currentWord.word.slice(2).replace(/./g, " •")}
                      </span>
                    )}
                  </div>
                ) : (showHint || wrongAttempts >= 2) ? (
                  <div className="w-full h-full px-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between gap-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 min-w-0">
                      <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        Gợi ý chính tả:{" "}
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-300 text-sm">
                          {currentWord.word.slice(0, 2).toUpperCase()}
                          {currentWord.word.slice(2).replace(/./g, " •")}
                        </span>{" "}
                        ({currentWord.word.length} ký tự)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-center text-sm text-slate-600 dark:text-zinc-400 font-medium select-none px-3">
                    <span>Đọc nghĩa tiếng Việt rồi tự gõ từ tiếng Anh. Phát âm sẽ có sau khi trả lời.</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end text-sm px-1 pt-1">
                {wrongAttempts < 2 && !showHint ? (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowHint(true)}
                        className="min-h-[40px] px-3 text-slate-600 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-300 text-sm flex items-center gap-1 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Gợi ý</span>
                      </button>
                      <GiveUpButton onConfirm={handleSkip} label="Không nhớ" icon={<SkipForward className="w-3.5 h-3.5" />} />
                      <button
                        type="button"
                        onClick={handleShowAnswer}
                        className="min-h-[40px] px-3 text-slate-600 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 text-sm underline transition-colors"
                      >
                        Xem đáp án
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full grid grid-cols-2 gap-2.5 animate-in fade-in duration-200">
                    <GiveUpButton
                      onConfirm={handleSkip}
                      label="Không nhớ từ này"
                      icon={<SkipForward className="w-4 h-4" />}
                      className="min-h-12 rounded-2xl border border-slate-200 dark:border-zinc-700"
                    />

                    <button
                      type="button"
                      onClick={handleShowAnswer}
                      className="min-h-12 px-3 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      title="Xem đáp án và phân tích ngữ pháp"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Xem kết quả</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col py-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {/* Feedback banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between shrink-0 ${
              isCorrect
                ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/40 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold">
                  {isCorrect ? "Chính xác! 🎉" : "Đáp án đúng"}
                </div>
                <div className="text-sm">
                  Từ đúng là: <span className="font-mono font-bold text-base">{currentWord.word}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSpeak(currentWord.word)}
              className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Nghe phát âm"
              aria-label="Nghe phát âm"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <RevealedWordContent
            currentWord={currentWord}
            handleSpeak={handleSpeak}
            compact
          />
        </div>
      )}
    </div>
  );
}
