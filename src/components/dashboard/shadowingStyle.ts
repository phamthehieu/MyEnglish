import type { WordStatus } from "@/services/sentenceCheck";

/** The look of the sentences of the Shadowing screen: the Lexend face, a little air between letters and words */
export const SENTENCE_FONT = { fontFamily: '"Lexend Variable", ui-sans-serif, system-ui, sans-serif', letterSpacing: "0.015em", wordSpacing: "0.1em" } as const;

/** How a word of a checked sentence is colored: heard clearly, shaky, heard as another word, not heard */
export const WORD_TONE: Record<WordStatus, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  shaky: "text-amber-600 dark:text-amber-400",
  wrong: "text-rose-600 dark:text-rose-400 underline decoration-wavy underline-offset-4",
  missing: "text-rose-500 dark:text-rose-400 opacity-60 line-through",
  skip: "text-slate-700 dark:text-zinc-300",
};
