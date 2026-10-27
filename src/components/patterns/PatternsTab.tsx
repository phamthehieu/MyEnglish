import { useEffect, useState } from "react";
import { Check, ChevronDown, GraduationCap, Languages, Play, SkipForward, Zap } from "lucide-react";
import { getPattern, PATTERNS } from "@/data/patterns";
import { tipForStage } from "@/data/grammarTips";
import type { Pattern } from "@/types/pattern";
import { averageTime, masteredCount, rapidPool, STEP_LABELS, STEPS, type PatternState } from "@/services/patterns/progress";
import { buildRapidMix, buildStepTasks, type Task } from "@/services/patterns/session";
import { SKIP_PASS, type DayPlan } from "@/services/roadmap/plan";
import { GOAL_LABEL, type RoadmapGoal, type Stage } from "@/services/roadmap/stages";
import { isFinished, setFocus, setGoal, skipLevel, skipStage } from "@/services/roadmap/state";
import { addStageWords } from "@/services/roadmap/words";
import { PAGE_CONTAINER } from "../dashboard/shared";
import GrammarTipCard from "../grammar/GrammarTipCard";
import DaySession from "../roadmap/DaySession";
import { useRoadmap } from "../roadmap/useRoadmap";
import PatternRunner from "./PatternRunner";
import TranslateRound from "./TranslateRound";

/** Set by the Today screen: open the day's work at once */
export const AUTOSTART_KEY = "roadmap.autostart";

const GOALS: RoadmapGoal[] = ["travel", "work", "daily", "social"];
const GOAL_HINT: Record<RoadmapGoal, string> = {
  travel: "Gọi món, hỏi đường, mua vé, khách sạn",
  work: "Giới thiệu, nghề nghiệp, giờ giấc, nhờ giúp",
  daily: "Ăn uống, mua sắm, sức khỏe, sở thích",
  social: "Chào hỏi, gia đình, cảm xúc, rủ rê",
  all: "",
};

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

function GoalPicker({ current, onPick, onLater }: { current: RoadmapGoal | null; onPick: (g: RoadmapGoal) => void; onLater?: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
      <div>
        <p className="font-bold text-violet-900 dark:text-violet-200">Bạn muốn dùng tiếng Anh để làm gì?</p>
        <p className="text-xs text-violet-800 dark:text-violet-300">App sắp xếp lộ trình nói theo mục tiêu này. Bạn đổi lại được bất cứ lúc nào.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((g) => (
          <button
            key={g}
            onClick={() => onPick(g)}
            className={`text-left rounded-xl border px-3 py-2.5 ${
              current === g ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
            }`}
          >
            <span className="block text-sm font-bold">{GOAL_LABEL[g]}</span>
            <span className={`block text-[11px] ${current === g ? "text-violet-100" : "text-slate-500 dark:text-zinc-400"}`}>{GOAL_HINT[g]}</span>
          </button>
        ))}
      </div>
      {onLater && (
        <button onClick={onLater} className="text-xs font-semibold underline underline-offset-2 text-violet-800 dark:text-violet-300">
          Để sau (học theo thứ tự chung)
        </button>
      )}
    </div>
  );
}

/** The grammar behind a stage's sentences, folded: one tap to see why they are built the way they are */
function StageGrammar({ stageId, onOpenLesson }: { stageId: string; onOpenLesson?: (lessonId: string) => void }) {
  const [shown, setShown] = useState(false);
  const tip = tipForStage(stageId);
  if (!tip) return null;
  return (
    <div className="rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-cyan-200 dark:border-cyan-900/60">
      <button onClick={() => setShown(!shown)} aria-expanded={shown} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-2 min-w-0 text-sm font-semibold text-cyan-900 dark:text-cyan-200">
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span className="truncate">Vì sao nói vậy? {tip.title}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${shown ? "rotate-180" : ""}`} />
      </button>
      {shown && (
        <div className="px-3 pb-3">
          <GrammarTipCard tip={tip} onOpenLesson={onOpenLesson} />
        </div>
      )}
    </div>
  );
}

/** Mẫu câu: the path of stages (one topic each), and the library of patterns under it */
export default function PatternsTab({ resetKey, onOpenGrammarLesson }: { resetKey?: number; onOpenGrammarLesson?: (lessonId: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [translating, setTranslating] = useState(false);
  const [day, setDay] = useState<{ stage: Stage; plan: DayPlan } | null>(null);
  const [skipTest, setSkipTest] = useState<Stage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [changingGoal, setChangingGoal] = useState(false);
  useEffect(() => {
    setSession(null);
    setTranslating(false);
    setDay(null);
    setSkipTest(null);
  }, [resetKey]);

  const { road, states, minutes, stages, current, plan, finishedCount, etaText, wantedLevel, startsLower } = useRoadmap();
  const [jumping, setJumping] = useState(false);
  // The next level of the path above the one being worked on: the learner can jump to it when they know this one
  const upperLevel = current ? stages.find((s) => s.level > current.level)?.level ?? null : null;
  const leftInLevel = current ? stages.filter((s) => s.level === current.level && !isFinished(road, s.id)).length : 0;
  // The level being worked on (the last one when the whole path is done)
  const level = current?.level ?? stages[stages.length - 1]?.level ?? "A1";
  const stateOf = (p: Pattern) => states[p.id] ?? fresh;

  // Starting the day: the words of the stage go to the word bank (once per stage) so they come back as cards too
  const begin = (stage: Stage, dayPlan: DayPlan) => {
    setDay({ stage, plan: dayPlan });
    void addStageWords(stage).then((n) => {
      if (n > 0) setNotice(`Đã thêm ${n} từ của chặng "${stage.title}" vào sổ từ của bạn.`);
    });
  };
  const startDay = () => {
    if (current && plan && plan.tasks.length > 0) begin(current, plan);
  };

  // The Today screen asks to start the day's work at once
  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(AUTOSTART_KEY) === "1";
      if (wanted) sessionStorage.removeItem(AUTOSTART_KEY);
    } catch {
      /* ignore */
    }
    if (wanted && current && plan && plan.tasks.length > 0) begin(current, plan);
    // only once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (day) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-2xl mx-auto w-full">
          <DaySession stage={day.stage} plan={day.plan} onExit={() => setDay(null)} />
        </div>
      </div>
    );
  }

  if (skipTest) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-2xl mx-auto w-full">
          <TranslateRound
            patterns={skipTest.patterns}
            forceNoHints
            title={`Kiểm tra: ${skipTest.title}`}
            onExit={() => setSkipTest(null)}
            onDone={() => setSkipTest(null)}
            onFinish={(results) => {
              const right = results.filter((r) => r.ok).length;
              if (right >= SKIP_PASS) {
                skipStage(skipTest.id);
                setNotice(`Đúng ${right}/10: chặng "${skipTest.title}" đã được đánh dấu xong.`);
              } else {
                setNotice(`Đúng ${right}/10, cần ít nhất ${SKIP_PASS} để bỏ qua chặng "${skipTest.title}". Bạn học chặng này trước nhé.`);
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (translating) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-2xl mx-auto w-full">
          <TranslateRound patterns={PATTERNS.filter((p) => p.level === level)} onExit={() => setTranslating(false)} />
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className={PAGE_CONTAINER}>
        <div className="max-w-2xl mx-auto w-full">
          <PatternRunner key={session.title + session.step} {...session} onExit={() => setSession(null)} />
        </div>
      </div>
    );
  }

  const poolSize = rapidPool().length;
  const needsGoal = road.goal === null || changingGoal;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Lộ trình nói</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Mỗi chặng một chủ đề: học vài mẫu câu, thay chỗ trống, ghép câu, trả lời nhanh, rồi nói một hội thoại. Gặp lại cùng câu nhiều lần là nói được mà không cần nghĩ.
          </p>
        </div>

        {PATTERNS.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có mẫu câu nào.</p>}

        {notice && (
          <p className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 px-3 py-2 text-sm" role="status">
            {notice}
          </p>
        )}

        {needsGoal ? (
          <GoalPicker
            current={road.goal}
            onPick={(g) => {
              setGoal(g);
              setChangingGoal(false);
            }}
            onLater={() => {
              setGoal("all");
              setChangingGoal(false);
            }}
          />
        ) : current && plan ? (
          <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Chặng {stages.indexOf(current) + 1}/{stages.length} · {GOAL_LABEL[road.goal ?? "all"]}
                </p>
                <p className="text-lg font-bold text-emerald-950 dark:text-emerald-100">{current.title}</p>
              </div>
              <button onClick={() => setChangingGoal(true)} className="shrink-0 text-xs font-semibold underline underline-offset-2 text-emerald-800 dark:text-emerald-300">
                Đổi mục tiêu
              </button>
            </div>
            <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden" aria-label="Tiến độ lộ trình">
              <div className="h-full bg-emerald-600" style={{ width: `${(finishedCount / Math.max(1, stages.length)) * 100}%` }} />
            </div>
            <p className="text-xs text-emerald-900 dark:text-emerald-200">
              Đã xong {finishedCount}/{stages.length} chặng · còn {etaText} nếu học {minutes} phút mỗi ngày
            </p>
            {startsLower && (
              <p className="text-xs text-emerald-900 dark:text-emerald-200">
                Mẫu câu {wantedLevel} chưa có, nên lộ trình tạm bắt đầu từ {stages[0].level}. Bạn vẫn học từ vựng {wantedLevel} như bình thường.
              </p>
            )}
            <p className="text-xs text-emerald-900 dark:text-emerald-200">
              Chặng này: {current.patterns.map((p) => p.frame_en).join("  ·  ")}
            </p>
            <StageGrammar stageId={current.id} onOpenLesson={onOpenGrammarLesson} />

            {upperLevel &&
              (jumping ? (
                <div className="rounded-xl bg-white/70 dark:bg-zinc-900/60 px-3 py-2 space-y-2 text-xs text-emerald-900 dark:text-emerald-100">
                  <p>
                    Đánh dấu {leftInLevel} chặng {current.level} còn lại là đã biết và chuyển sang {upperLevel}? Bạn vẫn xem lại được từng chặng ở danh sách dưới.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const n = skipLevel(stages, current.level);
                        setJumping(false);
                        setNotice(`Đã bỏ qua ${n} chặng ${current.level}. Bạn đang ở cấp ${upperLevel}.`);
                      }}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      Nhảy lên {upperLevel}
                    </button>
                    <button onClick={() => setJumping(false)} className="flex-1 py-2 rounded-lg border border-emerald-400 dark:border-emerald-700 font-semibold">
                      Không
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setJumping(true)} className="text-xs font-semibold underline underline-offset-2 text-emerald-800 dark:text-emerald-300">
                  Đã vững {current.level}? Nhảy lên cấp {upperLevel}
                </button>
              ))}
            {plan.tasks.length > 0 ? (
              <button onClick={startDay} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Bắt đầu hôm nay (~{plan.minutes} phút)
              </button>
            ) : (
              <p className="rounded-xl bg-white/70 dark:bg-zinc-900/60 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
                {plan.complete ? "Chặng này đã đủ điều kiện hoàn thành: bấm vào chặng ở dưới để đóng lại." : "Hôm nay bạn đã xong phần của chặng này. Quay lại vào ngày mai để làm bước tiếp theo (mỗi bước cách nhau một ngày để nhớ lâu)."}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            🎉 Bạn đã đi hết lộ trình {level}! Bạn vẫn luyện thêm bằng "Hỏi đáp nhanh" và "Dịch câu" bên dưới.
          </p>
        )}

        {PATTERNS.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setTranslating(true)} className="text-left rounded-2xl border-2 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/30 p-3.5 flex items-center gap-3">
              <Languages className="w-5 h-5 shrink-0 text-sky-700 dark:text-sky-300" />
              <span className="min-w-0">
                <span className="block font-bold text-sky-900 dark:text-sky-200">Dịch câu</span>
                <span className="block text-xs text-sky-800 dark:text-sky-300">10 câu, có đồng hồ</span>
              </span>
            </button>
            {poolSize > 0 && (
              <button onClick={rapid} className="text-left rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex items-center gap-3">
                <Zap className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <span className="min-w-0">
                  <span className="block font-bold text-amber-900 dark:text-amber-200">Hỏi đáp nhanh</span>
                  <span className="block text-xs text-amber-800 dark:text-amber-300">
                    {poolSize} mẫu đã học · thuộc {masteredCount()}/{PATTERNS.length}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Các chặng</h3>
          {stages.map((stage, i) => {
            const status = road.done.includes(stage.id) ? "done" : road.skipped.includes(stage.id) ? "skipped" : stage === current ? "current" : "later";
            const isOpen = open === stage.id;
            return (
              <div key={stage.id} className={`rounded-2xl border ${status === "current" ? "border-emerald-400 dark:border-emerald-700" : "border-slate-200 dark:border-zinc-800"} bg-white dark:bg-zinc-900`}>
                <button onClick={() => setOpen(isOpen ? null : stage.id)} className="w-full flex items-center gap-3 p-3.5 text-left" aria-expanded={isOpen}>
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full text-xs font-bold inline-flex items-center justify-center ${
                      status === "done" || status === "skipped"
                        ? "bg-emerald-600 text-white"
                        : status === "current"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    {status === "done" || status === "skipped" ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900 dark:text-white">{stage.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-zinc-400">
                      {stage.patterns.length} mẫu câu · {stage.words.length} từ
                      {status === "skipped" ? " · đã biết rồi" : status === "done" ? " · đã xong" : ""}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2">
                    <StageGrammar stageId={stage.id} onOpenLesson={onOpenGrammarLesson} />
                    {stage.patterns.map((p) => {
                      const s = stateOf(p);
                      const avg = averageTime(s);
                      return (
                        <button key={p.id} onClick={() => learn(p)} className="w-full text-left rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-0.5">
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
                    {status !== "done" && status !== "skipped" && (
                      <div className="flex gap-2 pt-1">
                        {status !== "current" && (
                          <button onClick={() => setFocus(stage.id)} className="flex-1 py-2 rounded-xl border border-emerald-400 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
                            Học chặng này
                          </button>
                        )}
                        <button onClick={() => setSkipTest(stage)} className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                          <SkipForward className="w-4 h-4" /> Mình đã biết rồi
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
