import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { localClock } from "../supabase/functions/_shared/reminderSlots";

/**
 * The web reminders' SQL (0010_web_push.sql, 0012_push_studied.sql) run for real, in Postgres compiled to WebAssembly.
 * Supabase's own pieces it relies on are stood in for: the API roles and auth.uid().
 */
const migration = (name: string) => readFileSync(path.resolve(__dirname, "../supabase/migrations", name), "utf8");

async function database(): Promise<PGlite> {
  // The test setup gives the app a `window`; PGlite would take that for a browser and look for the page's address
  const g = globalThis as { window?: unknown };
  const saved = g.window;
  delete g.window;
  const db = new PGlite();
  try {
    await db.waitReady;
  } finally {
    g.window = saved;
  }
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  `);
  await db.exec(migration("0010_web_push.sql"));
  await db.exec(migration("0012_push_studied.sql"));
  return db;
}

let n = 0;
async function subscribe(db: PGlite, times: string[], tz = "Asia/Ho_Chi_Minh"): Promise<string> {
  n += 1;
  const endpoint = `https://push.example.com/send/${n}`;
  await db.query("select public.save_push_subscription($1, $2, $3, $4, $5, $6)", [
    `device-${String(n).padStart(4, "0")}`,
    endpoint,
    "p256dh-key-of-the-browser-000000",
    "auth-secret-0",
    times,
    tz,
  ]);
  return endpoint;
}

const row = async (db: PGlite, endpoint: string) =>
  (await db.query<{ studied_on: string | null; tz: string }>("select studied_on, tz from push_subscriptions where endpoint = $1", [endpoint])).rows[0];

/** "HH:MM" in `tz`, `offset` minutes from now */
function localTime(tz: string, offset: number): string {
  const m = localClock(new Date(Date.now() + offset * 60_000), tz).minutes;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** A time zone where it is not close to midnight now (the window never spans midnight, as in dueSlot) */
function zoneAwayFromMidnight(): string {
  const zones = ["Asia/Ho_Chi_Minh", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"];
  return zones.find((tz) => {
    const m = localClock(new Date(), tz).minutes;
    return m >= 30 && m <= 1430;
  })!;
}

describe("web reminders on the server (0012)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await database();
  });

  it("marks the day the goal was reached, and the time zone the learner is in now", async () => {
    const endpoint = await subscribe(db, ["20:00"]);
    await db.query("select public.mark_push_studied($1, $2, $3)", [endpoint, "2026-10-31", "Asia/Tokyo"]);
    expect(await row(db, endpoint)).toEqual({ studied_on: "2026-10-31", tz: "Asia/Tokyo" });

    // A time zone the server does not know leaves the last good one
    await db.query("select public.mark_push_studied($1, $2, $3)", [endpoint, "2026-11-01", "Mars/Olympus"]);
    expect(await row(db, endpoint)).toEqual({ studied_on: "2026-11-01", tz: "Asia/Tokyo" });
  });

  it("refuses a malformed day, and creates nothing for an unknown browser", async () => {
    const endpoint = await subscribe(db, ["20:00"]);
    await expect(db.query("select public.mark_push_studied($1, $2, $3)", [endpoint, "31/10/2026", "Asia/Tokyo"])).rejects.toThrow(/push_invalid/);
    await db.query("select public.mark_push_studied($1, $2, $3)", ["https://push.example.com/send/unknown", "2026-10-31", "Asia/Tokyo"]);
    expect(Number((await db.query<{ n: number }>("select count(*)::int as n from push_subscriptions")).rows[0].n)).toBe(1);
  });

  it("hands send-reminders only the browsers whose study time was reached in the last minutes", async () => {
    const tz = zoneAwayFromMidnight();
    const due = await subscribe(db, [localTime(tz, -3)], tz);
    const tooLate = await subscribe(db, [localTime(tz, -20)], tz);
    const later = await subscribe(db, [localTime(tz, 10)], tz);
    const twoTimes = await subscribe(db, ["03:00", localTime(tz, 0)], tz);
    const none = await subscribe(db, [], tz);

    const rows = (await db.query<{ endpoint: string; studied_on: string | null }>("select * from public.due_push_subscriptions(15)")).rows;
    const got = rows.map((r) => r.endpoint);
    expect(got).toContain(due);
    expect(got).toContain(twoTimes);
    expect(got).not.toContain(tooLate);
    expect(got).not.toContain(later);
    expect(got).not.toContain(none);
    // Carries what send-reminders needs to skip a day whose goal is reached
    expect(Object.keys(rows[0])).toContain("studied_on");
  });

  it("reads the study time in each learner's own time zone", async () => {
    const here = zoneAwayFromMidnight();
    // The same clock time, but in a zone 9 to 12 hours away: not due there
    const far = here === "America/New_York" ? "Asia/Tokyo" : "America/New_York";
    const local = await subscribe(db, [localTime(here, -2)], here);
    const elsewhere = await subscribe(db, [localTime(here, -2)], far);
    const got = (await db.query<{ endpoint: string }>("select endpoint from public.due_push_subscriptions(15)")).rows.map((r) => r.endpoint);
    expect(got).toContain(local);
    expect(got).not.toContain(elsewhere);
  });

  it("is for the server only: the app's roles cannot list the subscriptions", async () => {
    const grants = (
      await db.query<{ grantee: string }>(
        "select grantee from information_schema.routine_privileges where routine_name = 'due_push_subscriptions' and privilege_type = 'EXECUTE'"
      )
    ).rows.map((r) => r.grantee);
    expect(grants).toContain("service_role");
    expect(grants).not.toContain("anon");
    expect(grants).not.toContain("authenticated");
  });

  it("refuses new subscriptions past 60 in a minute, and still updates an existing one", async () => {
    const first = await subscribe(db, ["20:00"]);
    for (let i = 0; i < 59; i++) await subscribe(db, ["20:00"]);
    await expect(subscribe(db, ["20:00"])).rejects.toThrow(/push_busy/);
    // An existing browser changing its times is not a new subscription
    await db.query("select public.save_push_subscription($1, $2, $3, $4, $5, $6)", [
      "device-0001-again",
      first,
      "p256dh-key-of-the-browser-000000",
      "auth-secret-0",
      ["21:00"],
      "Asia/Ho_Chi_Minh",
    ]).catch((e) => {
      throw new Error(`an update was refused: ${e}`);
    });
  });
});
