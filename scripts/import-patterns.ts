// Checks sentence patterns ("mẫu câu") written by an AI and saves the good ones to src/data/patterns/<level>.json.
//
//   npx vite-node scripts/import-patterns.ts -- scripts/import/patterns/A1-1-1.txt [more files] [--check]
//
// A file holds a JSON array (a ```json fence around it is fine). Each item has the fields of src/types/pattern.ts,
// except "id", which is built from "level" and "slug" ("a1.can-i-have"). --check only validates, nothing is saved.
// Patterns that are already saved (same id, or the same frame) are skipped.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pattern } from "@/types/pattern";
import { validatePattern } from "@/services/patterns/validate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data", "patterns");
const args = process.argv.slice(2).filter((a) => a !== "--");
const check = args.includes("--check");
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("Usage: npx vite-node scripts/import-patterns.ts -- <file> [more files] [--check]");
  process.exit(1);
}

function parseAnswer(text: string): unknown[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

const loadSaved = (level: string): Pattern[] => {
  const f = join(outDir, `${level.toLowerCase()}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Pattern[]) : [];
};

const items: unknown[] = [];
for (const file of files) {
  try {
    items.push(...parseAnswer(readFileSync(resolve(file), "utf8")));
  } catch (err) {
    console.error(`Không đọc được JSON trong ${file}: ${(err as Error).message}`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
const saved: Record<string, Pattern[]> = {};
let ok = 0;
let bad = 0;

items.forEach((item, i) => {
  const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const level = String(o.level ?? "").toUpperCase();
  const slug = String(o.slug ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const label = `#${i + 1} ${level.toLowerCase()}.${slug} ${String(o.frame_en ?? "")}`;
  const { slug: _slug, ...rest } = o;
  const pattern = { ...rest, id: `${level.toLowerCase()}.${slug}`, level } as unknown as Pattern;
  const problems = validatePattern(pattern);
  if (!slug) problems.unshift("thiếu slug");
  saved[level] ??= loadSaved(level);
  const same = saved[level].find((p) => p.id === pattern.id || p.frame_en.toLowerCase() === String(pattern.frame_en ?? "").toLowerCase());
  if (same) {
    console.log(`- ${label}: đã có (${same.id}), bỏ qua`);
    return;
  }
  if (problems.length > 0) {
    bad++;
    console.log(`✗ ${label}\n    ${problems.slice(0, 4).join("; ")}`);
    return;
  }
  saved[level].push(pattern);
  if (!check) writeFileSync(join(outDir, `${level.toLowerCase()}.json`), JSON.stringify(saved[level], null, 2));
  ok++;
  console.log(`✓ ${label}  (${pattern.slots.length} slot)`);
});

console.log(`\nXong: ${ok} mẫu đạt, ${bad} mẫu lỗi.`);
