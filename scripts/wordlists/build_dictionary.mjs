/**
 * Builds the comprehensive bilingual (English–Vietnamese & English–English) offline dictionary shards
 * in `public/dict/{a..z}.json` + `public/dict/vi-index.json` by merging:
 *   1. `src/data/vocabCatalog.json` (Oxford 5000 A1–C1 with US/UK IPA, CEFR, irregulars, bilingual examples)
 *   2. `scripts/wordlists/data/oxfordIt.json` (IT & Software Engineering specialized vocabulary)
 *   3. Open-source StarDict/OVDP English–Vietnamese dictionary (~109,000 entries, idioms, phrases, examples)
 *   4. Wordset / WordNet 3.1 English–English dictionary (~108,000 entries with definitions, examples, synonyms)
 *   5. CMU Pronouncing Dictionary (135,155 words converted from ARPAbet to IPA `/.../`)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const RAW_DIR = "C:/Users/user/.gemini/antigravity/brain/468ac9aa-caaf-4fbb-9e00-07867f7d770b/scratch/dict_raw";
const EN_VI_PATH = path.join(RAW_DIR, "en-vi.txt");
const WORDSET_DIR = path.join(RAW_DIR, "wordset");
const OUT_DIR = path.join(ROOT, "public", "dict");

// --- 1. ARPAbet to IPA converter (CMU Pronouncing Dictionary) ---
const ARPA_TO_IPA = {
  AA: "ɑː",
  AA0: "ɑ",
  AA1: "ɑː",
  AA2: "ɑː",
  AE: "æ",
  AE0: "æ",
  AE1: "æ",
  AE2: "æ",
  AH: "ʌ",
  AH0: "ə",
  AH1: "ʌ",
  AH2: "ʌ",
  AO: "ɔː",
  AO0: "ɔ",
  AO1: "ɔː",
  AO2: "ɔː",
  AW: "aʊ",
  AW0: "aʊ",
  AW1: "aʊ",
  AW2: "aʊ",
  AY: "aɪ",
  AY0: "aɪ",
  AY1: "aɪ",
  AY2: "aɪ",
  B: "b",
  CH: "tʃ",
  D: "d",
  DH: "ð",
  EH: "e",
  EH0: "e",
  EH1: "e",
  EH2: "e",
  ER: "ɜːr",
  ER0: "ər",
  ER1: "ɜːr",
  ER2: "ɜːr",
  EY: "eɪ",
  EY0: "eɪ",
  EY1: "eɪ",
  EY2: "eɪ",
  F: "f",
  G: "ɡ",
  HH: "h",
  IH: "ɪ",
  IH0: "ɪ",
  IH1: "ɪ",
  IH2: "ɪ",
  IY: "iː",
  IY0: "i",
  IY1: "iː",
  IY2: "iː",
  JH: "dʒ",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  NG: "ŋ",
  OW: "oʊ",
  OW0: "oʊ",
  OW1: "oʊ",
  OW2: "oʊ",
  OY: "ɔɪ",
  OY0: "ɔɪ",
  OY1: "ɔɪ",
  OY2: "ɔɪ",
  P: "p",
  R: "r",
  S: "s",
  SH: "ʃ",
  T: "t",
  TH: "θ",
  UH: "ʊ",
  UH0: "ʊ",
  UH1: "ʊ",
  UH2: "ʊ",
  UW: "uː",
  UW0: "u",
  UW1: "uː",
  UW2: "uː",
  V: "v",
  W: "w",
  Y: "j",
  Z: "z",
  ZH: "ʒ",
};

function arpabetToIpa(arpa) {
  if (!arpa) return undefined;
  const tokens = arpa.trim().split(/\s+/);
  const vowelCount = tokens.filter((t) => /[012]$/.test(t)).length;
  let out = "";
  for (const tok of tokens) {
    if (vowelCount > 1 && tok.endsWith("1")) out += "ˈ";
    else if (vowelCount > 2 && tok.endsWith("2")) out += "ˌ";
    const sym = ARPA_TO_IPA[tok] || ARPA_TO_IPA[tok.replace(/[012]$/, "")];
    if (sym) out += sym;
  }
  return out ? `/${out}/` : undefined;
}

// Normalize POS names to compact standard tags
function normalizePos(raw) {
  if (!raw) return "";
  const s = raw.toLowerCase().trim();
  if (s.includes("ngoại động từ") || s.includes("nội động từ") || s.includes("động từ") || s === "verb" || s === "v." || s === "v") return "v";
  if (s.includes("danh từ") || s === "noun" || s === "n." || s === "n") return "n";
  if (s.includes("tính từ") || s === "adjective" || s === "adj." || s === "adj") return "adj";
  if (s.includes("phó từ") || s.includes("trạng từ") || s === "adverb" || s === "adv." || s === "adv") return "adv";
  if (s.includes("giới từ") || s === "preposition" || s === "prep." || s === "prep") return "prep";
  if (s.includes("liên từ") || s === "conjunction" || s === "conj." || s === "conj") return "conj";
  if (s.includes("đại từ") || s === "pronoun" || s === "pron." || s === "pron") return "pron";
  if (s.includes("thán từ") || s === "exclamation" || s === "interjection" || s === "exclam.") return "interj";
  if (s.includes("mạo từ") || s.includes("hạn định") || s === "determiner" || s === "det.") return "det";
  return s.slice(0, 12);
}

function shardKeyFor(word) {
  const first = word.trim().toLowerCase().charCodeAt(0);
  if (first >= 97 && first <= 122) return String.fromCharCode(first);
  return "other";
}

console.log("1. Loading CMU Pronouncing Dictionary...");
const cmuDict = require("cmu-pronouncing-dictionary").dictionary;

/** Map<lowerWord, EntryObject> */
const entries = new Map();

function getOrCreateEntry(word) {
  const clean = word.trim();
  const key = clean.toLowerCase();
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      w: clean,
      i: undefined,
      uk: undefined,
      c: undefined,
      t: undefined,
      m: [],
      id: [],
      syn: [],
      f: [],
    };
    entries.set(key, entry);
  }
  return entry;
}

// --- 2. Load Oxford 5000 Catalog (Highest priority for learner senses & examples) ---
console.log("2. Loading Oxford 5000 Catalog...");
const catalogPath = path.join(ROOT, "src/data/vocabCatalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const itPath = path.join(ROOT, "scripts/wordlists/data/oxfordIt.json");
const itData = fs.existsSync(itPath) ? JSON.parse(fs.readFileSync(itPath, "utf8")) : { words: {} };
const itWords = new Set(Object.keys(itData.words || {}).map((w) => w.toLowerCase()));

for (const item of catalog.words) {
  const entry = getOrCreateEntry(item.word);
  entry.w = item.word;
  entry.c = item.cefr;
  if (item.it || itWords.has(item.word.toLowerCase())) {
    entry.t = "IT & Công sở";
  } else if (item.list === 3000) {
    entry.t = "Oxford 3000";
  } else {
    entry.t = "Oxford 5000";
  }
  if (item.ipaUs?.[0]) entry.i = item.ipaUs[0];
  if (item.ipaUk?.[0] && item.ipaUk[0] !== entry.i) entry.uk = item.ipaUk[0];
  if (item.irregular?.length) {
    entry.f = [...new Set([...entry.f, ...item.irregular])];
  }
  if (item.variants?.length) {
    entry.f = [...new Set([...entry.f, ...item.variants])];
  }

  for (let idx = 0; idx < (item.senses || []).length; idx++) {
    const s = item.senses[idx];
    const exs = (item.examples || [])
      .filter((ex) => ex.senseIndex === idx)
      .slice(0, 2)
      .map((ex) => [ex.en, ex.vi]);
    entry.m.push({
      p: normalizePos(s.pos || item.pos),
      v: s.vn,
      x: exs.length > 0 ? exs : undefined,
    });
  }
}
console.log(`   Loaded ${catalog.words.length} Oxford words.`);

// --- 3. Parse Open-Source EN-VI Dictionary (109,000+ entries) ---
if (fs.existsSync(EN_VI_PATH)) {
  console.log("3. Parsing 109,000+ EN-VI Dictionary entries...");
  const lines = fs.readFileSync(EN_VI_PATH, "utf8").split(/\r?\n/);
  let current = null;
  let currentPos = "";
  let currentIdiom = null;
  let lastSense = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("@")) {
      currentIdiom = null;
      lastSense = null;
      currentPos = "";
      // Format: @word /ipa/ or @word
      const raw = line.slice(1).trim();
      const slashIdx = raw.indexOf("/");
      let head = raw;
      let ipa = undefined;
      if (slashIdx > 0) {
        head = raw.slice(0, slashIdx).trim();
        const ipaPart = raw.slice(slashIdx).trim();
        if (ipaPart.startsWith("/") && ipaPart.endsWith("/")) {
          ipa = ipaPart;
        }
      }
      if (!head || head.length > 60) {
        current = null;
        continue;
      }
      current = getOrCreateEntry(head);
      if (ipa && !current.i) {
        current.i = ipa;
      }
      continue;
    }

    if (!current) continue;

    if (line.startsWith("*")) {
      currentIdiom = null;
      const posRaw = line.slice(1).trim();
      currentPos = normalizePos(posRaw);
      // Extract plural/irregular notes like "số nhiều mice"
      const pluralMatch = posRaw.match(/số nhiều\s+([a-zA-Z-]+)/i);
      if (pluralMatch && pluralMatch[1]) {
        const form = pluralMatch[1].toLowerCase();
        if (!current.f.includes(form)) current.f.push(form);
      }
      continue;
    }

    if (line.startsWith("!")) {
      const idiomText = line.slice(1).trim();
      if (idiomText && current.id.length < 8) {
        currentIdiom = [idiomText, ""];
        current.id.push(currentIdiom);
      } else {
        currentIdiom = null;
      }
      continue;
    }

    if (line.startsWith("-")) {
      const meaningVn = line.slice(1).trim().replace(/^:\s*/, "");
      if (!meaningVn) continue;

      if (currentIdiom) {
        currentIdiom[1] = currentIdiom[1] ? `${currentIdiom[1]}; ${meaningVn}` : meaningVn;
        continue;
      }

      // Avoid duplicating identical Vietnamese senses or bloating beyond 8 senses per entry
      const exists = current.m.some(
        (s) => s.v && s.v.toLowerCase() === meaningVn.toLowerCase()
      );
      if (!exists && current.m.length < 8) {
        lastSense = {
          p: currentPos || undefined,
          v: meaningVn,
        };
        current.m.push(lastSense);
      }
      continue;
    }

    if (line.startsWith("=")) {
      const exRaw = line.slice(1).trim();
      const plusIdx = exRaw.indexOf("+");
      if (plusIdx > 0 && lastSense) {
        const exEn = exRaw.slice(0, plusIdx).trim().replace(/_/g, " ");
        const exVi = exRaw.slice(plusIdx + 1).trim();
        if (exEn && exVi) {
          lastSense.x = lastSense.x || [];
          if (lastSense.x.length < 2) {
            lastSense.x.push([exEn, exVi]);
          }
        }
      }
    }
  }
  console.log(`   Total entries after EN-VI merge: ${entries.size}`);
}

// --- 4. Merge Wordset / WordNet 3.1 English–English Definitions & Synonyms ---
if (fs.existsSync(WORDSET_DIR)) {
  console.log("4. Merging Wordset / WordNet 3.1 English–English definitions & synonyms...");
  const files = fs.readdirSync(WORDSET_DIR).filter((f) => f.endsWith(".json"));
  let enEnMatched = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(WORDSET_DIR, file), "utf8"));
    for (const [wordKey, record] of Object.entries(data)) {
      if (!record || !record.meanings || !Array.isArray(record.meanings)) continue;
      const head = (record.word || wordKey).trim();
      if (!head || head.length > 60) continue;

      const entry = getOrCreateEntry(head);
      enEnMatched++;

      for (const m of record.meanings.slice(0, 6)) {
        const pos = normalizePos(m.speech_part);
        const defEn = (m.def || "").trim();
        if (!defEn) continue;

        // Collect synonyms
        const validSyns = Array.isArray(m.synonyms)
          ? m.synonyms.filter((syn) => typeof syn === "string" && syn.trim().length > 0).map((syn) => syn.trim())
          : [];
        for (const cleanSyn of validSyns) {
          if (cleanSyn.toLowerCase() !== head.toLowerCase() && entry.syn.length < 10 && !entry.syn.includes(cleanSyn)) {
            entry.syn.push(cleanSyn);
          }
        }

        // Try to pair with an existing sense of the same POS that doesn't have an English definition yet
        const targetSense = entry.m.find((s) => s.p === pos && !s.e) || entry.m.find((s) => !s.e);
        if (targetSense) {
          targetSense.e = defEn;
          if (!targetSense.p && pos) targetSense.p = pos;
          if (typeof m.example === "string" && m.example.trim() && (!targetSense.x || targetSense.x.length === 0)) {
            targetSense.x = [[m.example.trim()]];
          }
          if (validSyns.length > 0) {
            targetSense.s = validSyns.slice(0, 4);
          }
        } else if (entry.m.length < 8) {
          entry.m.push({
            p: pos || undefined,
            e: defEn,
            x: typeof m.example === "string" && m.example.trim() ? [[m.example.trim()]] : undefined,
            s: validSyns.length > 0 ? validSyns.slice(0, 4) : undefined,
          });
        }
      }
    }
  }
  console.log(`   Merged ${enEnMatched} English–English entries. Total dictionary size: ${entries.size}`);
}

// --- 5. Enrich Missing IPAs from CMU Pronouncing Dictionary (135,155 words) ---
console.log("5. Filling missing IPA transcriptions from CMU Dictionary...");
let cmuFilled = 0;
for (const [key, entry] of entries.entries()) {
  if (!entry.i) {
    const arpa = cmuDict[key];
    if (arpa) {
      const ipa = arpabetToIpa(arpa);
      if (ipa) {
        entry.i = ipa;
        cmuFilled++;
      }
    }
  }
}
console.log(`   Filled ${cmuFilled} additional IPA transcriptions.`);

// --- 6. Write Sharded Files & Vietnamese Reverse Index ---
fs.mkdirSync(OUT_DIR, { recursive: true });

const shards = new Map();
const viReverseMap = new Map(); // normalized Vi keyword -> Array<[word, pos, shortVi]>

function stripViAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

let validCount = 0;
for (const [, entry] of entries.entries()) {
  // Filter out empty entries
  entry.id = entry.id.filter((pair) => pair[0] && pair[1]);
  if (entry.m.length === 0 && entry.id.length === 0) continue;

  // Clean up empty arrays to save space
  const compact = { w: entry.w };
  if (entry.i) compact.i = entry.i;
  if (entry.uk) compact.uk = entry.uk;
  if (entry.c) compact.c = entry.c;
  if (entry.t) compact.t = entry.t;
  if (entry.m.length > 0) compact.m = entry.m;
  if (entry.id.length > 0) compact.id = entry.id;
  if (entry.syn.length > 0) compact.syn = entry.syn;
  if (entry.f.length > 0) compact.f = entry.f;

  const sKey = shardKeyFor(entry.w);
  if (!shards.has(sKey)) shards.set(sKey, []);
  shards.get(sKey).push(compact);
  validCount++;

  // Index Vietnamese meanings for VI -> EN lookup (prioritizing Oxford & common single words)
  const firstViSense = entry.m.find((s) => s.v);
  if (firstViSense && firstViSense.v && entry.w.length <= 28) {
    const rawParts = firstViSense.v
      .replace(/\([^)]*\)/g, "")
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2 && p.length <= 35);

    const isPriority = Boolean(entry.c) || !entry.w.includes(" ");
    if (isPriority) {
      for (const part of rawParts.slice(0, 3)) {
        const norm = part.toLowerCase();
        if (!viReverseMap.has(norm)) viReverseMap.set(norm, []);
        const list = viReverseMap.get(norm);
        if (list.length < 8 && !list.some((item) => item[0].toLowerCase() === entry.w.toLowerCase())) {
          list.push([
            entry.w,
            firstViSense.p || "",
            firstViSense.v.slice(0, 70),
            entry.c || "",
          ]);
        }
      }
    }
  }
}

console.log(`6. Writing ${shards.size} shard files for ${validCount} valid dictionary entries...`);
let totalBytes = 0;
for (const [sKey, list] of shards.entries()) {
  list.sort((a, b) => a.w.toLowerCase().localeCompare(b.w.toLowerCase()));
  const outPath = path.join(OUT_DIR, `${sKey}.json`);
  const json = JSON.stringify(list);
  fs.writeFileSync(outPath, json, "utf8");
  totalBytes += Buffer.byteLength(json, "utf8");
}

// Build compact VI -> EN index (top 25,000 most useful Vietnamese terms)
const viEntries = [...viReverseMap.entries()]
  .filter(([k, list]) => k.length >= 2 && list.length > 0)
  .sort((a, b) => {
    const aHasCefr = a[1].some((x) => x[3]);
    const bHasCefr = b[1].some((x) => x[3]);
    if (aHasCefr !== bHasCefr) return aHasCefr ? -1 : 1;
    return a[0].length - b[0].length;
  })
  .slice(0, 25000)
  .map(([vi, matches]) => ({
    v: vi,
    u: stripViAccents(vi),
    w: matches.slice(0, 5).map(([w, p, vn, c]) => (c ? [w, p, vn, c] : [w, p, vn])),
  }));

const viIndexPath = path.join(OUT_DIR, "vi-index.json");
const viJson = JSON.stringify(viEntries);
fs.writeFileSync(viIndexPath, viJson, "utf8");

console.log(`==> Done!`);
console.log(`   Total EN-VI / EN-EN entries: ${validCount.toLocaleString()}`);
console.log(`   Total VI->EN reverse index terms: ${viEntries.length.toLocaleString()}`);
console.log(`   Shards size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`   VI Index size: ${(Buffer.byteLength(viJson, "utf8") / 1024 / 1024).toFixed(2)} MB`);
