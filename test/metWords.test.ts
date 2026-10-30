import { describe, it, expect, afterEach, vi } from "vitest";
import { preselected, splitMetText } from "@/services/metWords";
import { takeIncomingText } from "@/services/incomingText";

describe("words met in a shared text", () => {
  it("splits sentences and keeps only English words: no addresses, e-mails or numbers", () => {
    const s = splitMetText("Please review the deadlines before Friday. Send it to lan@corp.vn!\nDetails: https://x.com/a?b=1 — v2 2026");
    expect(s.map((x) => x.text)).toEqual(["Please review the deadlines before Friday.", "Send it to", "Details: — v2 2026"]);
    expect(s[0].words.map((w) => w.raw)).toEqual(["Please", "review", "the", "deadlines", "before", "Friday"]);
    expect(s[2].words.map((w) => w.raw)).toEqual(["Details", "v"]);
  });

  it("learns the base word, keeping apostrophes and hyphens inside words", () => {
    const [s] = splitMetText("Our team’s follow-up meetings were postponed.");
    expect(s.words.map((w) => w.raw)).toEqual(["Our", "team’s", "follow-up", "meetings", "were", "postponed"]);
    expect(s.words.find((w) => w.raw === "meetings")?.base).toBe("meeting");
  });

  it("picks the word itself when one word was shared, nothing when a sentence was", () => {
    expect(preselected(splitMetText("  Deadlines  "))).toEqual(["deadline"]);
    expect(preselected(splitMetText("Two words"))).toEqual([]);
    expect(splitMetText("12345 !!! https://a.b")).toEqual([]);
  });
});

describe("text coming into the app", () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).AndroidIncoming;
    vi.unstubAllGlobals();
  });

  it("takes the Android app's text once", () => {
    let waiting: string | null = "  deadline ";
    (window as unknown as Record<string, unknown>).AndroidIncoming = {
      take: () => {
        const t = waiting ?? "";
        waiting = null;
        return t;
      },
    };
    expect(takeIncomingText()).toBe("deadline");
    expect(takeIncomingText()).toBeNull();
  });

  it("takes the web app's shared text from its address, then clears the address", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("location", { search: "?title=Mail&text=Follow%20up%20on%20the%20invoice", pathname: "/MyEnglish/", hash: "" });
    vi.stubGlobal("history", { replaceState });
    // the module reads window.location / window.history
    Object.defineProperty(window, "location", { value: globalThis.location, configurable: true });
    Object.defineProperty(window, "history", { value: globalThis.history, configurable: true });
    expect(takeIncomingText()).toBe("Follow up on the invoice");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/MyEnglish/");
  });
});
