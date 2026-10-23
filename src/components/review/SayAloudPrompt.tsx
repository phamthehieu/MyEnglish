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
import { handleSpeak, SLOW_RATE, stopSpeaking } from "./speech";

/** Common words the recognizer can pick instead of the target, so it does not accept any sound as the word */
const DECOY_POOL = ["water", "house", "people", "time", "work", "money", "family", "problem", "city", "friend", "morning", "number"];
const DECOY_COUNT = 4;
/** Failed readings after which the learner may move on without a pass (accents, noisy rooms) */
const SKIP_AFTER_MISSES = 3;

function decoysFor(word: string): string[] {
  const w = word.trim().toLowerCase();
  return DECOY_POOL.filter((d) => d !== w)
    .sort((a, b) => Math.abs(a.length - w.length) - Math.abs(b.length - w.length))
    .slice(0, DECOY_COUNT);
}

/**
 * On a new word's introduction: listen, then say the word aloud. The introduction cannot be finished until
 * `onPassed` is called:
 *  - Android, single plain word: the offline recognizer must hear the word (see pronunciationCheck.ts);
 *    after SKIP_AFTER_MISSES misses the learner may skip, so a stubborn microphone never traps them
 *  - anywhere else (desktop has no recognizer, phrases, words outside its dictionary): the learner confirms
 *    "Đọc được" themselves; "Chưa chắc" only sends them back to listen again
 * Never graded; logged as a "say_aloud" event.
 */
export default function SayAloudPrompt({ word, wordId, onPassed }: { word: string; wordId: string; onPassed: () => void }) {
  const [done, setDone] = useState<"ok" | "skipped" | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "listening" | "checking">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  // The recognizer cannot hear this word (not in its dictionary, no permission...): fall back to self-rating
  const [manual, setManual] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const grammar = useRef<string[]>([]);

  const useMic = asrAvailable() && isCheckableWord(word) && !manual;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      cancelListening();
    },
    []
  );

  const pass = (ok: boolean, how: "mic" | "self" | "skip") => {
    logLearningEvent("say_aloud", { wordId, meta: { ok, surface: "intro", how } });
    setDone(ok ? "ok" : "skipped");
    onPassed();
  };

  const finish = async () => {
    window.clearTimeout(timer.current);
    setPhase("checking");
    const result = await finishListening(grammar.current);
    const verdict = judge(word, result, { level: "focus" });
    setPhase("idle");
    if (verdict.ok) {
      pass(true, "mic");
    } else {
      setMisses((n) => n + 1);
      setMessage(verdict.message);
      logLearningEvent("say_aloud", { wordId, meta: { ok: false, surface: "intro", how: "mic", heard: verdict.heard ?? null } });
    }
  };

  const begin = async () => {
    setMessage(null);
    stopSpeaking();
    setPhase("preparing");
    const failure = await prepareListening();
    if (failure) {
      setMessage(
        failure === "permission"
          ? "Cần cho phép dùng micro (Cài đặt, Ứng dụng, MyEnglish, Quyền). Tạm thời bạn tự xác nhận nhé."
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
    if (!startListening()) {
      setMessage("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
      setPhase("idle");
      return;
    }
    setPhase("listening");
    timer.current = window.setTimeout(finish, MAX_LISTEN_MS);
  };

  if (done !== null) {
    return (
      <div className="text-center text-[11px] text-emerald-700 dark:text-emerald-400">
        {done === "ok" ? "Tốt lắm! Đọc to giúp nhớ từ lâu hơn." : "Không sao, nghe chậm thêm vài lần là quen."}
      </div>
    );
  }

  const listenButtons = (
    <>
      <button onClick={() => handleSpeak(word)} className="p-1 rounded-md border border-slate-200 dark:border-zinc-700" title="Nghe">
        <Volume2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => handleSpeak(word, SLOW_RATE)} className="p-1 rounded-md border border-slate-200 dark:border-zinc-700" title="Nghe chậm">
        <Snail className="w-3.5 h-3.5" />
      </button>
    </>
  );

  if (!useMic) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
          <Mic className="w-3.5 h-3.5 text-emerald-600" />
          <span>Nghe rồi đọc to từ này, xong bấm xác nhận:</span>
          {listenButtons}
          <button onClick={() => pass(true, "self")} className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-semibold">
            Đọc được
          </button>
          <button
            onClick={() => {
              setMessage("Không sao, nghe chậm thêm vài lần rồi đọc lại nhé.");
              handleSpeak(word, SLOW_RATE);
            }}
            className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-zinc-700"
          >
            Chưa chắc
          </button>
        </div>
        {message && <div className="text-center text-[11px] text-amber-700 dark:text-amber-300">{message}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
        <Mic className="w-3.5 h-3.5 text-emerald-600" />
        <span>Nghe rồi đọc to từ này để qua thẻ:</span>
        {listenButtons}
      </div>
      <div className="flex justify-center">
        {phase === "listening" ? (
          <button
            onClick={finish}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Đang nghe… đọc "{word}" rồi bấm dừng
          </button>
        ) : (
          <button
            onClick={begin}
            disabled={phase !== "idle"}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {phase === "idle" ? (
              <>
                <Mic className="w-3.5 h-3.5" /> Bấm rồi đọc to "{word}"
              </>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {phase === "preparing" ? "Đang chuẩn bị (lần đầu hơi lâu)…" : "Đang nghe lại…"}
              </>
            )}
          </button>
        )}
      </div>
      {message && <div className="text-center text-[11px] text-amber-700 dark:text-amber-300">{message}</div>}
      {misses >= SKIP_AFTER_MISSES && phase === "idle" && (
        <div className="text-center">
          <button onClick={() => pass(false, "skip")} className="text-[11px] underline text-slate-500 dark:text-zinc-400">
            Máy nghe chưa ra, bỏ qua từ này
          </button>
        </div>
      )}
    </div>
  );
}
