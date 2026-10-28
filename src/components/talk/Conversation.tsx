import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Eraser,
  Headphones,
  CircleHelp,
  Keyboard,
  Waves,
  Lightbulb,
  ListChecks,
  Mic,
  Puzzle,
  RotateCcw,
  Send,
  Shuffle,
  SlidersHorizontal,
  Trophy,
  Turtle,
  Volume2,
} from "lucide-react";
import type { DialogueNode, Situation, SituationLine } from "@/types/situation";
import { englishVoices, getTtsSettings, handleSpeak } from "@/components/review/speech";
import { turnVariants } from "@/data/situations/variants";
import { fillSlots } from "@/data/situations/templates";
import { asrAvailable, playRecording } from "@/services/pronunciationCheck";
import {
  buildChoices,
  buildTiles,
  judgeSpoken,
  matchTiles,
  matchTyped,
  pickMethod,
  swapRoles,
  type Choice,
  type Level,
  type Method,
  type Tile,
} from "@/services/talk/engine";
import {
  getTalkLevel,
  recordLineBuilt,
  recordLineTry,
  getSituationProgress,
  recordRun,
  seenCount,
  starsFor,
  setTalkLevel,
} from "@/services/talk/progress";
import { scheduleMiss } from "@/services/talk/review";
import MicButton from "./MicButton";
import TapText, { useWordTap } from "./WordTap";
import { useMic } from "./useMic";

const LEVEL_LABEL: Record<Level, string> = { auto: "Tự động", choose: "Chọn câu", tiles: "Ghép từ", say: "Nói", type: "Gõ" };
const METHOD_ICON: Record<Method, typeof Mic> = { choose: ListChecks, tiles: Puzzle, say: Mic, type: Keyboard };

/** The other person is "typing" this long before their message shows */
const TYPING_MS = 450;
/** The chance that the other person did not catch what was said and asks for it again */
const SORRY_CHANCE = 0.15;
const SORRY_LINES = [
  { en: "Sorry, could you say that again?", vi: "Xin lỗi, bạn nói lại được không?" },
  { en: "Sorry, I didn't catch that.", vi: "Xin lỗi, mình chưa nghe rõ." },
  { en: "Pardon? Could you repeat that?", vi: "Sao ạ? Bạn nhắc lại được không?" },
];
/** Speech rate of the other person when "slow" is on (the normal rate is the learner's own setting) */
const PARTNER_SLOW = 0.65;
const HANDS_KEY = "talk.handsFree";
const SLOW_KEY = "talk.slowPartner";
const SURPRISE_KEY = "talk.surprise";
const CHALLENGE_KEY = "talk.challenge";
const VOICE_KEY = "talk.voiceMix";
/** After this many wrong answers in a turn the right one can be shown */
const SHOW_ANSWER_AFTER = 2;

interface Step {
  nodeId: string;
  /** Which way of saying the turn is used: 0 is the node's own sentence, k is variant k - 1 */
  v?: number;
  /** A turn made up on the spot ("Sorry, could you say that again?"), not part of the situation */
  node?: DialogueNode;
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

const LISTEN_KEY = "talk.listenOnly";
const SWAP_KEY = "talk.swapRoles";
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* ignore */
  }
};
const readFlagOn = (key: string) => {
  try {
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
};
/** About how long the voice takes to say a sentence: the recording of a hands-free turn starts after it */
const speechMs = (text: string, slow: boolean) => {
  const rate = slow ? PARTNER_SLOW : getTtsSettings().rate;
  return 600 + text.trim().split(/\s+/).length * (1000 / (2.4 * rate));
};
/** The placeholder of a first message (learner speaks first) has nothing to read aloud */
const speakable = (text: string) => /[a-z]/i.test(text);

/** The chat, with the "swap roles" choice: switching it starts the talk again from the top */
export default function Conversation({ situation, onBack }: { situation: Situation; onBack: () => void }) {
  const [swap, setSwap] = useState(() => readFlag(SWAP_KEY));
  return (
    <ConversationChat
      key={swap ? "swap" : "normal"}
      original={situation}
      swap={swap}
      onSwap={(on) => {
        writeFlag(SWAP_KEY, on);
        setSwap(on);
      }}
      onBack={onBack}
    />
  );
}

/** Talk with the scripted partner like in a chat app; answer with tiles, your voice, or the keyboard */
function ConversationChat({
  original,
  swap,
  onSwap,
  onBack,
}: {
  original: Situation;
  swap: boolean;
  onSwap: (on: boolean) => void;
  onBack: () => void;
}) {
  const canSpeak = asrAvailable();
  const [round, setRound] = useState(0);
  // Swapped: the learner plays the other person; a new path through the talk is picked each time it starts over
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // The things that can change in it (the drink, the place, the price…) are picked again each time it starts
  const filled = useMemo(() => fillSlots(original), [original, round]);
  const situation = useMemo(() => (swap ? swapRoles(filled.situation) : filled.situation), [filled, swap]);
  const partnerEmoji = swap ? "🙋" : situation.partner_emoji;
  const partnerName = swap ? `Bạn đóng vai: ${original.partner_vi}` : situation.partner_vi;
  // Listening only: the other person's words stay hidden until tapped
  const [listenOnly, setListenOnly] = useState(() => readFlag(LISTEN_KEY));
  const [peeked, setPeeked] = useState<string | null>(null);
  // Hands-free: the microphone opens by itself after the other person speaks
  const [handsFree, setHandsFree] = useState(() => readFlag(HANDS_KEY));
  const [slow, setSlow] = useState(() => readFlag(SLOW_KEY));
  const [surprise, setSurprise] = useState(() => readFlagOn(SURPRISE_KEY));
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const slowRef = useRef(slow);
  slowRef.current = slow;
  const surpriseRef = useRef(surprise);
  surpriseRef.current = surprise;
  const autoTimer = useRef<number | undefined>(undefined);
  const autoTries = useRef(0);
  const nodeIdRef = useRef("");
  const sayRef = useRef<(auto: boolean) => void>(() => {});
  const clearAuto = () => window.clearTimeout(autoTimer.current);
  useEffect(() => () => window.clearTimeout(autoTimer.current), []);
  /** The way of saying a turn that is picked when the turn comes (not the same words every time) */
  const pickVariant = (nodeId: string) => Math.floor(Math.random() * (turnVariants(situation.id, nodeId).length + 1));
  const [level, setLevel] = useState<Level>(() => {
    const saved = getTalkLevel();
    return saved === "say" && !canSpeak ? "auto" : saved;
  });
  const [steps, setSteps] = useState<Step[]>(() => [{ nodeId: situation.dialogue[0].id, v: pickVariant(situation.dialogue[0].id) }]);
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState(true);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  // How the talk went: turns right at the first try, and the words the machine was unsure it heard
  const turnCount = useRef(0);
  const firstTry = useRef(0);
  const weakWords = useRef<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ score: number; first: number; turns: number; prev?: number; stars?: number } | null>(null);
  // Challenge: no hints, the answer is spoken (or typed), the text of the other person stays hidden, and the run earns stars
  const [challenge, setChallenge] = useState(() => readFlag(CHALLENGE_KEY));
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  // The other person speaks with a voice other than the learner's own, picked again each time the talk starts
  const [voiceMix, setVoiceMix] = useState(() => readFlagOn(VOICE_KEY));
  const partnerVoice = useMemo(() => {
    if (!voiceMix) return undefined;
    const voices = englishVoices();
    if (voices.length < 2) return undefined;
    const mine = getTtsSettings().voiceURI;
    const others = voices.filter((v) => v.voiceURI !== mine);
    const pool = others.length > 0 ? others : voices;
    return pool[Math.floor(Math.random() * pool.length)].voiceURI;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMix, round]);
  const partnerVoiceRef = useRef(partnerVoice);
  partnerVoiceRef.current = partnerVoice;

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
  const words = useWordTap();
  const bottom = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  const lineOf = useMemo(() => new Map(situation.lines.map((l) => [l.id, l] as const)), [situation]);
  const nodeOf = useMemo(() => new Map(situation.dialogue.map((n) => [n.id, n] as const)), [situation]);
  const nodeFor = (s: Step) => s.node ?? nodeOf.get(s.nodeId)!;
  const lineFor = (s: Step) => {
    const n = nodeFor(s);
    const v = s.v ? turnVariants(situation.id, n.id)[s.v - 1] : undefined;
    return v ? filled.rewrite(v.en, v.vi) : { en: n.npc_en, vi: n.npc_vi };
  };
  const current = steps[steps.length - 1];
  const node = nodeFor(current);
  nodeIdRef.current = node.id;
  const replies = useMemo(() => node.replies.map((r) => lineOf.get(r.lineId)!).filter(Boolean), [node, lineOf]);
  const waiting = !finished && !pending && current.lineId === undefined;

  /** Choose how this turn is answered, and get its tiles ready */
  const beginTurn = useCallback(
    (forced?: Method) => {
      const seen = Math.max(0, ...replies.map((l) => seenCount(l.id)));
      const next =
        forced ??
        (challengeRef.current
          ? canSpeak
            ? "say"
            : "type"
          : handsFreeRef.current && canSpeak
            ? "say"
            : pickMethod(levelRef.current, seen, canSpeak));
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
      const said = lineFor(current).en;
      if (speakable(said)) handleSpeak(said, slowRef.current ? PARTNER_SLOW : undefined, partnerVoiceRef.current);
      beginTurn();
      autoTries.current = 0;
      if (handsFreeRef.current && canSpeak) armAuto(speakable(said) ? speechMs(said, slowRef.current) : 300);
    }, TYPING_MS);
    return () => window.clearTimeout(timer);
    // beginTurn depends on the node's replies only: it is stable for this node
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, finished, round]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length, pending, finished, method, chosen.length, feedback]);

  /** Hands-free: open the microphone after `delay`, if the talk is still at this turn */
  const armAuto = (delay: number) => {
    clearAuto();
    const at = nodeIdRef.current;
    autoTimer.current = window.setTimeout(() => {
      if (nodeIdRef.current === at) sayRef.current(true);
    }, delay);
  };

  const send = (lineId: string, gaveUp = false) => {
    mic.cancel();
    clearAuto();
    // The score counts the turns of the talk itself (not the "say it again" ones), right at the first try
    if (!node.id.includes("~")) {
      turnCount.current++;
      if (fails === 0 && !gaveUp) firstTry.current++;
    }
    const next = node.replies.find((r) => r.lineId === lineId)?.next;
    let follow: Step | undefined;
    if (next) {
      // Now and then the other person did not catch it and asks for it again: the same answer is said once more
      if (surpriseRef.current && !node.id.includes("~") && Math.random() < SORRY_CHANCE) {
        const sorry = SORRY_LINES[Math.floor(Math.random() * SORRY_LINES.length)];
        follow = {
          nodeId: `${node.id}~sorry`,
          node: { id: `${node.id}~sorry`, npc_en: sorry.en, npc_vi: sorry.vi, replies: [{ lineId, next }] },
        };
      } else {
        follow = { nodeId: next, v: pickVariant(next) };
      }
    }
    setSteps((prev) => {
      const done = prev.map((s, i) => (i === prev.length - 1 ? { ...s, lineId } : s));
      return follow ? [...done, follow] : done;
    });
    if (!next) {
      const score = turnCount.current > 0 ? firstTry.current / turnCount.current : 0;
      const before = getSituationProgress(original.id);
      const stars = challengeRef.current ? starsFor(score) : undefined;
      recordRun(original.id, new Date(), { score, stars });
      setSummary({ score, first: firstTry.current, turns: turnCount.current, prev: before.lastScore, stars });
      setFinished(true);
    }
  };

  const wrong = (message: string, lineId?: string) => {
    setFails((f) => f + 1);
    setFeedback(message);
    const id = lineId ?? (replies.length === 1 ? replies[0].id : target?.id);
    if (id) {
      setMissed((m) => new Set(m).add(id));
      // A missed sentence comes back for review (not the made-up lines of "swap roles")
      if (!id.includes("~")) scheduleMiss(id);
    }
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

  const say = (auto = false) =>
    mic.begin(
      situation,
      replies,
      (result, grammar) => {
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
      // Words the machine was unsure about: listed in the summary as the ones to say more clearly
      for (const w of result.words ?? []) if (w.word && w.word !== "[unk]" && w.conf < 0.6) weakWords.current.add(w.word);
      if (id) recordLineTry(id, v.kind === "ok", v.heard);
      if (v.kind === "ok" && v.lineId) {
        send(v.lineId);
        return;
      }
      wrong(v.message, v.lineId && replies.some((l) => l.id === v.lineId) ? v.lineId : undefined);
      // Hands-free tries again by itself, twice at most
      if (handsFreeRef.current && autoTries.current < 2) {
        autoTries.current++;
        armAuto(1800);
      }
    },
      // Hands-free stops recording by itself: about as long as the longest answer takes to say
      auto ? Math.max(2500, 1800 + Math.max(...replies.map((l) => l.en.split(" ").length)) * 600) : undefined
    );
  sayRef.current = say;

  /** Gave up: the right answer is sent, and counted as missed */
  const showAnswer = () => {
    const line = target ?? replies[0];
    setMissed((m) => new Set(m).add(line.id));
    if (!line.id.includes("~")) scheduleMiss(line.id);
    send(line.id, true);
  };

  const toggleHandsFree = () => {
    const on = !handsFree;
    writeFlag(HANDS_KEY, on);
    setHandsFree(on);
    handsFreeRef.current = on;
    mic.cancel();
    clearAuto();
    if (on && waiting) {
      beginTurn("say");
      armAuto(300);
    }
  };

  const changeMethod = (m: Method) => {
    clearAuto();
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
    clearAuto();
    setSteps([{ nodeId: situation.dialogue[0].id, v: pickVariant(situation.dialogue[0].id) }]);
    setFinished(false);
    setMissed(new Set());
    setSummary(null);
    turnCount.current = 0;
    firstTry.current = 0;
    weakWords.current = new Set();
    setRound((r) => r + 1);
  };

  const methods: Method[] = canSpeak ? ["choose", "tiles", "say", "type"] : ["choose", "tiles", "type"];
  const levels = (Object.keys(LEVEL_LABEL) as Level[]).filter((l) => canSpeak || l !== "say");
  const notChosen = bank.filter((t) => !chosen.some((c) => c.id === t.id));
  // Everything that changes how the talk goes, in one panel, each with what it does
  const options: Array<{ label: string; hint: string; on: boolean; icon: typeof Mic; flip: () => void }> = [
    {
      label: "Chỉ nghe (ẩn chữ)",
      hint: "Giấu lời của người kia, bạn nghe rồi trả lời. Chạm để xem chữ.",
      on: listenOnly,
      icon: Headphones,
      flip: () => {
        writeFlag(LISTEN_KEY, !listenOnly);
        setListenOnly(!listenOnly);
      },
    },
    { label: "Đổi vai", hint: "Bạn đóng vai người kia và nói lại từ đầu.", on: swap, icon: ArrowLeftRight, flip: () => onSwap(!swap) },
    {
      label: "Thử thách ⭐",
      hint: "Không gợi ý, phải nói (hoặc gõ), được chấm sao theo cả bài.",
      on: challenge,
      icon: Trophy,
      flip: () => {
        writeFlag(CHALLENGE_KEY, !challenge);
        setChallenge(!challenge);
        challengeRef.current = !challenge;
        // A challenge starts from the top: it is scored on the whole talk
        restart();
      },
    },
    { label: "Nói chậm", hint: "Người kia nói chậm hơn cho dễ nghe.", on: slow, icon: Turtle, flip: () => { writeFlag(SLOW_KEY, !slow); setSlow(!slow); } },
    {
      label: "Hỏi lại bất ngờ",
      hint: "Thỉnh thoảng người kia hỏi \"Bạn nói lại được không?\" như ngoài đời.",
      on: surprise,
      icon: CircleHelp,
      flip: () => { writeFlag(SURPRISE_KEY, !surprise); setSurprise(!surprise); },
    },
    {
      label: "Giọng ngẫu nhiên",
      hint: "Mỗi lần nói chuyện, người kia dùng một giọng khác.",
      on: voiceMix,
      icon: Shuffle,
      flip: () => { writeFlag(VOICE_KEY, !voiceMix); setVoiceMix(!voiceMix); },
    },
    ...(canSpeak
      ? [{ label: "Rảnh tay", hint: "Micro tự mở sau khi người kia nói, bạn không cần bấm.", on: handsFree, icon: Waves, flip: toggleHandsFree }]
      : []),
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-slate-200 dark:border-zinc-800">
        <button onClick={onBack} className="w-10 h-10 -ml-1 inline-flex items-center justify-center text-slate-600 dark:text-zinc-400" aria-label="Về danh sách">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-lg">
          {partnerEmoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{partnerName}</p>
          <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">{situation.title_vi}</p>
        </div>
        <button
          onClick={() => setLevelOpen((o) => !o)}
          className="shrink-0 min-h-[40px] inline-flex items-center gap-1.5 text-xs font-semibold px-3 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
          aria-expanded={levelOpen}
        >
          <SlidersHorizontal className="w-4 h-4" /> Tùy chọn
        </button>
      </div>
      {levelOpen && (
        <div className="shrink-0 max-h-[55%] overflow-y-auto bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-2 space-y-3">
          <div className="space-y-1">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-400">Cách trả lời</p>
            <div role="radiogroup" aria-label="Cách trả lời" className="flex flex-wrap gap-1">
              {levels.map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => changeLevel(l)}
                  className={`flex-1 min-w-[4.5rem] min-h-[44px] rounded-lg text-sm font-semibold ${
                    level === l ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  {LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
            <p className="px-1 text-xs text-slate-600 dark:text-zinc-400">Tự động: app đổi cách trả lời theo mức bạn đã quen câu đó.</p>
          </div>
          <div className="space-y-1">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-400">Tùy chọn khác</p>
            {options.map((o) => (
              <button
                key={o.label}
                onClick={o.flip}
                role="switch"
                aria-checked={o.on}
                className={`w-full min-h-[48px] flex items-center gap-3 rounded-lg px-3 py-2 text-left ${
                  o.on ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                }`}
              >
                <o.icon className="w-4 h-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className={`block text-xs ${o.on ? "text-violet-100" : "text-slate-600 dark:text-zinc-400"}`}>{o.hint}</span>
                </span>
                <span className="shrink-0 text-xs font-bold">{o.on ? "Bật" : "Tắt"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3">
        {steps.map((s, i) => {
          const spoken = lineFor(s);
          const mine = s.lineId ? lineOf.get(s.lineId) : undefined;
          const isLast = i === steps.length - 1;
          const hidden = isLast && pending; // the other person is still typing
          const key = `${round}-${i}`;
          const concealed = (listenOnly || challenge) && isLast && peeked !== key && speakable(spoken.en);
          return (
            <div key={key} className="space-y-3">
              {hidden ? (
                <TypingDots />
              ) : (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-sm">
                    {partnerEmoji}
                  </div>
                  <button
                    onClick={() => {
                      if (speakable(spoken.en)) handleSpeak(spoken.en, slow ? PARTNER_SLOW : undefined, partnerVoice);
                    }}
                    className="max-w-[80%] min-w-0 break-words text-left rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-zinc-800 px-4 py-2.5"
                  >
                    {concealed ? (
                      <span className="block text-sm text-slate-600 dark:text-zinc-300">🔊 Nghe rồi trả lời (chạm để nghe lại)</span>
                    ) : (
                      <>
                        <span className="block text-[15px] font-medium text-slate-900 dark:text-white">
                          <TapText text={spoken.en} unlearned={words.unlearned} onWord={(w) => words.open(w, spoken.en)} tone="light" />
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-zinc-400">{spoken.vi}</span>
                      </>
                    )}
                  </button>
                  {concealed && (
                    <button onClick={() => setPeeked(key)} className="min-h-[40px] text-xs font-semibold text-violet-700 dark:text-violet-300">
                      Xem chữ
                    </button>
                  )}
                </div>
              )}
              {mine && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] min-w-0 break-words rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2.5">
                    <span className="block text-[15px] font-medium">
                      <TapText text={mine.en} unlearned={words.unlearned} onWord={(w) => words.open(w, mine.en)} tone="dark" />
                    </span>
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
            {summary && summary.turns > 0 && (
              <div className="rounded-xl bg-white/70 dark:bg-zinc-900/60 p-3 space-y-1 text-sm text-slate-800 dark:text-zinc-200">
                {summary.stars && <p className="text-lg">{"⭐".repeat(summary.stars)}{"☆".repeat(3 - summary.stars)}</p>}
                <p>
                  Đúng ngay lần đầu: <span className="font-semibold">{summary.first}/{summary.turns} lượt</span> ({Math.round(summary.score * 100)}%)
                </p>
                {summary.prev !== undefined && (
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Lần trước {Math.round(summary.prev * 100)}%{" "}
                    {summary.score > summary.prev ? "→ bạn tiến bộ rồi 👏" : summary.score < summary.prev ? "→ lần này kém hơn một chút, thử lại nhé" : "→ giữ vững phong độ"}
                  </p>
                )}
              </div>
            )}
            {missed.size > 0 && (
              <div className="text-sm text-slate-800 dark:text-zinc-200">
                <p className="font-semibold">Câu cần luyện thêm (sẽ quay lại trong phần ôn):</p>
                <ul className="mt-1 space-y-1">
                  {[...missed].map((id) => (
                    <li key={id} className="flex items-center gap-2">
                      <button onClick={() => handleSpeak(lineOf.get(id)?.en ?? "")} aria-label="Nghe câu" className="shrink-0 p-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60">
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span>{lineOf.get(id)?.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weakWords.current.size > 0 && (
              <div className="text-sm text-slate-800 dark:text-zinc-200">
                <p className="font-semibold">Từ máy nghe chưa chắc, hãy nói rõ hơn:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {[...weakWords.current].map((w) => (
                    <button key={w} onClick={() => handleSpeak(w)} className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-xs font-semibold">
                      🔊 {w}
                    </button>
                  ))}
                </div>
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
        <div className="shrink-0 max-h-[60%] overflow-y-auto border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 pt-3 pb-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                !challenge && (
                  <button onClick={() => setHint(true)} className="mt-1 min-h-[40px] inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    <Lightbulb className="w-3.5 h-3.5" /> Xem gợi ý
                  </button>
                )
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
                    className="px-3 min-h-[40px] rounded-lg bg-violet-600 text-white text-sm font-semibold"
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
                    className="px-3 min-h-[40px] rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {t.text}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChosen([])}
                  disabled={chosen.length === 0}
                  className="px-4 min-h-[44px] rounded-xl border border-slate-300 dark:border-zinc-700 disabled:opacity-40"
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
              <MicButton mic={mic} onStart={() => say()} idleLabel="Bấm để nói" />
              {mic.problem && <p className="text-xs text-rose-600 dark:text-rose-400">{mic.problem}</p>}
            </>
          )}

          {feedback && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-sm space-y-1" role="status">
              <p>{feedback}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                {method === "say" && (
                  <button onClick={playRecording} className="min-h-[40px] underline underline-offset-2 inline-flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
                  </button>
                )}
                {fails >= SHOW_ANSWER_AFTER && (
                  <button onClick={showAnswer} className="min-h-[40px] underline underline-offset-2">
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
                  className={`px-3 min-h-[40px] rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                    method === m
                      ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300"
                      : "text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {LEVEL_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {words.sheet}
    </div>
  );
}
