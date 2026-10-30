/**
 * Machines and a server for the sync tests. A machine runs the app's services on a fresh database: the Tauri
 * plugin's SQLite (node:sqlite here, as in the phone and desktop apps) or SQLite in WebAssembly (sql.js, as in the
 * web app), so a phone and a browser can be made to sync with each other.
 */
import { vi } from "vitest";
import path from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { Rating } from "ts-fsrs";
import type { CatalogEntry } from "@/services/vocabCatalog";
import type { PulledRow, SyncRow, SyncTransport, XpRow } from "@/services/sync/types";
import { BASE_DAY } from "@/services/sync/xpLedger";
import { WebDatabase, type ByteStore } from "@/services/sqlite/webDatabase";
import { freshServices } from "./helpers";

function entry(word: string, order: number): CatalogEntry {
  return {
    id: word, word, cefr: "A1", list: 3000, order, freq: order, it: false, pos: "noun", vn: `nghĩa của ${word}`,
    senses: [{ pos: "noun", vn: `nghĩa của ${word}` }], ipaUs: [`/${word}/`], ipaUk: [`/${word}/`],
    variants: [], irregular: [],
    examples: [{ en: `I see the ${word} here.`, vi: "Tôi thấy nó.", focus: [word], senseIndex: 0 }],
  };
}
export const DECK = ["apple", "banana", "cherry", "date"].map((w, i) => entry(w, i + 1));

/** Progress of a row as the server derives it: the review count of cards, lessons and mistakes */
const progOf = (r: { kind: string; data: Record<string, unknown> }) =>
  ["card", "grammar", "mistake"].includes(r.kind) ? Number(r.data.reps ?? 0) : 0;

/** The server side of the account: more progress wins, the later `ts` breaks a tie; logs and events only added */
export function fakeServer() {
  const rows = new Map<string, PulledRow>();
  const xp = new Map<string, XpRow>();
  const profiles: Array<{ level: number; streak: number }> = [];
  let clock = 0;
  const pushed: SyncRow[] = [];
  const xpSince: Array<string | null | undefined> = [];
  const server = { epoch: 0 };
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString();
  const transport = (): SyncTransport => ({
    async push(batch) {
      for (const r of batch) {
        pushed.push(r);
        const id = `${r.kind}|${r.key}`;
        const cur = rows.get(id);
        if (cur && (r.kind === "log" || r.kind === "event")) continue;
        if (cur && (progOf(cur) > progOf(r) || (progOf(cur) === progOf(r) && cur.ts >= r.ts))) continue;
        rows.set(id, { ...r, updated_at: stamp() });
      }
    },
    async pull(since, limit) {
      return [...rows.values()].filter((r) => r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit);
    },
    async pushXp(batch) {
      for (const r of batch) {
        const id = `${r.device_id}|${r.day}`;
        const cur = xp.get(id);
        if (r.day === BASE_DAY && cur) continue;
        xp.set(id, { ...r, xp: Math.max(r.xp, cur?.xp ?? 0), updated_at: stamp() } as XpRow);
      }
    },
    async pullXp(since) {
      xpSince.push(since);
      const all = [...xp.values()] as Array<XpRow & { updated_at: string }>;
      return since ? all.filter((r) => r.updated_at > since) : all;
    },
    async pushProfile(s) {
      profiles.push(s);
    },
    async getEpoch() {
      return server.epoch;
    },
  });
  return { rows, xp, profiles, pushed, transport, xpSince, server };
}

let sqlJs: Promise<SqlJsStatic> | null = null;

function memoryStore(): ByteStore {
  const files = new Map<string, Uint8Array>();
  return { load: async (key) => files.get(key) ?? null, save: async (key, bytes) => void files.set(key, bytes) };
}

/** Where a machine keeps its data: the apps' SQLite, or the web app's SQLite in WebAssembly */
export type Engine = "tauri" | "web";

/** A fresh machine: new database, new localStorage, the deck seeded */
export async function device(engine: Engine = "tauri") {
  if (engine === "web") {
    const SQL = await (sqlJs ??= initSqlJs({ locateFile: (f: string) => path.resolve(__dirname, "../node_modules/sql.js/dist", f) }));
    vi.doMock("@/services/sqlite/open", () => ({
      openDatabase: (p: string) => WebDatabase.open(p, SQL, memoryStore()),
      DatabaseInUseError: class extends Error {},
    }));
  } else {
    vi.doUnmock("@/services/sqlite/open");
  }
  const services = await freshServices();
  (globalThis.localStorage as Storage).clear();
  const catalog = await import("@/services/vocabCatalog");
  await catalog.ensureCatalogSeeded(async () => ({ version: catalog.CATALOG_VERSION, words: DECK }));
  const feed = await import("@/services/vocabFeed");
  const recorder = await import("@/services/reviewRecorder");
  const engineModule = await import("@/services/sync/engine");
  const state = await import("@/services/sync/state");
  const conn = await services.db.getDatabase();
  // The machine really runs on the SQLite it says (a mock that did not apply would test the same engine twice)
  const actual = conn.constructor.name;
  if (actual !== (engine === "web" ? "WebDatabase" : "Database")) throw new Error(`a ${engine} machine runs on ${actual}`);
  return { ...services, catalog, feed, recorder, engine: engineModule, state, conn, kind: engine };
}
export type Device = Awaited<ReturnType<typeof device>>;

export async function addDeckWord(d: Device, word: string) {
  const [e] = await d.catalog.getCatalogEntries([word]);
  const ids = await d.db.insertCatalogWords([d.feed.toCatalogWordInput(e, new Date(Date.now() - 86400000).toISOString())]);
  return ids.get(word)!;
}

export async function review(d: Device, id: string, rating = Rating.Good) {
  await d.srs.recordReview(id, rating, "recognition");
  await d.smart.saveReviewLog({
    wordId: id, exerciseType: "flip", responseTimeMs: 1000, isCorrect: true, wrongAttempts: 0, rating, xpEarned: 10,
    timestamp: new Date().toISOString(), isScheduled: true, direction: "recognition",
  });
}

export async function card(d: Device, wordKeyText: string) {
  const rows = await d.conn.select<Array<Record<string, unknown>>>(
    `SELECT s.* FROM srs_reviews s JOIN words w ON w.id = s.word_id WHERE w.catalog_id = $1`, [wordKeyText]);
  return rows[0];
}
