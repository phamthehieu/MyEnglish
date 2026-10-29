import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMON_WORDS, FUNCTION_WORDS } from "@/data/commonWords";
import { getAllWords } from "@/services/db";
import { isFoundationMode } from "@/services/learnerProfile";
import { buildWordIndex, classifyToken } from "@/services/reading";
import type { WordDetail } from "@/types/database";
import WordSheet, { cleanWord } from "@/components/dashboard/WordSheet";

type Unlearned = (word: string) => boolean;

/**
 * The learner's own words, for the chat: a word is "unlearned" when it is not in their word bank (and not one of
 * the very common words) or it is in the bank but never studied. Same rule as the Shadowing tab.
 * `lookup` opens the meaning sheet for a tapped word; `sheet` is the sheet to render (null when closed).
 */
export function useWordTap() {
  const [bank, setBank] = useState<WordDetail[]>([]);
  const reload = useCallback(() => {
    getAllWords()
      .then(setBank)
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const unlearned = useMemo<Unlearned>(() => {
    const { formIndex } = buildWordIndex(bank);
    const known = isFoundationMode() ? FUNCTION_WORDS : COMMON_WORDS;
    const memo = new Map<string, boolean>();
    return (raw) => {
      const word = cleanWord(raw);
      if (!word) return false;
      const key = word.toLowerCase();
      let answer = memo.get(key);
      if (answer === undefined) {
        const cls = classifyToken(word, formIndex, known);
        answer = cls.kind === "candidate" || (cls.kind === "bank" && cls.status === "new");
        memo.set(key, answer);
      }
      return answer;
    };
  }, [bank]);

  const [tapped, setTapped] = useState<{ raw: string; sentence: string } | null>(null);
  const close = useCallback(() => setTapped(null), []);
  const sheet = tapped ? <WordSheet raw={tapped.raw} sentence={tapped.sentence} fontFamily="inherit" onSaved={reload} onClose={close} /> : null;

  return { unlearned, open: (raw: string, sentence: string) => cleanWord(raw) && setTapped({ raw, sentence }), sheet };
}

/** A sentence whose words can be tapped (meaning sheet); the ones not learned yet are in yellow */
export default function TapText({
  text,
  unlearned,
  onWord,
  tone,
}: {
  text: string;
  unlearned: Unlearned;
  onWord: (word: string) => void;
  /** "light": on a light bubble, "dark": on the teal one */
  tone: "light" | "dark";
}) {
  const gold = tone === "dark" ? "text-yellow-300 underline decoration-dotted underline-offset-2" : "text-yellow-700 dark:text-yellow-300 underline decoration-dotted underline-offset-2";
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={i}
          className={unlearned(word) ? gold : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onWord(word);
          }}
        >
          {word}{" "}
        </span>
      ))}
    </>
  );
}
