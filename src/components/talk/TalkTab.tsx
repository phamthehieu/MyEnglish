import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, PlayCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { dueLines } from "@/services/talk/review";
import { getAllWords } from "@/services/db";
import { bankStatus, buildWordIndex } from "@/services/reading";
import { getSituationProgress } from "@/services/talk/progress";
import type { WordDetail } from "@/types/database";
import LineReview from "./LineReview";
import { allSituations, getSituation } from "@/data/situations";
import type { Situation, SituationGroup } from "@/types/situation";
import { summarize, TALK_UPDATED_EVENT, type SituationStatus } from "@/services/talk/progress";
import { removeGenerated, TALK_GENERATED_EVENT } from "@/services/talk/custom";
import { aiReady, generateSituation } from "@/services/talk/generateAi";
import { batchAvailable, batchStatus, cancelBatch, importPending, startBatch, topUpBatch, type BatchStatus } from "@/services/talk/situationBatch";
import { getActiveCefrLevel } from "@/services/pipeline";
import { isFoundationMode } from "@/services/learnerProfile";
import { isMobilePlatform } from "@/lib/platform";
import { asrAvailable } from "@/services/pronunciationCheck";
import { PAGE_CONTAINER } from "../dashboard/shared";
import { Badge, Button, Card } from "../ui/kit";
import Conversation from "./Conversation";
import WarmUp from "./WarmUp";

type View = { kind: "list" } | { kind: "warmup"; id: string } | { kind: "chat"; id: string } | { kind: "review" };

const LEVELS: Array<Situation["cefr"]> = ["A1", "A2", "B1", "B2", "C1", "C2"];

const GROUPS: Array<{ id: SituationGroup; label: string }> = [
  { id: "daily", label: "Đời thường" },
  { id: "work", label: "Công việc" },
];

const STATUS_LABEL: Record<SituationStatus, string> = { new: "Mới", learning: "Đang học", done: "Đã nói được" };
const STATUS_TONE: Record<SituationStatus, "neutral" | "amber" | "green"> = { new: "neutral", learning: "amber", done: "green" };

/** How many words of a conversation are in the learner's word bank but not remembered long yet */
function learningWordsIn(situation: Situation, formIndex: ReadonlyMap<string, WordDetail>): number {
  const text = [...situation.lines.map((l) => l.en), ...situation.dialogue.map((n) => n.npc_en)].join(" ");
  const seen = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []) {
    const hit = formIndex.get(w);
    if (hit && bankStatus(hit) !== "mastered") seen.add(hit.id ? String(hit.id) : w);
  }
  return seen.size;
}

function SituationCard({
  situation,
  learning,
  onWarmUp,
  onChat,
  suggested = false,
}: {
  situation: Situation;
  /** Words of it the learner is still learning */
  learning: number;
  onWarmUp: () => void;
  onChat: () => void;
  /** The lesson picked for today: shown first, with a label */
  suggested?: boolean;
}) {
  const s = summarize(situation);
  const stars = getSituationProgress(situation.id).bestStars ?? 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Card className={`space-y-3 ${suggested ? "border-teal-600/60 ring-1 ring-teal-600/20 dark:border-teal-500/50" : ""}`}>
      {suggested && <Badge tone="teal">Bài gợi ý hôm nay</Badge>}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">{situation.title_vi}</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {situation.title_en} · {situation.cefr}
            {situation.ai && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-400/10 text-xs text-teal-800 dark:text-teal-300 font-semibold">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
          </p>
        </div>
        <Badge tone={STATUS_TONE[s.status]} className="shrink-0">
          {STATUS_LABEL[s.status]}
        </Badge>
      </div>
      <p className="text-sm text-slate-700 dark:text-zinc-300">Mục tiêu: {situation.goal_vi}</p>
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Đã nói được {s.linesSaid}/{s.totalLines} câu · đã trò chuyện {s.runs} lần
        {stars > 0 && <span className="ml-1.5">· Thử thách {"⭐".repeat(stars)}</span>}
      </p>
      {learning > 0 && (
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">📚 Có {learning} từ bạn đang học trong bài này</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onWarmUp}>
          <PlayCircle className="w-4 h-4" /> Học câu trước
        </Button>
        <Button onClick={onChat}>
          <MessageCircle className="w-4 h-4" /> Nói thử
        </Button>
      </div>
      {situation.ai && (
        <div className="flex justify-end">
          {confirmDelete ? (
            <span className="text-sm text-slate-500 dark:text-zinc-400">
              Xóa hội thoại này?{" "}
              <button onClick={() => removeGenerated(situation.id)} className="min-h-[40px] px-2 font-semibold text-red-700 dark:text-red-300 underline underline-offset-2">
                Xóa
              </button>{" "}
              ·{" "}
              <button onClick={() => setConfirmDelete(false)} className="min-h-[40px] px-2 font-semibold underline underline-offset-2">
                Giữ lại
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="min-h-[40px] px-2 text-sm text-slate-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-300 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/** The learner's own choice to have the AI write a new conversation (never automatic) */
function GenerateCard({ onCreated }: { onCreated: (s: Situation) => void }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [levelText, setLevelText] = useState("");

  useEffect(() => {
    let cancelled = false;
    aiReady().then((ok) => !cancelled && setReady(ok));
    getActiveCefrLevel()
      .then((level) => !cancelled && setLevelText(isFoundationMode() ? "A0 (mới bắt đầu)" : level))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [count, setCount] = useState(3);
  const [progress, setProgress] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // Android: the phone writes them in the background (even with the app closed) and these are added when they
  // are there. Look when the card opens, while it is open, and when the app comes back to the front.
  const background = batchAvailable();
  const [background_status, setBackgroundStatus] = useState<BatchStatus | null>(null);
  useEffect(() => {
    if (!background) return;
    const look = () => {
      const status = batchStatus();
      setBackgroundStatus(status);
      const added = importPending();
      if (added.length > 0) {
        setMade((prev) => [...(prev ? prev.split(", ") : []), ...added.map((s) => s.title_vi)].join(", "));
        added.forEach(onCreated);
      }
      if (status && !status.running && status.total > 0 && status.done === 0 && status.error) setError(status.error);
      void topUpBatch(status);
    };
    look();
    const timer = window.setInterval(look, 2500);
    document.addEventListener("visibilitychange", look);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, [background, onCreated]);
  const writing = background && background_status?.running === true;

  const createInBackground = async () => {
    setBusy(true);
    setError(null);
    setMade(null);
    try {
      if (!(await startBatch(count))) setError("Không bắt đầu được việc tạo trong nền. Thử lại nhé.");
      else setBackgroundStatus(batchStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // One after another (each takes a topic the next one skips); a failure keeps the ones already made
  const create = async () => {
    if (background) return createInBackground();
    setBusy(true);
    setError(null);
    setMade(null);
    setProgress(0);
    setRetrying(false);
    const titles: string[] = [];
    // A weak network or an overloaded model (503) is retried, waiting longer each time, until the number the learner
    // chose is reached. A key the API refuses cannot be fixed by trying again, and too many failures in a row stop it.
    let wait = 4000;
    let failures = 0;
    try {
      while (titles.length < count) {
        try {
          const s = await generateSituation();
          titles.push(s.title_vi);
          setProgress(titles.length);
          setRetrying(false);
          onCreated(s);
          failures = 0;
          wait = 4000;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures++;
          if (/API key|khóa/i.test(message) || failures >= 8) {
            setError(titles.length < count ? `${message} (đã tạo ${titles.length}/${count} bài)` : message);
            break;
          }
          setRetrying(true);
          await new Promise((resolve) => setTimeout(resolve, wait));
          wait = Math.min(wait * 2, 30000);
        }
      }
    } finally {
      if (titles.length > 0) setMade(titles.join(", "));
      setRetrying(false);
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-semibold text-slate-900 dark:text-zinc-100 inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-300" /> Tạo hội thoại mới bằng AI
        </p>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Tình huống mới{levelText ? `, hợp trình độ ${levelText}` : ""}, không trùng với các hội thoại bạn đang có. Chỉ tạo khi
          bạn bấm.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
        <span>Số bài:</span>
        {[1, 3, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            disabled={busy || writing}
            className={`min-w-[44px] min-h-10 px-3 rounded-full font-semibold ${count === n ? "bg-teal-700 text-white dark:bg-teal-600" : "border border-slate-200 text-slate-700 dark:border-zinc-700 dark:text-zinc-300"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <Button block onClick={create} disabled={busy || writing || ready !== true}>
        {writing && background_status ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {background_status.error
              ? ` Mạng yếu hoặc AI bận, đang thử lại (${background_status.done}/${background_status.total})…`
              : ` Đang tạo trong nền ${background_status.done}/${background_status.total}…`}
          </>
        ) : busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {retrying ? ` Mạng yếu hoặc AI bận, đang thử lại (${progress}/${count})…` : ` Đang tạo ${progress + 1}/${count} (khoảng nửa phút mỗi bài)…`}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Tạo {count} hội thoại mới
          </>
        )}
      </Button>
      {writing && (
        <div className="flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Bạn có thể thoát app, máy vẫn tạo tiếp và báo khi xong.</span>
          <button onClick={cancelBatch} className="min-h-10 font-semibold text-teal-700 dark:text-teal-300 underline underline-offset-2 shrink-0">
            Dừng
          </button>
        </div>
      )}
      {ready === false && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Chưa có AI. Vào Cài đặt để nhập khóa Gemini{isMobilePlatform() ? "" : " (hoặc cài AI CLI)"}, rồi quay lại đây.
        </p>
      )}
      {made && <p className="text-sm text-green-700 dark:text-green-300">Đã tạo {made.split(", ").length} bài: {made}. Xem ở nhóm bên dưới.</p>}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </Card>
  );
}

/** Trò chuyện tình huống: learn the sentences of a situation, then talk it through with a scripted partner */
export default function TalkTab({ resetKey }: { resetKey?: number }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [, setTick] = useState(0);
  const [level, setLevel] = useState<"all" | Situation["cefr"]>("all");
  // The learner's word bank: conversations that use words they are still learning say so, and come first within a level
  const [bank, setBank] = useState<WordDetail[]>([]);
  useEffect(() => {
    let dead = false;
    getAllWords()
      .then((words) => !dead && setBank(words))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);
  const formIndex = useMemo(() => buildWordIndex(bank).formIndex, [bank]);

  // Tapping the tab again returns to the list
  useEffect(() => {
    setView({ kind: "list" });
  }, [resetKey]);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(TALK_UPDATED_EVENT, refresh);
    window.addEventListener(TALK_GENERATED_EVENT, refresh);
    return () => {
      window.removeEventListener(TALK_UPDATED_EVENT, refresh);
      window.removeEventListener(TALK_GENERATED_EVENT, refresh);
    };
  }, []);

  const situation = view.kind === "warmup" || view.kind === "chat" ? getSituation(view.id) : undefined;

  // The chat fills the screen and keeps its answer box at the bottom; the other screens scroll as pages
  if (view.kind === "chat" && situation) {
    return (
      <div className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full">
        <Conversation key={situation.id} situation={situation} onBack={() => setView({ kind: "list" })} />
      </div>
    );
  }

  const all = allSituations();
  const inLevel = (s: Situation) => level === "all" || s.cefr === level;
  const due = dueLines().length;
  // Today's suggestion: the one being learned, else the easiest new one that uses the most words the learner is learning
  const statusOf = (s: Situation) => summarize(s).status;
  const suggested =
    all.find((s) => statusOf(s) === "learning") ??
    [...all]
      .filter((s) => statusOf(s) === "new")
      .sort((a, b) => LEVELS.indexOf(a.cefr) - LEVELS.indexOf(b.cefr) || learningWordsIn(b, formIndex) - learningWordsIn(a, formIndex))[0];
  const showSuggested = !!suggested && level === "all";
  return (
    <div className={PAGE_CONTAINER}>
      {view.kind === "review" ? (
        <LineReview onBack={() => setView({ kind: "list" })} />
      ) : view.kind === "warmup" && situation ? (
        <WarmUp
          key={situation.id}
          situation={situation}
          onBack={() => setView({ kind: "list" })}
          onChat={() => setView({ kind: "chat", id: situation.id })}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Trò chuyện tình huống</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Học vài câu cần dùng, rồi nói thử như ngoài đời. Chọn câu hoặc tự nói, máy sẽ nghe và báo lại.
            </p>
            {!asrAvailable() && <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Chấm giọng chỉ có trên điện thoại Android.</p>}
          </div>
          {showSuggested && (
            <SituationCard
              suggested
              situation={suggested}
              learning={learningWordsIn(suggested, formIndex)}
              onWarmUp={() => setView({ kind: "warmup", id: suggested.id })}
              onChat={() => setView({ kind: "chat", id: suggested.id })}
            />
          )}
          {due > 0 && (
            <button
              onClick={() => setView({ kind: "review" })}
              className="w-full text-left rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3 hover:border-amber-300"
            >
              <RotateCcw className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-amber-900 dark:text-amber-200">Ôn lại hôm nay: {due} câu</span>
                <span className="block text-sm text-amber-800 dark:text-amber-300">Những câu bạn từng nói sai hoặc phải xem đáp án. Ôn vài phút là nhớ lâu hơn.</span>
              </span>
            </button>
          )}
          <p className="text-sm text-slate-500 dark:text-zinc-400">Cấp độ: A1 dễ → C2 khó.</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" role="tablist" aria-label="Cấp độ">
            {(["all", ...LEVELS] as const).map((l) => {
              const count = l === "all" ? all.length : all.filter((s) => s.cefr === l).length;
              // A level with nothing in it yet is not offered
              if (l !== "all" && count === 0) return null;
              return (
                <button
                  key={l}
                  role="tab"
                  aria-selected={level === l}
                  onClick={() => setLevel(l)}
                  className={`shrink-0 px-4 min-h-10 rounded-full text-sm font-semibold border transition-colors ${
                    level === l
                      ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                      : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {l === "all" ? "Tất cả" : l}
                  <span className={`ml-1.5 text-xs font-normal ${level === l ? "text-teal-50" : "text-slate-500 dark:text-zinc-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {GROUPS.map((g) => {
            // The ones the AI wrote for the learner first (newest on top), then the ones that come with the app,
            // easiest level first
            const notSuggested = (s: Situation) => !(showSuggested && s.id === suggested.id);
            const made = all.filter((s) => s.group === g.id && s.ai && inLevel(s) && notSuggested(s)).sort((a, b) => b.ai!.createdAt - a.ai!.createdAt);
            const builtIn = all
              .filter((s) => s.group === g.id && !s.ai && inLevel(s) && notSuggested(s))
              .sort(
                (a, b) =>
                  LEVELS.indexOf(a.cefr) - LEVELS.indexOf(b.cefr) || learningWordsIn(b, formIndex) - learningWordsIn(a, formIndex)
              );
            const list = [...made, ...builtIn];
            if (list.length === 0) return null;
            return (
              <section key={g.id} className="space-y-3">
                <h3 className="pt-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">{g.label}</h3>
                {list.map((s) => (
                  <SituationCard
                    key={s.id}
                    situation={s}
                    learning={learningWordsIn(s, formIndex)}
                    onWarmUp={() => setView({ kind: "warmup", id: s.id })}
                    onChat={() => setView({ kind: "chat", id: s.id })}
                  />
                ))}
              </section>
            );
          })}
          <GenerateCard onCreated={() => setTick((t) => t + 1)} />
        </div>
      )}
    </div>
  );
}
