import { describe, it, expect, afterEach } from "vitest";
import { prepareListening } from "@/services/pronunciationCheck";
import {
  closeVoiceModelSheet,
  megabytes,
  resetVoiceModelForTests,
  startVoiceModelDownload,
  useVoiceModel,
} from "@/services/voiceModel";

/** A stand-in for AsrBridge.kt: the model is not on the phone until downloadModel() is called and finishes */
function fakeAndroid({ onPhone = false, downloading = false } = {}) {
  const calls: string[] = [];
  const fire = (event: string, detail: unknown) =>
    window.dispatchEvent(new CustomEvent(event, { detail: typeof detail === "string" ? detail : JSON.stringify(detail) }));
  let ready = false;
  const asr = {
    status: () => JSON.stringify({ permission: true, modelReady: ready, downloading, downloadBytes: 41_205_931 }),
    requestPermission: () => fire("myenglish-asr-permission", "true"),
    prepare: () => {
      calls.push("prepare");
      setTimeout(() => {
        if (onPhone) {
          ready = true;
          fire("myenglish-asr-ready", { ok: true });
        } else fire("myenglish-asr-ready", { ok: false, missing: true, error: "missing" });
      }, 0);
    },
    downloadModel: () => calls.push("download"),
    cancelDownload: () => calls.push("cancel"),
    knownWords: (w: string) => w,
    start: () => true,
    stop: () => {},
    cancel: () => {},
    playLast: () => {},
  };
  (window as unknown as { AndroidASR: unknown }).AndroidASR = asr;
  const finish = (detail: unknown) => {
    ready = (detail as { ok: boolean }).ok;
    fire("myenglish-asr-ready", detail);
  };
  return { calls, fire, finish };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

afterEach(() => {
  delete (window as unknown as { AndroidASR?: unknown }).AndroidASR;
  resetVoiceModelForTests();
});

describe("downloading the speech model on first use", () => {
  it("loads a model already on the phone without asking (learners who updated from 0.4.1)", async () => {
    const { calls } = fakeAndroid({ onPhone: true });
    expect(await prepareListening()).toBeNull();
    expect(calls).toEqual(["prepare"]);
    expect(useVoiceModel.getState().open).toBe(false);
  });

  it("offers the download, then lets the learner speak once the model is loaded", async () => {
    const { calls, fire, finish } = fakeAndroid();
    const result = prepareListening();
    await tick();
    expect(useVoiceModel.getState()).toMatchObject({ open: true, phase: "ask", total: 41_205_931 });

    startVoiceModelDownload();
    expect(calls).toContain("download");
    fire("myenglish-asr-download", { received: 20_000_000, total: 41_205_931 });
    expect(useVoiceModel.getState()).toMatchObject({ phase: "downloading", received: 20_000_000 });

    finish({ ok: true });
    expect(await result).toBeNull();
    expect(useVoiceModel.getState()).toMatchObject({ open: false, phase: "idle" });
  });

  it("gives up quietly when the learner says not now", async () => {
    const { calls } = fakeAndroid();
    const result = prepareListening();
    await tick();
    closeVoiceModelSheet();
    expect(await result).toBe("declined");
    expect(calls).not.toContain("download");
    expect(useVoiceModel.getState().open).toBe(false);
  });

  it("says why a download failed and offers it again", async () => {
    const { finish } = fakeAndroid();
    void prepareListening();
    await tick();
    startVoiceModelDownload();
    finish({ ok: false, error: "space" });
    expect(useVoiceModel.getState()).toMatchObject({ phase: "failed", error: "space", open: true });

    finish({ ok: false, error: "network" }); // not downloading any more: ignored
    expect(useVoiceModel.getState().error).toBe("space");
  });

  it("goes back to the offer after the learner stops the download", async () => {
    const { finish } = fakeAndroid();
    void prepareListening();
    await tick();
    startVoiceModelDownload();
    finish({ ok: false, error: "cancelled" });
    expect(useVoiceModel.getState()).toMatchObject({ phase: "ask", open: true });
  });

  it("keeps downloading with the sheet put away, and shows the progress when the learner tries again", async () => {
    const { finish } = fakeAndroid();
    const first = prepareListening();
    await tick();
    startVoiceModelDownload();
    closeVoiceModelSheet();
    expect(await first).toBe("declined");
    expect(useVoiceModel.getState()).toMatchObject({ open: false, phase: "downloading" });

    const again = prepareListening();
    await tick();
    expect(useVoiceModel.getState()).toMatchObject({ open: true, phase: "downloading" });
    finish({ ok: true });
    expect(await again).toBeNull();
  });

  it("does not offer a declined download again when the microphone switches itself on", async () => {
    fakeAndroid();
    const first = prepareListening();
    await tick();
    closeVoiceModelSheet();
    expect(await first).toBe("declined");

    expect(await prepareListening({ automatic: true })).toBe("declined");
    expect(useVoiceModel.getState().open).toBe(false);

    // Pressing the microphone asks again
    void prepareListening();
    await tick();
    expect(useVoiceModel.getState()).toMatchObject({ open: true, phase: "ask" });
  });

  it("writes sizes in megabytes", () => {
    expect(megabytes(41_205_931)).toBe("41 MB");
    expect(megabytes(0)).toBe("1 MB");
  });
});
