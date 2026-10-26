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
import { PAGE_CONTAINER } from "../dashboard/shared";
import Conversation from "./Conversation";
import WarmUp from "./WarmUp";

type View = { kind: "list" } | { kind: "warmup"; id: string } | { kind: "chat"; id: string } | { kind: "review" };

const LEVELS: Array<Situation["cefr"]> = ["A1", "A2", "B1", "B2", "C1", "C2"];

const GROUPS: Array<{ id: SituationGroup; label: string }> = [
  { id: "daily", label: "Đời thường" },
  { id: "work", label: "Công việc" },
];

const STATUS_LABEL: Record<SituationStatus, string> = { new: "Mới", learning: "Đang học", done: "Đã nói được" };
const STATUS_TONE: Record<SituationStatus, string> = {
  new: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300",
  learning: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
};

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
}: {
  situation: Situation;
  /** Words of it the learner is still learning */
  learning: number;
  onWarmUp: () => void;
  onChat: () => void;
}) {
  const s = summarize(situation);
  const stars = getSituationProgress(situation.id).bestStars ?? 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white">{situation.title_vi}</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {situation.title_en} · {situation.cefr}
            {situation.ai && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-semibold">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[s.status]}`}>
          {STATUS_LABEL[s.status]}
        </span>
      </div>
      <p className="text-sm text-slate-700 dark:text-zinc-300">Mục tiêu: {situation.goal_vi}</p>
      <p className="text-xs text-slate-500 dark:text-zinc-400">
        Đã nói được {s.linesSaid}/{s.totalLines} câu · đã trò chuyện {s.runs} lần
        {stars > 0 && <span className="ml-1.5">· Thử thách {"⭐".repeat(stars)}</span>}
      </p>
      {learning > 0 && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">📚 Có {learning} từ bạn đang học trong bài này</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onWarmUp}
          className="flex-1 py-2.5 rounded-xl border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <PlayCircle className="w-4 h-4" /> Khởi động
        </button>
        <button
          onClick={onChat}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> Trò chuyện
        </button>
      </div>
      {situation.ai && (
        <div className="flex justify-end">
          {confirmDelete ? (
            <span className="text-xs text-slate-600 dark:text-zinc-400">
              Xóa hội thoại này?{" "}
              <button onClick={() => removeGenerated(situation.id)} className="font-semibold text-rose-600 dark:text-rose-400 underline underline-offset-2">
                Xóa
              </button>{" "}
              ·{" "}
              <button onClick={() => setConfirmDelete(false)} className="font-semibold underline underline-offset-2">
                Giữ lại
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-slate-500 dark:text-zinc-400 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa
            </button>
          )}
        </div>
      )}
    </div>
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
    <div className="rounded-2xl border border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 p-4 space-y-2">
      <p className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-500" /> Tạo hội thoại mới bằng AI
      </p>
      <p className="text-xs text-slate-600 dark:text-zinc-400">
        Tình huống mới{levelText ? `, hợp trình độ ${levelText}` : ""}, không trùng với các hội thoại bạn đang có. Chỉ tạo khi
        bạn bấm.
      </p>
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
        <span>Số bài:</span>
        {[1, 3, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            disabled={busy || writing}
            className={`px-3 py-1 rounded-lg border font-semibold ${count === n ? "border-violet-500 bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300" : "border-slate-200 dark:border-zinc-700"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={create}
        disabled={busy || writing || ready !== true}
        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
      >
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
      </button>
      {writing && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <span>Bạn có thể thoát app, máy vẫn tạo tiếp và báo khi xong.</span>
          <button onClick={cancelBatch} className="font-semibold underline underline-offset-2 shrink-0">
            Dừng
          </button>
        </div>
      )}
      {ready === false && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Chưa có AI. Vào Cài đặt để nhập khóa Gemini (hoặc cài AI CLI), rồi quay lại đây.
        </p>
      )}
      {made && <p className="text-xs text-emerald-700 dark:text-emerald-300">Đã tạo {made.split(", ").length} bài: {made}. Xem ở nhóm bên dưới.</p>}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
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
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Trò chuyện tình huống</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Học vài câu cần dùng, rồi trò chuyện thử như ngoài đời. Chọn câu hoặc tự nói, máy sẽ nghe và báo lại.
            </p>
          </div>
          {due > 0 && (
            <button
              onClick={() => setView({ kind: "review" })}
              className="w-full text-left rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3"
            >
              <RotateCcw className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-amber-900 dark:text-amber-200">Ôn lại hôm nay: {due} câu</span>
                <span className="block text-xs text-amber-800 dark:text-amber-300">Những câu bạn từng nói sai hoặc phải xem đáp án. Ôn vài phút là nhớ lâu hơn.</span>
              </span>
            </button>
          )}
          <GenerateCard onCreated={() => setTick((t) => t + 1)} />
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Cấp độ">
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
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    level === l
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-emerald-400"
                  }`}
                >
                  {l === "all" ? "Tất cả" : l}
                  <span className={`ml-1.5 text-xs font-normal ${level === l ? "text-emerald-100" : "text-slate-400 dark:text-zinc-500"}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {GROUPS.map((g) => {
            // The ones the AI wrote for the learner first (newest on top), then the ones that come with the app,
            // easiest level first
            const made = all.filter((s) => s.group === g.id && s.ai && inLevel(s)).sort((a, b) => b.ai!.createdAt - a.ai!.createdAt);
            const builtIn = all
              .filter((s) => s.group === g.id && !s.ai && inLevel(s))
              .sort(
                (a, b) =>
                  LEVELS.indexOf(a.cefr) - LEVELS.indexOf(b.cefr) || learningWordsIn(b, formIndex) - learningWordsIn(a, formIndex)
              );
            const list = [...made, ...builtIn];
            if (list.length === 0) return null;
            return (
              <section key={g.id} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{g.label}</h3>
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
        </div>
      )}
    </div>
  );
}
