import { BLANK, fillPattern, type Pattern, type PatternGoal, type PatternLevel } from "@/types/pattern";

const LEVELS: PatternLevel[] = ["A1", "A2", "B1", "B2", "C1"];
const GOALS: PatternGoal[] = ["travel", "work", "daily", "social"];
/** What a spoken English sentence may be written with: what the recognizer and the tiles can handle */
const WRITTEN = /^[A-Za-z’' ,.?!]+$/;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const blanks = (s: string) => s.split(BLANK).length - 1;

/** Everything that would make a pattern unusable, as a list of problems (empty = fine) */
export function validatePattern(p: Pattern, options: { maxWords?: number } = {}): string[] {
  const maxWords = options.maxWords ?? 10;
  const problems: string[] = [];
  const bad = (m: string) => problems.push(m);

  if (!/^[a-z][0-9]\.[a-z0-9-]+$/.test(p.id)) bad("id phải dạng a1.ten-mau-cau");
  if (!LEVELS.includes(p.level)) bad("level không hợp lệ");
  if (!p.topic?.trim() || !/^[a-z0-9-]+$/.test(p.topic)) bad("topic phải là slug (chữ thường, gạch nối)");
  if (!p.topic_vi?.trim()) bad("thiếu topic_vi");
  if (!Array.isArray(p.goals) || p.goals.length === 0 || p.goals.some((g) => !GOALS.includes(g))) bad("goals phải là một phần của travel, work, daily, social");

  if (blanks(p.frame_en ?? "") !== 1) bad(`frame_en phải có đúng một chỗ trống ${BLANK}`);
  if (blanks(p.frame_vi ?? "") !== 1) bad(`frame_vi phải có đúng một chỗ trống ${BLANK}`);
  if ((p.frame_en ?? "").trimStart().startsWith(BLANK)) bad("frame_en không được bắt đầu bằng chỗ trống");
  if (!p.note_vi?.trim() || words(p.note_vi) > 30) bad("note_vi cần một dòng ngắn (tối đa 30 từ)");

  const slots = Array.isArray(p.slots) ? p.slots : [];
  if (slots.length < 5 || slots.length > 10) bad(`cần 5 đến 10 slot (có ${slots.length})`);
  const seen = new Set<string>();
  slots.forEach((slot, i) => {
    if (!slot?.en?.trim() || !slot?.vi?.trim()) return bad(`slot ${i + 1} thiếu en hoặc vi`);
    if (seen.has(slot.en.toLowerCase())) bad(`slot "${slot.en}" bị lặp`);
    seen.add(slot.en.toLowerCase());
    if (blanks(slot.en) > 0 || blanks(slot.vi) > 0) return bad(`slot ${i + 1} chứa ${BLANK}`);
    const filled = fillPattern(p, slot);
    if (!WRITTEN.test(filled.en)) bad(`câu "${filled.en}" có ký tự không nói được (số, gạch nối, ký hiệu)`);
    if (words(filled.en) < 2 || words(filled.en) > maxWords) bad(`câu "${filled.en}" phải từ 2 đến ${maxWords} từ`);
    if (/\s{2,}/.test(filled.en) || /\s[,.?!]/.test(filled.en)) bad(`câu "${filled.en}" thừa khoảng trắng`);
  });

  const examples = Array.isArray(p.examples) ? p.examples : [];
  if (examples.length < 2 || examples.length > 4) bad(`cần 2 đến 4 câu ví dụ (có ${examples.length})`);
  examples.forEach((e, i) => {
    if (!e?.en?.trim() || !e?.vi?.trim()) return bad(`ví dụ ${i + 1} thiếu en hoặc vi`);
    if (!WRITTEN.test(e.en)) bad(`ví dụ "${e.en}" có ký tự không nói được`);
    if (words(e.en) < 2 || words(e.en) > maxWords + 2) bad(`ví dụ "${e.en}" phải từ 2 đến ${maxWords + 2} từ`);
  });

  const asks = Array.isArray(p.asks) ? p.asks : [];
  if (asks.length < 1 || asks.length > 3) bad(`cần 1 đến 3 câu hỏi của đối tác (có ${asks.length})`);
  asks.forEach((a, i) => {
    if (!a?.en?.trim() || !a?.vi?.trim()) return bad(`câu hỏi ${i + 1} thiếu en hoặc vi`);
    if (!WRITTEN.test(a.en)) bad(`câu hỏi "${a.en}" có ký tự không nói được`);
    if (words(a.en) > 12) bad(`câu hỏi "${a.en}" quá dài (tối đa 12 từ)`);
  });

  return problems;
}
