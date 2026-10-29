import { Dumbbell, Lightbulb, Volume2 } from "lucide-react";
import type { PronunciationLesson } from "@/types/pronunciation";
import { phonemeVideo } from "@/data/phonemeVideos";
import { handleSpeak } from "../review/speech";
import { PracticeTop } from "../talk/MicButton";
import { Button, Card } from "../ui/kit";

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
    <div className="max-w-md mx-auto space-y-4">
      <PracticeTop
        onBack={onBack}
        backLabel="Bảng âm"
        label="Bảng âm"
        right={
          <button
            onClick={onFree}
            className="shrink-0 min-h-10 px-3 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Học tự do
          </button>
        }
      />

      <Card className="space-y-4">
        <div className="text-center space-y-1">
          <div className="text-6xl font-bold text-slate-900 dark:text-zinc-100">/{sym}/</div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{lesson.title.replace(/^Âm\s*\/.+?\/\s*/, "")}</p>
        </div>

        {video && <video key={video} src={video} className="w-full rounded-xl bg-black" autoPlay loop playsInline controls />}

        {lesson.tips[0] && (
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-3 py-2.5 flex gap-2 text-sm text-slate-700 dark:text-zinc-300">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-300" />
            <p>{lesson.tips[0]}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {lesson.examples.slice(0, 6).map((ex) => (
            <button
              key={ex.text}
              onClick={() => handleSpeak(ex.text)}
              className="min-h-12 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left hover:border-teal-600/50"
            >
              <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
                <Volume2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> {ex.text}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">{ex.ipa}</span>
            </button>
          ))}
        </div>
      </Card>

      <Button size="lg" block onClick={onPractice}>
        <Dumbbell className="w-5 h-5" /> Tập luyện
      </Button>
    </div>
  );
}
