/** "Trò chuyện tình huống": situations the learner practices as a scripted conversation (src/data/situations) */

/** A sentence the learner says. The only text the speech check listens for. */
export interface SituationLine {
  /** Unique across all situations: "cafe-order.l1" */
  id: string;
  en: string;
  vi: string;
  /** Other ways to say it that are just as good; each is accepted when the learner speaks */
  accept: string[];
  /** Short Vietnamese note on how or when to say it */
  note?: string;
}

/** What the other person says, and the learner's possible answers */
export interface DialogueNode {
  /** Unique inside the situation: "n1" */
  id: string;
  /** Spoken by text-to-speech */
  npc_en: string;
  npc_vi: string;
  /** 1–3 answers that make sense here. `next` is the node that follows, or null when the talk ends. */
  replies: Array<{ lineId: string; next: string | null }>;
}

export type SituationGroup = "daily" | "work";

export interface Situation {
  /** "cafe-order" */
  id: string;
  group: SituationGroup;
  title_vi: string;
  title_en: string;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  /** What the learner can do afterwards, in Vietnamese */
  goal_vi: string;
  /** The other person, e.g. "Nhân viên quán" */
  partner_vi: string;
  /** Their picture in the chat: one emoji */
  partner_emoji: string;
  /** The sentences to learn first (the warm-up) */
  lines: SituationLine[];
  /** The conversation; it starts at the first node */
  dialogue: DialogueNode[];
  /** Set on a conversation the AI wrote for this learner; the built-in ones have none of these */
  ai?: {
    createdAt: number;
    /** Which topic of services/talk/topics.ts it was written for, so it is not picked again */
    topicId: string;
  };
}
