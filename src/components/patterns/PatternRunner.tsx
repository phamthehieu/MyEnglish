import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Keyboard, Mic, Send, Volume2, X } from "lucide-react";
import type { Pattern } from "@/types/pattern";
import { fillPattern } from "@/types/pattern";
import { handleSpeak } from "@/components/review/speech";
import { asrAvailable } from "@/services/pronunciationCheck";
import { judgeSpoken, matchTyped, type Tile } from "@/services/talk/engine";
import { lineOfSlot, patternSituation, tilesSpell } from "@/services/patterns/engine";
import { applySession, type SessionKind, type Task, type TaskResult } from "@/services/patterns/session";
import { STEP_LABELS } from "@/services/patterns/progress";
import MicButton, { PracticeTop } from "@/components/talk/MicButton";
import { useMic } from "@/components/talk/useMic";
import { useKeepVisible } from "./useKeepVisible";
import { IpaLine, IpaToggle } from "./Ipa";

/** How long a rapid-fire answer may take: speaking is quick, typing is slower */
const WINDOW_SAY_MS = 10000;
const WINDOW_TYPE_MS = 30000;
/** Extra time given for the one retry after a spoken answer that did not match */
const RETRY_BONUS_MS = 5000;

type Outcome = Omit<TaskResult, "patternId" | "kind">;

const BTN_PRIMARY =
  "w-full min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50";
/** The round outlined button next to the main one (clear the answer) */
const BTN_SIDE =
  "px-5 min-h-14 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300";
const CARD = "rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]";
/** A word tile to pick, and one already placed in the answer */
const TILE = "px-3 min-h-11 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-zinc-100 hover:border-teal-600/50";
const TILE_PLACED = "px-3 min-h-11 rounded-xl bg-teal-700 dark:bg-teal-600 text-white text-sm font-semibold";

/** About how long the voice takes to say a sentence */
const speechMs = (text: string) => 600 + text.trim().split(/\s+/).length * 450;

function Blank({ frame, fill }: { frame: string; fill?: string }) {
  const [a, b] = frame.split("___");
  return (
    <span>
      {a}
      <span className={fill ? "font-bold text-green-700 dark:text-green-300" : "px-3 border-b-2 border-slate-400 dark:border-zinc-500"}>{fill ?? "    "}</span>
      {b}
    </span>
  );
}

function Speaker({ text, label = "Nghe" }: { text: string; label?: string }) {
  return (
    <button onClick={() => handleSpeak(text)} aria-label={label} className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-full bg-teal-50 hover:bg-teal-100 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300">
      <Volume2 className="w-4 h-4" />
    </button>
  );
}

/** Step 1: the frame, how it works, sentences to hear, and a try at saying one */
function LearnCard({ pattern, onNext }: { pattern: Pattern; onNext: (o: Outcome) => void }) {
  const canSpeak = asrAvailable();
  const mic = useMic();
  const [slotIndex] = useState(() => Math.floor(Math.random() * pattern.slots.length));
  const slot = pattern.slots[slotIndex];
  const line = lineOfSlot(pattern, slot);
  const [heard, setHeard] = useState<string | null>(null);

  const say = () =>
    mic.begin(patternSituation(pattern), [line], (result, grammar) => {
      const v = judgeSpoken(result, grammar, new Set([line.id]));
      setHeard(v.kind === "ok" ? "✓ Máy nghe đúng. Tốt lắm!" : v.message);
    });

  return (
    <div className="space-y-3">
      <div className={CARD}>
        <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">
          <Blank frame={pattern.frame_en} />
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          <Blank frame={pattern.frame_vi} />
        </p>
        <p className="text-sm text-slate-700 dark:text-zinc-300 rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-3 py-2.5">💡 {pattern.note_vi}</p>
      </div>

      <div className={CARD}>
        <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Nghe và nhắc lại: <span className="font-normal">(IPA = ký hiệu cách đọc)</span></p>
        {pattern.slots.slice(0, 4).map((s) => {
          const f = fillPattern(pattern, s);
          return (
            <div key={s.en} className="flex items-center gap-2">
              <Speaker text={f.en} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">{f.en}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{f.vi}</p>
                <IpaLine ipa={s.ipa} />
              </div>
            </div>
          );
        })}
        {pattern.examples.slice(0, 2).map((e) => (
          <div key={e.en} className="flex items-center gap-2">
            <Speaker text={e.en} />
            <div className="min-w-0">
              <p className="text-[15px] text-slate-900 dark:text-zinc-100">{e.en}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{e.vi}</p>
              <IpaLine ipa={e.ipa} />
            </div>
          </div>
        ))}
      </div>

      {canSpeak && (
        <div className={CARD}>
          <p className="text-sm text-slate-700 dark:text-zinc-300">
            Thử nói: <span className="font-semibold">«{fillPattern(pattern, slot).en}»</span>
          </p>
          <MicButton mic={mic} onStart={say} idleLabel="Bấm để nói thử" />
          {mic.problem && <p className="text-sm text-red-700 dark:text-red-300">{mic.problem}</p>}
          {heard && <p className="text-sm text-slate-700 dark:text-zinc-300">{heard}</p>}
        </div>
      )}

      <button onClick={() => onNext({ ok: true })} className={BTN_PRIMARY}>
        Tiếp tục
      </button>
    </div>
  );
}

/** Step 2: read the Vietnamese, pick the word that fills the blank */
function SubstituteCard({ task, onNext }: { task: Extract<Task, { kind: "substitute" }>; onNext: (o: Outcome) => void }) {
  const { item } = task;
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  const pick = (en: string) => {
    if (en === item.answer.en) {
      setSolved(true);
      handleSpeak(item.full);
    } else {
      setWrong((w) => new Set(w).add(en));
    }
  };
  return (
    <div className="space-y-3">
      <div className={CARD}>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Câu này nói bằng tiếng Anh thế nào?</p>
        <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">«{item.vi}»</p>
        <p className="text-xl text-slate-900 dark:text-zinc-100">
          <Blank frame={item.frame} fill={solved ? item.answer.en : undefined} />
        </p>
      </div>
      <div className="space-y-2">
        {item.options.map((o) => {
          const bad = wrong.has(o.en);
          const good = solved && o.en === item.answer.en;
          return (
            <button
              key={o.en}
              onClick={() => pick(o.en)}
              disabled={bad || solved}
              className={`w-full min-h-12 text-left rounded-xl border px-4 py-2.5 text-base font-semibold ${
                good
                  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                  : bad
                    ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 opacity-70"
                    : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 hover:border-teal-600/50 hover:bg-teal-50/50 dark:hover:bg-teal-400/5"
              }`}
            >
              {o.en}
            </button>
          );
        })}
      </div>
      {solved && (
        <>
          <p className="text-sm text-green-700 dark:text-green-300 inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> {item.full} <Speaker text={item.full} />
          </p>
          <IpaLine ipa={item.answer.ipa} />
          <button onClick={() => onNext({ ok: wrong.size === 0 })} className={BTN_PRIMARY}>
            Tiếp theo
          </button>
        </>
      )}
    </div>
  );
}

/** Step 3: build the whole sentence from its words */
function TilesCard({ task, onNext }: { task: Extract<Task, { kind: "tiles" }>; onNext: (o: Outcome) => void }) {
  const { item } = task;
  const [chosen, setChosen] = useState<Tile[]>([]);
  const [fails, setFails] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const rest = item.tiles.filter((t) => !chosen.some((c) => c.id === t.id));

  const send = () => {
    if (tilesSpell(chosen, item)) {
      setDone(true);
      setFeedback(null);
      handleSpeak(item.en);
    } else {
      setFails((f) => f + 1);
      setFeedback("Chưa đúng rồi. Bấm vào từ đã chọn để bỏ ra, xếp lại nhé.");
    }
  };

  return (
    <div className="space-y-3">
      <div className={CARD}>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Ghép câu tiếng Anh cho nghĩa này:</p>
        <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">«{item.vi}»</p>
      </div>
      <div className="min-h-[3.25rem] rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 p-2 flex flex-wrap gap-1.5">
        {chosen.map((t) => (
          <button key={t.id} disabled={done} onClick={() => setChosen((c) => c.filter((x) => x.id !== t.id))} className={TILE_PLACED}>
            {t.text}
          </button>
        ))}
      </div>
      {!done && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {rest.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setFeedback(null);
                  setChosen((c) => [...c, t]);
                }}
                className={TILE}
              >
                {t.text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setChosen([])} disabled={chosen.length === 0} className={BTN_SIDE} aria-label="Xóa hết">
              <Eraser className="w-4 h-4" />
            </button>
            <button onClick={send} disabled={chosen.length === 0} className={`flex-1 ${BTN_PRIMARY}`}>
              <Send className="w-4 h-4" /> Gửi
            </button>
          </div>
          {feedback && <p className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-sm">{feedback}</p>}
          {fails >= 2 && (
            <button
              onClick={() => {
                setFails(99);
                setDone(true);
                handleSpeak(item.en);
              }}
              className="min-h-10 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              Xem đáp án
            </button>
          )}
        </>
      )}
      {done && (
        <>
          <p className="text-sm text-green-700 dark:text-green-300 inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> {item.en} <Speaker text={item.en} />
          </p>
          <IpaLine ipa={item.ipa} />
          <button onClick={() => onNext({ ok: fails === 0 })} className={BTN_PRIMARY}>
            Tiếp theo
          </button>
        </>
      )}
    </div>
  );
}

/** Step 4 and the rapid-fire mix: the other person asks, the learner has a few seconds to say the sentence */
function RapidCard({ task, onNext }: { task: Extract<Task, { kind: "rapid" }>; onNext: (o: Outcome) => void }) {
  const { item, pattern } = task;
  const canSpeak = asrAvailable();
  // The learner answers by voice or on the keyboard, and may switch at any moment; typing gets more time
  const [mode, setMode] = useState<"say" | "type">(canSpeak ? "say" : "type");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const bonusMs = useRef(0);
  const windowFor = () => (modeRef.current === "type" ? WINDOW_TYPE_MS : WINDOW_SAY_MS) + bonusMs.current;
  const mic = useMic();
  const line = useMemo(() => lineOfSlot(pattern, item.slot), [pattern, item.slot]);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"asking" | "answering" | "done">("asking");
  const [verdict, setVerdict] = useState<{ ok: boolean; ms: number; message: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { area, input } = useKeepVisible<HTMLDivElement, HTMLInputElement>();
  const readyAt = useRef(0);
  const settled = useRef(false);
  const retried = useRef(false);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  // The clock runs from the moment the microphone is really listening (or the learner types), not from the question
  const [started, setStarted] = useState(false);

  const settle = (ok: boolean, message: string) => {
    if (settled.current) return;
    settled.current = true;
    mic.cancel();
    const ms = started ? Math.min(windowFor(), Date.now() - readyAt.current) : windowFor();
    setVerdict({ ok, ms, message });
    setState("done");
    handleSpeak(item.en);
  };

  // The question is asked aloud; the clock starts when it is over
  useEffect(() => {
    handleSpeak(item.ask.en);
    const wait = window.setTimeout(() => {
      setState("answering");
      if (canSpeak) void say();
    }, speechMs(item.ask.en));
    return () => window.clearTimeout(wait);
    // the card is created once per question
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the clock once: typing, a microphone that is listening, or a microphone that cannot start (then the learner types)
  useEffect(() => {
    if (state !== "answering" || started) return;
    if (mode === "type" || mic.phase === "listening" || mic.problem) {
      readyAt.current = Date.now();
      setStarted(true);
    }
  }, [state, started, mode, mic.phase, mic.problem]);

  // Time runs out
  useEffect(() => {
    if (state !== "answering" || !started) return;
    const tick = window.setInterval(() => {
      const e = Date.now() - readyAt.current;
      setElapsed(e);
      if (e >= windowFor()) settle(false, "Hết giờ rồi. Xem câu đúng bên dưới và nói lại nhé.");
    }, 100);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, started]);

  const say = () =>
    mic.begin(
      patternSituation(pattern),
      [line],
      (result, grammar) => {
        const v = judgeSpoken(result, grammar, new Set([line.id]));
        if (v.kind === "ok") settle(true, "Đúng rồi!");
        else if (!settled.current) {
          // One more try before the answer counts as wrong
          if (!retried.current && modeRef.current === "say") {
            retried.current = true;
            bonusMs.current = RETRY_BONUS_MS;
            setRetryNote(`${v.message} Bạn còn một lần nói lại.`);
            void say();
          } else settle(false, v.message);
        }
      },
      WINDOW_SAY_MS
    );

  const switchTo = (next: "say" | "type") => {
    if (next === mode || state !== "answering") return;
    setMode(next);
    modeRef.current = next;
    if (next === "type") mic.cancel();
    else void say();
  };

  const submitTyped = () => {
    if (matchTyped(typed, [line])) settle(true, "Đúng rồi!");
    else settle(false, "Chưa đúng. Xem câu đúng bên dưới.");
  };

  const left = Math.max(0, 1 - elapsed / windowFor());
  return (
    // The bottom padding leaves room to scroll the box above the keyboard
    <div ref={area} className="space-y-3 pb-[45vh]">
      <div className={CARD}>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Người ấy hỏi:</p>
        <p className="text-lg font-bold text-slate-900 dark:text-zinc-100 inline-flex items-center gap-2">
          {item.ask.en} <Speaker text={item.ask.en} />
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{item.ask.vi}</p>
        <p className="text-sm text-slate-700 dark:text-zinc-300 pt-1">
          Bạn trả lời: <span className="font-semibold">«{item.vi}»</span>
        </p>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden" aria-label="Thời gian còn lại">
          <div className={`h-full rounded-full ${left < 0.3 ? "bg-red-500" : "bg-teal-700 dark:bg-teal-500"}`} style={{ width: `${state === "asking" ? 100 : left * 100}%` }} />
        </div>
      </div>

      {state === "asking" && <p className="text-sm text-slate-500 dark:text-zinc-400">Nghe câu hỏi…</p>}
      {state === "answering" && (
        <>
          {canSpeak && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cách trả lời">
              {(["say", "type"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchTo(m)}
                  aria-pressed={mode === m}
                  className={`px-4 min-h-[40px] rounded-full text-sm font-semibold inline-flex items-center gap-1.5 border ${
                    mode === m ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600" : "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  {m === "say" ? <Mic className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />} {m === "say" ? "Nói" : "Gõ (thêm thời gian)"}
                </button>
              ))}
            </div>
          )}
          {mode === "say" ? (
            <>
              <MicButton mic={mic} onStart={() => void say()} idleLabel="Bấm để nói" />
              {mic.problem && <p className="text-sm text-red-700 dark:text-red-300">{mic.problem} Bạn có thể bấm "Gõ" để trả lời.</p>}
              {retryNote && !mic.problem && <p className="text-sm text-amber-800 dark:text-amber-300">{retryNote}</p>}
              {!started && !mic.problem && <p className="text-xs text-slate-500 dark:text-zinc-400">Đồng hồ sẽ chạy khi micro sẵn sàng.</p>}
            </>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                ref={input}
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="Gõ câu tiếng Anh…"
                className="flex-1 min-w-0 min-h-12 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-base text-slate-900 dark:text-zinc-100 focus:border-teal-600 focus:outline-none"
              />
              <button type="submit" disabled={!typed.trim()} className="px-4 min-h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 disabled:opacity-50 text-white min-w-[52px]" aria-label="Gửi">
                <Send className="w-4 h-4 mx-auto" />
              </button>
            </form>
          )}
        </>
      )}
      {state === "done" && verdict && (
        <>
          <div
            className={`rounded-xl border px-3 py-2 text-sm space-y-1 ${
              verdict.ok
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
            }`}
          >
            <p className="inline-flex items-center gap-2">
              {verdict.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {verdict.message} {verdict.ok && <span className="text-xs">({(verdict.ms / 1000).toFixed(1)} giây)</span>}
            </p>
            <p className="font-semibold inline-flex items-center gap-2">
              {item.en} <Speaker text={item.en} />
            </p>
            <IpaLine ipa={item.slot.ipa} />
          </div>
          <button onClick={() => onNext({ ok: verdict.ok, ms: verdict.ms })} className={BTN_PRIMARY}>
            Tiếp theo
          </button>
        </>
      )}
    </div>
  );
}

/** One sitting: the tasks one after another, then what it did to the progress */
export default function PatternRunner({
  title,
  kind,
  pattern,
  step,
  tasks,
  onExit,
  onDone,
}: {
  title: string;
  kind: SessionKind;
  /** The pattern of a ladder sitting (null for a rapid-fire mix) */
  pattern: Pattern | null;
  /** The ladder step this sitting is for (1 to 4) */
  step: number;
  tasks: Task[];
  onExit: () => void;
  /** After the last task, when the learner taps "Xong": for a sitting that is one part of a longer session (otherwise `onExit`) */
  onDone?: (passed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [passed, setPassed] = useState<boolean | null>(null);
  const task = tasks[index];

  const next = (o: Outcome) => {
    const all = [...results, { patternId: task.pattern.id, kind: task.kind, ...o }];
    setResults(all);
    if (index + 1 >= tasks.length) setPassed(applySession(kind, pattern, step, tasks, all));
    else setIndex(index + 1);
  };

  const right = results.filter((r) => r.ok).length;
  const times = results.flatMap((r) => (r.ms !== undefined && r.ok ? [r.ms] : []));
  const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : null;

  return (
    <div className="space-y-4">
      <PracticeTop
        onBack={onExit}
        backLabel="Thoát"
        close
        label={
          <>
            <span className="text-slate-900 dark:text-zinc-100">{title}</span>
            {" · "}
            {kind === "ladder" ? `Bước ${step}/4: ${STEP_LABELS[step - 1]}` : "Hỏi đáp nhanh"}
          </>
        }
        count={passed === null && tasks.length > 1 ? `${index + 1}/${tasks.length}` : undefined}
        percent={passed !== null ? 100 : tasks.length > 1 ? (index / tasks.length) * 100 : undefined}
        right={<IpaToggle />}
      />

      {passed !== null ? (
        <div className="space-y-3">
          <div
            className={`${CARD}`}
          >
            <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {kind === "ladder" ? (passed ? "Xong bước này! 🎉" : "Chưa qua bước này, thử lại nhé") : "Xong lượt hỏi đáp nhanh! 🎉"}
            </p>
            {tasks[0].kind !== "learn" && (
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Đúng {right}/{results.length} câu{avg !== null ? `, trả lời nhanh trung bình ${avg.toFixed(1)} giây` : ""}.
              </p>
            )}
            {kind === "ladder" && passed && step < 4 && <p className="text-sm text-slate-700 dark:text-zinc-300">Bước tiếp theo sẽ đến vào ngày mai (hoặc bạn học tiếp ngay).</p>}
            {kind === "ladder" && passed && step >= 4 && <p className="text-sm text-slate-700 dark:text-zinc-300">Bạn đã thuộc mẫu này. App sẽ hỏi lại sau vài ngày để bạn nhớ lâu.</p>}
          </div>
          <button onClick={() => (onDone ? onDone(passed === true) : onExit())} className={BTN_PRIMARY}>
            {onDone ? "Tiếp tục" : "Xong"}
          </button>
        </div>
      ) : (
        <>
          {task.kind === "learn" && <LearnCard key={index} pattern={task.pattern} onNext={next} />}
          {task.kind === "substitute" && <SubstituteCard key={index} task={task} onNext={next} />}
          {task.kind === "tiles" && <TilesCard key={index} task={task} onNext={next} />}
          {task.kind === "rapid" && <RapidCard key={index} task={task} onNext={next} />}
        </>
      )}
    </div>
  );
}
