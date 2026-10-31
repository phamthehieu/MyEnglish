import { describe, expect, it } from "vitest";
import path from "node:path";
import initSqlJs from "sql.js";
import { STORAGE_FAILED_EVENT, STORAGE_SAVED_EVENT, WebDatabase, type ByteStore } from "@/services/sqlite/webDatabase";
import { initSchema } from "@/services/db";

const sqlJs = () => initSqlJs({ locateFile: (f: string) => path.resolve(__dirname, "../node_modules/sql.js/dist", f) });

function memoryStore(): ByteStore & { files: Map<string, Uint8Array>; saves: number } {
  const files = new Map<string, Uint8Array>();
  const store = {
    files,
    saves: 0,
    load: async (key: string) => files.get(key) ?? null,
    save: async (key: string, bytes: Uint8Array) => {
      store.saves++;
      files.set(key, bytes);
    },
  };
  return store;
}

describe("the web database (SQLite in WebAssembly)", () => {
  it("runs the app's real schema and keeps the data across a reopen", async () => {
    const SQL = await sqlJs();
    const store = memoryStore();
    const db = await WebDatabase.open("sqlite:test.db", SQL, store);
    await initSchema(db);
    const res = await db.execute("INSERT INTO words (word, meaning_vn) VALUES ($1, $2)", ["deadline", "hạn chót"]);
    expect(res.rowsAffected).toBe(1);
    expect(res.lastInsertId).toBeGreaterThan(0);
    await db.close();

    const again = await WebDatabase.open("sqlite:test.db", SQL, store);
    const rows = await again.select<{ word: string; meaning_vn: string }[]>("SELECT word, meaning_vn FROM words WHERE word = $1", ["deadline"]);
    expect(rows).toEqual([{ word: "deadline", meaning_vn: "hạn chót" }]);
    const [{ user_version }] = await again.select<{ user_version: number }[]>("PRAGMA user_version;");
    expect(user_version).toBeGreaterThan(0);
  });

  it("keeps foreign keys on after writing the file (writing reopens the database)", async () => {
    const SQL = await sqlJs();
    const db = await WebDatabase.open("sqlite:fk.db", SQL, memoryStore());
    await db.execute("PRAGMA foreign_keys = ON;");
    await db.execute("CREATE TABLE a (id INTEGER PRIMARY KEY)");
    await db.flush();
    const [{ foreign_keys }] = await db.select<{ foreign_keys: number }[]>("PRAGMA foreign_keys;");
    expect(foreign_keys).toBe(1);
  });

  it("binds $n like the Tauri plugin: reused numbers, booleans, undefined", async () => {
    const SQL = await sqlJs();
    const db = await WebDatabase.open("sqlite:bind.db", SQL, memoryStore());
    await db.execute("CREATE TABLE t (a TEXT, b TEXT, flag INTEGER, missing TEXT)");
    await db.execute("INSERT INTO t VALUES ($1, $1, $2, $3)", ["x", true, undefined]);
    expect(await db.select("SELECT * FROM t")).toEqual([{ a: "x", b: "x", flag: 1, missing: null }]);
  });

  it("writes the file once for a burst of changes", async () => {
    const SQL = await sqlJs();
    const store = memoryStore();
    const db = await WebDatabase.open("sqlite:burst.db", SQL, store);
    await db.execute("CREATE TABLE t (n INTEGER)");
    for (let i = 0; i < 20; i++) await db.execute("INSERT INTO t VALUES ($1)", [i]);
    await db.flush();
    expect(store.saves).toBe(1);
    await db.flush();
    expect(store.saves).toBe(1);
  });

  it("keeps saving after a write fails, and writes the changes the failed write lost", async () => {
    const SQL = await sqlJs();
    const store = memoryStore();
    let broken = true;
    const flaky: ByteStore = {
      load: store.load,
      save: async (key, bytes) => {
        if (broken) throw new Error("Connection to Indexed Database server lost");
        await store.save(key, bytes);
      },
    };
    const db = await WebDatabase.open("sqlite:flaky.db", SQL, flaky);
    await db.execute("CREATE TABLE t (n INTEGER)");
    await db.execute("INSERT INTO t VALUES (1)");
    await expect(db.flush()).rejects.toThrow();
    expect(store.files.has("sqlite:flaky.db")).toBe(false);

    broken = false;
    await db.execute("INSERT INTO t VALUES (2)");
    await db.flush();
    const again = await WebDatabase.open("sqlite:flaky.db", SQL, store);
    expect(await again.select("SELECT n FROM t ORDER BY n")).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("tells the page after repeated failures, and again once a write succeeds", async () => {
    const SQL = await sqlJs();
    const store = memoryStore();
    let broken = true;
    const flaky: ByteStore = {
      load: store.load,
      save: async (key, bytes) => {
        if (broken) throw new Error("QuotaExceededError");
        await store.save(key, bytes);
      },
    };
    const events: string[] = [];
    const record = (e: Event) => events.push(e.type);
    window.addEventListener(STORAGE_FAILED_EVENT, record);
    window.addEventListener(STORAGE_SAVED_EVENT, record);
    try {
      const db = await WebDatabase.open("sqlite:warn.db", SQL, flaky);
      for (let i = 0; i < 3; i++) {
        await db.execute("INSERT INTO t2 VALUES (1)").catch(() => db.execute("CREATE TABLE t2 (n INTEGER)"));
        await db.flush().catch(() => {});
      }
      expect(events).toEqual([STORAGE_FAILED_EVENT]);
      broken = false;
      await db.flush();
      expect(events).toEqual([STORAGE_FAILED_EVENT, STORAGE_SAVED_EVENT]);
      await db.close();
    } finally {
      window.removeEventListener(STORAGE_FAILED_EVENT, record);
      window.removeEventListener(STORAGE_SAVED_EVENT, record);
    }
  });
});
