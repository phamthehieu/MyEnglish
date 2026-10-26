// Builds a shadowing lesson (sentences with start/end times, optionally translated) from a YouTube video.
//
//   node scripts/build-shadowing.mjs <youtube url or id> [--level A1] [--no-vi]
//
// Needs scripts/tools/yt-dlp.exe (https://github.com/yt-dlp/yt-dlp/releases). It uses the video's English
// captions (the manual ones when the channel made them, else YouTube's automatic ones). The Vietnamese
// meaning comes from Gemini when GEMINI_API_KEY is set. Output: src/data/shadowing/<id>.json
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
if (!input) {
  console.error("Usage: node scripts/build-shadowing.mjs <youtube url or id> [--level A1] [--no-vi]");
  process.exit(1);
}
const id = input.match(/(?:v=|embed\/|youtu\.be\/)([\w-]{11})/)?.[1] ?? input;
const level = flag("--level", "A1");

const dir = mkdtempSync(join(tmpdir(), "shadowing-"));
const run = (extra) =>
  execFileSync(ytdlp, ["--js-runtimes", "node", "--skip-download", "-o", join(dir, "%(id)s"), ...extra, `https://www.youtube.com/watch?v=${id}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const meta = JSON.parse(run(["--dump-single-json"]));
// Manual captions first; the automatic ones when there are none
const hasManual = Object.keys(meta.subtitles ?? {}).some((l) => l.startsWith("en"));
run(["--sub-langs", "en.*,en", "--sub-format", "json3", hasManual ? "--write-subs" : "--write-auto-subs"]);
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
// A word ends where the next begins (never later than its line); the last one ends with its line
words.forEach((w, i) => {
  const next = words[i + 1];
  w.end = Math.min(w.lineEnd, next ? next.start : w.lineEnd);
  if (w.end <= w.start) w.end = w.start + 300;
});

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

// How each sentence is said, for the pronunciation line of the Shadowing tab
for (const s of segments) s.ipa = ipaOfSentence(s.words.map((w) => w[0]));

// Vietnamese meaning, one Gemini call per 60 sentences
// Free fallback: Google Translate's public web endpoint (no key; fine for a few hundred short sentences)
async function translateFree(list) {
  const out = [];
  for (const text of list) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
    let vi;
    for (let attempt = 0; attempt < 3 && !vi; attempt++) {
      const res = await fetch(url);
      if (res.ok) vi = (await res.json())[0].map((p) => p[0]).join("");
      else await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    out.push(vi);
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

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

const vi = await translate(segments.map((s) => s.text));
segments.forEach((s, i) => {
  if (vi[i]) s.vi = vi[i];
});

const lesson = {
  id,
  youtubeId: id,
  title: meta.title,
  channel: meta.channel,
  level,
  duration: meta.duration,
  captions: hasManual ? "manual" : "auto",
  segments,
};
const outDir = join(root, "src", "data", "shadowing");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${id}.json`), JSON.stringify(lesson, null, 2));
console.log(`${meta.title}: ${segments.length} sentences (${hasManual ? "manual" : "automatic"} captions${vi[0] ? ", with Vietnamese" : ", no Vietnamese"})`);
console.log(`-> src/data/shadowing/${id}.json`);
