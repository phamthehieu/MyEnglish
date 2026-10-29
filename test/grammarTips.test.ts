import { describe, expect, it } from "vitest";
import { PATTERNS } from "@/data/patterns";
import { GRAMMAR_TIPS, tipEntries, tipForStage } from "@/data/grammarTips";
import catalog from "@/data/grammarCatalog.json";

const lessonIds = new Set((catalog as { files: Array<{ lessons?: Array<{ id: string }> }> }).files.flatMap((f) => (f.lessons ?? []).map((l) => l.id)));
const stages = [...new Set(PATTERNS.map((p) => p.topic))];

describe("grammar tips of the speaking path", () => {
  it("every stage has one tip, and every tip belongs to a stage", () => {
    expect(GRAMMAR_TIPS.map((t) => t.stage).sort()).toEqual([...stages].sort());
    expect(new Set(GRAMMAR_TIPS.map((t) => t.stage)).size).toBe(GRAMMAR_TIPS.length);
  });

  it("are complete: points, examples with a translation, the usual mistake", () => {
    for (const t of GRAMMAR_TIPS) {
      expect(t.points.length, t.stage).toBeGreaterThanOrEqual(2);
      expect(t.points.length, t.stage).toBeLessThanOrEqual(4);
      expect(t.examples.length, t.stage).toBeGreaterThanOrEqual(2);
      for (const e of t.examples) {
        expect(e.en, t.stage).toBeTruthy();
        expect(e.vi, t.stage).toBeTruthy();
        expect(e.en, t.stage).not.toContain("___");
      }
      expect(t.mistake.wrong, t.stage).not.toBe(t.mistake.right);
      expect(t.mistake.why, t.stage).toBeTruthy();
    }
  });

  it("link only lessons of the grammar book, each with a name", () => {
    for (const t of GRAMMAR_TIPS) {
      expect(t.lessons.length, t.stage).toBeLessThanOrEqual(3);
      for (const l of t.lessons) {
        expect(lessonIds.has(l.id), `${t.stage} -> ${l.id}`).toBe(true);
        expect(l.title.length, `${t.stage} -> ${l.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("find the tip of a stage, and list them in the order of the path with their level", () => {
    expect(tipForStage("greetings-introductions")).toBeDefined();
    expect(tipForStage("no-such-stage")).toBeUndefined();
    const entries = tipEntries();
    expect(entries).toHaveLength(stages.length);
    expect(entries[0].level).toBe("A1");
    expect(entries[entries.length - 1].level).toBe("C1");
    expect(entries.every((e) => e.stageTitle.length > 0)).toBe(true);
  });
});
