import { useEffect, useMemo, useState } from "react";
import { Check, Eraser, Keyboard, Mic, Puzzle, RotateCcw, Send, Volume2 } from "lucide-react";
import { allSituations, getLine } from "@/data/situations";
import type { Situation, SituationLine } from "@/types/situation";
import { handleSpeak } from "@/components/review/speech";
import { asrAvailable, playRecording, canPlayRecording } from "@/services/pronunciationCheck";
import { buildTiles, judgeSpoken, matchTiles, matchTyped, type Tile } from "@/services/talk/engine";
import { dueLines, recordReview } from "@/services/talk/review";
import { Button, Card as Panel } from "@/components/ui/kit";
import MicButton, { PracticeTop } from "./MicButton";
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
        <PracticeTop onBack={onBack} backLabel="Về danh sách" label="Ôn lại câu cần luyện" />
        <Panel>
          <p className="text-base text-slate-700 dark:text-zinc-300">Hôm nay không còn câu nào cần ôn. Quay lại vào ngày mai nhé.</p>
        </Panel>
      </div>
    );
  }

  if (!card) {
    const right = results.filter(Boolean).length;
    return (
      <div className="space-y-4">
        <Panel className="space-y-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300">
            <Check className="h-6 w-6" />
          </span>
          <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Ôn xong rồi! 🎉</p>
          <p className="text-sm text-slate-700 dark:text-zinc-300">
            Nhớ đúng {right}/{results.length} câu. Câu nào chưa nhớ sẽ quay lại vào ngày mai, câu đã nhớ sẽ cách xa dần.
          </p>
        </Panel>
        <Button size="lg" block onClick={onBack}>
          Về danh sách
        </Button>
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
      <PracticeTop
        onBack={onBack}
        backLabel="Về danh sách"
        label={`Ôn lại câu cần luyện · ${card.situation.title_vi}`}
        count={`Câu ${index + 1}/${cards.length}`}
        percent={((index + 1) / cards.length) * 100}
      />

      <Panel className="space-y-2">
        <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Nói câu này bằng tiếng Anh:</p>
        <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">«{card.line.vi}»</p>
        {card.line.note && <p className="text-sm text-slate-500 dark:text-zinc-400">{card.line.note}</p>}
        {(done !== null || fails >= 2) && (
          <p className="text-base font-semibold text-teal-800 dark:text-teal-300 inline-flex items-center gap-2">
            {card.line.en}
            <button onClick={() => handleSpeak(card.line.en)} aria-label="Nghe câu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-400/10 dark:text-teal-300">
              <Volume2 className="w-4 h-4" />
            </button>
          </p>
        )}
      </Panel>

      {done === null ? (
        <Panel className="space-y-3">
          {method === "say" && (
            <>
              <MicButton mic={mic} onStart={say} idleLabel="Bấm để nói" />
              {mic.problem && <p className="text-sm text-red-700 dark:text-red-300">{mic.problem}</p>}
            </>
          )}
          {method === "tiles" && (
            <>
              <div className="min-h-[3.25rem] rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 p-2 flex flex-wrap gap-1.5">
                {chosen.map((t) => (
                  <button key={t.id} onClick={() => setChosen((c) => c.filter((x) => x.id !== t.id))} className="px-3 min-h-11 rounded-xl bg-teal-700 text-white text-sm font-semibold dark:bg-teal-600">
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
                    className="px-3 min-h-11 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-zinc-100 hover:border-teal-600/50"
                  >
                    {t.text}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="lg" onClick={() => setChosen([])} disabled={chosen.length === 0} aria-label="Xóa hết" className="px-5">
                  <Eraser className="w-5 h-5" />
                </Button>
                <Button size="lg" className="flex-1" onClick={sendTiles} disabled={chosen.length === 0}>
                  <Send className="w-5 h-5" /> Gửi
                </Button>
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
                className="flex-1 min-w-0 min-h-12 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-base text-slate-900 dark:text-zinc-100 focus:border-teal-600 focus:outline-none"
              />
              <Button type="submit" disabled={!typed.trim()} aria-label="Gửi" className="px-4">
                <Send className="w-5 h-5" />
              </Button>
            </form>
          )}

          {feedback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-sm space-y-1" role="status">
              <p>{feedback}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                {method === "say" && canPlayRecording() && (
                  <button onClick={playRecording} className="min-h-10 underline underline-offset-2 inline-flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Nghe lại giọng mình
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-1">
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
                    className={`px-3 min-h-10 rounded-full text-sm font-semibold inline-flex items-center gap-1 ${
                      method === m ? "bg-teal-700 text-white dark:bg-teal-600" : "border border-slate-200 text-slate-700 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {METHOD_LABEL[m]}
                  </button>
                );
              })}
            </div>
            <button onClick={() => settle(false)} className="min-h-10 px-1 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
              Xem đáp án
            </button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm inline-flex items-center gap-2 w-full ${
              done
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
            }`}
          >
            {done ? <Check className="w-4 h-4 shrink-0" /> : <RotateCcw className="w-4 h-4 shrink-0" />}
            {done ? "Đúng rồi! Câu này sẽ cách xa dần." : "Chưa nhớ cũng không sao, câu này sẽ quay lại vào ngày mai."}
          </div>
          <Button size="lg" block onClick={next}>
            {index + 1 >= cards.length ? "Xong" : "Câu tiếp theo"}
          </Button>
        </div>
      )}
    </div>
  );
}
