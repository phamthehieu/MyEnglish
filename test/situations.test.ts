import { describe, it, expect } from "vitest";
import { SITUATIONS } from "@/data/situations";

/** A spoken sentence the check can listen for: letters, apostrophes and spaces once punctuation is dropped */
const SPEAKABLE = /^[a-z' ]+$/;
const spoken = (text: string) => text.toLowerCase().replace(/[.,?!]/g, "").trim();

describe("situation content", () => {
  it("has unique situation and line ids", () => {
    const ids = SITUATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lineIds = SITUATIONS.flatMap((s) => s.lines.map((l) => l.id));
    expect(new Set(lineIds).size).toBe(lineIds.length);
  });

  for (const s of SITUATIONS) {
    describe(s.id, () => {
      const lineIds = new Set(s.lines.map((l) => l.id));
      const nodeIds = new Set(s.dialogue.map((n) => n.id));

      it("prefixes its line ids with the situation id", () => {
        for (const l of s.lines) expect(l.id.startsWith(`${s.id}.`)).toBe(true);
      });

      it("keeps lines short and speakable, with Vietnamese", () => {
        for (const l of s.lines) {
          const words = spoken(l.en).split(/\s+/);
          expect(words.length, l.id).toBeGreaterThanOrEqual(2);
          expect(words.length, l.id).toBeLessThanOrEqual(10);
          expect(l.vi.trim(), l.id).not.toBe("");
          for (const text of [l.en, ...l.accept]) expect(spoken(text), `${l.id}: ${text}`).toMatch(SPEAKABLE);
        }
      });

      it("has no duplicate accepted wording inside a line", () => {
        for (const l of s.lines) {
          const all = [l.en, ...l.accept].map(spoken);
          expect(new Set(all).size, l.id).toBe(all.length);
        }
      });

      it("never gives one wording to two lines (the recognizer must tell them apart)", () => {
        const all = s.lines.flatMap((l) => [l.en, ...l.accept].map(spoken));
        const seen = new Map<string, string>();
        for (const l of s.lines) {
          for (const w of new Set([l.en, ...l.accept].map(spoken))) {
            expect(seen.get(w), `"${w}" is in ${seen.get(w)} and ${l.id}`).toBeUndefined();
            seen.set(w, l.id);
          }
        }
        expect(all.length).toBeGreaterThan(0);
      });

      it("has a partner, a goal and a first turn", () => {
        expect(s.partner_vi.trim()).not.toBe("");
        expect(s.partner_emoji.trim()).not.toBe("");
        expect(s.goal_vi.trim()).not.toBe("");
        expect(s.dialogue.length).toBeGreaterThan(0);
        for (const n of s.dialogue) {
          expect(n.npc_en.trim(), n.id).not.toBe("");
          expect(n.npc_vi.trim(), n.id).not.toBe("");
        }
      });

      it("only replies with its own lines, and only moves to nodes that exist", () => {
        for (const n of s.dialogue) {
          expect(n.replies.length, n.id).toBeGreaterThanOrEqual(1);
          expect(n.replies.length, n.id).toBeLessThanOrEqual(3);
          for (const r of n.replies) {
            expect(lineIds.has(r.lineId), `${n.id} -> ${r.lineId}`).toBe(true);
            if (r.next !== null) expect(nodeIds.has(r.next), `${n.id} -> ${r.next}`).toBe(true);
          }
        }
      });

      it("only moves forward, so a conversation always ends", () => {
        const order = new Map(s.dialogue.map((n, i) => [n.id, i]));
        for (const n of s.dialogue) {
          for (const r of n.replies) {
            if (r.next !== null) expect(order.get(r.next)!, `${n.id} -> ${r.next}`).toBeGreaterThan(order.get(n.id)!);
          }
        }
      });

      it("teaches every line it uses and uses every line it teaches", () => {
        const used = new Set(s.dialogue.flatMap((n) => n.replies.map((r) => r.lineId)));
        expect([...lineIds].filter((id) => !used.has(id))).toEqual([]);
      });
    });
  }
});
