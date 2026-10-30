import { describe, it, expect, afterEach } from "vitest";
import { createWebSpeechBridge, normalizeHeard, pickResult, similarity } from "@/services/webSpeechAsr";
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
