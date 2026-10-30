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
import Collapse from "../ui/Collapse";
import { Button, Card, ProgressBar } from "../ui/kit";
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
        <span key={i} className={`w-2 h-2 rounded-full ${i < step ? "bg-teal-700 dark:bg-teal-500" : "bg-slate-200 dark:bg-zinc-700"}`} />
      ))}
    </span>
  );
}

function GoalPicker({ current, onPick, onLater }: { current: RoadmapGoal | null; onPick: (g: RoadmapGoal) => void; onLater?: () => void }) {
  return (
    <Card className="space-y-3">
      <div>
        <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Bạn muốn dùng tiếng Anh để làm gì?</p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">App sắp xếp lộ trình nói theo mục tiêu này. Bạn đổi lại được bất cứ lúc nào.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((g) => (
          <button
            key={g}
            onClick={() => onPick(g)}
            className={`min-w-0 min-h-14 text-left rounded-xl border px-3 py-2.5 ${
              current === g
                ? "border-teal-700 bg-teal-50 text-teal-900 ring-1 ring-teal-700 dark:border-teal-500 dark:bg-teal-400/10 dark:text-teal-100 dark:ring-teal-500"
                : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 hover:border-teal-600/50"
            }`}
          >
            <span className="block text-sm font-semibold">{GOAL_LABEL[g]}</span>
            <span className="block text-xs text-slate-500 dark:text-zinc-400">{GOAL_HINT[g]}</span>
          </button>
        ))}
      </div>
      {onLater && (
        <button onClick={onLater} className="min-h-10 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
          Để sau (học theo thứ tự chung)
        </button>
      )}
    </Card>
  );
}

/** The grammar behind a stage's sentences, folded: one tap to see why they are built the way they are */
function StageGrammar({ stageId, onOpenLesson }: { stageId: string; onOpenLesson?: (lessonId: string) => void }) {
  const [shown, setShown] = useState(false);
  const tip = tipForStage(stageId);
  if (!tip) return null;
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50">
      <button onClick={() => setShown(!shown)} aria-expanded={shown} className="w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-2 min-w-0 text-sm font-semibold text-slate-700 dark:text-zinc-300">
          <GraduationCap className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
          <span className="truncate">Vì sao nói vậy? {tip.title}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${shown ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={shown}>
        <div className="px-3 pb-3">
          <GrammarTipCard tip={tip} onOpenLesson={onOpenLesson} />
        </div>
      </Collapse>
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
      <div className="max-w-2xl mx-auto w-full space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Lộ trình nói</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Mỗi chặng một chủ đề: học vài mẫu câu, thay chỗ trống, ghép câu, trả lời nhanh, rồi nói một hội thoại. Gặp lại cùng câu nhiều lần là nói được mà không cần nghĩ.
          </p>
        </div>

        {PATTERNS.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có mẫu câu nào.</p>}

        {notice && (
          <p className="bar-enter rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 px-3 py-2.5 text-sm" role="status">
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
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
                  Chặng {stages.indexOf(current) + 1}/{stages.length} · {GOAL_LABEL[road.goal ?? "all"]}
                </p>
                <p className="text-xl font-semibold text-slate-900 dark:text-zinc-100">{current.title}</p>
              </div>
              <button onClick={() => setChangingGoal(true)} className="shrink-0 min-h-10 px-1 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
                Đổi mục tiêu
              </button>
            </div>
            {plan.tasks.length > 0 ? (
              <Button size="lg" block onClick={startDay}>
                <Play className="w-5 h-5" /> Bắt đầu hôm nay (~{plan.minutes} phút)
              </Button>
            ) : (
              <p className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-300">
                {plan.complete ? "Chặng này đã đủ điều kiện hoàn thành: bấm vào chặng ở dưới để đóng lại." : "Hôm nay bạn đã xong phần của chặng này. Quay lại vào ngày mai để làm bước tiếp theo (mỗi bước cách nhau một ngày để nhớ lâu)."}
              </p>
            )}
            <div className="space-y-1.5">
              <div aria-label="Tiến độ lộ trình">
                <ProgressBar value={(finishedCount / Math.max(1, stages.length)) * 100} />
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Đã xong {finishedCount}/{stages.length} chặng · còn {etaText} nếu học {minutes} phút mỗi ngày
              </p>
            </div>
            {startsLower && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Mẫu câu {wantedLevel} chưa có, nên lộ trình tạm bắt đầu từ {stages[0].level}. Bạn vẫn học từ vựng {wantedLevel} như bình thường.
              </p>
            )}
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              Chặng này: {current.patterns.map((p) => p.frame_en).join("  ·  ")}
            </p>
            <StageGrammar stageId={current.id} onOpenLesson={onOpenGrammarLesson} />

            {upperLevel &&
              (jumping ? (
                <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-3 space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                  <p>
                    Đánh dấu {leftInLevel} chặng {current.level} còn lại là đã biết và chuyển sang {upperLevel}? Bạn vẫn xem lại được từng chặng ở danh sách dưới.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        const n = skipLevel(stages, current.level);
                        setJumping(false);
                        setNotice(`Đã bỏ qua ${n} chặng ${current.level}. Bạn đang ở cấp ${upperLevel}.`);
                      }}
                    >
                      Nhảy lên {upperLevel}
                    </Button>
                    <Button variant="secondary" onClick={() => setJumping(false)}>
                      Không
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setJumping(true)} className="min-h-10 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
                  Đã vững {current.level}? Nhảy lên cấp {upperLevel}
                </button>
              ))}
          </Card>
        ) : (
          <Card className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              🎉 Bạn đã đi hết lộ trình {level}! Bạn vẫn luyện thêm bằng "Hỏi đáp nhanh" và "Dịch câu" bên dưới.
            </p>
          </Card>
        )}

        {PATTERNS.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setTranslating(true)} className="min-w-0 text-left rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 md:p-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-teal-600/50">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                <Languages className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900 dark:text-zinc-100">Dịch câu</span>
                <span className="block text-sm text-slate-500 dark:text-zinc-400">10 câu, có đồng hồ</span>
              </span>
            </button>
            {poolSize > 0 && (
              <button onClick={rapid} className="min-w-0 text-left rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 md:p-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:border-teal-600/50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                  <Zap className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900 dark:text-zinc-100">Hỏi đáp nhanh</span>
                  <span className="block text-sm text-slate-500 dark:text-zinc-400">
                    {poolSize} mẫu đã học · thuộc {masteredCount()}/{PATTERNS.length}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="pt-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">Các chặng</h3>
          {stages.map((stage, i) => {
            const status = road.done.includes(stage.id) ? "done" : road.skipped.includes(stage.id) ? "skipped" : stage === current ? "current" : "later";
            const isOpen = open === stage.id;
            return (
              <div key={stage.id} className={`rounded-2xl border ${status === "current" ? "border-teal-600/60 dark:border-teal-500/50" : "border-slate-200 dark:border-zinc-800"} bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)]`}>
                <button onClick={() => setOpen(isOpen ? null : stage.id)} className="w-full min-h-14 flex items-center gap-3 p-3.5 text-left" aria-expanded={isOpen}>
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full text-xs font-bold inline-flex items-center justify-center ${
                      status === "done" || status === "skipped"
                        ? "bg-green-600 text-white"
                        : status === "current"
                          ? "bg-teal-700 text-white dark:bg-teal-600"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    {status === "done" || status === "skipped" ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900 dark:text-zinc-100">{stage.title}</span>
                    <span className="block text-sm text-slate-500 dark:text-zinc-400">
                      {stage.patterns.length} mẫu câu · {stage.words.length} từ
                      {status === "skipped" ? " · đã biết rồi" : status === "done" ? " · đã xong" : ""}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <Collapse open={isOpen}>
                  <div className="px-3.5 pb-3.5 space-y-2">
                    <StageGrammar stageId={stage.id} onOpenLesson={onOpenGrammarLesson} />
                    {stage.patterns.map((p) => {
                      const s = stateOf(p);
                      const avg = averageTime(s);
                      return (
                        <button key={p.id} onClick={() => learn(p)} className="w-full text-left rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-0.5 hover:border-teal-600/50">
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 font-semibold text-slate-900 dark:text-zinc-100">{p.frame_en}</span>
                            <StepDots step={s.step} />
                          </span>
                          <span className="block text-sm text-slate-700 dark:text-zinc-300">{p.frame_vi}</span>
                          <span className="block text-xs text-slate-500 dark:text-zinc-400">
                            {s.step >= STEPS ? "Đã thuộc · bấm để hỏi đáp nhanh" : s.step === 0 ? "Chưa học" : `Tiếp theo: ${STEP_LABELS[s.step]}`}
                            {avg !== null ? ` · trả lời trung bình ${(avg / 1000).toFixed(1)} giây` : ""}
                          </span>
                        </button>
                      );
                    })}
                    {status !== "done" && status !== "skipped" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {status !== "current" && (
                          <Button variant="secondary" size="sm" className="flex-1 min-h-11" onClick={() => setFocus(stage.id)}>
                            Học chặng này
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="flex-1 min-h-11" onClick={() => setSkipTest(stage)}>
                          <SkipForward className="w-4 h-4" /> Làm bài kiểm tra để bỏ qua
                        </Button>
                      </div>
                    )}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
