import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let configured = true;
vi.mock("@/services/supabase", () => ({
  getSupabase: () => (configured ? { rpc } : null),
  isCloudConfigured: () => configured,
}));
vi.mock("@/services/sync/state", () => ({ getDeviceId: async () => "device-1234" }));
vi.mock("@/services/vocabFeed", () => ({ getStudyLevels: () => ["A2", "B1"] }));

import { checkFeedback, FEEDBACK_MAX, feedbackErrorText, platformName, sendFeedback } from "@/services/feedback";

beforeEach(() => {
  rpc.mockReset();
  configured = true;
});

describe("checkFeedback", () => {
  it("trims the message and drops an empty contact", () => {
    expect(checkFeedback({ kind: "bug", message: "  Nút Gửi không chạy  ", contact: "   " })).toEqual({
      ok: true,
      message: "Nút Gửi không chạy",
      contact: null,
    });
  });

  it("refuses an empty or too long message, and a too long contact", () => {
    expect(checkFeedback({ kind: "idea", message: " \n " }).ok).toBe(false);
    expect(checkFeedback({ kind: "idea", message: "a".repeat(FEEDBACK_MAX + 1) }).ok).toBe(false);
    expect(checkFeedback({ kind: "idea", message: "a".repeat(FEEDBACK_MAX) }).ok).toBe(true);
    expect(checkFeedback({ kind: "idea", message: "ok", contact: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("platformName", () => {
  it("names the platform from the user agent", () => {
    expect(platformName("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36")).toBe("Android");
    expect(platformName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0")).toBe("Windows");
    expect(platformName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("macOS");
    expect(platformName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iOS");
  });
});

describe("feedbackErrorText", () => {
  it("tells the daily limit and a busy server apart from a network failure", () => {
    expect(feedbackErrorText("feedback_limit")).toContain("mai gửi tiếp");
    expect(feedbackErrorText("feedback_busy")).toContain("bận");
    expect(feedbackErrorText("TypeError: Failed to fetch")).toContain("kiểm tra mạng");
  });
});

describe("sendFeedback", () => {
  it("calls send_feedback with the trimmed fields and the context, no study data", async () => {
    rpc.mockResolvedValue({ error: null });
    await sendFeedback({ kind: "content", message: " Câu ví dụ sai ", contact: "zalo 0901" });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("send_feedback");
    expect(args).toMatchObject({ p_device: "device-1234", p_kind: "content", p_message: "Câu ví dụ sai", p_contact: "zalo 0901" });
    expect(Object.keys(args.p_context).sort()).toEqual(["levels", "platform", "version"]);
    expect(args.p_context.levels).toBe("A2, B1");
  });

  it("does not call the server for an invalid form", async () => {
    await expect(sendFeedback({ kind: "bug", message: "   " })).rejects.toThrow("vài dòng");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns server and network errors into a message for the learner", async () => {
    rpc.mockResolvedValue({ error: { message: "feedback_limit" } });
    await expect(sendFeedback({ kind: "bug", message: "x" })).rejects.toThrow("mai gửi tiếp");
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendFeedback({ kind: "bug", message: "x" })).rejects.toThrow("kiểm tra mạng");
  });

  it("says so when the build has no server", async () => {
    configured = false;
    await expect(sendFeedback({ kind: "bug", message: "x" })).rejects.toThrow("chưa kết nối máy chủ");
  });
});
