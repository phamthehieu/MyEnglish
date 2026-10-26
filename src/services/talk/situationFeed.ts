import type { Situation } from "@/types/situation";
import { FEED_BASE } from "@/services/shadowingFeed";
import { TALK_GENERATED_EVENT } from "./custom";
import { validateSituation } from "./validate";

/**
 * New conversations for the Hội thoại tab that arrive after the app was built: once a day, the first time the app
 * is opened, up to DAILY_NEW_TALKS the phone does not have yet are downloaded from the feed (situations.json,
 * published by scripts/publish-shadowing-feed.mjs) and kept in localStorage. Each is checked with validateSituation
 * first, so a broken one never reaches the learner.
 */
export const DAILY_NEW_TALKS = 3;
const KEY = "myenglish_talk_feed_v1";
const DAY_KEY = "talk.feed.day";
/** The oldest are dropped past this */
const MAX_KEPT = 300;

export function getFeedSituations(): Situation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is Situation => !!s && typeof s.id === "string" && Array.isArray(s.lines) && Array.isArray(s.dialogue)) : [];
  } catch {
    return [];
  }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** `have` are the ids the app already knows (built in, written by the AI for the learner, or downloaded before) */
export async function syncDailySituations(have: ReadonlySet<string>): Promise<number> {
  try {
    if (localStorage.getItem(DAY_KEY) === today()) return 0;
  } catch {
    /* no storage: try anyway */
  }
  let added = 0;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    let feed: Situation[];
    try {
      const res = await fetch(`${FEED_BASE}/situations.json`, { signal: ctl.signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      feed = (await res.json()) as Situation[];
    } finally {
      clearTimeout(timer);
    }
    const kept = getFeedSituations();
    const known = new Set([...have, ...kept.map((s) => s.id)]);
    const fresh = feed
      .filter((s) => s && typeof s.id === "string" && !known.has(s.id) && validateSituation(s).length === 0)
      .slice(0, DAILY_NEW_TALKS);
    if (fresh.length > 0) {
      localStorage.setItem(KEY, JSON.stringify([...kept, ...fresh].slice(-MAX_KEPT)));
      added = fresh.length;
    }
    localStorage.setItem(DAY_KEY, today());
  } catch {
    /* offline or no feed yet: tried again at the next start */
  }
  if (added > 0) window.dispatchEvent(new Event(TALK_GENERATED_EVENT));
  return added;
}
