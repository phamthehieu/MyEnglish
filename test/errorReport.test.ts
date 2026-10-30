import { describe, it, expect, vi, beforeEach } from "vitest";
import { addToQueue, fingerprintOf, scrub, shouldIgnore, toQueued, type QueuedError } from "@/services/errorReport";

describe("error reports", () => {
  it("never carries an e-mail, a key, a token or an address's query", () => {
    const text = scrub(
      "Failed for lan.nguyen@congty.vn with AIzaSyA1234567890abcdefghijklmnop at https://api.x.com/v1/run?key=secret&u=2 " +
        "token gho_abcdefghijklmnopqrstuvwxyz123456 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuv bot 1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1"
    );
    expect(text).not.toMatch(/lan\.nguyen|AIzaSy|secret|gho_|eyJhbGci|AAHdqTcv/);
    expect(text).toContain("<email>");
    expect(text).toContain("https://api.x.com/v1/run");
  });

  it("gives the same error the same fingerprint across builds, and different errors different ones", () => {
    const a = fingerprintOf("Cannot read properties of undefined (reading 'id')", "TypeError: x\n    at loadWord (index-Ab12.js:120:33)");
    const b = fingerprintOf("Cannot read properties of undefined (reading 'id')", "TypeError: x\n    at loadWord (index-Ab12.js:987:5)");
    const c = fingerprintOf("Cannot read properties of undefined (reading 'id')", "TypeError: x\n    at saveWord (index-Ab12.js:120:33)");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(fingerprintOf("Word 12 missing")).toBe(fingerprintOf("Word 345 missing"));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("leaves out the browser's noise", () => {
    expect(shouldIgnore("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(shouldIgnore("Script error.")).toBe(true);
    expect(shouldIgnore("AbortError: The user aborted a request.")).toBe(true);
    expect(shouldIgnore("TypeError: x is undefined")).toBe(false);
    expect(toQueued(new Error("ResizeObserver loop limit exceeded"), "window")).toBeNull();
  });

  it("turns anything thrown into an entry: errors, strings, objects", () => {
    const fromError = toQueued(new TypeError("bad input"), "promise")!;
    expect(fromError.message).toBe("TypeError: bad input");
    expect(fromError.stack).toBeDefined();
    expect(fromError.context.where).toBe("promise");
    expect(fromError.context.version).toBeTruthy();
    expect(toQueued("plain text", "window")!.message).toBe("plain text");
    expect(toQueued({ code: 42 }, "promise")!.message).toBe('{"code":42}');
    expect(toQueued(new Error("x".repeat(2000)), "window")!.message.length).toBe(500);
  });

  it("counts an error already waiting instead of queueing it again, and keeps the newest 20", () => {
    const item = (n: number): QueuedError => ({ fingerprint: `f${n}`, message: `m${n}`, count: 1, context: { version: "t", platform: "web", where: "window" } });
    let queue = addToQueue([], item(1));
    queue = addToQueue(queue, item(1));
    queue = addToQueue(queue, item(1));
    expect(queue).toHaveLength(1);
    expect(queue[0].count).toBe(3);
    for (let i = 2; i <= 30; i++) queue = addToQueue(queue, item(i));
    expect(queue).toHaveLength(20);
    expect(queue[0].fingerprint).toBe("f11");
    expect(queue[19].fingerprint).toBe("f30");
  });
});

describe("sending error reports", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("sends the waiting errors once and empties the queue; keeps them when the network fails", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ error: null });
    vi.doMock("@/services/supabase", () => ({ getSupabase: () => ({ rpc }) }));
    vi.doMock("@/services/sync/state", () => ({ getDeviceId: async () => "device-1234" }));
    const report = await import("@/services/errorReport");
    report.recordError(new Error("boom"), "window");
    report.recordError(new Error("boom"), "window");

    await report.flushErrors(); // offline
    expect(JSON.parse(localStorage.getItem("myenglish_error_queue_v1")!)).toHaveLength(1);

    await report.flushErrors();
    expect(rpc).toHaveBeenLastCalledWith("report_errors", {
      p_device: "device-1234",
      p_items: [expect.objectContaining({ message: "boom", count: 2 })],
    });
    expect(localStorage.getItem("myenglish_error_queue_v1")).toBeNull();
    vi.doUnmock("@/services/supabase");
    vi.doUnmock("@/services/sync/state");
  });
});
