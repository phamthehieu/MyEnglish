import { describe, expect, it } from "vitest";
import { SITUATIONS } from "@/data/situations";
import { validateSituation } from "@/services/talk/validate";

describe("built-in situations pass the validator", () => {
  for (const s of SITUATIONS) {
    it(s.id, () => {
      expect(validateSituation(s)).toEqual([]);
    });
  }
});
