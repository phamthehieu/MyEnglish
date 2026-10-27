import { describe, expect, it } from "vitest";
import { compareVersions, fetchAppUpdate, parseUpdateManifest, pickUpdate } from "@/services/appUpdate";

const good = { version: "0.3.6", apkUrl: "https://github.com/phamthehieu/MyEnglish/releases/download/v0.3.6/MyEnglish-v0.3.6.apk", notes: "Lộ trình nói B1" };

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
    expect(parseUpdateManifest(good)).toEqual(good);
    expect(parseUpdateManifest({ version: "0.3.6", apkUrl: good.apkUrl })?.notes).toBe("");
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
