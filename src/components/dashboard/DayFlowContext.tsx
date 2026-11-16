import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { advanceFlow, DAYFLOW_EVENT, getFlow, nextInFlow, stopFlow, type DayFlow } from "@/services/dayFlow";
import { getLine } from "@/data/situations";
import { tipForStage } from "@/data/grammarTips";
import { getAllGrammarProgress } from "@/services/grammarService";
import { lessonsIntroducedToday } from "@/services/grammarPath";
import { pronunciationPracticedToday } from "@/services/pronunciation";
import { isReflexPracticedToday } from "@/services/reflexChallenge";
import { getLocalDateString } from "@/services/streak";
import { TALK_UPDATED_EVENT } from "@/services/talk/progress";
import { dueLines } from "@/services/talk/review";
import { WEAK_POINTS_EVENT, weakGrammarStage } from "@/services/weakPoints";
import { useRoadmap } from "../roadmap/useRoadmap";
import type { DashboardTab } from "./shared";
import type { TodayTaskId } from "./todayPlan";

export const FLOW_LABEL: Record<TodayTaskId, string> = {
  speaking: "Lộ trình nói",
  talkReview: "Ôn câu hội thoại",
  vocab: "Ôn từ và học từ mới",
  weakGrammar: "Ngữ pháp hay sai",
  grammar: "Ngữ pháp",
  pronunciation: "Phát âm",
  reflex: "Luyện phản xạ",
};

/** Everything that says a thing of the day moved on: the flow reads its "done" again */
const PROGRESS_EVENTS = [
  "myenglish-grammar-updated",
  "myenglish-pronunciation-updated",
  "myenglish-reflex-updated",
  TALK_UPDATED_EVENT,
  WEAK_POINTS_EVENT,
];

function grammarStudiedToday(now: Date): boolean {
  if (lessonsIntroducedToday(now).length > 0) return true;
  const day = getLocalDateString(now);
  return Object.values(getAllGrammarProgress()).some((p) => !!p.lastAttemptDate && getLocalDateString(new Date(p.lastAttemptDate)) === day);
}

/** Whether a thing of the day is done, read the same way the Today list ticks it off */
function taskDone(id: TodayTaskId, s: { vocabLeft: number; speakingDone: boolean }, now: Date = new Date()): boolean {
  try {
    if (id === "speaking") return s.speakingDone;
    if (id === "vocab") return s.vocabLeft === 0;
    if (id === "talkReview") return dueLines(now).filter((line) => !!getLine(line)).length === 0;
    if (id === "weakGrammar") {
      const weak = weakGrammarStage(now);
      return !weak || !tipForStage(weak.stageId) || weak.reviewedToday;
    }
    if (id === "grammar") return grammarStudiedToday(now);
    if (id === "pronunciation") return pronunciationPracticedToday(now);
    return isReflexPracticedToday(now);
  } catch {
    return false;
  }
}

interface DayFlowState {
  flow: DayFlow | null;
  /** The thing the learner is on (null: no flow) */
  current: TodayTaskId | null;
  currentDone: boolean;
  /** The next thing not done yet (null: the current one is the last) */
  next: TodayTaskId | null;
  /** To the next thing, or back to Today after the last */
  go: () => void;
}

const IDLE: DayFlowState = { flow: null, current: null, currentDone: false, next: null, go: () => {} };
const DayFlowContext = createContext<DayFlowState>(IDLE);

export const useDayFlow = () => useContext(DayFlowContext);

/** The day's work on the speaking path is read with the path's own hook: only mounted while a flow holds it */
function SpeakingProbe({ onDone }: { onDone: (done: boolean) => void }) {
  const { road, plan } = useRoadmap();
  const done = road.goal !== null && (!plan || plan.tasks.length === 0);
  useEffect(() => onDone(done), [done, onDone]);
  return null;
}

interface DayFlowProviderProps {
  /** Cards still to do today (reviews and new words) */
  vocabLeft: number;
  activeTab: DashboardTab;
  onRun: (id: TodayTaskId) => void;
  onFinish: () => void;
  children: ReactNode;
}

/**
 * The day's flow for every screen: the bar at the top and the end of each lesson read it here, so both know which
 * thing the learner is on, whether it is done, and go to the next one the same way.
 */
export function DayFlowProvider({ vocabLeft, activeTab, onRun, onFinish, children }: DayFlowProviderProps) {
  const [flow, setFlow] = useState(() => getFlow());
  const [, setTick] = useState(0);
  const [speakingDone, setSpeakingDone] = useState(false);

  useEffect(() => {
    const sync = () => setFlow(getFlow());
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(DAYFLOW_EVENT, sync);
    for (const name of PROGRESS_EVENTS) window.addEventListener(name, bump);
    return () => {
      window.removeEventListener(DAYFLOW_EVENT, sync);
      for (const name of PROGRESS_EVENTS) window.removeEventListener(name, bump);
    };
  }, []);

  // Back on Today while on the last thing (or the only one): the list says what is left, the flow has nothing more to add
  useEffect(() => {
    if (activeTab !== "today") return;
    const now = getFlow();
    if (now && now.index >= now.queue.length - 1) stopFlow();
  }, [activeTab]);

  const isDone = (id: TodayTaskId) => taskDone(id, { vocabLeft, speakingDone });
  const current = flow ? flow.queue[flow.index] : null;
  const value: DayFlowState = {
    flow,
    current,
    currentDone: current ? isDone(current) : false,
    next: flow ? nextInFlow(flow, isDone) : null,
    go: () => {
      const id = advanceFlow(new Date(), isDone);
      if (id) onRun(id);
      else onFinish();
    },
  };

  return (
    <DayFlowContext.Provider value={value}>
      {flow?.queue.includes("speaking") && <SpeakingProbe onDone={setSpeakingDone} />}
      {children}
    </DayFlowContext.Provider>
  );
}

/**
 * The way on at the end of a lesson: "Tiếp: …" (or back to Today after the last thing), so the learner never looks for
 * the next thing of the day. Shows nothing outside a flow, or when the lesson is not the thing the flow is on.
 */
export function DayFlowNext({ task, onBefore, className = "" }: { task: TodayTaskId | readonly TodayTaskId[]; onBefore?: () => void; className?: string }) {
  const { current, next, go } = useDayFlow();
  if (!current || !(typeof task === "string" ? task === current : task.includes(current))) return null;
  return (
    <button
      type="button"
      data-testid="dayflow-next"
      onClick={() => {
        onBefore?.();
        go();
      }}
      className={`w-full min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-base font-semibold shadow-sm inline-flex items-center justify-center gap-2 ${className}`}
    >
      {next ? (
        <>
          Tiếp: {FLOW_LABEL[next]} <ArrowRight className="h-5 w-5 shrink-0" />
        </>
      ) : (
        <>
          Xong, về Hôm nay <Check className="h-5 w-5 shrink-0" />
        </>
      )}
    </button>
  );
}
