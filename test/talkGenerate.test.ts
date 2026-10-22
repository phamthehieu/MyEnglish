import { describe, it, expect } from "vitest";
import { SITUATIONS, allSituations, getSituation, getLine } from "@/data/situations";
import { validateSituation } from "@/services/talk/validate";
import { buildSituationFromAi, ContentError, findDuplicate, type BuildContext } from "@/services/talk/generate";
import { addGenerated, getGenerated, MAX_GENERATED, removeGenerated, usedTopicIds } from "@/services/talk/custom";
import { FREE_TOPIC, pickTopic, TALK_TOPICS } from "@/services/talk/topics";

const ctx: BuildContext = { id: "ai-x1", group: "daily", cefr: "A2", topicId: "taxi", now: 1_700_000_000_000 };

/** A conversation as the AI is asked to write it */
const goodAi = () => ({
  title_vi: "Đi taxi",
  title_en: "Taking a taxi",
  goal_vi: "Nói được bạn muốn đi đâu.",
  partner_vi: "Tài xế",
  partner_emoji: "🚕",
  lines: [
    { key: "l1", en: "To the airport, please.", vi: "Cho tôi ra sân bay.", accept: ["Airport please", "To the airport"], note: "" },
    { key: "l2", en: "How long will it take?", vi: "Mất bao lâu?", accept: ["How long is it"] },
    { key: "l3", en: "Here is fine, thank you.", vi: "Dừng ở đây được rồi.", accept: ["Here is good thanks"] },
  ],
  dialogue: [
    { id: "n1", npc_en: "Hello! Where to?", npc_vi: "Xin chào! Đi đâu ạ?", replies: [{ line: "l1", next: "n2" }] },
    { id: "n2", npc_en: "Sure. Anything else?", npc_vi: "Vâng. Còn gì nữa không?", replies: [{ line: "l2", next: "n3" }, { line: "l3", next: null }] },
    { id: "n3", npc_en: "About twenty minutes.", npc_vi: "Khoảng hai mươi phút.", replies: [{ line: "l3", next: null }] },
  ],
});
const build = (mutate?: (ai: ReturnType<typeof goodAi>) => void, options: Partial<BuildContext> = {}) => {
  const ai = goodAi();
  mutate?.(ai);
  return buildSituationFromAi(JSON.stringify(ai), { ...ctx, ...options });
};

describe("validateSituation", () => {
  it("accepts every built-in conversation", () => {
    for (const s of SITUATIONS) expect(validateSituation(s), s.id).toEqual([]);
  });

  it("has unique topic ids and none that is a built-in conversation", () => {
    const ids = TALK_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(SITUATIONS.some((s) => s.id === id)).toBe(false);
  });
});

describe("buildSituationFromAi", () => {
  it("turns the AI's JSON into a situation with our own ids, level and marker", () => {
    const s = build();
    expect(s.id).toBe("ai-x1");
    expect(s.cefr).toBe("A2");
    expect(s.ai).toEqual({ createdAt: ctx.now, topicId: "taxi" });
    expect(s.lines.map((l) => l.id)).toEqual(["ai-x1.l1", "ai-x1.l2", "ai-x1.l3"]);
    expect(s.dialogue[1].replies).toEqual([
      { lineId: "ai-x1.l2", next: "n3" },
      { lineId: "ai-x1.l3", next: null },
    ]);
    expect(validateSituation(s)).toEqual([]);
  });

  it("drops an accepted wording that repeats the line itself", () => {
    const s = build((ai) => (ai.lines[0].accept = ["to the airport please", "Airport please"]));
    expect(s.lines[0].accept).toEqual(["Airport please"]);
  });

  const rejects = (name: string, mutate: (ai: ReturnType<typeof goodAi>) => void, options: Partial<BuildContext> = {}) =>
    it(`rejects ${name}`, () => {
      expect(() => build(mutate, options)).toThrow(ContentError);
    });

  rejects("a line with digits", (ai) => (ai.lines[0].en = "To terminal 2, please."));
  rejects("a line with a hyphen or symbol", (ai) => (ai.lines[1].en = "How long is the e-ticket?"));
  rejects("a line that is too long", (ai) => (ai.lines[1].en = "How long will it take us to get there with all the traffic today?"));
  rejects("a line longer than a beginner's limit", (ai) => (ai.lines[0].en = "To the airport, please, thank you."), { maxWords: 5 });
  rejects("a turn that goes back", (ai) => (ai.dialogue[2].replies = [{ line: "l3", next: "n1" }]));
  rejects("a turn that does not exist", (ai) => (ai.dialogue[0].replies = [{ line: "l1", next: "n9" }]));
  rejects("a reply to a line that does not exist", (ai) => (ai.dialogue[0].replies = [{ line: "l9", next: "n2" }]));
  rejects("a line that is never used", (ai) => {
    ai.lines.push({ key: "l4", en: "Stop here, please.", vi: "Dừng ở đây.", accept: [] });
  });
  rejects("one wording shared by two lines", (ai) => (ai.lines[1].accept = ["Airport please"]));
  rejects("a turn nobody can reach", (ai) => (ai.dialogue[1].replies = [{ line: "l2", next: null }, { line: "l3", next: null }]));
  rejects("a missing title", (ai) => (ai.title_vi = "  "));

  it("rejects text that is not JSON, and JSON that is not a conversation", () => {
    expect(() => buildSituationFromAi("not json", ctx)).toThrow(ContentError);
    expect(() => buildSituationFromAi("[1,2]", ctx)).toThrow(ContentError);
    expect(() => buildSituationFromAi("{}", ctx)).toThrow(ContentError);
  });
});

describe("findDuplicate", () => {
  it("lets a new topic through", () => {
    expect(findDuplicate(build(), SITUATIONS)).toBeNull();
  });

  it("catches the same title, in either language", () => {
    const again = build((ai) => (ai.title_en = "Ordering at a café"));
    expect(findDuplicate(again, SITUATIONS)).toContain("Gọi đồ ở quán cà phê");
    const sameVi = build((ai) => (ai.title_vi = "Tự giới thiệu"));
    expect(findDuplicate(sameVi, SITUATIONS)).toContain("Tự giới thiệu");
  });

  it("catches a conversation that says the same sentences as an existing one", () => {
    const cafe = SITUATIONS.find((s) => s.id === "cafe-order")!;
    const copy = build((ai) => {
      ai.lines = [
        { key: "l1", en: "Can I have a coffee, please?", vi: "a", accept: [] },
        { key: "l2", en: "A large one, please.", vi: "b", accept: [] },
        { key: "l3", en: "To go, please.", vi: "c", accept: [] },
      ];
    });
    expect(findDuplicate(copy, [cafe])).toContain("quá giống");
  });

  it("does not mind a single common sentence like thank you", () => {
    const polite = build((ai) => (ai.lines[2] = { key: "l3", en: "Thank you very much.", vi: "Cảm ơn nhiều.", accept: [] }));
    expect(findDuplicate(polite, SITUATIONS)).toBeNull();
  });
});

describe("pickTopic", () => {
  it("never picks a topic that was used", () => {
    const used = new Set(TALK_TOPICS.slice(1).map((t) => t.id));
    for (let i = 0; i < 10; i++) expect(pickTopic(used, Math.random).id).toBe(TALK_TOPICS[0].id);
  });

  it("falls back to a free topic when all are used", () => {
    expect(pickTopic(new Set(TALK_TOPICS.map((t) => t.id)))).toBe(FREE_TOPIC);
  });
});

describe("generated conversations", () => {
  it("are stored, found next to the built-in ones, and can be removed", () => {
    expect(getGenerated()).toEqual([]);
    const s = build();
    addGenerated(s);
    expect(getGenerated().map((x) => x.id)).toEqual(["ai-x1"]);
    expect(usedTopicIds()).toEqual(new Set(["taxi"]));
    expect(allSituations().length).toBe(SITUATIONS.length + 1);
    expect(getSituation("ai-x1")?.title_vi).toBe("Đi taxi");
    expect(getLine("ai-x1.l2")?.en).toBe("How long will it take?");
    removeGenerated("ai-x1");
    expect(getGenerated()).toEqual([]);
    expect(getSituation("ai-x1")).toBeUndefined();
  });

  it("keeps the newest when there are too many", () => {
    for (let i = 0; i < MAX_GENERATED + 3; i++) addGenerated({ ...build(undefined, { id: `ai-${i}` }), id: `ai-${i}` });
    const ids = getGenerated().map((s) => s.id);
    expect(ids.length).toBe(MAX_GENERATED);
    expect(ids[ids.length - 1]).toBe(`ai-${MAX_GENERATED + 2}`);
    expect(ids).not.toContain("ai-0");
  });

  it("ignores broken stored data", () => {
    localStorage.setItem("myenglish_talk_generated_v1", "{not json");
    expect(getGenerated()).toEqual([]);
    localStorage.setItem("myenglish_talk_generated_v1", JSON.stringify([{ id: 1 }, "x", null]));
    expect(getGenerated()).toEqual([]);
  });
});
