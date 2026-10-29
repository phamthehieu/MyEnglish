import { describe, it, expect } from "vitest";
import { countWordStatus, isLearning, isRememberedLong, wordStatus, WORD_STATUS_LABELS } from "@/services/wordStatus";
import { NAV_SECTIONS, navSectionOf, tabLabel, type DashboardTab } from "@/components/dashboard/shared";
import { makeWord, reviewSrs } from "./helpers";

/** "Đã biết" from a tap only: Review after one rep, no lapse, never reviewed for real */
const knownOnlySrs = { state: 2 as const, reps: 1, lapses: 0, stability: 25 };

describe("one definition of 'đã thuộc': Đang học / Nhớ lâu (U9)", () => {
  const unseen = makeWord("unseen"); // a deck word still waiting in the buffer
  const learning = makeWord("learning", { srs: { state: 1, reps: 1, stability: 0.5, last_review: new Date().toISOString() } });
  const young = makeWord("young", { srs: reviewSrs(6, 2) });
  const relearning = makeWord("relearning", { srs: { state: 3, reps: 6, lapses: 2, stability: 30 } });
  const long = makeWord("long", { srs: reviewSrs(21, 10) });
  const tapOnly = makeWord("tap-only", { srs: knownOnlySrs });

  it("isRememberedLong: recognition card in Review with stability >= 21 days, confirmed by a real review", () => {
    expect(isRememberedLong(long)).toBe(true);
    expect(isRememberedLong(young)).toBe(false);
    expect(isRememberedLong(relearning)).toBe(false); // forgotten: back to learning, whatever its stability
    expect(isRememberedLong(tapOnly)).toBe(false);
    expect(isRememberedLong(unseen)).toBe(false);
  });

  it("isLearning: met at least once, not remembered for the long run; words never met or only tapped are not", () => {
    expect(isLearning(learning)).toBe(true);
    expect(isLearning(young)).toBe(true);
    expect(isLearning(relearning)).toBe(true);
    expect(isLearning(long)).toBe(false);
    expect(isLearning(unseen)).toBe(false);
    expect(isLearning(tapOnly)).toBe(false);
  });

  it("a review card is judged on its recognition card, not on the production card in srs", () => {
    const card = { ...long, srs: { ...long.srs, state: 1 as const, stability: 1 }, srsRecognition: long.srs };
    expect(isRememberedLong(card)).toBe(true);
    expect(isLearning(card)).toBe(false);
  });

  it("wordStatus and the shared labels", () => {
    expect([unseen, learning, long, tapOnly].map(wordStatus)).toEqual(["new", "learning", "remembered_long", "known_only"]);
    expect(WORD_STATUS_LABELS.learning).toBe("Đang học");
    expect(WORD_STATUS_LABELS.remembered_long).toBe("Nhớ lâu");
  });

  it("countWordStatus puts every word in at most one tier", () => {
    expect(countWordStatus([unseen, learning, young, relearning, long, tapOnly])).toEqual({ learning: 3, rememberedLong: 1 });
    expect(countWordStatus([])).toEqual({ learning: 0, rememberedLong: 0 });
  });
});

describe("the five sections of the app", () => {
  const ALL_TABS: DashboardTab[] = [
    "today", "library", "known", "capture", "reading", "writing", "review", "forgotten", "analytics", "guide", "grammar", "talk", "patterns", "pronunciation", "shadowing", "leaderboard", "account",
  ];

  it("has five sections in order, and every tab belongs to exactly one", () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual(["Hôm nay", "Từ vựng", "Luyện nói", "Ngữ pháp", "Tôi"]);
    const tabs = NAV_SECTIONS.flatMap((s) => s.tabs.map((t) => t.tab));
    expect([...tabs].sort()).toEqual([...ALL_TABS].sort());
  });

  it("each section opens its main tab and holds the tabs that belong with it", () => {
    expect(navSectionOf("review").tabs[0].tab).toBe("review");
    expect(navSectionOf("forgotten").id).toBe("vocab");
    expect(navSectionOf("capture").id).toBe("vocab");
    expect(navSectionOf("patterns").tabs.map((t) => t.tab)).toEqual(["patterns", "talk", "pronunciation", "shadowing"]);
    expect(navSectionOf("writing").tabs.map((t) => t.tab)).toEqual(["grammar", "reading", "writing"]);
    expect(navSectionOf("leaderboard").id).toBe("me");
    expect(navSectionOf("guide").tabs[0].tab).toBe("analytics");
    expect(tabLabel("library")).toBe("Kho từ");
  });
});
