import { useState, useEffect, useRef } from "react";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { WordDetail } from "@/types/database";
import { generateSmartMnemonic, getStoredMnemonic, saveMnemonic } from "@/services/aiMnemonic";
import { generateMemoryAidWithAI, type MemoryAid } from "@/services/ai";
import { addUserContextExample } from "@/services/db";
import { getActiveCefrLevel } from "@/services/pipeline";

/** AI Mnemonic Memory Hook for Leech / Challenging Words (generated on demand for leeches / 2+ lapses) */
export default function MnemonicPanel({
  currentWord,
  wordIsLeech,
}: {
  currentWord: WordDetail;
  wordIsLeech: boolean;
}) {
  const [mnemonic, setMnemonic] = useState<string | null>(() => getStoredMnemonic(currentWord.id, currentWord.meaning_vn));
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [aid, setAid] = useState<MemoryAid | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle");
  const currentWordIdRef = useRef(currentWord.id);
  currentWordIdRef.current = currentWord.id;

  // A word forgotten again and again needs new hooks (new situations, a tip, the word it is confused
  // with), not a harder exercise. The new sentences become examples for the next reviews.
  const makeMemoryAid = async () => {
    const wordId = currentWord.id;
    const wordText = currentWord.word;
    const meaningVn = currentWord.meaning_vn;
    setAiState("loading");
    try {
      const result = await generateMemoryAidWithAI(wordText, meaningVn, await getActiveCefrLevel());
      for (const ex of result.examples) {
        await addUserContextExample(wordId, ex.sentence_en, ex.sentence_vn, "ai_memory_aid").catch(() => false);
      }
      if (result.tipVn) {
        saveMnemonic(wordId, `💡 ${result.tipVn}`, meaningVn);
        if (currentWordIdRef.current === wordId) {
          setMnemonic(`💡 ${result.tipVn}`);
        }
      }
      if (currentWordIdRef.current !== wordId) return;
      setAid(result);
      setAiState("idle");
    } catch {
      if (currentWordIdRef.current === wordId) {
        setAiState("error");
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    setAid(null);
    setAiState("idle");
    const existing = getStoredMnemonic(currentWord.id, currentWord.meaning_vn);
    if (existing) {
      setMnemonic(existing);
    } else if (wordIsLeech || (currentWord.srs?.lapses ?? 0) >= 2) {
      setLoadingMnemonic(true);
      generateSmartMnemonic(currentWord)
        .then((m) => {
          if (mounted) setMnemonic(m);
        })
        .finally(() => {
          if (mounted) setLoadingMnemonic(false);
        });
    } else {
      setMnemonic(null);
    }
    return () => {
      mounted = false;
    };
  }, [currentWord.id, wordIsLeech]);

  if (!(wordIsLeech || mnemonic || (currentWord.srs?.lapses ?? 0) >= 2)) return null;

  return (
    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 text-sm text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          {wordIsLeech ? "Mẹo ghi nhớ · từ hay quên" : "Mẹo ghi nhớ"}
        </span>
        {wordIsLeech && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 font-semibold">
            {currentWord.srs.lapses} lần quên
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed font-sans font-medium text-amber-950 dark:text-amber-100">
        {loadingMnemonic ? "Đang tạo liên tưởng ghi nhớ..." : (mnemonic || "💡 Nhấn để tạo mẹo ghi nhớ cho từ này.")}
      </p>
      {aid && (
        <div className="space-y-1 pt-1 font-sans">
          {aid.examples.map((ex) => (
            <p key={ex.sentence_en} className="text-sm">
              • <span className="font-medium">{ex.sentence_en}</span>{" "}
              <span className="text-amber-700/80 dark:text-amber-300/70">({ex.sentence_vn})</span>
            </p>
          ))}
          {aid.confusable && (
            <p className="text-sm">
              ⚠️ Hay nhầm với <b>{aid.confusable.word}</b>: {aid.confusable.differenceVn}
            </p>
          )}
          <p className="text-xs text-amber-700/80 dark:text-amber-300/70">Các câu mới đã được thêm làm ví dụ cho những lần ôn sau.</p>
        </div>
      )}
      {!aid && (wordIsLeech || (currentWord.srs?.lapses ?? 0) >= 2) && (
        <button
          onClick={makeMemoryAid}
          disabled={aiState === "loading"}
          className="inline-flex items-center gap-1.5 mt-1 min-h-10 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 text-sm font-semibold font-sans disabled:opacity-60 transition-colors"
        >
          {aiState === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {aiState === "loading" ? "Đang tạo…" : aiState === "error" ? "AI chưa trả lời được, thử lại" : "Tạo câu ví dụ & mẹo nhớ mới bằng AI"}
        </button>
      )}
    </div>
  );
}
