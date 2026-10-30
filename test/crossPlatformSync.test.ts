import { describe, it, expect } from "vitest";
import { Rating } from "ts-fsrs";
import { addDeckWord, card, device, fakeServer, review, type Device, type Engine } from "./syncHarness";

/** The card's schedule as both machines must agree on it (the word's id is each machine's own) */
const CARD_FIELDS = ["stability", "difficulty", "reps", "lapses", "state", "last_review", "next_review_date", "scheduled_days"];
const schedule = (row: Record<string, unknown> | undefined) => (row ? Object.fromEntries(CARD_FIELDS.map((f) => [f, row[f]])) : row);

async function wordId(d: Device, catalogId: string) {
  return (await d.conn.select<Array<{ id: string }>>(`SELECT id FROM words WHERE catalog_id = $1`, [catalogId]))[0]?.id;
}

const PAIRS: Array<[Engine, Engine, string]> = [
  ["tauri", "web", "học trên app rồi mở bản web"],
  ["web", "tauri", "học trên bản web rồi mở app"],
];

describe.each(PAIRS)("sync between the apps and the web app: %s → %s (%s)", (first, second) => {
  it("moves the card, its review log, XP and settings, with the same schedule", async () => {
    const server = fakeServer();
    const a = await device(first);
    const id = await addDeckWord(a, "apple");
    await review(a, id);
    a.smart.awardXP(25);
    localStorage.setItem("myenglish_daily_goal_v1", "17");
    const onA = schedule(await card(a, "apple"));
    await a.engine.syncNow(server.transport(), "user-1");

    const b = await device(second);
    expect(b.kind).toBe(second);
    await b.engine.syncNow(server.transport(), "user-1");
    expect(schedule(await card(b, "apple"))).toEqual(onA);
    const logs = await b.conn.select<Array<{ n: number }>>(`SELECT COUNT(*) AS n FROM review_logs`);
    expect(logs[0].n).toBe(1);
    expect(localStorage.getItem("myenglish_daily_goal_v1")).toBe("17");
    expect(b.smart.getXPState().totalXP).toBe(25);
  });

  it("settles: once both have synced, further passes on either side send and change nothing", async () => {
    const server = fakeServer();
    const a = await device(first);
    await review(a, await addDeckWord(a, "banana"));
    await a.engine.syncNow(server.transport(), "user-1");
    const b = await device(second);
    await b.engine.syncNow(server.transport(), "user-1");
    await review(b, await wordId(b, "banana"));
    await b.engine.syncNow(server.transport(), "user-1");
    await a.engine.syncNow(server.transport(), "user-1");

    // A row that changed on the way (a time written differently by the two SQLites, say) would bounce forever
    for (const d of [b, a, b, a]) {
      const report = await d.engine.syncNow(server.transport(), "user-1");
      expect(report.pushed, `${d.kind} pushed again`).toBe(0);
      expect(report.applied, `${d.kind} applied again`).toBe(0);
    }
    expect(schedule(await card(a, "banana"))).toEqual(schedule(await card(b, "banana")));
  });

  it("keeps the card that is further along when both studied it offline", async () => {
    const server = fakeServer();
    const a = await device(first);
    const idA = await addDeckWord(a, "date");
    await review(a, idA);
    await a.engine.syncNow(server.transport(), "user-1");
    const b = await device(second);
    await b.engine.syncNow(server.transport(), "user-1");
    const idB = await wordId(b, "date");

    // A: two more reviews; B, not synced since: one, later
    await review(a, idA);
    await review(a, idA);
    const ahead = schedule(await card(a, "date"));
    await new Promise((r) => setTimeout(r, 15));
    await review(b, idB, Rating.Easy);

    await a.engine.syncNow(server.transport(), "user-1");
    await b.engine.syncNow(server.transport(), "user-1");
    await a.engine.syncNow(server.transport(), "user-1");
    for (const d of [a, b]) expect(schedule(await card(d, "date")), d.kind).toEqual(ahead);
  });

  it("carries a word the learner added, with Vietnamese text, its example and its card", async () => {
    const server = fakeServer();
    const a = await device(first);
    const id = await a.db.insertEnrichedWord({
      word: "Idempotent", meaning_vn: "bất biến khi gọi lại — “giống hệt” 👍", synonyms: ["repeatable"], antonyms: [],
      examples: [{ sentence_en: "The call is idempotent.", sentence_vn: "Lệnh gọi này bất biến.", grammar_analysis: "S + be + adj" }],
    });
    await review(a, id);
    await a.engine.syncNow(server.transport(), "user-1");

    const b = await device(second);
    await b.engine.syncNow(server.transport(), "user-1");
    const rows = await b.conn.select<Array<{ id: string; meaning_vn: string; synonyms: string }>>(
      `SELECT id, meaning_vn, synonyms FROM words WHERE LOWER(word) = 'idempotent'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].meaning_vn).toBe("bất biến khi gọi lại — “giống hệt” 👍");
    expect(JSON.parse(rows[0].synonyms)).toEqual(["repeatable"]);
    const ex = await b.conn.select<Array<{ sentence_en: string; sentence_vn: string }>>(
      `SELECT sentence_en, sentence_vn FROM examples WHERE word_id = $1`, [rows[0].id]
    );
    expect(ex[0]).toEqual({ sentence_en: "The call is idempotent.", sentence_vn: "Lệnh gọi này bất biến." });
    const srs = await b.conn.select<Array<{ reps: number }>>(`SELECT reps FROM srs_reviews WHERE word_id = $1`, [rows[0].id]);
    expect(srs[0].reps).toBeGreaterThan(0);
  });

  it("deletes a word on the other side, and it does not come back", async () => {
    const server = fakeServer();
    const a = await device(first);
    const id = await addDeckWord(a, "cherry");
    await review(a, id);
    await a.engine.syncNow(server.transport(), "user-1");
    const b = await device(second);
    await b.engine.syncNow(server.transport(), "user-1");
    expect(await card(b, "cherry")).toBeDefined();

    await b.db.deleteWord(await wordId(b, "cherry"));
    await b.engine.syncNow(server.transport(), "user-1");
    await a.engine.syncNow(server.transport(), "user-1");
    expect(await wordId(a, "cherry")).toBeUndefined();
    await b.engine.syncNow(server.transport(), "user-1");
    expect(await wordId(b, "cherry")).toBeUndefined();
  });

  it("adds the XP of both instead of keeping one", async () => {
    const server = fakeServer();
    const a = await device(first);
    a.smart.awardXP(30);
    await a.engine.syncNow(server.transport(), "user-1");
    const b = await device(second);
    await b.engine.syncNow(server.transport(), "user-1");
    b.smart.awardXP(20);
    await b.engine.syncNow(server.transport(), "user-1");
    expect(b.smart.getXPState().totalXP).toBe(50);
  });
});
