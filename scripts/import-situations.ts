// Checks conversations written by any AI outside the app (ChatGPT, Gemini on the web, …) and saves the good ones
// to src/data/situations/generated, where the app picks them up like the ones scripts/build-situations.ts writes.
//
//   npm run gen:import -- scripts/import/a2.txt
//
// The file holds the AI's answer as it is: a JSON array (a ```json fence around it is fine). Each conversation has the
// fields of scripts/build-situations.ts plus "slug" (topic, kebab-case), "level" (A1…C2) and "group" ("daily"|"work").
// Every conversation goes through the same checks as the ones the app's own AI writes; for each one that does not pass
// the reason is printed, to paste back to the AI so it fixes just that one.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Situation } from "@/types/situation";
import { SITUATIONS } from "@/data/situations";
import { buildSituationFromAi, ContentError, findDuplicate } from "@/services/talk/generate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data", "situations", "generated");
const args = process.argv.slice(2).filter((a) => a !== "--");
const check = args.includes("--check");
/** --limit N: save at most N new conversations in this run (the rest are skipped), to fill a level up to an exact count */
const limitAt = args.indexOf("--limit");
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) || Infinity : Infinity;
const files = args.filter((a, i) => !a.startsWith("--") && !(limitAt >= 0 && i === limitAt + 1));
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

if (files.length === 0) {
  console.error("Usage: npm run gen:import -- <file with the AI's JSON answer> [more files] [--check] [--limit N]");
  process.exit(1);
}

/** The JSON of an answer that may be wrapped in a code fence or in a few words of chat */
function parseAnswer(text: string): unknown[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  const body = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(body) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

function loadSaved(level: string): Situation[] {
  const f = join(outDir, `${level.toLowerCase()}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Situation[]) : [];
}

const items: unknown[] = [];
for (const file of files) {
  try {
    items.push(...parseAnswer(readFileSync(resolve(file), "utf8")));
  } catch (err) {
    console.error(`Không đọc được JSON trong ${file}: ${(err as Error).message}`);
    console.error("Kiểm tra AI có trả về đúng một mảng JSON không, rồi dán lại.");
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
const saved: Record<string, Situation[]> = {};
const everything = () => [...SITUATIONS, ...Object.values(saved).flat()];
let ok = 0;
let bad = 0;

items.forEach((item, i) => {
  const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const level = String(o.level ?? "").toUpperCase();
  const slug = String(o.slug ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const label = `#${i + 1} ${slug || "(thiếu slug)"} ${level || "(thiếu level)"} ${String(o.title_en ?? "")}`.trim();
  if (!LEVELS.includes(level) || !slug || (o.group !== "daily" && o.group !== "work")) {
    bad++;
    console.log(`✗ ${label}\n    thiếu hoặc sai "slug", "level" (A1…C2) hoặc "group" ("daily"|"work")`);
    return;
  }
  saved[level] ??= loadSaved(level);
  const id = `${slug}-${level.toLowerCase()}`;
  if (saved[level].some((s) => s.id === id)) {
    console.log(`- ${label}: đã có, bỏ qua`);
    return;
  }
  if (ok >= limit) {
    console.log(`- ${label}: đã đủ ${limit} bài, bỏ qua`);
    return;
  }
  try {
    const s = buildSituationFromAi(JSON.stringify(o), { id, group: o.group as Situation["group"], cefr: level as Situation["cefr"], topicId: slug, now: Date.now() });
    const duplicate = findDuplicate(s, everything());
    if (duplicate) throw new ContentError(`trùng: ${duplicate}`);
    delete s.ai;
    saved[level].push(s);
    // --check: only the verdict, nothing is saved
    if (!check) writeFileSync(join(outDir, `${level.toLowerCase()}.json`), JSON.stringify(saved[level], null, 2));
    ok++;
    console.log(`✓ ${label}  (${s.dialogue.length} lượt, ${s.lines.length} câu)`);
  } catch (err) {
    bad++;
    console.log(`✗ ${label}\n    ${(err as Error).message}`);
  }
});

console.log(`\nXong: ${ok} bài đạt, ${bad} bài lỗi (bài lỗi: dán lý do ở trên cho AI để nó sửa riêng bài đó).`);
