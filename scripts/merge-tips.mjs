// Merges the checked drafts of grammar tips (scripts/import/tips/tips-*.json) into src/data/grammarTips/<level>.json:
// node scripts/merge-tips.mjs        (run scripts/check-tips.mjs on the drafts first)
// The lessons of a draft are ids; the app's file also has each lesson's name, so it does not need the grammar book to show it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src/data/grammarCatalog.json"), "utf8"));
const lessons = new Map(catalog.files.flatMap((f) => (f.lessons ?? []).map((l) => [l.id, l])));

const shortName = (l) => {
  const raw = (l.titleVn || l.title || "").split(/[:(]/)[0].trim();
  return raw.length > 56 ? `${raw.slice(0, 55).trim()}…` : raw;
};

const draftsDir = path.join(root, "scripts/import/tips");
const drafts = fs
  .readdirSync(draftsDir)
  .filter((f) => /^tips-.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(draftsDir, f), "utf8")));

const byLevel = new Map();
for (const level of ["a1", "a2"]) {
  const patterns = JSON.parse(fs.readFileSync(path.join(root, `src/data/patterns/${level}.json`), "utf8"));
  const order = [...new Set(patterns.map((p) => p.topic))];
  const tips = order
    .map((stage) => drafts.find((d) => d.stage === stage))
    .filter(Boolean)
    .map((d) => ({
      stage: d.stage,
      title: d.title,
      points: d.points,
      examples: d.examples,
      mistake: d.mistake,
      lessons: d.lessons.map((id) => ({ id, title: shortName(lessons.get(id)) })),
    }));
  byLevel.set(level, { tips, expected: order.length });
}

for (const [level, { tips, expected }] of byLevel) {
  if (tips.length !== expected) console.warn(`${level}: ${tips.length} of ${expected} stages have a tip`);
  const out = path.join(root, `src/data/grammarTips/${level}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(tips, null, 2)}\n`);
  console.log(`${level}: wrote ${tips.length} tips -> ${path.relative(root, out)}`);
}
