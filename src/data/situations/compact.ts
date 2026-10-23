import type { DialogueNode, Situation, SituationGroup, SituationLine } from "@/types/situation";
import { normalizeSpeech } from "@/services/talk/engine";

/** [English, Vietnamese, other accepted wordings, note] */
type LineSpec = [en: string, vi: string, accept: string[], note?: string];
/** [what the other person says, its Vietnamese, the answers as [line number, next turn number or null]] — numbers start at 1 */
type TurnSpec = [npcEn: string, npcVi: string, replies: Array<[line: number, next: number | null]>];

export interface CompactSpec {
  id: string;
  group: SituationGroup;
  cefr: Situation["cefr"];
  title_vi: string;
  title_en: string;
  goal_vi: string;
  partner_vi: string;
  partner_emoji: string;
  lines: LineSpec[];
  turns: TurnSpec[];
}

/** The same Situation as the long form in the other files, written without repeating the ids */
export function situation(spec: CompactSpec): Situation {
  const lines: SituationLine[] = spec.lines.map(([en, vi, accept, note], i) => {
    // An accepted wording that is the line itself without its punctuation, or a repeat, adds nothing
    const seen = new Set([normalizeSpeech(en)]);
    const others = accept.filter((a) => {
      const key = normalizeSpeech(a);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { id: `${spec.id}.l${i + 1}`, en, vi, accept: others, ...(note ? { note } : {}) };
  });
  const dialogue: DialogueNode[] = spec.turns.map(([npc_en, npc_vi, replies], i) => ({
    id: `n${i + 1}`,
    npc_en,
    npc_vi,
    replies: replies.map(([line, next]) => ({ lineId: `${spec.id}.l${line}`, next: next === null ? null : `n${next}` })),
  }));
  const { id, group, cefr, title_vi, title_en, goal_vi, partner_vi, partner_emoji } = spec;
  return { id, group, cefr, title_vi, title_en, goal_vi, partner_vi, partner_emoji, lines, dialogue };
}
