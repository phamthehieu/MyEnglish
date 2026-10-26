import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Eraser, Keyboard, Mic, Puzzle, RotateCcw, Send, Volume2 } from "lucide-react";
import { allSituations, getLine } from "@/data/situations";
import type { Situation, SituationLine } from "@/types/situation";
import { handleSpeak } from "@/components/review/speech";
import { asrAvailable, playRecording } from "@/services/pronunciationCheck";
import { buildTiles, judgeSpoken, matchTiles, matchTyped, type Tile } from "@/services/talk/engine";
import { dueLines, recordReview } from "@/services/talk/review";
import MicButton from "./MicButton";
import { useMic } from "./useMic";

/** At most this many sentences in one sitting */
const SESSION_SIZE = 8;

type Method = "say" | "tiles" | "type";
const METHOD_LABEL: Record<Method, string> = { say: "Nói", tiles: "Ghép từ", type: "Gõ" };
const METHOD_ICON = { say: Mic, tiles: Puzzle, type: Keyboard } as const;

interface Card {
  line: SituationLine;
  situation: Situation;
}

/** The sentences due for review that still exist (a deleted conversation takes its sentences with it) */
function loadCards(): Card[] {
  const situations = allSituations();
  const cards: Card[] = [];
  for (const id of dueLines(new Date(), SESSION_SIZE * 2)) {
    const line = getLine(id);
    const situation = line ? situations.find((s) => s.lines.some((l) => l.id === id)) : undefined;
    if (line && situation) cards.push({ line, situation });
    if (cards.length >= SESSION_SIZE) break;
  }
  return cards;
}

/** Sentences missed in the conversations, brought back one by one: the meaning is shown, the learner says, builds or types it */
export default function LineReview({ onBack }: { onBack: () => void }) {
  const canSpeak = asrAvailable();
  const [cards] = useState<Card[]>(loadCards);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [method, setMethod] = useState<Method>(canSpeak ? "say" : "tiles");
  const [typed, setTyped] = useState("");
  const [chosen, setChosen] = useState<Tile[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  /** After an answer: right, or the answer was shown (false) */
  const [done, setDone] = useState<boolean | null>(null);
  const mic = useMic();

  const card = cards[index];
  const tiles = useMemo(() => (card ? buildTiles(card.line, card.situation) : []), [card]);
  const notChosen = tiles.filter((t) => !chosen.some((c) => c.id === t.id));

  // A new sentence: the answer boxes are cleared
  useEffect(() => {
    setTyped("");
    setChosen([]);
    setFeedback(null);
    setFails(0);
    setDone(null);
  }, [index]);

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="p-1.5 -ml-1.5 text-slate-600 dark:text-zinc-400" aria-label="Về danh sách">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-sm text-slate-600 dark:text-zinc-400">Hôm nay không còn câu nào cần ôn. Quay lại vào ngày mai nhé.</p>
      </div>
    );
  }

  if (!card) {
    const right = results.filter(Boolean).length;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
          <p className="font-bold text-emerald-800 dark:text-emerald-200">Ôn xong rồi! 🎉</p>
          <p className="text-sm text-emerald-900 dark:text-emerald-100">
            Nhớ đúng {right}/{results.length} câu. Câu nào chưa nhớ sẽ quay lại vào ngày mai, câu đã nhớ sẽ cách xa dần.
          </p>
        </div>
        <button onClick={onBack} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
          Về danh sách
        </button>
      </div>
    );
  }

  const settle = (ok: boolean) => {
    mic.cancel();
    recordReview(card.line.id, ok);
    setResults((r) => [...r, ok]);
    setDone(ok);
    handleSpeak(card.line.en);
  };
  const miss = (message: string) => {
    setFails((f) => f + 1);
    setFeedback(message);
  };
  const next = () => setIndex((i) => i + 1);

  const say = () =>
    mic.begin(card.situation, [card.line], (result, grammar) => {
      const v = judgeSpoken(result, grammar, new Set([card.line.id]));
      if (v.kind === "ok") settle(true);
      else miss(v.message);
    });

  const sendTyped = () => {
    if (matchTyped(typed, [card.line])) settle(true);
    else miss("Chưa đúng rồi, xem lại nghĩa tiếng Việt rồi gõ lại nhé.");
  };

  const sendTiles = () => {
    if (matchTiles(chosen, [card.line])) settle(true);
    else miss("Chưa đúng rồi. Bấm vào từ đã chọn để bỏ ra, xếp lại nhé.");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 -ml-1.5 text-slate-600 dark:text-zinc-400" aria-label="Về danh sách">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ôn lại câu cần luyện</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Câu {index + 1}/{cards.length} · {card.situation.title_vi}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Nói câu này bằng tiếng Anh:</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">«{card.line.vi}»</p>
        {card.line.note && <p className="text-xs text-slate-500 dark:text-zinc-400">{card.line.note}</p>}
        {(done !== null || fails >= 2) && (
          <p className="text-[15px] font-semibold text-violet-700 dark:text-violet-300 inline-flex items-center gap-2">
            {card.line.en}
            <button onClick={() => handleSpeak(card.line.en)} aria-label="Nghe câu" className="p-1 rounded-full bg-violet-100 dark:bg-violet-950/60">
              <Volume2 className="w-4 h-4" />
            </button>
          </p>
        )}
      </div>

      {done === null ? (
        <div className="space-y-3">
          {method === "say" && (
            <>
              <MicButton mic={mic} onStart={say} idleLabel="Bấm để nói" />
              {mic.problem && <p className="text-xs text-rose-600 dark:text-rose-400">{mic.problem}</p>}
            </>
          )}
          {method === "tiles" && (
            <>
              <div className="min-h-[3rem] rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 p-2 flex flex-wrap gap-1.5">
                {chosen.map((t) => (
                  <button key={t.id} onClick={() => setChosen((c) => c.filter((x) => x.id !== t.id))} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold">
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
                <button onClick={() => setChosen([])} disabled={chosen.length === 0} className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 disabled:opacity-40" aria-label="Xóa hết">
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
                placeholder="Gõ câu tiếng Anh…"
                className="flex-1 min-w-0 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-[15px] text-slate-900 dark:text-white"
              />
              <button type="submit" disabled={!typed.trim()} className="px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white" aria-label="Gửi">
                <Send className="w-4 h-4" />
              </button>
            </form>
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
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(canSpeak ? (["say", "tiles", "type"] as const) : (["tiles", "type"] as const)).map((m) => {
                const Icon = METHOD_ICON[m];
                return (
                  <button
                    key={m}
                    onClick={() => {
                      mic.cancel();
                      setFeedback(null);
                      setMethod(m);
                    }}
                    aria-pressed={method === m}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                      method === m ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-zinc-400"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {METHOD_LABEL[m]}
                  </button>
                );
              })}
            </div>
            <button onClick={() => settle(false)} className="text-xs font-semibold underline underline-offset-2 text-slate-600 dark:text-zinc-400">
              Xem đáp án
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 w-full ${
              done
                ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
            }`}
          >
            {done ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            {done ? "Đúng rồi! Câu này sẽ cách xa dần." : "Chưa nhớ cũng không sao, câu này sẽ quay lại vào ngày mai."}
          </div>
          <button onClick={next} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
            {index + 1 >= cards.length ? "Xong" : "Câu tiếp theo"}
          </button>
        </div>
      )}
    </div>
  );
}
