import { describe, it, expect, afterEach, vi } from "vitest";
import { handleSpeak, SPEAK_EVENT, stopSpeaking, waitForSpeechToEnd } from "@/components/review/speech";

/** The Android engine (TtsBridge.kt): it reports the start and the end of each reading as window events */
function fakeTts() {
  const spoken: string[] = [];
  (window as unknown as { AndroidTTS: unknown }).AndroidTTS = {
    isReady: () => true,
    voices: () => "[]",
    speak: (text: string) => spoken.push(text),
    stop: () => {},
  };
  return { spoken, fire: (name: string) => window.dispatchEvent(new Event(name)) };
}

afterEach(() => {
  vi.useRealTimers();
  stopSpeaking();
  delete (window as unknown as { AndroidTTS?: unknown }).AndroidTTS;
});

describe("waiting for the word to be read before listening", () => {
  it("waits for the engine to finish", async () => {
    vi.useFakeTimers();
    const { fire } = fakeTts();
    handleSpeak("three");
    fire("myenglish-tts-start");
    let over = false;
    void waitForSpeechToEnd().then(() => (over = true));
    await vi.advanceTimersByTimeAsync(3000);
    expect(over).toBe(false);
    fire("myenglish-tts-end");
    await vi.advanceTimersByTimeAsync(400);
    expect(over).toBe(true);
  });

  it("does not wait long for an engine that never starts", async () => {
    vi.useFakeTimers();
    fakeTts();
    handleSpeak("three");
    let over = false;
    void waitForSpeechToEnd().then(() => (over = true));
    await vi.advanceTimersByTimeAsync(2000);
    expect(over).toBe(true);
  });

  it("tells a listening microphone that something is read aloud", () => {
    fakeTts();
    const heard = vi.fn();
    window.addEventListener(SPEAK_EVENT, heard);
    handleSpeak("three");
    window.removeEventListener(SPEAK_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
