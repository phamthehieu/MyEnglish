import { useState } from "react";
import { ArrowLeft, Bell, Check, ChevronDown, ChevronRight, ClipboardCheck, Loader2 } from "lucide-react";
import { isDesktopApp } from "@/lib/platform";
import type { StudyLevel } from "@/services/vocabCatalog";
import { defaultStudyLevelsFor, setStudyLevels, topUpNewWords } from "@/services/vocabFeed";
import {
  applyDailyPlan,
  applyLevelChoice,
  DAILY_PLANS,
  markOnboardingDone,
  type DailyMinutes,
  type LevelChoice,
} from "@/services/onboarding";
import { ANCHOR_TIMES, type PresetAnchor, type ReminderAnchor } from "@/services/reminderMoments";
import type { ReminderTrigger } from "@/services/reminderSettings";
import { DEFAULT_INITIAL_TENSE_IDS, saveInitialTenses } from "@/services/grammarPath";
import TenseSelectionPicker from "./grammar/TenseSelectionPicker";
import PlacementTest from "./PlacementTest";
import { LevelPicker, mixDescription } from "./dashboard/VocabTab";
import { Button, ProgressBar } from "./ui/kit";

const TRIGGER_OPTIONS: Array<{ value: ReminderTrigger; title: string; desc: string }> = [
  { value: "due_only", title: "Chỉ từ đến hạn ôn", desc: "Hết từ thì dừng nhắc" },
  { value: "due_then_random", title: "Từ đến hạn trước", desc: "Hết thì ôn thêm từ khác" },
  { value: "all_words", title: "Luôn nhắc", desc: "Hỏi ngẫu nhiên để giữ phản xạ" },
];

const LEVELS: Array<{ level: LevelChoice; label: string; hint: string }> = [
  { level: "A0", label: "Mất gốc", hint: "Quên gần hết, muốn học lại từ đầu" },
  { level: "A1", label: "Mới bắt đầu", hint: "Biết vài từ cơ bản" },
  { level: "A2", label: "Cơ bản", hint: "Hiểu câu ngắn, quen thuộc" },
  { level: "B1", label: "Trung cấp", hint: "Đọc được tài liệu đơn giản" },
  { level: "B2", label: "Khá", hint: "Đọc tài liệu tiếng Anh mà ít phải tra từ" },
  { level: "C1", label: "Thành thạo", hint: "Đọc, viết, họp khá tự nhiên" },
];

/** A large selectable card: white, or teal-tinted with a teal border when chosen */
const choiceCard = (on: boolean) =>
  `w-full rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
    on
      ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-400/10"
      : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
  }`;

/** The round tick on the right of a choice card */
function CheckDot({ on, small = false }: { on: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${small ? "h-5 w-5" : "h-6 w-6"} ${
        on ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950" : "border-2 border-slate-200 dark:border-zinc-700"
      }`}
    >
      {on && <Check className={small ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />}
    </span>
  );
}

interface OnboardingFlowProps {
  /** startNow = open the first session right after the words are added */
  onFinish: (startNow: boolean) => void;
}

/**
 * First run, in the order a teacher would ask:
 *  1. level (quick adaptive test, or pick one; "mất gốc" = A0)
 *  2. vocabulary levels: the Oxford deck from A1, mixed with the next levels up to the learner's own
 *  3. starting tenses: choose which tenses to learn first (default: Present Simple)
 *  4. minutes per day and WHEN to study
 * then the first session right away.
 */
export default function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [studyLevels, setStudyLevelsState] = useState<StudyLevel[]>(["A1"]);
  const [level, setLevel] = useState<LevelChoice | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementDone, setPlacementDone] = useState(false);
  const [selectedTenses, setSelectedTenses] = useState<string[]>([...DEFAULT_INITIAL_TENSE_IDS]);
  const [minutes, setMinutes] = useState<DailyMinutes>(10);
  const [reminders, setReminders] = useState(true);
  const [triggerCondition, setTriggerCondition] = useState<ReminderTrigger>("due_only");
  const [anchors, setAnchors] = useState<ReminderAnchor[]>(["after_lunch"]);
  const [transitions, setTransitions] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAnchor = (a: ReminderAnchor) =>
    setAnchors((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const goToLevels = () => {
    // Up to the learner's own level (A0 = A1): words they may know are skipped with "Đã biết"
    setStudyLevelsState(defaultStudyLevelsFor(level === "A0" ? "A1" : level));
    setStep(2);
  };

  const finish = async (startNow: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (level) applyLevelChoice(level);
      applyDailyPlan(minutes, reminders, { anchors, transitions }, triggerCondition);
      setStudyLevels(studyLevels);
      saveInitialTenses(selectedTenses);
      await topUpNewWords();
      markOnboardingDone();
      onFinish(startNow);
    } catch (err) {
      setError(`Không chuẩn bị được từ vựng: ${err}`);
      setBusy(false);
    }
  };

  const skipAll = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Defaults: A1 words, 10 minutes a day, Present Simple tense
      setStudyLevels(["A1"]);
      applyDailyPlan(10, reminders, { anchors, transitions });
      saveInitialTenses([...DEFAULT_INITIAL_TENSE_IDS]);
      await topUpNewWords().catch(() => {});
      markOnboardingDone();
      onFinish(false);
    } catch {
      setError("Chưa lưu được thiết lập. Bạn thử lại nhé.");
      setBusy(false);
    }
  };

  return (
    <div className="popup-backdrop-enter fixed inset-0 z-50 overflow-y-auto bg-[#F7F8FA] dark:bg-zinc-950">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4">
        {/* Top: back, "Bước n/4", skip, one progress bar */}
        <div className="sticky top-0 z-10 -mx-4 bg-[#F7F8FA]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur dark:bg-zinc-950/95">
          <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  aria-label="Quay lại"
                  onClick={() => setStep(step - 1)}
                  disabled={step === 4 && busy}
                  className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200/60 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-zinc-400">Bước {step}/4</span>
            <div className="flex justify-end">
              <button
                onClick={skipAll}
                disabled={busy}
                className="-mr-2 inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-right text-sm font-medium leading-tight text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
                Bỏ qua phần thiết lập
              </button>
            </div>
          </div>
          <ProgressBar value={step * 25} className="mt-2 h-1.5" />
        </div>

        <div className="flex-1 space-y-6 pb-6 pt-3">
          {error && step !== 4 && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tiếng Anh của bạn đang ở mức nào?</h1>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Không sao nếu bạn đã quên gần hết: app sẽ bắt đầu từ những từ và mẫu câu cơ bản nhất, đi chậm mà chắc.
                </p>
              </div>
              <div className="space-y-3">
                {LEVELS.map((l) => {
                  const on = level === l.level;
                  return (
                    <button
                      key={l.level}
                      aria-pressed={on}
                      onClick={() => {
                        setLevel(l.level);
                        setPlacementDone(false);
                      }}
                      className={`${choiceCard(on)} flex min-h-16 items-center gap-4 p-4`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                          on ? "bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950" : "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
                        }`}
                      >
                        {l.level}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-base font-semibold ${on ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-white"}`}>{l.label}</span>
                        <span className="mt-0.5 block text-sm leading-snug text-slate-600 dark:text-zinc-400">{l.hint}</span>
                      </span>
                      <CheckDot on={on} />
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPlacementOpen(true)}
                className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-teal-700/20 bg-teal-50 p-4 text-left transition-colors hover:bg-teal-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:border-teal-400/20 dark:bg-teal-400/10 dark:hover:bg-teal-400/15"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 dark:bg-zinc-900 dark:text-teal-300">
                  <ClipboardCheck className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-base font-semibold text-teal-900 dark:text-teal-100">
                    {placementDone && level ? `Kết quả kiểm tra: ${level} · làm lại` : "Kiểm tra nhanh (2–4 phút)"}
                  </span>
                  <span className="block text-sm leading-snug text-teal-800/80 dark:text-teal-200/80">
                    Từ vựng, ngữ pháp và nghe; câu hỏi tự dễ hơn hoặc khó hơn theo câu trả lời của bạn.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bạn muốn học từ vựng cấp nào?</h1>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  5.004 từ Oxford 3000 và 5000, có nghĩa tiếng Việt, câu ví dụ và phát âm. Việc học luôn bắt đầu từ A1; chọn thêm cấp cao hơn để trộn vào. Từ nào bạn đã biết thì bấm "Đã biết" là bỏ qua được.
                </p>
              </div>
              <LevelPicker value={studyLevels} onChange={setStudyLevelsState} />
              <p className="text-sm text-slate-600 dark:text-zinc-400">{mixDescription(studyLevels)}</p>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chọn thì bạn muốn bắt đầu học</h1>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Mặc định là <b>Thì hiện tại đơn</b> — khởi đầu lý tưởng cho người mất gốc để xây chắc nền tảng mà không bị ngợp. Bạn có thể tích chọn thêm nhiều thì nếu muốn, và luôn có thể đổi lại trong tab Ngữ pháp sau này.
                </p>
              </div>

              <TenseSelectionPicker value={selectedTenses} onChange={setSelectedTenses} />
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mỗi ngày bạn học bao lâu, vào lúc nào?</h1>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Ít mà đều đặn nhớ lâu hơn học dồn. Gắn việc học vào một lúc cố định trong ngày giúp tạo thói quen nhanh nhất.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([5, 10, 15] as DailyMinutes[]).map((m) => {
                  const p = DAILY_PLANS[m];
                  const on = minutes === m;
                  return (
                    <button key={m} aria-pressed={on} onClick={() => setMinutes(m)} className={`${choiceCard(on)} min-h-20 p-3.5 sm:p-4`}>
                      <span className="flex items-start justify-between gap-1">
                        <span className={`block text-lg font-bold ${on ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-white"}`}>{m} phút</span>
                        <CheckDot on={on} small />
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-slate-600 dark:text-zinc-400">{p.newCardsPerDay} từ mới/ngày</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <label className="flex min-h-12 cursor-pointer items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                    <Bell className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-base font-semibold text-slate-900 dark:text-zinc-100">Nhắc tôi học mỗi ngày</span>
                  <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} className="peer sr-only" />
                  <span
                    aria-hidden="true"
                    className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-teal-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40 dark:bg-zinc-700 dark:peer-checked:bg-teal-500"
                  />
                </label>
                {reminders && (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-2 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      aria-expanded={showMore}
                      className="-ml-2 inline-flex min-h-12 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                    >
                      {showMore ? "Ẩn bớt" : "Tùy chỉnh thêm"}
                      <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
                    </button>
                    {showMore && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">Nhắc vào lúc nào?</span>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {(Object.keys(ANCHOR_TIMES) as PresetAnchor[]).map((a) => {
                              const on = anchors.includes(a);
                              return (
                                <label
                                  key={a}
                                  className={`${choiceCard(on)} flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus-within:ring-2 focus-within:ring-teal-600/40 dark:text-zinc-200`}
                                >
                                  <input type="checkbox" checked={on} onChange={() => toggleAnchor(a)} className="sr-only" />
                                  <span className="flex-1">{ANCHOR_TIMES[a].label}</span>
                                  <CheckDot on={on} small />
                                </label>
                              );
                            })}
                            {isDesktopApp() && (
                              <label
                                className={`${choiceCard(transitions)} flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus-within:ring-2 focus-within:ring-teal-600/40 dark:text-zinc-200 sm:col-span-2`}
                              >
                                <input type="checkbox" checked={transitions} onChange={(e) => setTransitions(e.target.checked)} className="sr-only" />
                                <span className="flex-1">Lúc mở máy buổi sáng, hoặc vừa xong cuộc họp</span>
                                <CheckDot on={transitions} small />
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">Nhắc những từ nào?</span>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {TRIGGER_OPTIONS.map((o) => {
                              const on = triggerCondition === o.value;
                              return (
                                <button
                                  key={o.value}
                                  type="button"
                                  onClick={() => setTriggerCondition(o.value)}
                                  aria-pressed={on}
                                  className={`${choiceCard(on)} flex min-h-12 flex-col gap-0.5 p-3`}
                                >
                                  <span className={`text-sm font-semibold ${on ? "text-teal-800 dark:text-teal-200" : "text-slate-900 dark:text-zinc-100"}`}>{o.title}</span>
                                  <span className="text-sm leading-snug text-slate-600 dark:text-zinc-400">{o.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {isDesktopApp() && (
                          <p className="text-sm text-slate-600 dark:text-zinc-400">Một thẻ nhỏ ở góc màn hình, không chiếm bàn phím. Không nhắc ban đêm.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>

        {/* The main action, fixed at the bottom */}
        <div className="sticky bottom-0 z-10 -mx-4 space-y-1 border-t border-slate-200 bg-[#F7F8FA]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          {step === 1 && (
            <>
              <Button size="lg" block onClick={goToLevels} disabled={!level}>
                Tiếp
              </Button>
              {!level && (
                <Button variant="ghost" block onClick={goToLevels}>
                  Chưa rõ, bỏ qua
                </Button>
              )}
            </>
          )}
          {step === 2 && (
            <Button size="lg" block onClick={() => setStep(3)}>
              Tiếp
            </Button>
          )}
          {step === 3 && (
            <Button size="lg" block onClick={() => setStep(4)} disabled={selectedTenses.length === 0}>
              Tiếp
            </Button>
          )}
          {step === 4 && (
            <>
              <Button size="lg" block onClick={() => finish(true)} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Đang chuẩn bị từ vựng…" : `Học ${DAILY_PLANS[minutes].newCardsPerDay} từ đầu tiên ngay`}
              </Button>
              <Button variant="ghost" block onClick={() => finish(false)} disabled={busy}>
                Để sau
              </Button>
            </>
          )}
        </div>
      </div>

      {placementOpen && (
        <PlacementTest
          onClose={() => setPlacementOpen(false)}
          onDone={(choice) => {
            setPlacementOpen(false);
            setLevel(choice);
            setPlacementDone(true);
          }}
        />
      )}
    </div>
  );
}
