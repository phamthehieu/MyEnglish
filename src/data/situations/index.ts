import type { Situation, SituationLine } from "@/types/situation";
import { getGenerated } from "@/services/talk/custom";
import { ASK_COLLEAGUE } from "./ask-colleague";
import { ASK_DIRECTION } from "./ask-direction";
import { ASK_FOR_HELP } from "./ask-for-help";
import { CAFE_ORDER } from "./cafe-order";
import { DAILY_STANDUP } from "./daily-standup";
import { INTRODUCE_YOURSELF } from "./introduce-yourself";
import { ONLINE_MEETING } from "./online-meeting";
import { RESTAURANT } from "./restaurant";
import { SHOPPING } from "./shopping";
import { WEEKEND_CHAT } from "./weekend-chat";
import { B1_SITUATIONS } from "./b1";

/** Conversations written in bulk by scripts/build-situations.ts (one file per level; none when it has not run) */
const GENERATED: Situation[] = Object.values(
  import.meta.glob("./generated/*.json", { eager: true, import: "default" }) as Record<string, Situation[]>
).flat();

/** The conversations that come with the app. Shortest and easiest first inside each group. */
export const SITUATIONS: Situation[] = [
  INTRODUCE_YOURSELF,
  CAFE_ORDER,
  ASK_DIRECTION,
  RESTAURANT,
  SHOPPING,
  ASK_FOR_HELP,
  WEEKEND_CHAT,
  DAILY_STANDUP,
  ASK_COLLEAGUE,
  ONLINE_MEETING,
  ...B1_SITUATIONS,
  ...GENERATED,
];

/** Built-in conversations and the ones the AI wrote for this learner (newest last) */
export function allSituations(): Situation[] {
  return [...SITUATIONS, ...getGenerated()];
}

export function getSituation(id: string): Situation | undefined {
  return allSituations().find((s) => s.id === id);
}

/** A line of any situation by its id ("cafe-order.l1") */
export function getLine(lineId: string): SituationLine | undefined {
  for (const s of allSituations()) {
    const line = s.lines.find((l) => l.id === lineId);
    if (line) return line;
  }
  return undefined;
}
