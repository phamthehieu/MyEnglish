// Corrections to the deck's Vietnamese meanings, applied to src/data/vocabCatalog.json (run again after
// build_catalog_from_anki.py, which writes the deck's own text). Examples stay tied to their sense (senseIndex).
// Raise `version` here and CATALOG_VERSION in src/services/vocabCatalog.ts together: the learners' words follow it.
import fs from "node:fs";

const FILE = new URL("../../src/data/vocabCatalog.json", import.meta.url);
const VERSION = 3;

/** at: where a new sense goes in; replace: the sense at that place is reworded */
const FIXES = {
  give: [{ at: 0, pos: "verb", vn: "cho, đưa" }],
  free: [{ at: 1, pos: "adjective", vn: "rảnh" }],
  business: [{ at: 0, pos: "noun", vn: "kinh doanh" }],
  situation: [{ replace: 0, vn: "tình huống, tình hình" }],
  hand: [{ replace: 1, vn: "người giúp một tay" }],
  get: [{ at: 4, pos: "verb", vn: "đến (get to: đến nơi nào)" }],
  by: [
    { at: 0, pos: "preposition", vn: "bằng (phương tiện, cách thức: by bus)" },
    { at: 3, pos: "preposition", vn: "bên cạnh, gần" },
  ],
  end: [{ replace: 0, vn: "phần cuối, kết thúc" }],
  see: [{ at: 2, pos: "verb", vn: "gặp" }],
  person: [{ replace: 0, vn: "người" }],
  search: [{ at: 0, pos: "verb", vn: "tìm kiếm" }],
  shall: [{ at: 0, pos: "modal verb", vn: "sẽ (đi với I, we)" }],
  dumb: [{ at: 0, pos: "adjective", vn: "câm (không nói được)" }],
  inevitably: [{ replace: 0, vn: "chắc chắn, tất yếu, không thể tránh khỏi" }],
};

const deck = JSON.parse(fs.readFileSync(FILE, "utf8"));
for (const [word, fixes] of Object.entries(FIXES)) {
  const entry = deck.words.find((w) => w.word === word);
  if (!entry) throw new Error(`no word: ${word}`);
  for (const fix of fixes) {
    if (fix.replace !== undefined) {
      entry.senses[fix.replace].vn = fix.vn;
    } else if (!entry.senses.some((s) => s.vn === fix.vn)) {
      entry.senses.splice(fix.at, 0, { pos: fix.pos, vn: fix.vn });
      for (const ex of entry.examples) if (ex.senseIndex >= fix.at) ex.senseIndex++;
    }
  }
  // As the deck builds it: each meaning once, in order
  entry.vn = [...new Set(entry.senses.map((s) => s.vn))].join("; ");
  console.log(`${word}: ${entry.vn}`);
}
deck.version = VERSION;
fs.writeFileSync(FILE, JSON.stringify(deck), "utf8");
