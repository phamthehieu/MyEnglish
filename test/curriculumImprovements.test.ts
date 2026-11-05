import { describe, it, expect } from "vitest";
import catalogRaw from "../src/data/grammarCatalog.json";
import type { GrammarBookFile, GrammarBookItem, GrammarExerciseSetType } from "../src/types/grammarBook";
import { availableFormats, formatForLevel, buildTask, cleanDistractors } from "../src/services/grammarItems";
import { PATTERNS } from "../src/data/patterns";
import { isTranslation, hintFor } from "../src/services/patterns/translate";
import { completeStep, getPatternState } from "../src/services/patterns/progress";
import { buildDayPlan } from "../src/services/roadmap/plan";
import { buildPathStages } from "../src/services/roadmap/stages";
import { READING_SAMPLES } from "../src/data/readingSamples";
import { INTRODUCE_YOURSELF } from "../src/data/situations/introduce-yourself";
import { ASK_COLLEAGUE } from "../src/data/situations/ask-colleague";
import SHADOWING_INDEX from "../src/data/shadowing/index.json";

const files = (catalogRaw as unknown as { files: GrammarBookFile[] }).files;
const setTypeById = new Map<string, GrammarExerciseSetType>();
for (const f of files) {
  for (const s of f.exerciseSets ?? []) {
    setTypeById.set(s.id, s.type);
  }
}

describe("Curriculum & UX Improvements for Working Adults", () => {
  it("1. [Ngữ pháp] Tất cả câu hỏi có chỗ trống (blanks > 0) đều có phương án Trắc nghiệm (choice) ở Level 0 nhờ fallbackDistractors", () => {
    const seen = new Set<string>();
    let blankItems = 0;
    let choiceAtLevel0 = 0;

    for (const f of files) {
      for (const s of f.exerciseSets ?? []) {
        for (const item of s.items ?? []) {
          const key = `${item.setId}:${item.n}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const blanks = (item.prompt.match(/_{3,}/g) || []).length;
          if (blanks === 0) continue;
          const avail = availableFormats(item, s.type);
          if (avail[0] === "self") continue;
          blankItems++;
          if (formatForLevel(item, s.type, 0, avail) === "choice") choiceAtLevel0++;
        }
      }
      for (const g of f.practiceGroups ?? []) {
        for (const item of g.items ?? []) {
          const key = `${item.setId}:${item.n}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const blanks = (item.prompt.match(/_{3,}/g) || []).length;
          if (blanks === 0) continue;
          const setType = setTypeById.get(item.setId) ?? "fill_blank";
          const avail = availableFormats(item, setType);
          if (avail[0] === "self") continue;
          blankItems++;
          if (formatForLevel(item, setType, 0, avail) === "choice") choiceAtLevel0++;
        }
      }
    }

    expect(blankItems).toBeGreaterThan(500);
    // 100% câu hỏi điền chỗ trống tự chấm được đều có phương án Trắc nghiệm ở Level 0!
    expect(choiceAtLevel0).toBe(blankItems);

    // Kiểm tra cụ thể 1 câu thiếu ai.distractors (ví dụ câu điều kiện ở Chương 3) tạo được 4 đáp án trắc nghiệm hợp lệ:
    const itemWithoutAiDistractors: GrammarBookItem = {
      setId: "ch03-s01",
      n: 1,
      prompt: "If I see him, I ___ (give) him a gift.",
      answers: [["will give"]],
      answerSentence: "If I see him, I will give him a gift.",
    };
    expect(cleanDistractors(itemWithoutAiDistractors, 0).length).toBeGreaterThanOrEqual(3);
    const task = buildTask(itemWithoutAiDistractors, "verb_form", "choice", () => 0.5);
    expect(task.format).toBe("choice");
    expect(task.options).toHaveLength(4);
    expect(task.options).toContain("will give");
  });

  it("2. [Mẫu câu] Bài Dịch câu (isTranslation) chấp nhận chữ số, giờ giấc, từ viết tắt mở rộng và cách diễn đạt tương đương", () => {
    // Chữ số & giờ giấc
    expect(isTranslation("I get up at 5:30.", "I get up at five thirty.")).toBe(true);
    expect(isTranslation("I get up at 5:30 am.", "I get up at five thirty.")).toBe(true);
    expect(isTranslation("I usually wake up at 7.", "I usually wake up at seven.")).toBe(true);
    expect(isTranslation("I usually wake up at 7 o'clock.", "I usually wake up at seven.")).toBe(true);
    expect(isTranslation("I am 25 years old.", "I am twenty-five years old.")).toBe(true);

    // Dạng viết tắt mở rộng
    expect(isTranslation("My name's Anna.", "My name is Anna.")).toBe(true);
    expect(isTranslation("There's a cafe near here.", "There is a cafe near here.")).toBe(true);
    expect(isTranslation("I'll call you later.", "I will call you later.")).toBe(true);

    // Cụm từ tương đương phổ biến
    expect(isTranslation("I wake up at five thirty.", "I get up at five thirty.")).toBe(true);
    expect(isTranslation("I come from Vietnam.", "I am from Vietnam.")).toBe(true);
    expect(isTranslation("I'm fine, thanks.", "I'm fine, thank you.")).toBe(true);

    expect(hintFor(2)).toBe("count");
    expect(hintFor(4)).toBe("none");
  });

  it("3. [Lộ trình nói] Người học có thể bấm học tiếp Bước 3 & Bước 4 ngay trong ngày (allowAhead=true) mà không bị kẹt chờ qua ngày", () => {
    localStorage.clear();
    const stages = buildPathStages(PATTERNS, "all", "A1");
    const stage1 = stages[0];
    const now = new Date("2026-05-10T09:00:00");
    const roadmap = { stageId: stage1.id, done: [], tested: [], conversed: [] };

    for (const p of stage1.patterns) {
      completeStep(p.id, 1, now);
      completeStep(p.id, 2, now);
    }
    const statesAllStep2 = Object.fromEntries(stage1.patterns.map((p) => [p.id, getPatternState(p.id)]));
    const planContinueSameDay = buildDayPlan(stage1, roadmap, statesAllStep2, [], 15, now, true);

    expect(planContinueSameDay.waiting).toBe(false);
    expect(planContinueSameDay.tasks.length).toBeGreaterThan(0);
    expect(planContinueSameDay.tasks[0]).toMatchObject({
      kind: "step",
      steps: [3],
    });
  });

  it("4. [Đọc] Kho bài đọc mẫu (READING_SAMPLES) phủ đủ A1, A2, B1 với nội dung đời sống & công việc gần gũi", () => {
    expect(READING_SAMPLES.length).toBeGreaterThanOrEqual(8);
    const levels = new Set(READING_SAMPLES.map((s) => s.level));
    expect(levels.has("A1")).toBe(true);
    expect(levels.has("A2")).toBe(true);
    expect(levels.has("B1")).toBe(true);
    expect(levels.has("B2")).toBe(true);
    for (const s of READING_SAMPLES) {
      expect(s.translationVi.length).toBeGreaterThan(30);
    }
    expect(INTRODUCE_YOURSELF.lines.find((l) => l.id === "introduce-yourself.l3")?.en).toBe("I'm an office worker.");
    expect(ASK_COLLEAGUE.lines.find((l) => l.id === "ask-colleague.l2")?.en).toBe("I have a problem with this report.");
    expect((SHADOWING_INDEX as Array<{ hasVi?: boolean }>).some((x) => x.hasVi)).toBe(true);
    for (const s of READING_SAMPLES) {
      expect(s.text.split(/\s+/).length).toBeGreaterThanOrEqual(35);
      expect(s.titleVi.length).toBeGreaterThan(3);
    }
  });
});
