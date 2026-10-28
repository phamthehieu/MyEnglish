import { ArrowLeft, Dumbbell, Lightbulb, Volume2 } from "lucide-react";
import type { PronunciationLesson } from "@/types/pronunciation";
import { phonemeVideo } from "@/data/phonemeVideos";
import { handleSpeak } from "../review/speech";

/** What opens when a sound is tapped on the chart: the video of how to make it, with its sound; practice starts only on the button */
export default function SoundIntro({
  lesson,
  onPractice,
  onFree,
  onBack,
}: {
  lesson: PronunciationLesson;
  onPractice: () => void;
  onFree: () => void;
  onBack: () => void;
}) {
  const sym = lesson.title.match(/\/(.+?)\//)?.[1] ?? "";
  const video = phonemeVideo(sym);

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="min-h-[40px] pr-3 text-sm text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Bảng âm
        </button>
        <button onClick={onFree} className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-zinc-200">
          Học tự do
        </button>
      </div>

      <div className="text-center space-y-1">
        <div className="text-6xl font-bold text-slate-900 dark:text-white">/{sym}/</div>
        <p className="text-sm text-slate-600 dark:text-zinc-400">{lesson.title.replace(/^Âm\s*\/.+?\/\s*/, "")}</p>
      </div>

      {video && <video key={video} src={video} className="w-full rounded-2xl bg-black" autoPlay loop playsInline controls />}

      {lesson.tips[0] && (
        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 px-3 py-2.5 flex gap-2 text-sm text-slate-700 dark:text-zinc-300">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
          <p>{lesson.tips[0]}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {lesson.examples.slice(0, 6).map((ex) => (
          <button
            key={ex.text}
            onClick={() => handleSpeak(ex.text)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left hover:border-violet-400"
          >
            <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <Volume2 className="w-3.5 h-3.5 text-violet-500" /> {ex.text}
            </span>
            <span className="font-mono text-xs text-slate-600 dark:text-zinc-400">{ex.ipa}</span>
          </button>
        ))}
      </div>

      <button onClick={onPractice} className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold inline-flex items-center justify-center gap-2">
        <Dumbbell className="w-5 h-5" /> Tập luyện
      </button>
    </div>
  );
}
