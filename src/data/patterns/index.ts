import type { Pattern, PatternLevel } from "@/types/pattern";

/** The sentence patterns that come with the app: one file per level in this folder (written by scripts/import-patterns.ts) */
export const PATTERNS: Pattern[] = Object.values(
  import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, Pattern[]>
).flat();

const LEVEL_ORDER: PatternLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export const patternsOfLevel = (level: PatternLevel): Pattern[] => PATTERNS.filter((p) => p.level === level);

export const getPattern = (id: string): Pattern | undefined => PATTERNS.find((p) => p.id === id);

/** Levels that have patterns, easiest first */
export const patternLevels = (): PatternLevel[] => LEVEL_ORDER.filter((l) => PATTERNS.some((p) => p.level === l));
