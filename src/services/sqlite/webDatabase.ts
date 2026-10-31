import type { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from "sql.js";
import { bindParams } from "./bind";
import type { QueryResult, SqlDatabase } from "./types";

/** Where the database file's bytes are kept between visits (IndexedDB in a browser, memory in tests) */
export interface ByteStore {
  load(key: string): Promise<Uint8Array | null>;
  save(key: string, bytes: Uint8Array): Promise<void>;
}

const SAVE_DELAY_MS = 400;
const FAILURES_BEFORE_WARNING = 3;

/** Fired on window when the study data could not be written several times in a row, and when it is written again */
export const STORAGE_FAILED_EVENT = "myenglish-storage-failed";
export const STORAGE_SAVED_EVENT = "myenglish-storage-saved";

function dispatch(name: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

/**
 * SQLite in WebAssembly (sql.js) for the browser: the whole database lives in memory and its file is written to a
 * ByteStore shortly after each change, and at once when the page is hidden or closed.
 */
export class WebDatabase implements SqlDatabase {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();
  /** Writes that failed in a row */
  private failures = 0;
  /** Connection settings (foreign_keys...): writing the file reopens the database, which forgets them */
  private pragmas = new Map<string, string>();

  private constructor(
    private db: SqlJsDatabase,
    private readonly key: string,
    private readonly store: ByteStore
  ) {}

  static async open(key: string, sql: SqlJsStatic, store: ByteStore): Promise<WebDatabase> {
    const bytes = await store.load(key);
    const web = new WebDatabase(new sql.Database(bytes ?? undefined), key, store);
    // The last changes must not wait for the timer when the learner leaves
    const flushNow = () => void web.flush().catch(() => {});
    if (typeof window !== "undefined") window.addEventListener("pagehide", flushNow);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushNow());
    }
    return web;
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (params.length === 0 && !/\$\d+/.test(sql)) {
      this.db.exec(sql);
    } else {
      const { sql: q, args } = bindParams(sql, params);
      this.db.run(q, args as SqlValue[]);
    }
    const rowsAffected = this.db.getRowsModified();
    const lastInsertId = Number(this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] ?? 0);
    this.rememberPragma(sql);
    this.scheduleSave();
    return { rowsAffected, lastInsertId };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    const { sql: q, args } = bindParams(sql, params);
    const stmt = this.db.prepare(q);
    try {
      stmt.bind(args as SqlValue[]);
      const rows: Record<string, SqlValue>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }

  async close(): Promise<boolean> {
    await this.flush();
    this.db.close();
    return true;
  }

  /**
   * Write the file now if anything changed since it was last written. A write that fails (storage full, Safari
   * losing its IndexedDB connection) leaves the changes marked unsaved and is tried again; the writes after it
   * still run. After a few failures in a row the page is told (STORAGE_FAILED_EVENT).
   */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    // One write at a time, in order; a failed one does not stop those after it
    const write = this.saving
      .catch(() => {})
      .then(async () => {
        if (!this.dirty) return;
        this.dirty = false;
        const bytes = this.db.export();
        this.replayPragmas();
        try {
          await this.store.save(this.key, bytes);
          if (this.failures > 0) {
            this.failures = 0;
            dispatch(STORAGE_SAVED_EVENT);
          }
        } catch (err) {
          this.dirty = true;
          this.failures += 1;
          if (this.failures === FAILURES_BEFORE_WARNING) dispatch(STORAGE_FAILED_EVENT);
          clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.flush().catch(() => {}), Math.min(30_000, 1000 * 2 ** this.failures));
          throw err;
        }
      });
    this.saving = write;
    return write;
  }

  private scheduleSave(): void {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush().catch(() => {}), SAVE_DELAY_MS);
  }

  private rememberPragma(sql: string): void {
    const m = /^\s*PRAGMA\s+(foreign_keys|synchronous|busy_timeout)\s*=\s*([^;]+);?\s*$/i.exec(sql);
    if (m) this.pragmas.set(m[1].toLowerCase(), m[2].trim());
  }

  private replayPragmas(): void {
    for (const [name, value] of this.pragmas) this.db.exec(`PRAGMA ${name} = ${value};`);
  }
}

/** IndexedDB as the ByteStore: one object store holding each database file's bytes under its name */
export function indexedDbStore(dbName = "myenglish-sqlite", storeName = "files"): ByteStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const idb = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = idb.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        // A write counts once its transaction has committed, not when the request succeeds
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      idb.close();
    }
  };
  return {
    load: async (key) => {
      const value = await run<unknown>("readonly", (s) => s.get(key));
      return value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null;
    },
    save: async (key, bytes) => {
      await run("readwrite", (s) => s.put(bytes, key));
    },
  };
}
