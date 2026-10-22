import type { Situation, SituationGroup, SituationLine } from "@/types/situation";
import { normalizeSpeech, variantsOf } from "./engine";
import { validateSituation } from "./validate";

/** The AI's answer was not a usable conversation (as opposed to the AI not answering at all) */
export class ContentError extends Error {}

export interface BuildContext {
  /** Id of the new conversation; its lines are "<id>.l1", "<id>.l2", ... */
  id: string;
  group: SituationGroup;
  cefr: Situation["cefr"];
  topicId: string;
  now: number;
  /** Longest learner line, in words */
  maxWords?: number;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/**
 * The AI's JSON as a Situation, or a ContentError saying what is wrong with it. The AI picks the words; the
 * ids, group, level and the checks are ours: nothing it says is trusted until validateSituation passes.
 */
export function buildSituationFromAi(raw: string, ctx: BuildContext): Situation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContentError("AI trả về dữ liệu không đọc được.");
  }
  const obj = rec(parsed);

  const keyToId = new Map<string, string>();
  const lines: SituationLine[] = list(obj.lines).map((item, i) => {
    const l = rec(item);
    const id = `${ctx.id}.l${i + 1}`;
    const key = str(l.key);
    if (key) keyToId.set(key, id);
    const en = str(l.en);
    const accept = [...new Set(list(l.accept).map(str).filter(Boolean))].filter(
      (a) => normalizeSpeech(a) !== normalizeSpeech(en)
    );
    const note = str(l.note);
    return { id, en, vi: str(l.vi), accept, ...(note ? { note } : {}) };
  });

  const dialogue = list(obj.dialogue).map((item) => {
    const n = rec(item);
    return {
      id: str(n.id),
      npc_en: str(n.npc_en),
      npc_vi: str(n.npc_vi),
      replies: list(n.replies).map((r) => {
        const reply = rec(r);
        const next = reply.next === null || reply.next === undefined ? null : str(reply.next);
        return { lineId: keyToId.get(str(reply.line)) ?? `${ctx.id}.missing_${str(reply.line)}`, next: next || null };
      }),
    };
  });

  const situation: Situation = {
    id: ctx.id,
    group: ctx.group,
    title_vi: str(obj.title_vi),
    title_en: str(obj.title_en),
    cefr: ctx.cefr,
    goal_vi: str(obj.goal_vi),
    partner_vi: str(obj.partner_vi),
    partner_emoji: [...str(obj.partner_emoji)].slice(0, 4).join(""),
    lines,
    dialogue,
    ai: { createdAt: ctx.now, topicId: ctx.topicId },
  };
  const problems = validateSituation(situation, { maxWords: ctx.maxWords });
  if (problems.length > 0) throw new ContentError(`AI viết chưa đạt: ${problems.slice(0, 3).join("; ")}.`);
  return situation;
}

/**
 * Why `candidate` is the same as a conversation the learner already has, or null when it is new: the same title,
 * or half (at least two) of its lines said in the same words as one existing conversation.
 */
export function findDuplicate(candidate: Situation, existing: Situation[]): string | null {
  const titles = new Set([normalizeSpeech(candidate.title_en), normalizeSpeech(candidate.title_vi)]);
  const need = Math.max(2, Math.ceil(candidate.lines.length / 2));
  for (const e of existing) {
    if (titles.has(normalizeSpeech(e.title_en)) || titles.has(normalizeSpeech(e.title_vi))) {
      return `trùng tên với "${e.title_vi}"`;
    }
    const theirs = new Set(e.lines.flatMap(variantsOf));
    const shared = candidate.lines.filter((l) => variantsOf(l).some((v) => theirs.has(v)));
    if (shared.length >= need) return `quá giống "${e.title_vi}"`;
  }
  return null;
}
