import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stage } from "./stages";
import { getRoadmap } from "./state";

// The word bank lives in the app's database: the test gives its own
vi.mock("@/services/vocabFeed", () => ({ pullWordFromDeck: vi.fn() }));
import { addStageWords } from "./words";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true };
});

const stage = { id: "food", words: ["coffee", "tea", "xyzzy", "water", "bread"] } as unknown as Stage;

describe("adding the words of a stage", () => {
  it("adds the words the deck has, skips the others, and does it once", async () => {
    const pulled: string[] = [];
    const pull = async (word: string) => {
      pulled.push(word);
      return { status: word === "xyzzy" ? "not_in_deck" : word === "tea" ? "studied" : "added", word };
    };
    expect(await addStageWords(stage, { pull })).toBe(3);
    expect(getRoadmap().wordsAdded).toEqual(["food"]);
    expect(await addStageWords(stage, { pull })).toBe(0);
    expect(pulled).toHaveLength(5);
  });

  it("stops at the maximum", async () => {
    const pull = async (word: string) => ({ status: "added", word });
    expect(await addStageWords(stage, { pull, max: 2 })).toBe(2);
  });

  it("does not throw, and does not mark the stage, when the bank fails", async () => {
    const pull = async () => {
      throw new Error("no database");
    };
    expect(await addStageWords(stage, { pull })).toBe(0);
    expect(getRoadmap().wordsAdded).toEqual([]);
  });
});
