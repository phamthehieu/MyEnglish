import { useEffect, useMemo, useState } from "react";
import { PATTERNS } from "@/data/patterns";
import { getFocusSettings } from "@/services/focusSession";
import { getStudyLevels } from "@/services/vocabFeed";
import { allPatternStates, duePatterns, PATTERNS_UPDATED_EVENT, STEPS } from "@/services/patterns/progress";
import { buildDayPlan } from "@/services/roadmap/plan";
import { buildPathStages, estimateDays } from "@/services/roadmap/stages";
import { currentStage, getRoadmap, isFinished, ROADMAP_EVENT } from "@/services/roadmap/state";

/**
 * Everything the screens need about the path: the stages for the learner's goal (from their lowest level up), the one being
 * worked on, today's plan for the minutes they chose, and how far along they are. Reloads when the progress or the
 * choices change.
 */
export function useRoadmap() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(PATTERNS_UPDATED_EVENT, refresh);
    window.addEventListener(ROADMAP_EVENT, refresh);
    window.addEventListener("myenglish-study-levels-changed", refresh);
    return () => {
      window.removeEventListener(PATTERNS_UPDATED_EVENT, refresh);
      window.removeEventListener(ROADMAP_EVENT, refresh);
      window.removeEventListener("myenglish-study-levels-changed", refresh);
    };
  }, []);

  const road = getRoadmap();
  const states = allPatternStates();
  const minutes = getFocusSettings().minutes;
  // The path starts at the lowest level the learner studies
  const wantedLevel = getStudyLevels()[0];
  const stages = useMemo(() => buildPathStages(PATTERNS, road.goal ?? "all", wantedLevel), [road.goal, wantedLevel]);
  // Sentences of the wanted level may not exist yet: the path then starts lower than the learner's level
  const startsLower = stages.length > 0 && stages[0].level < wantedLevel;
  const current = currentStage(stages, road);
  const plan = current
    ? buildDayPlan(
        current,
        road,
        states,
        duePatterns().filter((id) => (states[id]?.step ?? 0) >= STEPS),
        minutes
      )
    : null;
  const finishedCount = stages.filter((s) => isFinished(road, s.id)).length;
  const etaDays = estimateDays(
    stages.filter((s) => !isFinished(road, s.id)),
    minutes
  );
  const etaText = etaDays <= 14 ? `${etaDays} ngày` : etaDays <= 60 ? `khoảng ${Math.round(etaDays / 7)} tuần` : `khoảng ${Math.round(etaDays / 30)} tháng`;
  return { road, states, minutes, stages, current, plan, finishedCount, etaText, wantedLevel, startsLower };
}
