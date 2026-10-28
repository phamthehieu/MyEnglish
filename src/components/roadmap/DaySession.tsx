import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, PartyPopper } from "lucide-react";
import { tipForStage } from "@/data/grammarTips";
import { getPattern } from "@/data/patterns";
import { getSituation } from "@/data/situations";
import type { Pattern } from "@/types/pattern";
import { getPatternState, STEPS } from "@/services/patterns/progress";
import { buildRapidMix, buildStepTasks, type Task } from "@/services/patterns/session";
import { getSituationProgress } from "@/services/talk/progress";
import type { DayPlan } from "@/services/roadmap/plan";
import { TEST_PASS } from "@/services/roadmap/plan";
import type { Stage } from "@/services/roadmap/stages";
import { getRoadmap, markConversed, markDone, markTested, markTipSeen } from "@/services/roadmap/state";
import GrammarTipCard from "@/components/grammar/GrammarTipCard";
import PatternRunner from "@/components/patterns/PatternRunner";
import TranslateRound from "@/components/patterns/TranslateRound";
import Conversation from "@/components/talk/Conversation";

/** One screen of the day: a part of a task (a task with two steps is two screens) */
type Screen =
  | { kind: "tip" }
  | { kind: "review"; patternIds: string[] }
  | { kind: "step"; patternId: string; step: number }
  | { kind: "test" }
  | { kind: "conversation"; situationId: string };

function screensOf(plan: DayPlan): Screen[] {
  return plan.tasks.flatMap<Screen>((t) => {
    if (t.kind === "review") return [{ kind: "review", patternIds: t.patternIds }];
    if (t.kind === "step") return t.steps.map((step) => ({ kind: "step" as const, patternId: t.patternId, step }));
    if (t.kind === "test") return [{ kind: "test" }];
    return [{ kind: "conversation", situationId: t.situationId }];
  });
}

/** Today's work on the path, one screen after the other, then what it came to */
export default function DaySession({ stage, plan, onExit }: { stage: Stage; plan: DayPlan; onExit: () => void }) {
  // The first day of a stage opens with its grammar tip (decided once: reading it must not move the screens)
  const [withTip] = useState(() => !!tipForStage(stage.id) && !getRoadmap().tipSeen.includes(stage.id));
  const screens = useMemo<Screen[]>(() => [...(withTip ? [{ kind: "tip" as const }] : []), ...screensOf(plan)], [plan, withTip]);
  const [index, setIndex] = useState(0);
  const prepared = useRef(new Map<number, Task[]>());
  const talkRunsBefore = useRef(0);
  const screen = screens[index];
  const finished = index >= screens.length;
  const next = () => setIndex((i) => i + 1);

  // A step that cannot be done (the one before it did not pass) is skipped
  const blocked = screen?.kind === "step" && getPatternState(screen.patternId).step < screen.step - 1;
  useEffect(() => {
    if (blocked) next();
  }, [blocked, index]);

  // The talk has no end of its own: it counts as played when its number of runs went up
  useEffect(() => {
    if (screen?.kind === "conversation") talkRunsBefore.current = getSituationProgress(screen.situationId).runs;
  }, [screen]);

  const tasksFor = (i: number, make: () => Task[]) => {
    if (!prepared.current.has(i)) prepared.current.set(i, make());
    return prepared.current.get(i)!;
  };

  // When the last screen is done: the stage is finished if all its parts are
  const [stageDone, setStageDone] = useState(false);
  useEffect(() => {
    if (!finished) return;
    const road = getRoadmap();
    const allLearned = stage.patterns.every((p) => getPatternState(p.id).step >= STEPS);
    const talked = !stage.conversationId || road.conversed.includes(stage.id);
    if (allLearned && road.tested.includes(stage.id) && talked) {
      markDone(stage.id);
      setStageDone(true);
    }
  }, [finished, stage]);

  if (finished) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
          <p className="font-bold text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-2">
            <PartyPopper className="w-5 h-5" /> {stageDone ? `Xong chặng "${stage.title}"!` : "Xong phần hôm nay!"}
          </p>
          {stageDone ? (
            <>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">Bạn đã nói được:</p>
              <ul className="text-sm text-emerald-900 dark:text-emerald-100 list-disc pl-5">
                {stage.patterns.map((p: Pattern) => (
                  <li key={p.id}>{p.frame_en}</li>
                ))}
              </ul>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">Chặng tiếp theo đã mở.</p>
            </>
          ) : (
            <p className="text-sm text-emerald-900 dark:text-emerald-100">Phần tiếp theo của chặng sẽ sẵn sàng vào ngày mai. Mỗi bước cần cách nhau một ngày để nhớ lâu hơn.</p>
          )}
        </div>
        <button onClick={onExit} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
          Xong
        </button>
      </div>
    );
  }

  const label = `Chặng: ${stage.title} · phần ${Math.min(index + 1, screens.length)}/${screens.length}`;

  if (blocked) return <p className="text-sm text-slate-600 dark:text-zinc-400">Đang chuyển…</p>;

  if (screen.kind === "tip") {
    const tip = tipForStage(stage.id)!;
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-cyan-300 dark:border-cyan-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 inline-flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4" /> Trước khi bắt đầu: ngữ pháp của chặng "{stage.title}"
          </p>
          <GrammarTipCard tip={tip} />
        </div>
        <button
          onClick={() => {
            markTipSeen(stage.id);
            next();
          }}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
        >
          Đã hiểu, học tiếp
        </button>
        <button onClick={next} className="w-full min-h-11 text-xs font-semibold underline underline-offset-2 text-slate-600 dark:text-zinc-400">
          Để sau, vào học luôn
        </button>
      </div>
    );
  }

  if (screen.kind === "review") {
    const patterns = screen.patternIds.map(getPattern).filter((p): p is Pattern => !!p);
    return (
      <PatternRunner
        key={index}
        title="Ôn lại"
        kind="rapid-mix"
        pattern={null}
        step={STEPS}
        tasks={tasksFor(index, () => buildRapidMix(patterns, 4))}
        onExit={onExit}
        onDone={next}
      />
    );
  }

  if (screen.kind === "step") {
    const pattern = getPattern(screen.patternId)!;
    return (
      <PatternRunner
        key={index}
        title={pattern.frame_en}
        kind="ladder"
        pattern={pattern}
        step={screen.step}
        tasks={tasksFor(index, () => buildStepTasks(pattern, screen.step))}
        onExit={onExit}
        onDone={next}
      />
    );
  }

  if (screen.kind === "test") {
    return (
      <TranslateRound
        key={index}
        patterns={stage.patterns}
        title={`Thử thách: ${stage.title}`}
        onExit={onExit}
        onDone={next}
        onFinish={(results) => {
          if (results.filter((r) => r.ok).length >= TEST_PASS) markTested(stage.id);
        }}
      />
    );
  }

  const situation = getSituation(screen.situationId);
  if (!situation) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600 dark:text-zinc-400">{label}</p>
      <div className="flex flex-col h-[calc(100dvh-11rem)] min-h-[26rem] rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <Conversation
          key={index}
          situation={situation}
          onBack={() => {
            if (getSituationProgress(situation.id).runs > talkRunsBefore.current) markConversed(stage.id);
            next();
          }}
        />
      </div>
    </div>
  );
}
