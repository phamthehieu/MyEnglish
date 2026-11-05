import { useEffect, useMemo, useState } from "react";
import { PATTERNS } from "@/data/patterns";
import { getDailyGoal } from "@/services/streak";
import { chosenDailyMinutes } from "../dashboard/todayPlan";
import { getStudyLevels } from "@/services/vocabFeed";
import type { StudyLevel } from "@/services/vocabCatalog";
import { chosenLevel } from "@/services/learnerProfile";
import { allPatternStates, completeStep, duePatterns, PATTERNS_UPDATED_EVENT, STEPS } from "@/services/patterns/progress";
import { buildDayPlan } from "@/services/roadmap/plan";
import { buildPathStages, estimateDays } from "@/services/roadmap/stages";
import { currentStage, getRoadmap, isFinished, markDone, ROADMAP_EVENT } from "@/services/roadmap/state";

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
    // The daily goal (the minutes a day) changed
    window.addEventListener("myenglish-activity-updated", refresh);
    return () => {
      window.removeEventListener(PATTERNS_UPDATED_EVENT, refresh);
      window.removeEventListener(ROADMAP_EVENT, refresh);
      window.removeEventListener("myenglish-study-levels-changed", refresh);
      window.removeEventListener("myenglish-activity-updated", refresh);
    };
  }, []);

  const road = getRoadmap();
  const states = allPatternStates();
  // The minutes a day chosen at the first run (5 / 10 / 15), not the focus session's timer: the path's day must fit
  // in the day the learner signed up for, next to the words
  const minutes = chosenDailyMinutes(getDailyGoal());
  // The path starts at the lowest level the learner studies
  const studyLevels = getStudyLevels();
  const profileLevel = chosenLevel();
  const wantedLevel: StudyLevel =
    profileLevel && profileLevel !== "A0" && studyLevels.includes(profileLevel as StudyLevel)
      ? (profileLevel as StudyLevel)
      : studyLevels[0];
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
  // Every part of the stage is done, whichever screen finished it (a test closed on its results, say): it closes
  const completeStage = current && plan?.complete ? current.id : null;
  useEffect(() => {
    if (completeStage) markDone(completeStage);
  }, [completeStage]);
  // An older version sent a pattern of a finished stage back a step on a miss, and nothing asked it again: mastered again
  const sentBack = stages
    .filter((s) => isFinished(road, s.id))
    .flatMap((s) => s.patterns)
    .filter((p) => states[p.id]?.step === STEPS - 1)
    .map((p) => p.id)
    .join();
  useEffect(() => {
    if (sentBack) for (const id of sentBack.split(",")) completeStep(id, STEPS);
  }, [sentBack]);
  const finishedCount = stages.filter((s) => isFinished(road, s.id)).length;
  const aheadPlan = current && plan?.waiting ? buildDayPlan(current, road, states, duePatterns().filter((id) => (states[id]?.step ?? 0) >= STEPS), minutes, undefined, true) : null;
  const etaDays = estimateDays(
    stages.filter((s) => !isFinished(road, s.id)),
    minutes
  );
  const etaText = etaDays <= 14 ? `${etaDays} ngày` : etaDays <= 60 ? `khoảng ${Math.round(etaDays / 7)} tuần` : `khoảng ${Math.round(etaDays / 30)} tháng`;
  return { road, states, minutes, stages, current, plan, aheadPlan, finishedCount, etaText, wantedLevel, startsLower };
}
