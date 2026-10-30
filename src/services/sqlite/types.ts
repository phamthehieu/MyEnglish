/**
 * The SQLite connection the services use: the calls of @tauri-apps/plugin-sql that the app needs, so the same
 * services, schema and queries run on the app's SQLite (Tauri) and on SQLite in WebAssembly (a browser).
 * Parameters are written $1, $2... as with the Tauri plugin.
 */
export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface SqlDatabase {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  close(): Promise<boolean>;
}
