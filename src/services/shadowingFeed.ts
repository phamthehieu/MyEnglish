import BUNDLED from "@/data/shadowing/index.json";

/**
 * Shadowing lessons that arrive after the app was built: once a day, the first time the app is opened,
 * up to DAILY_NEW lessons the phone does not have yet are downloaded from the feed (published by
 * scripts/publish-shadowing-feed.mjs) and kept on the phone. When the feed has nothing new, nothing happens.
 */
export const FEED_BASE = "https://raw.githubusercontent.com/phamthehieu/MyEnglish/shadowing-feed";
export const DAILY_NEW = 5;
export const FEED_EVENT = "shadowing-feed-updated";

const DAY_KEY = "shadowing.feed.day";
const DB_NAME = "myenglish-shadowing-feed";
const STORE = "lessons";

/** The same shape as a line of src/data/shadowing/index.json */
export interface FeedEntry {
  id: string;
  youtubeId: string;
  title: string;
  level: string;
  group?: string | null;
  duration: number;
  count: number;
}

interface Stored {
  id: string;
  entry: FeedEntry;
  lesson: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** The lines of the list for the lessons downloaded so far */
export async function getFeedEntries(): Promise<FeedEntry[]> {
  try {
    const all = await run<Stored[]>("readonly", (s) => s.getAll());
    return all.map((x) => x.entry);
  } catch {
    return [];
  }
}

export async function getFeedLesson<T>(id: string): Promise<T | null> {
  try {
    const row = await run<Stored | undefined>("readonly", (s) => s.get(id));
    return (row?.lesson as T) ?? null;
  } catch {
    return null;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(`${FEED_BASE}/${path}`, { signal: ctl.signal, cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/**
 * Downloads the day's new lessons. Does nothing after the first successful run of the day;
 * when the phone is offline or a download fails, the next time the app opens tries again.
 * Returns how many lessons were added.
 */
export async function syncDailyFeed(): Promise<number> {
  try {
    if (localStorage.getItem(DAY_KEY) === today()) return 0;
  } catch {
    /* no storage: try anyway */
  }
  if (typeof indexedDB === "undefined") return 0;

  let added = 0;
  try {
    const feed = await getJson<FeedEntry[]>("index.json");
    const have = new Set((BUNDLED as Array<{ id: string }>).map((e) => e.id));
    for (const e of await getFeedEntries()) have.add(e.id);
    const fresh = feed.filter((e) => !have.has(e.id)).slice(0, DAILY_NEW);
    for (const entry of fresh) {
      const lesson = await getJson<unknown>(`lessons/${entry.id}.json`);
      await run("readwrite", (s) => s.put({ id: entry.id, entry, lesson } satisfies Stored));
      added++;
    }
    try {
      localStorage.setItem(DAY_KEY, today());
    } catch {
      /* ignore */
    }
  } catch {
    /* offline or the feed is not there yet: tried again at the next start */
  }
  if (added > 0) window.dispatchEvent(new Event(FEED_EVENT));
  return added;
}
