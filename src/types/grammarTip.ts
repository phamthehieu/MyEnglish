import type { PatternLevel } from "./pattern";

/** A lesson of the built-in grammar book that explains a tip in depth */
export interface GrammarTipLesson {
  id: string;
  title: string;
}

/**
 * The grammar behind the sentences of one stage of the speaking path, in a few plain lines: what the learner needs
 * to know to build more sentences like them, and the mistake a Vietnamese speaker most often makes.
 */
export interface GrammarTip {
  /** The stage (the pattern topic slug) */
  stage: string;
  title: string;
  points: string[];
  examples: Array<{ en: string; vi: string }>;
  mistake: { wrong: string; right: string; why: string };
  lessons: GrammarTipLesson[];
}

/** A tip with the level and the name of its stage, for lists */
export interface GrammarTipEntry extends GrammarTip {
  level: PatternLevel;
  stageTitle: string;
}
