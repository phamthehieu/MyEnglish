import { describe, it, expect, afterEach } from "vitest";
import { createWebSpeechBridge, joinSegments, normalizeHeard, pickResult, similarity } from "@/services/webSpeechAsr";
import { judge } from "@/services/pronunciationCheck";

const alt = (transcript: string, confidence = 0.9) => ({ transcript, confidence });

describe("speech recognition in the web app", () => {
  it("writes what the browser heard as the word lists are written", () => {
    expect(normalizeHeard("Three.")).toBe("three");
    expect(normalizeHeard("I’m fine, thank you!")).toBe("i'm fine thank you");
    expect(normalizeHeard("  Can I get a   COFFEE? ")).toBe("can i get a coffee");
  });

  it("takes the list's sentence the browser said, exactly or close enough", () => {
    const grammar = ["can i get a coffee", "can i get a tea", "[unk]"];
    expect(pickResult([alt("Can I get a coffee?")], grammar, true).text).toBe("can i get a coffee");
    // A second guess that matches beats a first one that does not
    expect(pickResult([alt("can I get a toffee"), alt("can I get a tea")], grammar, true).text).toBe("can i get a tea");
    // One word in five off is still that sentence
    expect(similarity("could i get a coffee", "can i get a coffee")).toBeCloseTo(0.8);
    expect(pickResult([alt("could I get a coffee")], grammar, true).text).toBe("can i get a coffee");
  });

  it("passes on what it heard when nothing in the list is close: the learner learns what came out", () => {
    const r = pickResult([alt("tree")], ["three", "free", "[unk]"], true);
    expect(r.text).toBe("tree");
    const verdict = judge("three", r);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('"tree"');
  });

  it("reads no guess as silence, or as unclear when a voice was noticed", () => {
    expect(judge("three", pickResult([], ["three"], false)).kind).toBe("silent");
    expect(judge("three", pickResult([], ["three"], true)).kind).toBe("unclear");
  });

  it("does not take Safari's missing confidence (0) for a weak word", () => {
    const r = pickResult([alt("three", 0)], ["three", "[unk]"], true);
    expect(r.words?.[0].conf).toBeGreaterThan(0.6);
    expect(judge("three", r, { level: "word" }).ok).toBe(true);
  });
});

describe("the web bridge, in the Android bridge's shape", () => {
  class FakeRecognition {
    static last: FakeRecognition | null = null;
    lang = "";
    continuous = true;
    interimResults = true;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onspeechstart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      FakeRecognition.last = this;
    }
    start() {}
    stop() {
      // the browser answers after stop, then ends
      const list = Object.assign([alt("Three!", 0.8), alt("tree", 0.4)], { isFinal: true });
      this.onresult?.({ resultIndex: 0, results: [list] });
      this.onend?.();
    }
    abort() {
      this.onerror?.({ error: "aborted" });
      this.onend?.();
    }
  }

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it("records, says when the voice stopped, and answers with the list's word", async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const events: Array<[string, string]> = [];
    const listen = (name: string) => window.addEventListener(name, (e) => events.push([name, String((e as CustomEvent).detail)]));
    ["myenglish-asr-endpoint", "myenglish-asr-result"].forEach(listen);

    const bridge = createWebSpeechBridge();
    expect(JSON.parse(bridge.status())).toMatchObject({ modelReady: true });
    expect(bridge.start()).toBe(true);
    expect(FakeRecognition.last).toMatchObject({ lang: "en-US", continuous: false, maxAlternatives: 5 });
    FakeRecognition.last!.onspeechstart?.();
    FakeRecognition.last!.onspeechend?.();
    bridge.stop(JSON.stringify(["three", "tree", "[unk]"]));

    expect(events.map(([n]) => n)).toEqual(["myenglish-asr-endpoint", "myenglish-asr-result"]);
    const result = JSON.parse(events[1][1]);
    expect(result).toMatchObject({ ok: true, text: "three" });
    expect(result.words[0]).toEqual({ word: "three", conf: 0.8 });
  });
});

describe("what the browser writes, read as the lessons are written", () => {
  it("writes numbers in words: \"3\" is \"three\", not a miss", () => {
    expect(normalizeHeard("3")).toBe("three");
    expect(normalizeHeard("2 coffees, please")).toBe("two coffees please");
    expect(normalizeHeard("Room 21")).toBe("room twenty one");
    expect(normalizeHeard("2026")).toBe("2026");
  });

  it("only takes the word of the list from the browser's best guesses", () => {
    const grammar = ["three", "tree", "free", "[unk]"];
    // The learner said "free"; "three" is only the browser's fourth idea
    const heard = pickResult([alt("free", 0.8), alt("frey", 0), alt("fri", 0), alt("three", 0)], grammar, true);
    expect(heard.text).toBe("free");
    // A lower guess with no confidence is a weak one
    const second = pickResult([alt("threw", 0.6), alt("three", 0)], grammar, true);
    expect(second.text).toBe("three");
    expect(second.words?.[0].conf).toBeLessThan(0.5);
  });

  it("puts a sentence heard in pieces back together", () => {
    const joined = joinSegments([[alt("I would like", 0.9)], [alt("a coffee", 0.7), alt("a copy", 0)]]);
    expect(joined.map((a) => a.transcript)).toEqual(["I would like a coffee", "I would like a copy"]);
    expect(joined[0].confidence).toBe(0.7);
    expect(joinSegments([[alt("hello", 0.9)]])).toEqual([alt("hello", 0.9)]);
  });
});
