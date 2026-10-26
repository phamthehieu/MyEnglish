import { describe, expect, it } from "vitest";
import { SITUATIONS } from "@/data/situations";
import { nextNodeId, swapRoles } from "./engine";

describe("swapRoles", () => {
  it.each(SITUATIONS.map((s) => [s.id, s] as const))("%s: the swapped talk can be played to its end", (_id, situation) => {
    const swapped = swapRoles(situation);
    expect(swapped.dialogue.length).toBeGreaterThan(0);
    const lineIds = new Set(swapped.lines.map((l) => l.id));
    let node: string | null | undefined = swapped.dialogue[0].id;
    let steps = 0;
    while (node && steps++ < 100) {
      const n = swapped.dialogue.find((d) => d.id === node)!;
      expect(n).toBeDefined();
      expect(n.replies).toHaveLength(1);
      expect(lineIds.has(n.replies[0].lineId)).toBe(true);
      node = nextNodeId(swapped, n.id, n.replies[0].lineId);
    }
    expect(node).toBeNull();
  });

  it("the learner says the other person's lines and hears their own", () => {
    const cafe = SITUATIONS.find((s) => s.id === "cafe-order")!;
    const swapped = swapRoles(cafe);
    expect(swapped.lines[0].en).toBe(cafe.dialogue[0].npc_en);
    const ownLines = new Set(cafe.lines.map((l) => l.en));
    expect(ownLines.has(swapped.dialogue[1].npc_en)).toBe(true);
  });
});
