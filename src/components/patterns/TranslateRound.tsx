import { useEffect, useRef, useState } from "react";
import { Check, Lightbulb, RotateCcw, Send, Volume2, X } from "lucide-react";
import type { Pattern } from "@/types/pattern";
import { handleSpeak } from "@/components/review/speech";
import { asrAvailable } from "@/services/pronunciationCheck";
import { judgeSpoken } from "@/services/talk/engine";
import { lineOfSlot, patternSituation } from "@/services/patterns/engine";
import { applyTranslate } from "@/services/patterns/session";
import {
  buildTranslateRound,
  isTranslation,
  limitFor,
  matchedWords,
  pointsFor,
  type TranslateItem,
  type TranslateResult,
} from "@/services/patterns/translate";
import MicButton, { PracticeTop } from "@/components/talk/MicButton";
import { useMic } from "@/components/talk/useMic";
import { useKeepVisible } from "./useKeepVisible";
import { IpaLine, IpaToggle } from "./Ipa";

const ROUND_SIZE = 10;

const BTN_PRIMARY = "w-full min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50";

/** The dots that stand for a word the learner has not found yet */
const dots = (word: string) => "•".repeat(Math.min(10, Math.max(2, word.replace(/[^A-Za-z']/g, "").length)));

/** One sentence: the Vietnamese, the skeleton of the English one, the box to write it in, and the clock */
function Question({ item, onDone }: { item: TranslateItem; onDone: (r: TranslateResult) => void }) {
  const canSpeak = asrAvailable();
  const mic = useMic();
  const limit = limitFor(item.words.length);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [hints, setHints] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; points: number; ms: number; message: string } | null>(null);
  const { area, input } = useKeepVisible<HTMLDivElement, HTMLTextAreaElement>();
  const startedAt = useRef(Date.now());
  const settled = useRef(false);
  const state = useRef({ hints, mistakes });
  state.current = { hints, mistakes };

  const settle = (ok: boolean, message: string) => {
    if (settled.current) return;
    settled.current = true;
    mic.cancel();
    const ms = Math.min(limit, Date.now() - startedAt.current);
    const points = pointsFor(ok, state.current.hints, state.current.mistakes, ms, limit);
    setVerdict({ ok, points, ms, message });
    handleSpeak(item.en);
  };

  // The clock waits while the microphone is still being prepared for the first time
  const preparing = useRef(false);
  preparing.current = mic.phase === "preparing";

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (preparing.current) startedAt.current += 100;
      const e = Date.now() - startedAt.current;
      setElapsed(e);
      if (e >= limit) settle(false, "Hết giờ rồi.");
    }, 100);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matched = matchedWords(typed, item.words);
  const shown = (i: number) => revealed.has(i) || i < matched;

  const hint = () => {
    const at = item.words.findIndex((_, i) => !shown(i));
    if (at < 0) return;
    setRevealed((r) => new Set(r).add(at));
    setHints((h) => h + 1);
  };

  const reveal = (i: number) => {
    if (shown(i)) return;
    setRevealed((r) => new Set(r).add(i));
    setHints((h) => h + 1);
  };

  const check = () => {
    if (isTranslation(typed, item.en)) {
      settle(true, "Đúng rồi!");
    } else {
      setMistakes((m) => m + 1);
      setFeedback("Chưa đúng, xem lại các ô rồi sửa nhé.");
    }
  };

  const say = () =>
    mic.begin(
      patternSituation(item.pattern),
      [lineOfSlot(item.pattern, item.slot)],
      (result, grammar) => {
        const line = lineOfSlot(item.pattern, item.slot);
        const v = judgeSpoken(result, grammar, new Set([line.id]));
        if (v.kind === "ok") settle(true, "Máy nghe đúng. Tốt lắm!");
        else if (!settled.current) {
          setMistakes((m) => m + 1);
          setFeedback(v.message);
        }
      },
      Math.min(8000, 2500 + item.words.length * 600)
    );

  const left = Math.max(0, 1 - elapsed / limit);
  const level = item.hint;

  return (
    // The bottom padding leaves room to scroll the box above the keyboard
    <div ref={area} className="space-y-3 pb-[45vh]">
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-zinc-400">NGHĨA TIẾNG VIỆT:</p>
        <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">{item.vi}</p>

        {level !== "none" && (
          <div className="flex flex-wrap gap-1.5" aria-label="Khung câu tiếng Anh">
            {level === "full" ? (
              item.words.map((w, i) =>
                shown(i) ? (
                  <span key={i} className="px-2.5 py-1 rounded-full border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 font-mono text-sm">
                    {w}
                  </span>
                ) : (
                  <button
                    key={i}
                    onClick={() => reveal(i)}
                    disabled={!!verdict}
                    aria-label="Mở từ này (mất điểm)"
                    className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono text-sm tracking-widest hover:border-teal-600/50"
                  >
                    {dots(w)}
                  </button>
                )
              )
            ) : (
              <span className="text-sm text-slate-600 dark:text-zinc-400">Câu tiếng Anh có {item.words.length} từ.</span>
            )}
          </div>
        )}

        <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden" aria-label="Thời gian còn lại">
          <div className={`h-full rounded-full ${left < 0.25 ? "bg-red-500" : "bg-teal-700 dark:bg-teal-500"}`} style={{ width: `${left * 100}%` }} />
        </div>
      </div>

      {!verdict ? (
        <>
          <textarea
            ref={input}
            autoFocus
            rows={2}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setFeedback(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (typed.trim()) check();
              } else if (e.key === " " && e.ctrlKey) {
                e.preventDefault();
                hint();
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="Gõ câu tiếng Anh…"
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-base text-slate-900 dark:text-zinc-100 resize-none focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
          {feedback && <p className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-sm">{feedback}</p>}
          <div className="flex gap-2">
            <button onClick={hint} className="min-h-14 px-5 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 font-semibold inline-flex items-center justify-center gap-2 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300">
              <Lightbulb className="w-4 h-4" /> Gợi ý
            </button>
            <button onClick={check} disabled={!typed.trim()} className="flex-1 min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="w-5 h-5" /> Kiểm tra
            </button>
          </div>
          {canSpeak && (
            <>
              <MicButton mic={mic} onStart={() => void say()} idleLabel="Hoặc bấm để nói" />
              {mic.problem && <p className="text-sm text-red-700 dark:text-red-300">{mic.problem}</p>}
            </>
          )}
          <p className="text-sm text-slate-500 dark:text-zinc-400">Mỗi gợi ý trừ 25 điểm, mỗi lần sai trừ 12 điểm. Bấm vào ô chấm để mở đúng từ đó.</p>
        </>
      ) : (
        <>
          <div
            className={`rounded-xl border px-3 py-2 text-sm space-y-1 ${
              verdict.ok
                ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
            }`}
          >
            <p className="inline-flex items-center gap-2">
              {verdict.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {verdict.message} {verdict.ok && <span className="font-semibold">+{verdict.points} điểm</span>}
              {verdict.ok && <span className="text-xs">({(verdict.ms / 1000).toFixed(1)} giây)</span>}
            </p>
            <p className="font-semibold inline-flex items-center gap-2">
              {item.en}
              <button onClick={() => handleSpeak(item.en)} aria-label="Nghe câu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 hover:bg-teal-100 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300">
                <Volume2 className="w-4 h-4" />
              </button>
            </p>
            <IpaLine ipa={item.slot.ipa} />
          </div>
          <button
            onClick={() =>
              onDone({ patternId: item.pattern.id, vi: item.vi, en: item.en, ok: verdict.ok, ms: verdict.ms, hints: hints + mistakes, points: verdict.points })
            }
            className={BTN_PRIMARY}
          >
            Tiếp theo
          </button>
        </>
      )}
    </div>
  );
}

/** A round of ten sentences to translate, then how it went */
export default function TranslateRound({
  patterns,
  onExit,
  onDone,
  onFinish,
  size = ROUND_SIZE,
  forceNoHints = false,
  title = "Dịch câu",
}: {
  patterns: Pattern[];
  onExit: () => void;
  /** The "Xong" at the end, for a round that is one part of a longer session (otherwise `onExit`) */
  onDone?: () => void;
  /** Called with the results when the last sentence is done */
  onFinish?: (results: TranslateResult[]) => void;
  size?: number;
  /** No skeleton of the English sentence at all (a test of what the learner already knows) */
  forceNoHints?: boolean;
  title?: string;
}) {
  const make = () => buildTranslateRound(patterns, size).map((it) => (forceNoHints ? { ...it, hint: "none" as const } : it));
  const [items, setItems] = useState<TranslateItem[]>(make);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TranslateResult[]>([]);
  const [streak, setStreak] = useState(0);
  const done = index >= items.length;

  const finish = (r: TranslateResult) => {
    const all = [...results, r];
    setResults(all);
    setStreak(r.ok ? streak + 1 : 0);
    if (index + 1 >= items.length) {
      applyTranslate(all);
      onFinish?.(all);
    }
    setIndex(index + 1);
  };

  const again = () => {
    setItems(make());
    setIndex(0);
    setResults([]);
    setStreak(0);
  };

  const points = results.reduce((a, r) => a + r.points, 0);
  const right = results.filter((r) => r.ok);
  const avg = right.length > 0 ? right.reduce((a, r) => a + r.ms, 0) / right.length / 1000 : null;
  const missed = results.filter((r) => !r.ok);

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PracticeTop onBack={onExit} backLabel="Thoát" close label={title} />
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <p className="text-base text-slate-700 dark:text-zinc-300">Chưa có câu nào để dịch ở cấp và mục tiêu này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PracticeTop
        onBack={onExit}
        backLabel="Thoát"
        close
        label={
          <>
            <span className="text-slate-900 dark:text-zinc-100">{title}</span> · Từ tiếng Việt sang tiếng Anh
          </>
        }
        count={!done ? `câu ${index + 1}/${items.length}` : undefined}
        percent={(Math.min(index, items.length) / items.length) * 100}
        right={<IpaToggle />}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 -mt-2">
        <span className="shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">🪙 {points}</span>
        {streak >= 2 && <span className="shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300">🔥 {streak}</span>}
      </div>

      {done ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-1 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Xong vòng này! 🎉 {points} điểm</p>
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              Đúng {right.length}/{results.length} câu
              {avg !== null ? `, trả lời trung bình ${avg.toFixed(1)} giây` : ""}. Dùng {results.reduce((a, r) => a + r.hints, 0)} lần gợi ý hoặc sửa.
            </p>
          </div>
          {missed.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 md:p-5 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Câu cần nhớ thêm:</p>
              {missed.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => handleSpeak(m.en)} aria-label="Nghe câu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 hover:bg-teal-100 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300">
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">{m.en}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{m.vi}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={again} className="min-h-14 px-5 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 font-semibold inline-flex items-center justify-center gap-2 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300">
              <RotateCcw className="w-5 h-5" /> Chơi lại
            </button>
            <button onClick={() => (onDone ? onDone() : onExit())} className="min-h-14 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-[17px] font-semibold shadow-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
              {onDone ? "Tiếp tục" : "Xong"}
            </button>
          </div>
        </div>
      ) : (
        <Question key={`${items.length}-${index}-${results.length}`} item={items[index]} onDone={finish} />
      )}
    </div>
  );
}
