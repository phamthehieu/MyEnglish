import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelListening, finishListening, startListening } from "@/services/pronunciationCheck";

/** A stand-in for AsrBridge.kt on the page: records calls, answers `stop` with a result event */
function installBridge(options: { start?: boolean } = {}) {
  const bridge = {
    start: vi.fn(() => options.start ?? true),
    stop: vi.fn(() => {
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("myenglish-asr-result", { detail: JSON.stringify({ ok: true, text: "three", peak: 0.4 }) })
          ),
        0
      );
    }),
    cancel: vi.fn(),
  };
  (window as unknown as { AndroidASR: unknown }).AndroidASR = bridge;
  return bridge;
}

const endpoint = () => window.dispatchEvent(new CustomEvent("myenglish-asr-endpoint"));

describe("the microphone stops by itself", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cancelListening();
    delete (window as unknown as { AndroidASR?: unknown }).AndroidASR;
    vi.useRealTimers();
  });

  it("calls back once when the learner goes quiet, and not again", () => {
    installBridge();
    const onEnd = vi.fn();
    expect(startListening(onEnd)).toBe(true);
    endpoint();
    endpoint();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("does not listen for the end when the phone refused to record", () => {
    installBridge({ start: false });
    const onEnd = vi.fn();
    expect(startListening(onEnd)).toBe(false);
    endpoint();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("stops listening for the end once the learner finished by hand or cancelled", async () => {
    installBridge();
    const early = vi.fn();
    startListening(early);
    const result = finishListening(["three"]);
    await vi.runAllTimersAsync();
    await result;
    endpoint();
    expect(early).not.toHaveBeenCalled();

    const cancelled = vi.fn();
    startListening(cancelled);
    cancelListening();
    endpoint();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("a new recording replaces the previous watcher", () => {
    installBridge();
    const first = vi.fn();
    const second = vi.fn();
    startListening(first);
    startListening(second);
    endpoint();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("finishing twice (stop pressed as the phone also stopped) recognizes once and gives both the same answer", async () => {
    const bridge = installBridge();
    startListening();
    const a = finishListening(["three"]);
    const b = finishListening(["three"]);
    await vi.runAllTimersAsync();
    expect(await a).toEqual(await b);
    expect((await a).text).toBe("three");
    expect(bridge.stop).toHaveBeenCalledTimes(1);
  });
});
