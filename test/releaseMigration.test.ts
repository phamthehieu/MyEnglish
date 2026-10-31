import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ensureReleaseMigrationV27", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("seeds the deck and the grammar book on a fresh install, and marks itself done", async () => {
    vi.resetModules();
    const { getDatabase } = await import("@/services/db");
    const { ensureReleaseMigrationV27, RELEASE_WIPE_VERSION_KEY, TARGET_RELEASE_WIPE_VERSION } = await import("@/services/releaseMigration");
    const db = await getDatabase();

    expect(await ensureReleaseMigrationV27()).toBe(true);

    expect(localStorage.getItem(RELEASE_WIPE_VERSION_KEY)).toBe(TARGET_RELEASE_WIPE_VERSION);
    const markerKv = await db.select<Array<{ value: string }>>(`SELECT value FROM app_kv WHERE key = $1;`, [RELEASE_WIPE_VERSION_KEY]);
    expect(markerKv[0]?.value).toBe(TARGET_RELEASE_WIPE_VERSION);
    const catalogWords = await db.select<Array<{ n: number }>>(`SELECT count(*) as n FROM vocab_catalog;`);
    expect(catalogWords[0]?.n).toBeGreaterThan(0);
    const grammarChs = await db.select<Array<{ n: number }>>(`SELECT count(*) as n FROM grammar_book_chapters;`);
    expect(grammarChs[0]?.n).toBe(31);
  });

  it("never wipes study data whose marker was lost (localStorage cleared, marker write failed)", async () => {
    vi.resetModules();
    const { getDatabase } = await import("@/services/db");
    const { ensureReleaseMigrationV27, RELEASE_WIPE_VERSION_KEY, TARGET_RELEASE_WIPE_VERSION } = await import("@/services/releaseMigration");
    const db = await getDatabase();
    await db.execute(`INSERT OR REPLACE INTO words (id, word, meaning_vn) VALUES ('studied', 'deploy', 'triển khai');`);
    await db.execute(`INSERT OR REPLACE INTO grammar_progress (lesson_id, mastery) VALUES ('ch01-l01', 90);`);
    localStorage.setItem("myenglish_xp_v1", "540");

    expect(await ensureReleaseMigrationV27()).toBe(false);

    expect(await db.select(`SELECT id FROM words WHERE id = 'studied';`)).toHaveLength(1);
    expect(await db.select(`SELECT lesson_id FROM grammar_progress;`)).toHaveLength(1);
    expect(localStorage.getItem("myenglish_xp_v1")).toBe("540");
    // Marked, so it is not looked at again
    expect(localStorage.getItem(RELEASE_WIPE_VERSION_KEY)).toBe(TARGET_RELEASE_WIPE_VERSION);
  });

  it("skips wiping and does nothing if version marker is already present", async () => {
    vi.resetModules();
    const { getDatabase } = await import("@/services/db");
    const { ensureReleaseMigrationV27, RELEASE_WIPE_VERSION_KEY, TARGET_RELEASE_WIPE_VERSION } = await import("@/services/releaseMigration");
    const db = await getDatabase();

    localStorage.setItem(RELEASE_WIPE_VERSION_KEY, TARGET_RELEASE_WIPE_VERSION);
    await db.execute(`INSERT OR REPLACE INTO app_kv (key, value) VALUES ($1, $2);`, [RELEASE_WIPE_VERSION_KEY, TARGET_RELEASE_WIPE_VERSION]);
    await db.execute(`INSERT OR REPLACE INTO words (id, word, meaning_vn) VALUES ('new_user_word', 'future', 'tương lai');`);

    expect(await ensureReleaseMigrationV27()).toBe(false);

    const words = await db.select<Array<{ id: string }>>(`SELECT id FROM words WHERE id = 'new_user_word';`);
    expect(words).toHaveLength(1);
  });
});
