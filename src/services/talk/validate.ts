import type { Situation } from "@/types/situation";
import { normalizeSpeech, variantsOf } from "./engine";

/** Characters a spoken line may be written with: what the recognizer and the tiles can handle */
const WRITTEN = /^[A-Za-z’' ,.?!]+$/;

export interface ValidateOptions {
  /** Longest learner line, in words */
  maxWords?: number;
}

/**
 * Everything that would make a conversation unplayable or unfair, as a list of problems (empty = fine).
 * The built-in conversations must pass it, and so must one written by the AI before it is shown.
 */
export function validateSituation(s: Situation, options: ValidateOptions = {}): string[] {
  const maxWords = options.maxWords ?? 10;
  const problems: string[] = [];
  const bad = (message: string) => problems.push(message);

  if (!s.id.trim()) bad("thiếu id");
  if (s.group !== "daily" && s.group !== "work") bad("nhóm không hợp lệ");
  for (const [name, value] of [
    ["title_vi", s.title_vi],
    ["title_en", s.title_en],
    ["goal_vi", s.goal_vi],
    ["partner_vi", s.partner_vi],
    ["partner_emoji", s.partner_emoji],
  ] as const) {
    if (!value.trim()) bad(`thiếu ${name}`);
  }

  if (s.lines.length < 3 || s.lines.length > 10) bad(`số câu phải từ 3 đến 10 (có ${s.lines.length})`);
  const lineIds = new Set<string>();
  const owner = new Map<string, string>();
  for (const line of s.lines) {
    if (lineIds.has(line.id)) bad(`trùng id câu ${line.id}`);
    lineIds.add(line.id);
    if (!line.id.startsWith(`${s.id}.`)) bad(`id câu ${line.id} phải bắt đầu bằng "${s.id}."`);
    if (!line.vi.trim()) bad(`${line.id}: thiếu nghĩa tiếng Việt`);
    for (const text of [line.en, ...line.accept]) {
      if (!WRITTEN.test(text)) bad(`${line.id}: "${text}" có ký tự không nói được (số, gạch nối, ký hiệu)`);
    }
    const words = normalizeSpeech(line.en).split(" ").filter(Boolean);
    if (words.length < 2 || words.length > maxWords) bad(`${line.id}: câu phải từ 2 đến ${maxWords} từ (có ${words.length})`);
    for (const phrase of variantsOf(line)) {
      const other = owner.get(phrase);
      if (other && other !== line.id) bad(`"${phrase}" thuộc cả ${other} và ${line.id}`);
      owner.set(phrase, line.id);
    }
  }

  if (s.dialogue.length < 3 || s.dialogue.length > 7) bad(`số lượt hội thoại phải từ 3 đến 7 (có ${s.dialogue.length})`);
  const order = new Map<string, number>();
  s.dialogue.forEach((n, i) => {
    if (order.has(n.id)) bad(`trùng id lượt ${n.id}`);
    order.set(n.id, i);
  });
  const used = new Set<string>();
  for (const n of s.dialogue) {
    if (!n.npc_en.trim() || !n.npc_vi.trim()) bad(`${n.id}: thiếu lời của người kia`);
    if (n.replies.length < 1 || n.replies.length > 3) bad(`${n.id}: mỗi lượt cần 1 đến 3 câu trả lời`);
    const inNode = new Set<string>();
    for (const r of n.replies) {
      if (!lineIds.has(r.lineId)) bad(`${n.id}: câu trả lời ${r.lineId} không tồn tại`);
      if (inNode.has(r.lineId)) bad(`${n.id}: câu ${r.lineId} xuất hiện hai lần`);
      inNode.add(r.lineId);
      used.add(r.lineId);
      if (r.next !== null) {
        const to = order.get(r.next);
        if (to === undefined) bad(`${n.id}: lượt tiếp theo ${r.next} không tồn tại`);
        else if (to <= order.get(n.id)!) bad(`${n.id}: không được quay lại lượt ${r.next}`);
      }
    }
  }
  for (const id of lineIds) if (!used.has(id)) bad(`câu ${id} không được dùng ở lượt nào`);

  // Every turn must be reachable from the first
  if (s.dialogue.length > 0 && problems.length === 0) {
    const reached = new Set<string>([s.dialogue[0].id]);
    for (const n of s.dialogue) {
      if (!reached.has(n.id)) continue;
      for (const r of n.replies) if (r.next) reached.add(r.next);
    }
    for (const n of s.dialogue) if (!reached.has(n.id)) bad(`lượt ${n.id} không có đường đi tới`);
  }
  return problems;
}
