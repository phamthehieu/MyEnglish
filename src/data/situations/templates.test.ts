import { describe, expect, it } from "vitest";
import { SITUATIONS } from ".";
import { fillSlots, SLOTS } from "./templates";
import { validateSituation } from "@/services/talk/validate";

describe("conversation templates", () => {
  it("every slot belongs to a built-in conversation", () => {
    for (const id of Object.keys(SLOTS)) expect(SITUATIONS.some((s) => s.id === id), id).toBe(true);
  });

  it.each(Object.keys(SLOTS))("%s: every combination of values gives a valid conversation with the same ids", (id) => {
    const base = SITUATIONS.find((s) => s.id === id)!;
    const sizes = SLOTS[id].map((s) => s.length + 1);
    const total = sizes.reduce((a, b) => a * b, 1);
    for (let k = 0; k < total; k++) {
      // The k-th combination, through a fixed "random" that walks the choices
      let rest = k;
      const picks = sizes.map((n) => {
        const p = rest % n;
        rest = Math.floor(rest / n);
        return p;
      });
      let call = 0;
      const { situation } = fillSlots(base, () => (picks[call++] + 0.01) / sizes[call - 1]);
      expect(validateSituation(situation), `${id} #${k}`).toEqual([]);
      expect(situation.lines.map((l) => l.id)).toEqual(base.lines.map((l) => l.id));
      expect(situation.dialogue.map((n) => n.id)).toEqual(base.dialogue.map((n) => n.id));
    }
  });

  it("swaps the drink in every sentence that names it", () => {
    const cafe = SITUATIONS.find((s) => s.id === "cafe-order")!;
    // First slot picks option 1 ("a tea"); the others keep the original
    const picks = [0.3, 0, 0];
    let call = 0;
    const { situation } = fillSlots(cafe, () => picks[call++] ?? 0);
    const first = situation.lines.find((l) => l.id === "cafe-order.l1")!;
    expect(first.en).toBe("Can I have a tea, please?");
    expect(first.vi).toContain("trà");
    expect(first.accept.some((a) => /a tea/i.test(a))).toBe(true);
    expect(situation.lines.some((l) => /coffee/i.test(l.en))).toBe(false);
  });

  it("rewrites the other ways of saying a turn in the same way", () => {
    const cafe = SITUATIONS.find((s) => s.id === "cafe-order")!;
    const picks = [0, 0, 0.3];
    let call = 0;
    const { rewrite } = fillSlots(cafe, () => picks[call++] ?? 0);
    expect(rewrite("Five dollars, please.", "Năm đô nhé.").en).toBe("Six dollars, please.");
  });
});
