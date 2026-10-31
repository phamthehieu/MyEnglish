import { create } from "zustand";

/**
 * The speech recognizer's model is not in the Android app (41 MB on every download and update): the first time
 * the learner speaks, the app asks to fetch it once (AsrBridge.downloadModel). This is the state of that sheet;
 * VoiceModelSheet shows it.
 */

type DownloadError = "space" | "network" | "corrupt";

interface VoiceModelState {
  /** ask: the sheet offers the download; downloading: in progress; failed: it stopped, `error` says why */
  phase: "idle" | "ask" | "downloading" | "failed";
  /** The sheet is on screen (a download can go on with the sheet put away) */
  open: boolean;
  received: number;
  total: number;
  error: DownloadError | null;
}

export const useVoiceModel = create<VoiceModelState>(() => ({
  phase: "idle",
  open: false,
  received: 0,
  total: 0,
  error: null,
}));

interface DownloadBridge {
  downloadModel(): void;
  cancelDownload(): void;
}

function bridge(): DownloadBridge | null {
  return (window as unknown as { AndroidASR?: DownloadBridge }).AndroidASR ?? null;
}

/** Callers of requestVoiceModel waiting for the model: true once it is loaded, false when the sheet is closed */
let waiting: ((ready: boolean) => void)[] = [];

function settle(ready: boolean): void {
  const callers = waiting;
  waiting = [];
  callers.forEach((resolve) => resolve(ready));
}

let listening = false;

function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener("myenglish-asr-download", (e) => {
    try {
      const { received, total } = JSON.parse(String((e as CustomEvent).detail)) as { received: number; total: number };
      if (useVoiceModel.getState().phase === "downloading") useVoiceModel.setState({ received, total });
    } catch {
      /* a malformed progress report: the next one will do */
    }
  });
  window.addEventListener("myenglish-asr-ready", (e) => {
    if (useVoiceModel.getState().phase !== "downloading") return;
    let answer: { ok: boolean; missing?: boolean; error?: string } = { ok: false };
    try {
      answer = JSON.parse(String((e as CustomEvent).detail)) as typeof answer;
    } catch {
      /* treated as a failure */
    }
    // prepare() answering "not on the phone yet" while the download runs: not the download's end
    if (answer.missing) return;
    if (answer.ok) {
      useVoiceModel.setState({ phase: "idle", open: false, error: null });
      settle(true);
    } else if (answer.error === "cancelled") {
      useVoiceModel.setState({ phase: "ask", received: 0 });
    } else {
      const error: DownloadError = answer.error === "space" || answer.error === "corrupt" ? answer.error : "network";
      useVoiceModel.setState({ phase: "failed", error, open: true });
    }
  });
}

/** The learner said "Để sau": a microphone that switches itself on (a new word's card) does not ask again */
let declined = false;

/**
 * Show the sheet; resolves true once the model is on the phone and loaded, false when the learner closes it.
 * A download already running (`downloading`) is shown with its progress instead of the offer. `automatic`:
 * nobody pressed the microphone, so an offer already declined is not made again.
 */
export function requestVoiceModel(totalBytes: number, downloading = false, automatic = false): Promise<boolean> {
  listen();
  const state = useVoiceModel.getState();
  if (automatic && (declined || (state.phase === "downloading" && !state.open))) return Promise.resolve(false);
  if (downloading || state.phase === "downloading") {
    useVoiceModel.setState({ phase: "downloading", open: true, total: state.total || totalBytes });
  } else {
    useVoiceModel.setState({ phase: "ask", open: true, received: 0, total: totalBytes, error: null });
  }
  return new Promise((resolve) => waiting.push(resolve));
}

export function startVoiceModelDownload(): void {
  const android = bridge();
  if (!android) return;
  listen();
  useVoiceModel.setState({ phase: "downloading", received: 0, error: null });
  android.downloadModel();
}

export function cancelVoiceModelDownload(): void {
  bridge()?.cancelDownload();
}

/** Put the sheet away. A download keeps going; the learner's attempt to speak ends here */
export function closeVoiceModelSheet(): void {
  const { phase } = useVoiceModel.getState();
  if (phase !== "downloading") declined = true;
  useVoiceModel.setState({ open: false, phase: phase === "downloading" ? "downloading" : "idle" });
  settle(false);
}

/** "41 MB" */
export function megabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

/** Test hook */
export function resetVoiceModelForTests(): void {
  settle(false);
  declined = false;
  useVoiceModel.setState({ phase: "idle", open: false, received: 0, total: 0, error: null });
}
