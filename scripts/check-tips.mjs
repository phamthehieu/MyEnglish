// Checks drafts of grammar tips (one JSON array per file): node scripts/check-tips.mjs <file> [<file>...]
// A tip is { stage, title, points[2-4], examples[2-3]{en,vi}, mistake{wrong,right,why}, lessons[0-3] }
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/grammarCatalog.json", import.meta.url), "utf8"));
const lessonIds = new Set(catalog.files.flatMap((f) => (f.lessons ?? []).map((l) => l.id)));
const stages = new Set(
  ["a1", "a2"].flatMap((lv) => JSON.parse(fs.readFileSync(new URL(`../src/data/patterns/${lv}.json`, import.meta.url), "utf8")).map((p) => p.topic))
);

const problems = [];
const seen = new Set();
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/check-tips.mjs <file>...");
  process.exit(2);
}
let count = 0;
for (const file of files) {
  let tips;
  try {
    tips = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${file}: not valid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(tips)) {
    problems.push(`${file}: must be an array`);
    continue;
  }
  for (const t of tips) {
    count++;
    const at = `${file} ${t?.stage ?? "?"}`;
    const bad = (m) => problems.push(`${at}: ${m}`);
    if (!stages.has(t.stage)) bad("unknown stage");
    if (seen.has(t.stage)) bad("duplicate stage");
    seen.add(t.stage);
    if (typeof t.title !== "string" || t.title.length < 3 || t.title.length > 60) bad("title must be 3-60 characters");
    if (!Array.isArray(t.points) || t.points.length < 2 || t.points.length > 4) bad("points must have 2-4 items");
    for (const p of t.points ?? []) if (typeof p !== "string" || p.length < 10 || p.length > 160) bad(`point length 10-160: "${p}"`);
    if (!Array.isArray(t.examples) || t.examples.length < 2 || t.examples.length > 3) bad("examples must have 2-3 items");
    for (const e of t.examples ?? []) {
      if (!e || typeof e.en !== "string" || typeof e.vi !== "string" || !e.en || !e.vi) bad("example needs en and vi");
      else if (/___/.test(e.en)) bad(`example still has a blank: "${e.en}"`);
    }
    const m = t.mistake;
    if (!m || !m.wrong || !m.right || !m.why || m.wrong === m.right) bad("mistake needs wrong, right (different) and why");
    else if (m.why.length > 120) bad("mistake.why over 120 characters");
    if (!Array.isArray(t.lessons) || t.lessons.length > 3) bad("lessons must be an array of at most 3 ids");
    for (const id of t.lessons ?? []) if (!lessonIds.has(id)) bad(`unknown lesson id ${id}`);
    const all = JSON.stringify(t);
    if (/[—–]/.test(all)) bad("no em/en dashes, use a comma or a colon");
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s) in ${count} tip(s)`);
  process.exit(1);
}
console.log(`ok: ${count} tip(s), ${seen.size} stage(s)`);
