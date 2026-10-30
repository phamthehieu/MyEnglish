import { isTauri } from "@/lib/platform";
import type { SqlDatabase } from "./types";

/** Raised when the web app is already open in another tab: two copies would overwrite each other's progress */
export class DatabaseInUseError extends Error {
  constructor() {
    super("MyEnglish đang mở ở một tab khác. Đóng tab đó rồi tải lại trang này.");
    this.name = "DatabaseInUseError";
  }
}

/** Hold the browser's lock on the database for as long as this page lives; false when another tab has it */
function holdTabLock(name: string): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    void locks.request(name, { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      // Never settles: the lock is released when the page goes away
      return lock ? new Promise<void>(() => {}) : undefined;
    });
  });
}

/**
 * The app's SQLite database: the Tauri plugin in the app (and in tests, where it is a node:sqlite stand-in), SQLite in
 * WebAssembly kept in IndexedDB in a browser. Same schema and queries on both.
 */
export async function openDatabase(path: string): Promise<SqlDatabase> {
  if (isTauri() || typeof indexedDB === "undefined") {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    return Database.load(path);
  }
  if (!(await holdTabLock(`myenglish-db:${path}`))) throw new DatabaseInUseError();
  const [{ WebDatabase, indexedDbStore }, { loadSqlJs }] = await Promise.all([import("./webDatabase"), import("./sqlJsLoader")]);
  return WebDatabase.open(path, await loadSqlJs(), indexedDbStore());
}
