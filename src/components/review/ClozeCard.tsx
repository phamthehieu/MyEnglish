import type { RefObject } from "react";
import { Volume2, CheckCircle2, Eye, TextCursorInput, HelpCircle, RotateCcw, AlertCircle, SkipForward } from "lucide-react";
import type { ReviewCard, WordExample } from "@/types/database";
import type { FeedbackMessage } from "@/hooks/useReviewSession";
import RevealedWordContent from "./RevealedWordContent";
import GiveUpButton from "./GiveUpButton";
import { highlightWord } from "./highlightWord";
import { handleSpeak } from "./speech";
import { getExampleSenseMeaning, maskTargetInMeaning } from "@/utils/exerciseHints";

interface ClozeCardProps {
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
  originalSentence: string;
  clozeDisplaySentence: string;
  /** The form of the word the blank needs ("deployed"), shown in hints and in the answer */
  answerForm: string;
  clozeExample?: WordExample;
}

/** MODE 2: CLOZE DELETION (type the missing word into the context sentence) */
export default function ClozeCard({
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
  originalSentence,
  clozeDisplaySentence,
  answerForm,
  clozeExample,
}: ClozeCardProps) {
  // The length of the word is shown only after the learner asks for a hint
  const lengthRevealed = showHint || wrongAttempts >= 2;
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between">
      {!hasCheckedAnswer ? (
        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 overflow-y-auto pr-1 scrollbar-thin">
          <div className="my-auto space-y-4 w-full">
            <div className="text-center space-y-1 shrink-0">
              <span className="text-sm text-teal-700 dark:text-teal-300 font-semibold flex items-center justify-center gap-1.5">
                <TextCursorInput className="w-4 h-4" />
                Điền từ tiếng Anh còn thiếu vào câu
              </span>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Gõ từ còn thiếu vào ô bên dưới. Đúng thì xem lại đáp án rồi sang câu mới; sai thì nhập lại.
              </p>
            </div>

            {/* Example sentence card */}
            <div className="p-4 md:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                <span>Câu ví dụ</span>
                {currentWord.topic && currentWord.topic !== "General Tech" && (
                  <span className="text-teal-700 dark:text-teal-300 font-semibold">{currentWord.topic}</span>
                )}
              </div>
              <p className="text-base font-medium text-slate-900 dark:text-zinc-100 leading-relaxed">
                {clozeDisplaySentence}
              </p>

              {/* Vietnamese Meaning Hint */}
              <div className="pt-2.5 border-t border-slate-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-300 flex items-start gap-2">
                <span className="text-teal-700 dark:text-teal-300 font-semibold shrink-0">Nghĩa tiếng Việt:</span>
                <span className="font-medium">
                  {maskTargetInMeaning(
                    getExampleSenseMeaning(currentWord.meaning_vn, clozeExample),
                    currentWord.word
                  )}
                </span>
              </div>
            </div>

            {/* Input for Guessing - Centered & Symmetrical */}
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
                  placeholder={lengthRevealed ? `Gõ từ còn thiếu (${answerForm.length} ký tự) rồi xác nhận` : "Gõ từ còn thiếu rồi xác nhận"}
                  className={`w-full min-h-12 bg-white dark:bg-zinc-900 border-2 rounded-2xl px-4 py-3 text-base font-mono text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-zinc-400 focus:outline-none text-center tracking-wide transition-colors ${
                    isCorrect
                      ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-500/10 text-green-800 dark:text-green-200 font-bold"
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
                        Gợi ý: "{answerForm[0].toUpperCase()}" ({answerForm.length} ký tự)
                      </span>
                    )}
                  </div>
                ) : (showHint || wrongAttempts >= 2) ? (
                  <div className="w-full h-full px-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between gap-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 min-w-0">
                      <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="line-clamp-2 leading-tight">
                        Gợi ý: Bắt đầu bằng{" "}
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                          "{answerForm[0].toUpperCase()}"
                        </span>
                        , độ dài:{" "}
                        <span className="font-bold text-amber-800 dark:text-amber-300">
                          {answerForm.length} ký tự
                        </span>
                      </span>
                    </div>
                    {currentWord.phonetic && (
                      <span className="text-xs font-mono bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-lg shrink-0 ml-2">
                        {currentWord.phonetic}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-center text-sm text-slate-600 dark:text-zinc-400 font-medium select-none px-3">
                    <span>Gõ từ tiếng Anh còn thiếu vào ô bên trên</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {wrongAttempts < 2 && !showHint ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowHint(true)}
                      className="min-h-[40px] px-2 text-slate-600 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-300 transition-colors flex items-center gap-1.5 text-sm font-medium"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Gợi ý chữ cái đầu</span>
                    </button>

                    <div className="flex items-center gap-1">
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
          <div className="space-y-2 shrink-0">
            {/* Result feedback banner */}
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between ${
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
                <span className="text-sm font-semibold">
                  {isCorrect
                    ? `Chính xác! Từ cần điền là "${answerForm}"`
                    : `Đáp án chính xác: "${answerForm}"`}
                </span>
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

            {/* Context Sentence with Highlighted Answer */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 text-base leading-relaxed text-slate-900 dark:text-zinc-100">
              {highlightWord(originalSentence, currentWord.word)}
            </div>
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
