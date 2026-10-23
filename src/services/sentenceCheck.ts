import { WEAK_CONFIDENCE, type AsrWord } from "@/services/pronunciationCheck";

/**
 * Reading a whole sentence aloud: the words the offline recognizer heard are lined up with the words of the sentence,
 * so each word can be told apart as heard clearly, heard but shaky, heard as another word, or not heard at all.
 * It says what the machine heard, not a score: a recognizer cannot measure how good a pronunciation is.
 */
export type WordStatus = "ok" | "shaky" | "wrong" | "missing" | "skip";

export interface CheckedWord {
  /** As written in the sentence (with its punctuation) */
  text: string;
  status: WordStatus;
  /** What was heard in its place (status "wrong") */
  heard?: string;
}

export interface SentenceCheck {
  words: CheckedWord[];
  /** Words heard clearly, out of the words that could be judged */
  clear: number;
  judged: number;
  /** Words said that are not in the sentence */
  extra: string[];
}

/** The letters of a word as the recognizer writes it: lower case, no punctuation, ’ as ' */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
}

/** A word the recognizer cannot be held to: figures are written as words by it ("20" -> "twenty") */
function isUnjudgeable(key: string): boolean {
  return key === "" || /\d/.test(key);
}

export function checkSentence(sentence: string, heard: AsrWord[]): SentenceCheck {
  const target = sentence
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, key: normalizeWord(text) }))
    .filter((w) => w.key !== "" || /[a-z0-9]/i.test(w.text));
  const said = heard.map((w) => ({ key: normalizeWord(w.word), conf: w.conf, word: w.word })).filter((w) => w.key !== "");

  // Edit distance between the two word lists; a word that was not heard or was added costs 1, a swap costs 1
  const n = target.length;
  const m = said.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) cost[i][0] = i;
  for (let j = 1; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = target[i - 1].key === said[j - 1].key ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }

  const words: CheckedWord[] = new Array(n);
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = target[i - 1].key === said[j - 1].key;
      if (cost[i][j] === cost[i - 1][j - 1] + (same ? 0 : 1)) {
        const t = target[i - 1];
        const h = said[j - 1];
        words[i - 1] = isUnjudgeable(t.key)
          ? { text: t.text, status: "skip" }
          : same
            ? { text: t.text, status: h.conf >= WEAK_CONFIDENCE ? "ok" : "shaky" }
            : { text: t.text, status: "wrong", heard: h.word };
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      const t = target[i - 1];
      words[i - 1] = { text: t.text, status: isUnjudgeable(t.key) ? "skip" : "missing" };
      i--;
    } else {
      extra.unshift(said[j - 1].word);
      j--;
    }
  }

  const judged = words.filter((w) => w.status !== "skip").length;
  return { words, judged, clear: words.filter((w) => w.status === "ok").length, extra };
}
