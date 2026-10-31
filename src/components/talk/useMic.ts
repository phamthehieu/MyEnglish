import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelListening,
  finishListening,
  prepareListening,
  startListening,
  wordsInDictionary,
  type AsrResult,
  speechUnavailableText,
  micPermissionText,
} from "@/services/pronunciationCheck";
import { stopSpeaking } from "@/components/review/speech";
import { buildGrammar, decoysFor, speakableFrom, wordsOf, type Grammar } from "@/services/talk/engine";
import type { Situation, SituationLine } from "@/types/situation";

/** The phone's recorder ends a recording after 15 s (AsrBridge MAX_SECONDS); stop a little before that */
const MAX_SPEECH_MS = 14000;

export type MicPhase = "idle" | "preparing" | "listening" | "checking";

export interface MicHandle {
  phase: MicPhase;
  /** Why the microphone could not start, in Vietnamese */
  problem: string | null;
  /** Record; `onResult` gets the answer when the learner stops or the time is up */
  begin: (
    situation: Situation,
    wanted: SituationLine[],
    onResult: (result: AsrResult, grammar: Grammar) => void,
    /** Stop by itself after this long (hands-free); at most MAX_SPEECH_MS */
    maxMs?: number
  ) => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

/** Record the learner and read the offline recognizer's answer against the sentences that make sense now */
export function useMic(): MicHandle {
  const [phase, setPhase] = useState<MicPhase>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const grammar = useRef<Grammar | null>(null);
  const callback = useRef<((result: AsrResult, grammar: Grammar) => void) | null>(null);
  const mounted = useRef(true);
  // Bumped by each begin and by cancel: an older begin still getting ready gives up
  const attempt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      cancelListening();
    };
  }, []);

  const finish = useCallback(async () => {
    window.clearTimeout(timer.current);
    const g = grammar.current;
    const done = callback.current;
    if (!g || !done) return;
    grammar.current = null;
    callback.current = null;
    if (mounted.current) setPhase("checking");
    const result = await finishListening(g.phrases);
    if (!mounted.current) return;
    setPhase("idle");
    done(result, g);
  }, []);

  const begin = useCallback<MicHandle["begin"]>(
    async (situation, wanted, onResult, maxMs) => {
      setProblem(null);
      stopSpeaking();
      setPhase("preparing");
      const mine = ++attempt.current;
      const failure = await prepareListening();
      // Cancelled while the microphone was getting ready (the learner moved on): it must not open for that line
      if (!mounted.current || mine !== attempt.current) return;
      if (failure === "declined") {
        setPhase("idle");
        return;
      }
      if (failure) {
        setProblem(
          failure === "permission"
            ? micPermissionText()
            : failure === "no-bridge"
              ? speechUnavailableText()
              : "Chưa chuẩn bị được bộ nhận dạng giọng nói. Thử lại sau ít phút."
        );
        setPhase("idle");
        return;
      }
      // A sentence with a word the recognizer does not know can never be heard: leave it out
      const decoys = decoysFor(situation, wanted);
      const known = wordsInDictionary(wordsOf(buildGrammar([...wanted, ...decoys]).phrases));
      const g = buildGrammar(wanted, decoys, speakableFrom(known));
      const wantedIds = new Set(wanted.map((l) => l.id));
      if (![...g.owner.values()].some((id) => wantedIds.has(id))) {
        setProblem("Bộ nhận dạng offline chưa biết các từ của câu này, nên không chấm được. Bạn chọn câu thay vì nói nhé.");
        setPhase("idle");
        return;
      }
      grammar.current = g;
      callback.current = onResult;
      if (!startListening(finish, { sentence: true })) {
        grammar.current = null;
        callback.current = null;
        setProblem("Không bật được micro (có thể app khác đang dùng). Thử lại nhé.");
        setPhase("idle");
        return;
      }
      setPhase("listening");
      timer.current = window.setTimeout(finish, Math.min(maxMs ?? MAX_SPEECH_MS, MAX_SPEECH_MS));
    },
    [finish]
  );

  const cancel = useCallback(() => {
    attempt.current += 1;
    window.clearTimeout(timer.current);
    grammar.current = null;
    callback.current = null;
    cancelListening();
    setPhase("idle");
  }, []);

  return { phase, problem, begin, stop: finish, cancel };
}
