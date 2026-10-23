// Writes conversations for the Hội thoại tab in bulk with Gemini and saves the ones that pass the app's own checks.
//
//   $env:GEMINI_API_KEY = "..."
//   npm run gen:situations -- --levels A1,A2 [--topics hotel-checkin,taxi] [--limit 10] [--dry]
//
// One request per (topic, level). A conversation is kept only when it passes validateSituation and is not a copy of
// one that exists; the others are retried (3 attempts), so nothing broken reaches the app. It saves after every
// conversation and skips what is already in src/data/situations/generated, so a stopped run just continues.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Situation } from "@/types/situation";
import { SITUATIONS } from "@/data/situations";
import { TALK_TOPICS, type TalkTopic } from "@/services/talk/topics";
import { buildSituationFromAi, ContentError, findDuplicate } from "@/services/talk/generate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data", "situations", "generated");

const args = process.argv.slice(2);
const flag = (name: string, fallback = "") => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? fallback) : fallback);
const levels = flag("--levels", "A1,A2").split(",").map((l) => l.trim().toUpperCase()) as Array<Situation["cefr"]>;
const onlyTopics = flag("--topics") ? new Set(flag("--topics").split(",").map((t) => t.trim())) : null;
const limit = Number(flag("--limit", "0")) || Infinity;
const dry = args.includes("--dry");
// Same default as the app's own API calls (src-tauri/src/ai_api.rs)
const model = process.env.MYENGLISH_AI_MODEL || "gemini-3.8-flash";
/** Pause between requests: the free tier allows only a few per minute */
const DELAY_MS = 4500;
const ATTEMPTS = 3;

const GUIDE: Record<Situation["cefr"], string> = {
  A1: "A1 (beginner: present simple, very common words, short sentences)",
  A2: "A2 (elementary: simple past and future, everyday words, short sentences)",
  B1: "B1 (intermediate: opinions, reasons, comparisons, linking words, still short sentences)",
  B2: "B2 (upper intermediate: natural phrasing, polite hedging, phrasal verbs, still short sentences)",
  C1: "C1 (advanced: precise, idiomatic, still short sentences)",
  C2: "C2 (near native: idiomatic, still short sentences)",
};

/** The same request the app makes (build_situation_prompt in src-tauri/src/lib.rs), with room for longer talks */
function buildPrompt(topic: TalkTopic, level: Situation["cefr"], avoid: string[]): string {
  const setting = topic.group === "work" ? "a workplace" : "an everyday-life";
  return `Write a short scripted conversation for a Vietnamese learner to practice speaking English. Setting: ${setting} situation, topic: "${topic.topic}". Learner level ${GUIDE[level]}.
The other person (partner) speaks first. The learner answers at every turn.
Rules:
- 4 to 7 turns (dialogue nodes n1, n2, ...). At each turn the learner has 1-3 possible answers (lines). Each reply has "next": the id of a LATER node, or null when the conversation ends. Never point back to an earlier node. Every node must be reachable from n1, and every learner line must be used in at least one turn. The last node's replies all end with null.
- 3 to 10 learner lines in all.
- Every learner line: 2 to 10 words, one natural spoken sentence a real person says. Use only English letters, spaces and the marks , . ? ! ' (no digits, no hyphens, no symbols: write numbers as words).
- accept: 1-3 other natural ways to say the same line (same character rules); none may equal another line or another accept.
- Partner sentences: max 14 words, vocabulary within ${level}.
- Vietnamese must be natural and short. title_vi max 8 words. goal_vi: one sentence saying what the learner can do afterwards.
- partner_emoji: exactly one emoji. note: optional short Vietnamese tip (max 20 words), else empty string.
- The situation must be clearly different from these existing ones (JSON list of titles): ${JSON.stringify(avoid.slice(0, 60))}
Return ONLY minified JSON:
{"title_vi":"","title_en":"","goal_vi":"","partner_vi":"","partner_emoji":"","lines":[{"key":"l1","en":"","vi":"","accept":[""],"note":""}],"dialogue":[{"id":"n1","npc_en":"","npc_vi":"","replies":[{"line":"l1","next":"n2"}]}]}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(prompt: string, key: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new Error(`Gemini ${res.status} after ${attempt} tries`);
      console.log(`  … Gemini ${res.status}, waiting ${attempt * 30}s`);
      await sleep(attempt * 30_000);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
    const text = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no text");
    return text;
  }
}

function loadSaved(level: string): Situation[] {
  const file = join(outDir, `${level.toLowerCase()}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Situation[]) : [];
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key && !dry) {
    console.error('No GEMINI_API_KEY. In PowerShell: $env:GEMINI_API_KEY = "your key"  (set it only for this window)');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const topics = TALK_TOPICS.filter((t) => !onlyTopics || onlyTopics.has(t.id));
  const saved = Object.fromEntries(levels.map((l) => [l, loadSaved(l)])) as Record<string, Situation[]>;
  const everything = () => [...SITUATIONS, ...Object.values(saved).flat()];
  let made = 0;
  let failed = 0;

  for (const level of levels) {
    for (const topic of topics) {
      if (made >= limit) break;
      const id = `${topic.id}-${level.toLowerCase()}`;
      if (saved[level].some((s) => s.id === id)) continue;

      if (dry) {
        console.log(`--- ${id}\n${buildPrompt(topic, level, everything().map((s) => s.title_en))}\n`);
        made++;
        continue;
      }

      let result: Situation | null = null;
      let problem = "";
      for (let attempt = 1; attempt <= ATTEMPTS && !result; attempt++) {
        try {
          const raw = await ask(buildPrompt(topic, level, everything().map((s) => s.title_en)), key!);
          const s = buildSituationFromAi(raw, { id, group: topic.group, cefr: level, topicId: topic.id, now: Date.now() });
          const duplicate = findDuplicate(s, everything());
          if (duplicate) throw new ContentError(`trùng: ${duplicate}`);
          // A built-in conversation carries no `ai` mark
          delete s.ai;
          result = s;
        } catch (err) {
          problem = (err as Error).message;
          if (!(err instanceof ContentError)) throw err;
        }
        await sleep(DELAY_MS);
      }

      if (result) {
        saved[level].push(result);
        writeFileSync(join(outDir, `${level.toLowerCase()}.json`), JSON.stringify(saved[level], null, 2));
        made++;
        console.log(`✓ ${id}  ${result.title_en}  (${result.dialogue.length} lượt, ${result.lines.length} câu)`);
      } else {
        failed++;
        console.log(`✗ ${id}  ${problem}`);
      }
    }
  }
  console.log(`\nDone: ${made} ${dry ? "prompts" : "saved"}, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
