import { useEffect, useMemo, useState } from "react";
import { Layers, Zap } from "lucide-react";
import { getPattern, PATTERNS, patternLevels } from "@/data/patterns";
import type { Pattern, PatternGoal, PatternLevel } from "@/types/pattern";
import { getStudyLevels } from "@/services/vocabFeed";
import {
  allPatternStates,
  averageTime,
  duePatterns,
  masteredCount,
  PATTERNS_UPDATED_EVENT,
  rapidPool,
  STEP_LABELS,
  STEPS,
  type PatternState,
} from "@/services/patterns/progress";
import { buildRapidMix, buildStepTasks, type Task } from "@/services/patterns/session";
import { PAGE_CONTAINER } from "../dashboard/shared";
import PatternRunner from "./PatternRunner";

const GOALS: Array<{ id: PatternGoal | "all"; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "travel", label: "Du lịch" },
  { id: "work", label: "Đi làm" },
  { id: "daily", label: "Đời sống" },
  { id: "social", label: "Kết bạn" },
];
const GOAL_KEY = "patterns.goal";

function readGoal(): PatternGoal | "all" {
  try {
    const v = localStorage.getItem(GOAL_KEY);
    return GOALS.some((g) => g.id === v) ? (v as PatternGoal | "all") : "all";
  } catch {
    return "all";
  }
}

interface Session {
  title: string;
  kind: "ladder" | "rapid-mix";
  pattern: Pattern | null;
  step: number;
  tasks: Task[];
}

const fresh: PatternState = { step: 0, due: "", box: 0, times: [], lastDay: "" };

function StepDots({ step }: { step: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Đã xong ${step}/${STEPS} bước`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < step ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"}`} />
      ))}
    </span>
  );
}

/** Mẫu câu: sentence frames learned in four steps (learn, substitute, build, answer fast), then kept by review */
export default function PatternsTab({ resetKey }: { resetKey?: number }) {
  const [session, setSession] = useState<Session | null>(null);
  const [, setTick] = useState(0);
  const [goal, setGoal] = useState<PatternGoal | "all">(readGoal);
  const levels = useMemo(() => patternLevels(), []);
  const [level, setLevel] = useState<PatternLevel>(() => levels.find((l) => getStudyLevels().includes(l)) ?? levels[0] ?? "A1");

  useEffect(() => setSession(null), [resetKey]);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(PATTERNS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PATTERNS_UPDATED_EVENT, refresh);
  }, []);

  const chooseGoal = (g: PatternGoal | "all") => {
    setGoal(g);
    try {
      localStorage.setItem(GOAL_KEY, g);
    } catch {
      /* only a convenience */
    }
  };

  const states = allPatternStates();
  const stateOf = (p: Pattern) => states[p.id] ?? fresh;
  const shown = useMemo(() => PATTERNS.filter((p) => p.level === level && (goal === "all" || p.goals.includes(goal))), [level, goal]);
  const groups = useMemo(() => {
    const byTopic = new Map<string, { title: string; items: Pattern[] }>();
    for (const p of shown) {
      const g = byTopic.get(p.topic) ?? { title: p.topic_vi, items: [] };
      g.items.push(p);
      byTopic.set(p.topic, g);
    }
    return [...byTopic.values()];
  }, [shown]);

  const learn = (p: Pattern) => {
    const step = stateOf(p).step;
    // A mastered pattern is practised in rapid-fire; the others do their next step
    if (step >= STEPS) setSession({ title: p.frame_en, kind: "rapid-mix", pattern: null, step: STEPS, tasks: buildStepTasks(p, STEPS) });
    else setSession({ title: p.frame_en, kind: "ladder", pattern: p, step: step + 1, tasks: buildStepTasks(p, step + 1) });
  };

  const rapid = () => {
    const pool = rapidPool()
      .map(getPattern)
      .filter((p): p is Pattern => !!p);
    if (pool.length > 0) setSession({ title: "Hỏi đáp nhanh", kind: "rapid-mix", pattern: null, step: STEPS, tasks: buildRapidMix(pool, 8) });
  };

  if (session) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-2xl mx-auto w-full">
          <PatternRunner key={session.title + session.step} {...session} onExit={() => setSession(null)} />
        </div>
      </div>
    );
  }

  const dueIds = duePatterns();
  const next = shown.find((p) => stateOf(p).step < STEPS && (stateOf(p).step === 0 || dueIds.includes(p.id)));
  const poolSize = rapidPool().length;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mẫu câu</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Học một khung câu, thay chỗ trống bằng nhiều từ, ghép câu rồi trả lời thật nhanh. Gặp lại nhiều lần là nói được mà không cần nghĩ.
          </p>
        </div>

        {PATTERNS.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có mẫu câu nào.</p>}

        {next && (
          <button onClick={() => learn(next)} className="w-full text-left rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
            <Layers className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-emerald-900 dark:text-emerald-200">Học tiếp: {next.frame_en}</span>
              <span className="block text-xs text-emerald-800 dark:text-emerald-300">
                {next.topic_vi} · bước {stateOf(next).step + 1}/{STEPS}: {STEP_LABELS[stateOf(next).step]}
              </span>
            </span>
          </button>
        )}

        {poolSize > 0 && (
          <button onClick={rapid} className="w-full text-left rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-amber-900 dark:text-amber-200">Hỏi đáp nhanh</span>
              <span className="block text-xs text-amber-800 dark:text-amber-300">
                Máy hỏi, bạn trả lời trong vài giây ({poolSize} mẫu đã học). Đã thuộc {masteredCount()}/{PATTERNS.length}.
              </span>
            </span>
          </button>
        )}

        {levels.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Cấp độ">
            {levels.map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={level === l}
                onClick={() => setLevel(l)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border ${
                  level === l ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Bạn muốn dùng tiếng Anh để:</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Mục tiêu">
            {GOALS.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={goal === g.id}
                onClick={() => chooseGoal(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  goal === g.id ? "bg-violet-600 border-violet-600 text-white" : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.title} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{g.title}</h3>
            {g.items.map((p) => {
              const s = stateOf(p);
              const avg = averageTime(s);
              return (
                <button key={p.id} onClick={() => learn(p)} className="w-full text-left rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{p.frame_en}</span>
                    <StepDots step={s.step} />
                  </span>
                  <span className="block text-sm text-slate-600 dark:text-zinc-400">{p.frame_vi}</span>
                  <span className="block text-xs text-slate-500 dark:text-zinc-500">
                    {s.step >= STEPS ? "Đã thuộc · bấm để hỏi đáp nhanh" : s.step === 0 ? "Chưa học" : `Tiếp theo: ${STEP_LABELS[s.step]}`}
                    {avg !== null ? ` · trả lời trung bình ${(avg / 1000).toFixed(1)} giây` : ""}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        {shown.length === 0 && PATTERNS.length > 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Mục tiêu này chưa có mẫu ở cấp {level}. Thử chọn "Tất cả".</p>}
      </div>
    </div>
  );
}
