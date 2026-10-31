import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Snail, Square, Volume2 } from "lucide-react";
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
} from "@/services/pronunciationCheck";
import { playSound } from "@/services/sound";
import { AUTO_SPEAK_DELAY_MS, handleSpeak, SLOW_RATE, SPEAK_EVENT, stopSpeaking, waitForSpeechToEnd } from "./speech";

/** Common words the recognizer can pick instead of the target, so it does not accept any sound as the word */
const DECOY_POOL = ["water", "house", "people", "time", "work", "money", "family", "problem", "city", "friend", "morning", "number"];
const DECOY_COUNT = 4;
/** How long "Tốt lắm" stays before the card moves on by itself */
const ADVANCE_AFTER_MS = 1200;

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
 *    the microphone switches itself on; when the recognizer hears the word the card moves on (`onAdvance`).
 *    Hearing the word again pauses the microphone (it would hear the phone) and switches it back on after.
 *  - anywhere else (desktop has no recognizer, phrases, words outside its dictionary): the learner confirms
 *    "Đọc được" themselves; "Chưa chắc" only sends them back to listen again
 * "Tôi không nói to được lúc này" (noisy room, public place, accent) is always on screen, so nobody has to fail first.
 * Never graded; logged as a "say_aloud" event.
 */
export default function SayAloudPrompt({
  word,
  wordId,
  onPassed,
  onAdvance,
}: {
  word: string;
  wordId: string;
  onPassed: () => void;
  /** Called a moment after the recognizer heard the word: the card moves on by itself */
  onAdvance?: () => void;
}) {
  const [done, setDone] = useState<"ok" | "skipped" | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // The recognizer cannot hear this word (not in its dictionary, no permission...): fall back to self-rating
  const [manual, setManual] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const advanceTimer = useRef<number | undefined>(undefined);
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
      window.clearTimeout(advanceTimer.current);
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
      if (onAdvance) advanceTimer.current = window.setTimeout(() => alive.current && onAdvance(), ADVANCE_AFTER_MS);
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
    const failure = await prepareListening({ automatic });
    if (!alive.current) return;
    if (failure) {
      setMessage(
        failure === "permission"
          ? "Cần cho phép dùng micro (Cài đặt, Ứng dụng, MyEnglish, Quyền). Tạm thời bạn tự xác nhận nhé."
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
    const mine = attempt.current;
    await new Promise((r) => window.setTimeout(r, delayMs));
    await waitForSpeechToEnd();
    if (alive.current && mine === attempt.current) void begin(true);
  };

  // Hands free: the card reads the word when it opens (useReviewSession), then the microphone comes on
  useEffect(() => {
    if (!useMic) return;
    void listenAfterSpeech(AUTO_SPEAK_DELAY_MS + 150);
    // Only when the card opens, and when it falls back from the self-rating (never: manual is one way)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useMic]);

  // The word is read again (a button, a shortcut) while listening: pause, so the microphone does not hear the
  // phone, and listen again once it is over
  useEffect(() => {
    if (!useMic) return;
    const onSpeak = () => {
      if (doneRef.current !== null) return;
      if (phaseRef.current === "listening") {
        attempt.current += 1;
        window.clearTimeout(timer.current);
        cancelListening();
        phaseRef.current = "idle";
        setPhase("idle");
        void listenAfterSpeech(100);
      } else if (phaseRef.current === "idle") {
        // After a miss: hear it, then try again without pressing anything
        attempt.current += 1;
        void listenAfterSpeech(100);
      }
    };
    window.addEventListener(SPEAK_EVENT, onSpeak);
    return () => window.removeEventListener(SPEAK_EVENT, onSpeak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useMic]);

  if (done !== null) {
    return (
      <div className="text-center text-sm text-green-700 dark:text-green-400" role="status">
        {done === "ok" ? (onAdvance ? "Tốt lắm! Sang thẻ tiếp…" : "Tốt lắm! Đọc to giúp nhớ từ lâu hơn.") : "Không sao, nghe chậm thêm vài lần là quen."}
      </div>
    );
  }

  const listenButtons = (
    <>
      <button
        onClick={() => handleSpeak(word)}
        className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
        title="Nghe"
        aria-label="Nghe"
      >
        <Volume2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleSpeak(word, SLOW_RATE)}
        className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 transition-colors"
        title="Nghe chậm"
        aria-label="Nghe chậm"
      >
        <Snail className="w-4 h-4" />
      </button>
    </>
  );

  // Always offered: logged like the other ways out, with how: "skip"
  const skipButton = (
    <div className="text-center">
      <button
        onClick={() => {
          attempt.current += 1;
          window.clearTimeout(timer.current);
          cancelListening();
          setPhase("idle");
          pass(false, "skip");
        }}
        disabled={phase === "preparing" || phase === "checking"}
        className="min-h-10 px-3 text-sm underline text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
      >
        Tôi không nói to được lúc này
      </button>
    </div>
  );

  if (!useMic) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
          <Mic className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          <span>Nghe rồi đọc to từ này, xong bấm xác nhận:</span>
          {listenButtons}
          <button onClick={() => pass(true, "self")} className="min-h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold transition-colors">
            Đọc được
          </button>
          <button
            onClick={() => {
              setMessage("Không sao, nghe chậm thêm vài lần rồi đọc lại nhé.");
              handleSpeak(word, SLOW_RATE);
            }}
            className="min-h-10 px-4 rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 font-semibold transition-colors"
          >
            Chưa chắc
          </button>
        </div>
        {message && <div className="text-center text-sm text-amber-700 dark:text-amber-300">{message}</div>}
        {skipButton}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
        <Mic className="w-4 h-4 text-teal-700 dark:text-teal-300" />
        <span>Nghe rồi đọc to từ này, máy nghe đúng là tự qua thẻ:</span>
        {listenButtons}
      </div>
      <div className="flex justify-center">
        {phase === "listening" ? (
          <button
            onClick={finish}
            className="min-h-12 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-base font-semibold inline-flex items-center gap-1.5 animate-pulse motion-reduce:animate-none"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Đang nghe… đọc to "{word}"
          </button>
        ) : (
          <button
            onClick={() => void begin()}
            disabled={phase !== "idle"}
            className="min-h-12 px-5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-60 text-white text-base font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {phase === "idle" ? (
              <>
                <Mic className="w-4 h-4" /> {message ? `Đọc lại "${word}"` : `Bấm rồi đọc to "${word}"`}
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {phase === "preparing" ? "Đang bật micro…" : "Đang nghe lại…"}
              </>
            )}
          </button>
        )}
      </div>
      {message && <div className="text-center text-sm text-amber-700 dark:text-amber-300">{message}</div>}
      {skipButton}
    </div>
  );
}
