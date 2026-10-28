import { useEffect, useState } from "react";
import { BookmarkCheck, BookmarkPlus, ChevronsDown, ChevronsUp, Loader2, Play, Volume2 } from "lucide-react";
import { baseCandidates } from "@/services/reading";
import { ensureCatalogSeeded, findCatalogWord, type CatalogEntry } from "@/services/vocabCatalog";
import { pullMessage, pullWordFromDeck } from "@/services/vocabFeed";
import { handleSpeak } from "../review/speech";

/** The word without the punctuation the captions carry: "collapses," -> collapses */
export function cleanWord(raw: string): string {
  return raw.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, "");
}

/** A dot for how hard the word is: green A1-A2, amber B1-B2, rose above */
const LEVEL_DOT: Record<string, string> = {
  A1: "bg-emerald-400",
  A2: "bg-emerald-400",
  B1: "bg-amber-400",
  B2: "bg-amber-400",
  C1: "bg-rose-400",
  C2: "bg-rose-400",
};

/**
 * What opens when a word of a caption is tapped: its meaning from the bundled Oxford 5000 deck (works offline), the
 * sentence it was met in (a button reads the whole sentence aloud, the speaker at the top reads the word), and a button
 * to keep the word.
 */
export default function WordSheet({
  raw,
  sentence,
  fontFamily,
  onSaved,
  onClose,
}: {
  raw: string;
  sentence: string;
  fontFamily: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const word = cleanWord(raw);
  // undefined: looking it up; null: the deck does not have it
  const [entry, setEntry] = useState<CatalogEntry | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let dead = false;
    setEntry(undefined);
    setNote(null);
    setMore(false);
    (async () => {
      try {
        await ensureCatalogSeeded();
        const found = await findCatalogWord(word, baseCandidates(word));
        if (!dead) setEntry(found[0] ?? null);
      } catch {
        if (!dead) setEntry(null);
      }
    })();
    return () => {
      dead = true;
    };
  }, [word]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const r = await pullWordFromDeck(entry?.word ?? word, sentence);
      setNote({ ok: r.status !== "not_in_deck", text: pullMessage(r) });
      if (r.status !== "not_in_deck") onSaved();
    } catch {
      setNote({ ok: false, text: "Không lưu được từ này. Thử lại nhé." });
    } finally {
      setSaving(false);
    }
  };

  const shown = word.toLowerCase();
  const ipa = entry?.ipaUs[0] || entry?.ipaUk[0];
  const level = entry?.cefr;
  const examples = entry?.examples ?? [];
  const otherSenses = (entry?.senses ?? []).slice(1);
  const forms = [...(entry?.irregular ?? []), ...(entry?.variants ?? [])];
  const hasMore = otherSenses.length > 0 || examples.length > 1 || forms.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`Từ ${shown}`}>
      <button className="popup-backdrop-enter absolute inset-0 bg-black/40" onClick={onClose} aria-label="Đóng" />
      <div className="sheet-enter relative mx-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <button onClick={onClose} className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-slate-300 dark:bg-zinc-600" aria-label="Đóng" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-4xl font-bold leading-tight text-slate-900 dark:text-white break-words" style={{ fontFamily }}>
              {shown}
            </h3>
            {entry && entry.word.toLowerCase() !== shown && <p className="text-sm text-slate-600 dark:text-zinc-400">dạng của "{entry.word}"</p>}
          </div>
          <button
            onClick={() => handleSpeak(shown)}
            className="h-12 w-12 shrink-0 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 inline-flex items-center justify-center"
            aria-label="Nghe phát âm"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {entry === undefined && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tra từ…
          </p>
        )}

        {entry && (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-base text-slate-600 dark:text-zinc-300">
              {ipa && <span>{ipa}</span>}
              {entry.pos && <span className="italic text-slate-600 dark:text-zinc-400">· {entry.pos.split(",")[0]}</span>}
              {level && (
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[level] ?? "bg-slate-400"}`} aria-hidden="true" />
                  {level}
                </span>
              )}
            </p>
            <p className="mt-4 text-3xl font-bold leading-snug text-slate-900 dark:text-white" style={{ fontFamily }}>
              {entry.vn}
            </p>
          </>
        )}

        {entry === null && (
          <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">Từ này chưa có trong bộ 5.000 từ Oxford của app nên chưa có nghĩa để hiện.</p>
        )}

        {/* The sentence the word was met in, with the word lit, and a button that reads it aloud */}
        <div className="mt-5 flex items-center gap-3 border-l-2 border-slate-300 dark:border-zinc-600 pl-4">
          <p className="min-w-0 flex-1 text-[17px] leading-relaxed text-slate-800 dark:text-zinc-100" style={{ fontFamily }}>
            {sentence.split(" ").map((w, i) => (
              <span key={i} className={cleanWord(w).toLowerCase() === shown ? "font-semibold text-orange-600 dark:text-orange-300" : undefined}>
                {w}{" "}
              </span>
            ))}
          </p>
          <button
            onClick={() => handleSpeak(sentence)}
            className="h-11 w-11 shrink-0 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 inline-flex items-center justify-center"
            aria-label="Đọc cả câu này"
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
        </div>

        {examples[0] && (
          <div className="mt-5 space-y-0.5" style={{ fontFamily }}>
            <p className="text-lg text-slate-800 dark:text-zinc-100">{examples[0].en}</p>
            <p className="text-lg text-slate-600 dark:text-zinc-400">{examples[0].vi}</p>
          </div>
        )}

        {more && hasMore && (
          <div className="mt-5 space-y-4 text-slate-700 dark:text-zinc-300">
            {otherSenses.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">Nghĩa khác</p>
                <ul className="mt-1.5 space-y-1">
                  {otherSenses.map((s, i) => (
                    <li key={i} className="text-base">
                      <span className="italic text-slate-600 dark:text-zinc-400">{s.pos}</span> · {s.vn}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {forms.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">Dạng khác</p>
                <p className="mt-1.5 text-base">{forms.join(" · ")}</p>
              </div>
            )}
            {examples.slice(1, 3).map((ex, i) => (
              <div key={i} className="space-y-0.5" style={{ fontFamily }}>
                <p className="text-base text-slate-800 dark:text-zinc-100">{ex.en}</p>
                <p className="text-base text-slate-600 dark:text-zinc-400">{ex.vi}</p>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setMore((v) => !v)}
            className="mt-4 flex w-full items-center justify-center gap-2 border-t border-slate-200 dark:border-zinc-800 pt-4 text-base font-semibold text-violet-600 dark:text-violet-300"
            aria-expanded={more}
          >
            {more ? <ChevronsDown className="w-4 h-4" /> : <ChevronsUp className="w-4 h-4" />}
            {more ? "Ít hơn" : "Thêm"}
          </button>
        )}

        <button
          onClick={save}
          disabled={saving || entry === undefined || entry === null || note?.ok === true}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500/15 py-4 text-lg font-bold text-violet-700 dark:text-violet-300 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : note?.ok ? <BookmarkCheck className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
          {note?.ok ? "Đã lưu" : "Lưu từ"}
        </button>
        {note && <p className={`mt-2 text-center text-sm ${note.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{note.text}</p>}
      </div>
    </div>
  );
}
