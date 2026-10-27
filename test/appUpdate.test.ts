import { describe, expect, it } from "vitest";
import { compareVersions, fetchAppUpdate, IDLE_UPDATE, nextUpdateState, parseUpdateManifest, pickUpdate } from "@/services/appUpdate";

const good = { version: "0.3.6", apkUrl: "https://github.com/phamthehieu/MyEnglish/releases/download/v0.3.6/MyEnglish-v0.3.6.apk", notes: "Lộ trình nói B1" };
const hash = "a".repeat(64);

const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("versions", () => {
  it("compare by number, not by text", () => {
    expect(compareVersions("0.3.10", "0.3.9")).toBeGreaterThan(0);
    expect(compareVersions("0.4.0", "0.3.99")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.3.5", "0.3.5")).toBe(0);
    expect(compareVersions("0.3.4", "0.3.5")).toBeLessThan(0);
  });
});

describe("the published update file", () => {
  it("is read when it is complete", () => {
    expect(parseUpdateManifest(good)).toEqual({ ...good, sha256: "" });
    expect(parseUpdateManifest({ version: "0.3.6", apkUrl: good.apkUrl })?.notes).toBe("");
  });

  it("carries the hash of the APK, which must be a real one when given", () => {
    expect(parseUpdateManifest({ ...good, sha256: hash.toUpperCase() })?.sha256).toBe(hash);
    expect(parseUpdateManifest({ ...good, sha256: "abc" })).toBeNull();
    expect(parseUpdateManifest({ ...good, sha256: "g".repeat(64) })).toBeNull();
    expect(parseUpdateManifest({ ...good, sha256: 123 })).toBeNull();
  });

  it("is refused when something is missing or unsafe", () => {
    expect(parseUpdateManifest(null)).toBeNull();
    expect(parseUpdateManifest("0.3.6")).toBeNull();
    expect(parseUpdateManifest({ ...good, version: "v0.3.6" })).toBeNull();
    expect(parseUpdateManifest({ ...good, version: "0.3" })).toBeNull();
    expect(parseUpdateManifest({ ...good, apkUrl: "http://example.com/a.apk" })).toBeNull();
    expect(parseUpdateManifest({ ...good, apkUrl: "javascript:alert(1)" })).toBeNull();
    expect(parseUpdateManifest({ ...good, apkUrl: "not a url" })).toBeNull();
    expect(parseUpdateManifest({ version: "0.3.6" })).toBeNull();
  });

  it("keeps the notes short", () => {
    expect(parseUpdateManifest({ ...good, notes: "x".repeat(900) })?.notes).toHaveLength(400);
  });
});

describe("the update in progress", () => {
  it("goes from the button to the download, the installer and the end", () => {
    let s = nextUpdateState(IDLE_UPDATE, { type: "start" });
    expect(s).toEqual({ phase: "downloading", percent: 0, message: "" });
    s = nextUpdateState(s, { type: "progress", percent: 42.4 });
    expect(s.percent).toBe(42);
    s = nextUpdateState(s, { type: "progress", percent: 250 });
    expect(s.percent).toBe(100);
    s = nextUpdateState(s, { type: "downloaded" });
    expect(s.phase).toBe("installing");
    expect(nextUpdateState(s, { type: "reset" })).toEqual(IDLE_UPDATE);
  });

  it("ignores a progress that comes after the end, and keeps the message of an error", () => {
    const installing = nextUpdateState(IDLE_UPDATE, { type: "downloaded" });
    expect(nextUpdateState(installing, { type: "progress", percent: 10 })).toBe(installing);
    const failed = nextUpdateState(nextUpdateState(IDLE_UPDATE, { type: "start" }), { type: "error", message: "Không tải được" });
    expect(failed).toEqual({ phase: "error", percent: 0, message: "Không tải được" });
    expect(nextUpdateState(failed, { type: "start" }).phase).toBe("downloading");
  });

  it("asks for the permission to install first", () => {
    expect(nextUpdateState(IDLE_UPDATE, { type: "needs-permission" }).phase).toBe("permission");
  });
});

describe("offering the update", () => {
  it("only when the file names a newer version than the one running", () => {
    expect(pickUpdate("0.3.5", good)?.version).toBe("0.3.6");
    expect(pickUpdate("0.3.6", good)).toBeNull();
    expect(pickUpdate("0.4.0", good)).toBeNull();
    expect(pickUpdate("dev", good)).toBeNull();
  });

  it("reads the file from the network, and is quiet when there is nothing or it cannot be read", async () => {
    expect((await fetchAppUpdate("0.3.5", reply(good)))?.apkUrl).toBe(good.apkUrl);
    expect(await fetchAppUpdate("0.3.6", reply(good))).toBeNull();
    expect(await fetchAppUpdate("0.3.5", reply({}, false))).toBeNull();
    expect(await fetchAppUpdate("0.3.5", reply({ nonsense: true }))).toBeNull();
    const offline = (async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchAppUpdate("0.3.5", offline)).toBeNull();
  });
});
