/**
 * Rewrites the Tauri plugin's `$1, $2` placeholders to positional `?` and orders the values to match (a number may
 * appear twice). SQLite takes no booleans or undefined: they become 0/1 and NULL, as the Tauri plugin stores them.
 */
export function bindParams(sql: string, params: unknown[] = []): { sql: string; args: unknown[] } {
  const args: unknown[] = [];
  const rewritten = sql.replace(/\$(\d+)/g, (_, n: string) => {
    const value = params[Number(n) - 1];
    args.push(value === undefined ? null : typeof value === "boolean" ? Number(value) : value);
    return "?";
  });
  return { sql: rewritten, args };
}
