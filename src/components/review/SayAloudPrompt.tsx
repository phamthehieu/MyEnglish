import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { logLearningEvent } from "@/services/learningEvents";
import {
  asrAvailable,
  buildGrammar,
  cancelListening,
  finishListening,
  isCheckableWord,
  judge,
  MAX_LISTEN_MS,
  prepareListening,
  startListening,
  wordsInDictionary,
  micPermissionText,
} from "@/services/pronunciationCheck";
import { playSound } from "@/services/sound";
import { AUTO_SPEAK_DELAY_MS, handleSpeak, SLOW_RATE, SPEAK_EVENT, stopSpeaking, waitForSpeechToEnd } from "./speech";

/** Common words the recognizer can pick instead of the target, so it does not accept any sound as the word */
const DECOY_POOL = ["water", "house", "people", "time", "work", "money", "family", "problem", "city", "friend", "morning", "number"];
const DECOY_COUNT = 4;

function decoysFor(word: string): string[] {
  const w = word.trim().toLowerCase();
  return DECOY_POOL.filter((d) => d !== w)
    .sort((a, b) => Math.abs(a.length - w.length) - Math.abs(b.length - w.length))
    .slice(0, DECOY_COUNT);
}

/**
 * On a new word's introduction: listen, then say the word aloud. The introduction cannot be finished until
 * `onPassed` is called:
 *  - Android and browsers that recognize speech, single plain word: hands free. Once the card has read the word,
 *    the microphone switches itself on until the recognizer hears the word. The card does not move on by
 *    itself: the learner still has the meaning and the example to read. Hearing the word again pauses the
 *    microphone (it would hear the phone) and switches it back on after.
 *  - anywhere else (desktop has no recognizer, phrases, words outside its dictionary): the learner confirms
 *    "Đọc được" themselves; "Chưa chắc" only sends them back to listen again
 * "Tôi không nói to được lúc này" (noisy room, public place, accent) is always on screen, so nobody has to fail first.
 * Never graded; logged as a "say_aloud" event.
 */
export default function SayAloudPrompt({ word, wordId, onPassed }: { word: string; wordId: string; onPassed: () => void }) {
  const [done, setDone] = useState<"ok" | "skipped" | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // The recognizer cannot hear this word (not in its dictionary, no permission...): fall back to self-rating
  const [manual, setManual] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const grammar = useRef<string[]>([]);
  const alive = useRef(true);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const doneRef = useRef(done);
  doneRef.current = done;
  // Bumped whenever a listening is abandoned, so a late answer from it is ignored
  const attempt = useRef(0);

  const useMic = asrAvailable() && isCheckableWord(word) && !manual;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      cancelListening();
    };
  }, []);

  const pass = (ok: boolean, how: "mic" | "self" | "skip") => {
    logLearningEvent("say_aloud", { wordId, meta: { ok, surface: "intro", how } });
    setDone(ok ? "ok" : "skipped");
    onPassed();
  };

  const finish = async () => {
    window.clearTimeout(timer.current);
    if (phaseRef.current !== "listening") return;
    const mine = attempt.current;
    setPhase("checking");
    const result = await finishListening(grammar.current);
    if (!alive.current || mine !== attempt.current) return;
    const verdict = judge(word, result, { level: "focus" });
    setPhase("idle");
    if (verdict.ok) {
      playSound("correct");
      pass(true, "mic");
    } else {
      setMessage(verdict.kind === "silent" ? `Chưa nghe thấy bạn. Bấm micro rồi đọc to "${word}" nhé.` : verdict.message);
      logLearningEvent("say_aloud", { wordId, meta: { ok: false, surface: "intro", how: "mic", heard: verdict.heard ?? null } });
    }
  };

  /** `automatic`: the microphone switches itself on (after the word was read), nobody pressed it */
  const begin = async (automatic = false) => {
    if (doneRef.current !== null || phaseRef.current !== "idle") return;
    setMessage(null);
    if (!automatic) stopSpeaking();
    setPhase("preparing");
    phaseRef.current = "preparing";
    const mine = attempt.current;
    const failure = await prepareListening({ automatic });
    if (!alive.current) return;
    // Given up meanwhile (skipped, the word read again): this attempt does not switch the microphone on
    if (mine !== attempt.current || doneRef.current !== null) {
      if (phaseRef.current === "preparing") {
        phaseRef.current = "idle";
        setPhase("idle");
      }
      return;
    }
    if (failure) {
      setMessage(
        failure === "permission"
          ? `${micPermissionText()} Tạm thời bạn tự xác nhận nhé.`
          : failure === "declined"
            ? "Chưa tải bộ nghe giọng, nên bạn tự xác nhận nhé."
            : "Chưa chuẩn bị được bộ nhận dạng giọng nói. Tạm thời bạn tự xác nhận nhé."
      );
      setManual(true);
      setPhase("idle");
      return;
    }
    const target = word.trim().toLowerCase();
    const list = wordsInDictionary(buildGrammar(target, [], decoysFor(target)));
    if (!list.includes(target)) {
      setMessage(`Bộ nhận dạng chưa biết từ "${word}", nên không chấm được. Bạn tự xác nhận nhé.`);
      setManual(true);
      setPhase("idle");
      return;
    }
    grammar.current = list;
    if (!startListening(finish)) {
      setMessage("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
      setPhase("idle");
      return;
    }
    phaseRef.current = "listening";
    setPhase("listening");
    timer.current = window.setTimeout(finish, MAX_LISTEN_MS);
  };

  /** Once the reading going on now is over, switch the microphone on by itself */
  const listenAfterSpeech = async (delayMs: number) => {
    const mine = ++attempt.current;
    await new Promise((r) => window.setTimeout(r, delayMs));
    if (!alive.current || mine !== attempt.current || doneRef.current !== null) return;
    await waitForSpeechToEnd();
    if (alive.current && mine === attempt.current && doneRef.current === null) void begin(true);
  };

  // Hands free: the card reads the word when it opens (useReviewSession), then the microphone comes on
  useEffect(() => {
    if (!useMic) return;
    void listenAfterSpeech(AUTO_SPEAK_DELAY_MS + 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useMic]);

  // When speaking starts externally, pause active listening and resume once the reading finishes
  useEffect(() => {
    if (!useMic) return;
    const onSpeak = () => {
      if (doneRef.current !== null) return;
      attempt.current += 1;
      window.clearTimeout(timer.current);
      cancelListening();
      if (phaseRef.current === "listening" || phaseRef.current === "preparing") {
        phaseRef.current = "idle";
        setPhase("idle");
      }
      void listenAfterSpeech(150);
    };
    window.addEventListener(SPEAK_EVENT, onSpeak);
    return () => window.removeEventListener(SPEAK_EVENT, onSpeak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useMic]);

  if (done !== null) {
    return (
      <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 p-2.5 text-center text-xs font-semibold text-green-800 dark:text-green-300 animate-in fade-in" role="status">
        {done === "ok" ? "🎉 Phát âm rất chuẩn! Hãy xem câu ví dụ rồi bấm Học tiếp ở dưới." : "👍 Đã ghi nhận! Hãy xem câu ví dụ rồi bấm Học tiếp ở dưới."}
      </div>
    );
  }

  if (!useMic) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 p-3 space-y-2 mt-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
          <span className="inline-flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
            <Mic className="w-3.5 h-3.5" />
            <span>Luyện phát âm từ này:</span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => pass(true, "self")}
            className="min-h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            Đã tự đọc chuẩn ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage("Hãy nghe lại chậm rồi thử nhẩm theo nhé.");
              handleSpeak(word, SLOW_RATE);
            }}
            className="min-h-10 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Chưa chắc lắm
          </button>
        </div>
        {message && <div className="text-center text-xs text-amber-700 dark:text-amber-300">{message}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 p-3 space-y-2 mt-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
          <Mic className="w-3.5 h-3.5" />
          <span>Luyện phát âm (tùy chọn):</span>
        </span>
        <button
          type="button"
          onClick={() => pass(false, "skip")}
          className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
        >
          Bỏ qua
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        {phase === "listening" ? (
          <button
            type="button"
            onClick={finish}
            className="min-h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-2 animate-pulse shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Đang nghe... hãy đọc "{word}"</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void begin()}
            disabled={phase !== "idle"}
            className="min-h-11 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            {phase === "idle" ? (
              <>
                <Mic className="w-4 h-4" />
                <span>{message ? `Đọc lại "${word}"` : `Bấm micro đọc thử "${word}"`}</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{phase === "preparing" ? "Đang bật micro..." : "Đang chấm điểm..."}</span>
              </>
            )}
          </button>
        )}
      </div>

      {message && <div className="text-center text-xs text-amber-700 dark:text-amber-300">{message}</div>}
    </div>
  );
}
