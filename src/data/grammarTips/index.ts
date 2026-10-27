import { PATTERNS } from "@/data/patterns";
import type { GrammarTip, GrammarTipEntry } from "@/types/grammarTip";

/** The grammar tips that come with the app: one file per level in this folder (written by scripts/merge-tips.mjs) */
export const GRAMMAR_TIPS: GrammarTip[] = Object.values(
  import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, GrammarTip[]>
).flat();

/** The tip of a stage of the speaking path (undefined when the stage has none) */
export const tipForStage = (stageId: string): GrammarTip | undefined => GRAMMAR_TIPS.find((t) => t.stage === stageId);

/** Every tip with its level and the name of its stage, in the order of the path (the order of the pattern files) */
export function tipEntries(): GrammarTipEntry[] {
  const out: GrammarTipEntry[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    if (seen.has(p.topic)) continue;
    seen.add(p.topic);
    const tip = tipForStage(p.topic);
    if (tip) out.push({ ...tip, level: p.level, stageTitle: p.topic_vi });
  }
  return out;
}
