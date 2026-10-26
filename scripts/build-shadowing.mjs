// Builds a shadowing lesson (sentences with start/end times, optionally translated) from a YouTube video.
//
//   node scripts/build-shadowing.mjs <youtube url or id> [--level A1] [--no-vi]
//
// Needs scripts/tools/yt-dlp.exe (https://github.com/yt-dlp/yt-dlp/releases). It uses the video's English
// captions (the manual ones when the channel made them, else YouTube's automatic ones). The Vietnamese
// meaning comes from Gemini when GEMINI_API_KEY is set. Output: src/data/shadowing/<id>.json
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { dictionary } from "cmu-pronouncing-dictionary";

// ---- Pronunciation of a whole sentence (American English), from the CMU dictionary ----
const VOWELS = { AA: "ɑ", AE: "æ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", EY: "eɪ", IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u" };
const CONSONANTS = {
  B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ",
  P: "p", R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
/** Two consonants that may begin a syllable (the rest of a cluster belongs to the syllable before) */
const ONSETS = new Set(["pl", "pr", "bl", "br", "tr", "dr", "kl", "kr", "ɡl", "ɡr", "fl", "fr", "θr", "ʃr", "sp", "st", "sk", "sm", "sn", "sl", "sw", "kw", "tw", "dw"]);

function ipaOfWord(raw) {
  const key = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, "");
  if (!key) return "";
  const entry = dictionary[key];
  if (!entry) return raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  const phones = entry.toUpperCase().split(" ").map((p) => {
    const stress = /\d$/.test(p) ? Number(p.slice(-1)) : -1;
    const base = p.replace(/\d$/, "");
    if (stress >= 0) {
      let ipa = VOWELS[base];
      if (base === "AH") ipa = stress === 0 ? "ə" : "ʌ";
      else if (base === "ER") ipa = stress === 0 ? "ər" : "ɝ";
      return { ipa: ipa ?? base.toLowerCase(), vowel: true, stress };
    }
    return { ipa: CONSONANTS[base] ?? base.toLowerCase(), vowel: false, stress: -1 };
  });
  const vowelCount = phones.filter((p) => p.vowel).length;
  const marks = new Map(); // phone index -> stress mark placed before it
  if (vowelCount > 1) {
    phones.forEach((p, v) => {
      if (!p.vowel || (p.stress !== 1 && p.stress !== 2)) return;
      let start = v;
      while (start > 0 && !phones[start - 1].vowel) start--;
      const cluster = phones.slice(start, v).map((c) => c.ipa);
      let take = Math.min(cluster.length, 1);
      if (start === 0) take = cluster.length;
      else if (cluster.length >= 2 && ONSETS.has(cluster.slice(-2).join(""))) take = cluster.length >= 3 && cluster[cluster.length - 3] === "s" ? 3 : 2;
      marks.set(v - take, p.stress === 1 ? "ˈ" : "ˌ");
    });
  }
  return phones.map((p, i) => (marks.get(i) ?? "") + p.ipa).join("");
}

function ipaOfSentence(words) {
  const parts = words.map(ipaOfWord).filter(Boolean);
  return parts.length > 0 ? `/${parts.join(" ")}/` : "";
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ytdlp = join(root, "scripts", "tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const dataDir = join(root, "src", "data", "shadowing");
const outDir = join(dataDir, "lessons");

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const videoId = (input) => input.match(/(?:v=|embed\/|youtu\.be\/)([\w-]{11})/)?.[1] ?? input;

/** yt-dlp, tried again a few times: YouTube answers "too many requests" when videos come one after another */
async function runYtdlp(dir, id, extra) {
  for (let attempt = 1; ; attempt++) {
    try {
      return execFileSync(ytdlp, ["--js-runtimes", "node", "--skip-download", "-o", join(dir, "%(id)s"), ...extra, `https://www.youtube.com/watch?v=${id}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (err) {
      if (attempt >= 3) throw err;
      await sleep(attempt * 20_000);
    }
  }
}

/** Sentences with the time of each word, cut from the words of the captions */
function cutSentences(words) {
  // Sentences end at . ? ! ; a run with no punctuation is cut at a comma or a pause once it is long enough
  const MAX_WORDS = 28;
  const sentences = [];
  let cur = [];
  const flush = () => {
    if (cur.length === 0) return;
    sentences.push({
      start: +(cur[0].start / 1000).toFixed(2),
      end: +(cur[cur.length - 1].end / 1000).toFixed(2),
      text: cur.map((w) => w.text).join(" ").replace(/\s+([,.?!;:])/g, "$1"),
      // Each word with the second it starts, so the app can light the word being said
      words: cur.map((w) => [w.text, +(w.start / 1000).toFixed(2)]),
    });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.?!]["')\]]*$/.test(w.text);
    const pause = next ? next.start - w.end : Infinity;
    if (endsSentence || (cur.length >= 14 && (/[,;:]$/.test(w.text) || pause > 500)) || cur.length >= MAX_WORDS) flush();
  });
  flush();

  // Very short fragments ("Yes.", "Okay.") join the sentence before them
  const segments = [];
  for (const s of sentences) {
    const last = segments[segments.length - 1];
    if (last && s.text.split(" ").length < 3 && s.start - last.end < 1) {
      last.text += " " + s.text;
      last.words = [...last.words, ...s.words];
      last.end = s.end;
    } else segments.push({ ...s });
  }
  return segments;
}

// Free translation: Google Translate's public web endpoint (no key). Many sentences go in one request (one per line),
// which keeps the number of requests small; the endpoint still answers "too many requests" (429) when it is used a lot,
// and then it is left alone for the rest of the run: the lessons are built without Vietnamese and `--fill-vi` adds it later.
let translationBlocked = false;
let blockedInARow = 0;

async function askGoogle(text) {
  const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(text)}`,
  });
  if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json())[0].map((p) => p[0]).join("");
}

/** The Vietnamese of each sentence, or undefined where it could not be had */
async function translateFree(list) {
  const out = new Array(list.length);
  const CHUNK = 25;
  for (let i = 0; i < list.length; i += CHUNK) {
    if (translationBlocked) break;
    const chunk = list.slice(i, i + CHUNK);
    try {
      const lines = (await askGoogle(chunk.join("\n"))).split("\n").map((l) => l.trim());
      if (lines.length === chunk.length && lines.every(Boolean)) lines.forEach((l, k) => (out[i + k] = l));
      else {
        // The lines did not come back one to one: ask for each sentence of this chunk on its own
        for (let k = 0; k < chunk.length; k++) {
          out[i + k] = await askGoogle(chunk[k]);
          await sleep(400);
        }
      }
      blockedInARow = 0;
    } catch (err) {
      blockedInARow++;
      console.log(`  translation: ${err.message} (${blockedInARow} in a row)`);
      if (blockedInARow >= 3) {
        translationBlocked = true;
        console.log("  translation paused for this run: the rest is built without Vietnamese (add it later with --fill-vi)");
        break;
      }
      await sleep(30_000);
      i -= CHUNK; // the same chunk again
    }
    await sleep(1200);
  }
  return out;
}

// With a Gemini key the meaning comes from Gemini, 60 sentences per call
async function translate(list) {
  const key = process.env.GEMINI_API_KEY;
  if (args.includes("--no-vi")) return list.map(() => undefined);
  if (!key || args.includes("--free")) return translateFree(list);
  const model = process.env.MYENGLISH_AI_MODEL || "gemini-2.5-flash";
  const out = [];
  for (let i = 0; i < list.length; i += 60) {
    const chunk = list.slice(i, i + 60);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Dịch từng câu tiếng Anh sau sang tiếng Việt tự nhiên, ngắn gọn. Trả về JSON là mảng chuỗi, đúng thứ tự và đúng số lượng " +
                  `(${chunk.length}).\n\n` +
                  JSON.stringify(chunk),
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const arr = JSON.parse(data.candidates[0].content.parts[0].text);
    out.push(...chunk.map((_, k) => arr[k]));
  }
  return out;
}

/** One video -> one lesson (the file is written by the caller) */
async function buildLesson(id, { level, group, order }) {
  const dir = mkdtempSync(join(tmpdir(), "shadowing-"));
  const meta = JSON.parse(await runYtdlp(dir, id, ["--dump-single-json"]));
  // Manual captions first; the automatic ones when there are none
  const hasManual = Object.keys(meta.subtitles ?? {}).some((l) => l.startsWith("en"));
  await runYtdlp(dir, id, ["--sub-langs", "en.*,en", "--sub-format", "json3", hasManual ? "--write-subs" : "--write-auto-subs"]);
  const file = readdirSync(dir).find((f) => f.endsWith(".json3"));
  if (!file) throw new Error("No English captions for this video");
  const events = JSON.parse(readFileSync(join(dir, file), "utf8")).events ?? [];

  // Every word with its time (captions put the offset of each word inside its line)
  const words = [];
  for (const e of events) {
    for (const s of e.segs ?? []) {
      // Drop caption markers: ">>" speaker changes and [music] style notes
      const text = (s.utf8 ?? "").replace(/\[[^\]]*\]|>>/g, "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      words.push({ text, start: e.tStartMs + (s.tOffsetMs ?? 0), lineEnd: e.tStartMs + (e.dDurationMs ?? 0) });
    }
  }
  if (words.length === 0) throw new Error("The captions have no words");
  // A word ends where the next begins (never later than its line); the last one ends with its line
  words.forEach((w, i) => {
    const next = words[i + 1];
    w.end = Math.min(w.lineEnd, next ? next.start : w.lineEnd);
    if (w.end <= w.start) w.end = w.start + 300;
  });

  const segments = cutSentences(words);
  // How each sentence is said, for the pronunciation line of the Shadowing tab
  for (const s of segments) s.ipa = ipaOfSentence(s.words.map((w) => w[0]));
  const vi = await translate(segments.map((s) => s.text));
  segments.forEach((s, i) => {
    if (vi[i]) s.vi = vi[i];
  });

  return {
    id,
    youtubeId: id,
    title: meta.title,
    channel: meta.channel,
    level,
    group: group || undefined,
    order,
    duration: meta.duration,
    captions: hasManual ? "manual" : "auto",
    segments,
  };
}

/** The list of the screen: one small entry per lesson, so the app need not load every lesson to show it */
function writeIndex() {
  mkdirSync(outDir, { recursive: true });
  const lessons = readdirSync(outDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(outDir, f), "utf8")));
  // A lesson is listed under the level it was built for, and under the others it was also asked for ("also")
  const entries = lessons
    .flatMap((l) => [{ level: l.level, group: l.group, order: l.order }, ...(l.also ?? [])].map((where) => ({ l, where })))
    .map(({ l, where }) => ({
      id: l.id,
      youtubeId: l.youtubeId,
      title: l.title,
      channel: l.channel,
      level: where.level,
      group: where.group,
      order: where.order ?? 0,
      duration: l.duration,
      count: l.segments.length,
    }))
    .sort((a, b) => a.level.localeCompare(b.level) || a.order - b.order || a.title.localeCompare(b.title));
  writeFileSync(join(dataDir, "index.json"), JSON.stringify(entries, null, 1));
  return entries.length;
}

function saveLesson(lesson) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${lesson.id}.json`), JSON.stringify(lesson));
}

const describe = (l) => `${l.title}: ${l.segments.length} sentences (${l.captions} captions${l.segments[0]?.vi ? ", with Vietnamese" : ", no Vietnamese"})`;

const batchFile = flag("--batch");
const input = args.find((a, i) => !a.startsWith("--") && !["--level", "--group", "--batch"].includes(args[i - 1]));
const level = flag("--level", "A1");

if (args.includes("--fill-vi")) {
  // Adds the Vietnamese to the sentences of the lessons that have none yet (a run that was blocked, or --no-vi)
  let filled = 0;
  let left = 0;
  for (const f of readdirSync(outDir).filter((x) => x.endsWith(".json"))) {
    const lesson = JSON.parse(readFileSync(join(outDir, f), "utf8"));
    const missing = lesson.segments.map((s, i) => (s.vi ? -1 : i)).filter((i) => i >= 0);
    if (missing.length === 0) continue;
    if (translationBlocked) {
      left += missing.length;
      continue;
    }
    const vi = await translate(missing.map((i) => lesson.segments[i].text));
    let got = 0;
    missing.forEach((idx, k) => {
      if (vi[k]) {
        lesson.segments[idx].vi = vi[k];
        got++;
      }
    });
    if (got > 0) saveLesson(lesson);
    filled += got;
    left += missing.length - got;
    console.log(`${lesson.id}: ${got}/${missing.length} sentences translated`);
  }
  console.log(`\nDone: ${filled} sentences translated, ${left} still without Vietnamese.`);
} else if (batchFile) {
  // One line per video: "<group>\t<link>". Videos already in lessons/ are skipped (--force builds them again).
  const rows = readFileSync(batchFile, "utf8")
    .split(/\r?\n/)
    .map((l) => l.split("\t").map((c) => c.trim()))
    .filter((c) => c.length >= 2 && /youtu/.test(c[1]));
  const seen = new Set();
  const failed = [];
  let done = 0;
  for (const [i, [group, link]] of rows.entries()) {
    const id = videoId(link);
    if (seen.has(id)) continue;
    seen.add(id);
    const label = `[${i + 1}/${rows.length}] ${id} (${group})`;
    const existing = join(outDir, `${id}.json`);
    if (!args.includes("--force") && existsSync(existing)) {
      // Built for another level already: the same lesson is listed under this level too, nothing is fetched again
      const lesson = JSON.parse(readFileSync(existing, "utf8"));
      if (lesson.level === level || (lesson.also ?? []).some((a) => a.level === level)) {
        console.log(`${label}: already there`);
      } else {
        lesson.also = [...(lesson.also ?? []), { level, group: group || undefined, order: i }];
        saveLesson(lesson);
        writeIndex();
        console.log(`${label}: also listed under ${level} (built as ${lesson.level})`);
      }
      continue;
    }
    try {
      const lesson = await buildLesson(id, { level, group, order: i });
      saveLesson(lesson);
      writeIndex();
      done++;
      console.log(`${label}: ${describe(lesson)}`);
    } catch (err) {
      failed.push(`${id} (${group}): ${String(err.message ?? err).split("\n")[0].slice(0, 160)}`);
      console.log(`${label}: FAILED ${failed[failed.length - 1]}`);
    }
    // A pause between videos: YouTube answers "too many requests" to captions asked for in a hurry
    await sleep(Number(process.env.SHADOWING_PAUSE_MS) || 8000);
  }
  console.log(`\nDone: ${done} built, ${failed.length} failed, ${writeIndex()} lessons in the list.`);
  if (failed.length) console.log("Failed:\n  " + failed.join("\n  "));
} else if (input) {
  const id = videoId(input);
  const lesson = await buildLesson(id, { level, group: flag("--group", ""), order: 0 });
  saveLesson(lesson);
  console.log(describe(lesson));
  console.log(`-> src/data/shadowing/lessons/${id}.json (${writeIndex()} lessons in the list)`);
} else {
  console.error('Usage: node scripts/build-shadowing.mjs <youtube url or id> [--level A1] [--group "name"] [--no-vi]');
  console.error("       node scripts/build-shadowing.mjs --batch scripts/shadowing-a1.tsv --level A1");
  process.exit(1);
}
