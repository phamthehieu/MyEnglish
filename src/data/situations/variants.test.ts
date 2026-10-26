import { describe, expect, it } from "vitest";
import { SITUATIONS } from ".";
import { NODE_VARIANTS } from "./variants";

describe("partner variants", () => {
  it("every key names a real turn of a built-in conversation", () => {
    for (const key of Object.keys(NODE_VARIANTS)) {
      const [situationId, nodeId] = key.split(".");
      const situation = SITUATIONS.find((s) => s.id === situationId);
      expect(situation, key).toBeDefined();
      expect(situation!.dialogue.some((n) => n.id === nodeId), key).toBe(true);
    }
  });

  it("each variant is a short plain English sentence with a Vietnamese meaning", () => {
    for (const [key, list] of Object.entries(NODE_VARIANTS)) {
      for (const v of list) {
        expect(v.en.trim(), key).toMatch(/^[A-Za-z’' ,.?!]+$/);
        expect(v.en.split(/\s+/).length, key).toBeLessThanOrEqual(14);
        expect(v.vi.trim().length, key).toBeGreaterThan(0);
      }
    }
  });
});
