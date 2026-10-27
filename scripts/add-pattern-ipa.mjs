// Adds the pronunciation ("ipa") of every sentence of the sentence patterns: the sentence made by each slot, and each example.
//
//   node scripts/add-pattern-ipa.mjs
//
// Run it after scripts/import-patterns.ts has saved new patterns. It reads and rewrites src/data/patterns/*.json,
// using the CMU dictionary (American English) like scripts/build-shadowing.mjs. A word the dictionary does not know
// (a name) is written as it is.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dictionary } from "cmu-pronouncing-dictionary";

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

function ipaOfSentence(text) {
  const parts = text.split(/\s+/).map(ipaOfWord).filter(Boolean);
  return parts.length > 0 ? `/${parts.join(" ")}/` : "";
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "patterns");
let sentences = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const patterns = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const p of patterns) {
    for (const slot of p.slots) {
      slot.ipa = ipaOfSentence(p.frame_en.replace("___", slot.en));
      sentences++;
    }
    for (const example of p.examples) {
      example.ipa = ipaOfSentence(example.en);
      sentences++;
    }
  }
  writeFileSync(join(dir, file), JSON.stringify(patterns, null, 2));
  console.log(`${file}: ${patterns.length} patterns`);
}
console.log(`${sentences} sentences now have their pronunciation.`);
