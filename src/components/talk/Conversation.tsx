import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eraser, Keyboard, Lightbulb, ListChecks, Mic, Puzzle, RotateCcw, Send, Volume2 } from "lucide-react";
import type { Situation, SituationLine } from "@/types/situation";
import { handleSpeak } from "@/components/review/speech";
import { asrAvailable, playRecording } from "@/services/pronunciationCheck";
import {
  buildChoices,
  buildTiles,
  judgeSpoken,
  matchTiles,
  matchTyped,
  nextNodeId,
  pickMethod,
  type Choice,
  type Level,
  type Method,
  type Tile,
} from "@/services/talk/engine";
import {
  getTalkLevel,
  recordLineBuilt,
  recordLineTry,
  recordRun,
  seenCount,
  setTalkLevel,
} from "@/services/talk/progress";
import MicButton from "./MicButton";
import { useMic } from "./useMic";

const LEVEL_LABEL: Record<Level, string> = { auto: "Tự động", choose: "Chọn câu", tiles: "Ghép từ", say: "Nói", type: "Gõ" };
const METHOD_ICON: Record<Method, typeof Mic> = { choose: ListChecks, tiles: Puzzle, say: Mic, type: Keyboard };

/** The other person is "typing" this long before their message shows */
const TYPING_MS = 900;
/** After this many wrong answers in a turn the right one can be shown */
const SHOW_ANSWER_AFTER = 2;

interface Step {
  nodeId: string;
  /** The answer given at this node; unset while it waits */
  lineId?: string;
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <div className="rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-zinc-800 px-4 py-3 inline-flex gap-1" aria-label="Đang gõ">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Talk with the scripted partner like in a chat app; answer with tiles, your voice, or the keyboard */
export default function Conversation({ situation, onBack }: { situation: Situation; onBack: () => void }) {
  const canSpeak = asrAvailable();
  const [level, setLevel] = useState<Level>(() => {
    const saved = getTalkLevel();
    return saved === "say" && !canSpeak ? "auto" : saved;
  });
  const [steps, setSteps] = useState<Step[]>([{ nodeId: situation.dialogue[0].id }]);
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState(true);
  const [round, setRound] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(new Set());

  // This turn's way of answering
  const [method, setMethod] = useState<Method>("tiles");
  const [target, setTarget] = useState<SituationLine | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [wrongPicks, setWrongPicks] = useState<Set<string>>(new Set());
  const [bank, setBank] = useState<Tile[]>([]);
  const [chosen, setChosen] = useState<Tile[]>([]);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [hint, setHint] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);

  const mic = useMic();
  const bottom = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  const lineOf = useMemo(() => new Map(situation.lines.map((l) => [l.id, l] as const)), [situation]);
  const nodeOf = useMemo(() => new Map(situation.dialogue.map((n) => [n.id, n] as const)), [situation]);
  const current = steps[steps.length - 1];
  const node = nodeOf.get(current.nodeId)!;
  const replies = useMemo(() => node.replies.map((r) => lineOf.get(r.lineId)!).filter(Boolean), [node, lineOf]);
  const waiting = !finished && !pending && current.lineId === undefined;

  /** Choose how this turn is answered, and get its tiles ready */
  const beginTurn = useCallback(
    (forced?: Method) => {
      const seen = Math.max(0, ...replies.map((l) => seenCount(l.id)));
      const next = forced ?? pickMethod(levelRef.current, seen, canSpeak);
      const pick = replies[Math.floor(Math.random() * replies.length)];
      setMethod(next);
      setTarget(pick);
      setChoices(buildChoices(pick, replies, situation));
      setWrongPicks(new Set());
      setBank(buildTiles(pick, situation));
      setChosen([]);
      setTyped("");
      setFeedback(null);
      setFails(0);
      setHint(false);
    },
    [replies, situation, canSpeak]
  );

  // The other person types, then speaks
  useEffect(() => {
    if (finished) return;
    setPending(true);
    const timer = window.setTimeout(() => {
      setPending(false);
      handleSpeak(node.npc_en);
      beginTurn();
    }, TYPING_MS);
    return () => window.clearTimeout(timer);
    // beginTurn depends on the node's replies only: it is stable for this node
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, finished, round]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length, pending, finished, method, chosen.length, feedback]);

  const send = (lineId: string) => {
    mic.cancel();
    const next = nextNodeId(situation, node.id, lineId);
    setSteps((prev) => {
      const done = prev.map((s, i) => (i === prev.length - 1 ? { ...s, lineId } : s));
      return next ? [...done, { nodeId: next }] : done;
    });
    if (!next) {
      recordRun(situation.id);
      setFinished(true);
    }
  };

  const wrong = (message: string, lineId?: string) => {
    setFails((f) => f + 1);
    setFeedback(message);
    const id = lineId ?? (replies.length === 1 ? replies[0].id : target?.id);
    if (id) setMissed((m) => new Set(m).add(id));
  };

  const pickChoice = (choice: Choice) => {
    if (choice.correct) {
      recordLineBuilt(choice.line.id);
      send(choice.line.id);
    } else {
      setWrongPicks((w) => new Set(w).add(choice.line.id));
      wrong("Câu này chưa hợp ở đây, thử câu khác nhé.");
    }
  };

  const sendTiles = () => {
    const id = matchTiles(chosen, replies);
    if (id) {
      recordLineBuilt(id);
      send(id);
    } else {
      wrong("Chưa đúng rồi. Bấm vào từ đã chọn để bỏ ra, xếp lại nhé.");
    }
  };

  const sendTyped = () => {
    const match = matchTyped(typed, replies);
    if (match) {
      recordLineBuilt(match.lineId);
      send(match.lineId);
    } else {
      wrong("Chưa đúng rồi, xem lại nghĩa tiếng Việt rồi gõ lại nhé.");
    }
  };

  const say = () =>
    mic.begin(situation, replies, (result, grammar) => {
      const v = judgeSpoken(result, grammar, new Set(replies.map((l) => l.id)));
      console.info(
        "[talk] chat",
        node.id,
        v.kind,
        `raw="${result.text ?? ""}"`,
        `peak=${(result.peak ?? 0).toFixed(2)}`,
        `conf=${v.conf?.toFixed(2) ?? "-"}`,
        result.error ?? ""
      );
      // With one possible answer a miss is that line's; with several, only a heard answer counts
      const id = v.lineId ?? (replies.length === 1 ? replies[0].id : undefined);
      if (id) recordLineTry(id, v.kind === "ok", v.heard);
      if (v.kind === "ok" && v.lineId) {
        send(v.lineId);
        return;
      }
      wrong(v.message, v.lineId && replies.some((l) => l.id === v.lineId) ? v.lineId : undefined);
    });

  /** Gave up: the right answer is sent, and counted as missed */
  const showAnswer = () => {
    const line = target ?? replies[0];
    setMissed((m) => new Set(m).add(line.id));
    send(line.id);
  };

  const changeMethod = (m: Method) => {
    mic.cancel();
    setFeedback(null);
    setMethod(m);
  };

  const changeLevel = (l: Level) => {
    setLevel(l);
    levelRef.current = l;
    setTalkLevel(l);
    setLevelOpen(false);
    mic.cancel();
    if (waiting) beginTurn(l === "auto" ? undefined : l === "say" && !canSpeak ? "type" : (l as Method));
  };

  const restart = () => {
    mic.cancel();
    setSteps([{ nodeId: situation.dialogue[0].id }]);
    setFinished(false);
    setMissed(new Set());
    setRound((r) => r + 1);
  };

  const methods: Method[] = canSpeak ? ["choose", "tiles", "say", "type"] : ["choose", "tiles", "type"];
  const levels = (Object.keys(LEVEL_LABEL) as Level[]).filter((l) => canSpeak || l !== "say");
  const notChosen = bank.filter((t) => !chosen.some((c) => c.id === t.id));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-slate-200 dark:border-zinc-800">
        <button onClick={onBack} className="p-1 text-slate-600 dark:text-zinc-400" aria-label="Về danh sách">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-lg">
          {situation.partner_emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{situation.partner_vi}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{situation.title_vi}</p>
        </div>
        <button
          onClick={() => setLevelOpen((o) => !o)}
          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
          aria-expanded={levelOpen}
        >
          {LEVEL_LABEL[level]} ▾
        </button>
      </div>
      {levelOpen && (
        <div role="radiogroup" aria-label="Cấp độ" className="shrink-0 flex gap-1 p-2 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
          {levels.map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={level === l}
              onClick={() => changeLevel(l)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                level === l ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
              }`}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3">
        {steps.map((s, i) => {
          const n = nodeOf.get(s.nodeId)!;
          const mine = s.lineId ? lineOf.get(s.lineId) : undefined;
          const isLast = i === steps.length - 1;
          const hidden = isLast && pending; // the other person is still typing
          return (
            <div key={`${round}-${i}`} className="space-y-3">
              {hidden ? (
                <TypingDots />
              ) : (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-sm">
                    {situation.partner_emoji}
                  </div>
                  <button
                    onClick={() => handleSpeak(n.npc_en)}
                    className="max-w-[80%] text-left rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-zinc-800 px-4 py-2.5"
                  >
                    <span className="block text-[15px] font-medium text-slate-900 dark:text-white">{n.npc_en}</span>
                    <span className="block text-xs text-slate-500 dark:text-zinc-400">{n.npc_vi}</span>
                  </button>
                </div>
              )}
              {mine && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2.5">
                    <span className="block text-[15px] font-medium">{mine.en}</span>
                    <span className="block text-xs text-violet-100">{mine.vi}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {finished && (
          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <p className="font-bold text-emerald-800 dark:text-emerald-200">Xong rồi! 🎉</p>
            <p className="text-sm text-emerald-900 dark:text-emerald-100">Mục tiêu: {situation.goal_vi}</p>
            {missed.size > 0 && (
              <div className="text-sm text-slate-800 dark:text-zinc-200">
                <p className="font-semibold">Câu cần luyện thêm:</p>
                <ul className="list-disc pl-5">
                  {[...missed].map((id) => (
                    <li key={id}>{lineOf.get(id)?.en}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={restart}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Nói lại
              </button>
              <button onClick={onBack} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm font-semibold">
                Về danh sách
              </button>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* The learner's answer */}
      {waiting && target && (
        <div className="shrink-0 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 pt-3 pb-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {method === "tiles" || method === "choose" ? (
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              Nói: <span className="font-semibold">«{target.vi}»</span>
            </p>
          ) : (
            <div className="text-sm text-slate-700 dark:text-zinc-300">
              <p>
                Bạn muốn nói:{" "}
                <span className="font-semibold">{replies.map((l) => `«${l.vi}»`).join(" hoặc ")}</span>
              </p>
              {hint ? (
                <ul className="mt-1 text-xs text-violet-700 dark:text-violet-300 list-disc pl-5">
                  {replies.map((l) => (
                    <li key={l.id}>{l.en}</li>
                  ))}
                </ul>
              ) : (
                <button onClick={() => setHint(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  <Lightbulb className="w-3.5 h-3.5" /> Xem gợi ý
                </button>
              )}
            </div>
          )}

          {method === "choose" && (
            <div className="space-y-2">
              {choices.map((c) => {
                const bad = wrongPicks.has(c.line.id);
                return (
                  <button
                    key={c.line.id}
                    onClick={() => pickChoice(c)}
                    disabled={bad}
                    className={`w-full text-left rounded-xl border px-4 py-2.5 ${
                      bad
                        ? "border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 opacity-70"
                        : "border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100"
                    }`}
                  >
                    <span className="block text-[15px] font-semibold">{c.line.en}</span>
                  </button>
                );
              })}
            </div>
          )}

          {method === "tiles" && (
            <>
              <div className="min-h-[3rem] rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 p-2 flex flex-wrap gap-1.5">
                {chosen.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setChosen((c) => c.filter((x) => x.id !== t.id))}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold"
                  >
                    {t.text}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notChosen.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setFeedback(null);
                      setChosen((c) => [...c, t]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {t.text}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChosen([])}
                  disabled={chosen.length === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 disabled:opacity-40"
                  aria-label="Xóa hết"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <button
                  onClick={sendTiles}
                  disabled={chosen.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Gửi
                </button>
              </div>
            </>
          )}

          {method === "type" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendTyped();
              }}
            >
              <input
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setFeedback(null);
                }}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="send"
                placeholder="Gõ câu tiếng Anh…"
                className="flex-1 min-w-0 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-[15px] text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!typed.trim()}
                className="px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white"
                aria-label="Gửi"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {method === "say" && (
            <>
              <MicButton mic={mic} onStart={say} idleLabel="Bấm để nói" />
              {mic.problem && <p className="text-xs text-rose-600 dark:text-rose-400">{mic.problem}</p>}
            </>
          )}

          {feedback && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-sm space-y-1" role="status">
              <p>{feedback}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                {method === "say" && (
                  <button onClick={playRecording} className="underline underline-offset-2 inline-flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
                  </button>
                )}
                {fails >= SHOW_ANSWER_AFTER && (
                  <button onClick={showAnswer} className="underline underline-offset-2">
                    Xem đáp án
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1 pt-1">
            {methods.map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <button
                  key={m}
                  onClick={() => changeMethod(m)}
                  aria-pressed={method === m}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                    method === m
                      ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300"
                      : "text-slate-500 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {LEVEL_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
