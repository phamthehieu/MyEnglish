import initSqlJs from "sql.js";
import type { SqlJsStatic } from "sql.js";
// The WebAssembly file is served with the app (no CDN: the web app must work offline)
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let loading: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  loading ??= initSqlJs({ locateFile: () => wasmUrl });
  return loading;
}
