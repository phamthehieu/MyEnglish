import { setFoundationMode } from "@/services/learnerProfile";
import { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  Sparkles,
  Zap,
  TrendingUp,
  CheckCircle2,
  Lock,
  Brain,
  Loader2,
  Sliders,
  Clock,
  Flame,
  ChevronDown,
  X,
} from "lucide-react";
import type { WordDetail } from "@/types/database";
import type { GrammarLevel } from "@/types/grammar";
import PlacementTest from "./PlacementTest";
import {
  assessUserProficiency,
  setUserOverrideLevel,
  syncProficiencyWithReminderSettings,
  CEFR_LEVEL_METADATA,
  type UserProficiencyProfile,
} from "@/services/userProficiency";
import {
  getAutoReplenishSettings,
  saveAutoReplenishSettings,
  triggerAutoReplenish,
  type AutoReplenishSettings,
} from "@/services/autoReplenish";
import { AI_VOCAB_ENABLED } from "@/services/features";
import { CATALOG_LEVEL_COUNTS } from "@/services/vocabCatalog";
import { levelDetail, type LevelWord } from "@/services/levelDetail";
import { C1_TENSE_NOTE, LEVEL_TENSES, matchTenseLessons } from "@/services/levelTenses";
import { getAllBookChapters } from "@/services/grammarBook";
import { getDueGrammarLessons } from "@/services/grammarService";
import { lessonStatus } from "@/services/grammarSession";
import { LessonStatusChip } from "./grammar/PathPicker";
import type { GrammarBookLesson } from "@/types/grammarBook";

interface ProficiencyAssessmentCardProps {
  words: WordDetail[];
  onRefreshWords?: () => void;
  /** Open a lesson of the grammar book (the tenses of a level) */
  onOpenGrammarLesson?: (lessonId: string) => void;
}

const ALL_LEVELS: GrammarLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export default function ProficiencyAssessmentCard({
  words,
  onRefreshWords,
  onOpenGrammarLesson,
}: ProficiencyAssessmentCardProps) {
  const [assessmentTrigger, setAssessmentTrigger] = useState(0);
  const [isManualGenerating, setIsManualGenerating] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [autoReplenishSettings, setAutoReplenishSettings] = useState<AutoReplenishSettings>(getAutoReplenishSettings);
  const [showOverrideMenu, setShowOverrideMenu] = useState(false);
  const [showPlacement, setShowPlacement] = useState(false);
  // The level whose detail is open under the cards (null: none)
  const [openLevel, setOpenLevel] = useState<GrammarLevel | null>(null);

  const profile: UserProficiencyProfile = useMemo(() => {
    return assessUserProficiency(words);
  }, [words, assessmentTrigger]);

  const levelMeta = CEFR_LEVEL_METADATA[profile.effectiveLevel];

  const handleSetOverride = (lvl: GrammarLevel | null) => {
    setUserOverrideLevel(lvl);
    if (lvl) {
      syncProficiencyWithReminderSettings(lvl);
      setActionNotice({
        type: "info",
        text: `Đã thiết lập cố định trình độ của bạn là [${lvl}]. Các bài tập và câu ví dụ sẽ tự động đồng bộ.`,
      });
    } else {
      syncProficiencyWithReminderSettings(profile.assessedLevel);
      setActionNotice({
        type: "info",
        text: `Đã chuyển về chế độ tự động xếp trình độ theo số từ bạn đã thuộc (hiện tại: [${profile.assessedLevel}]).`,
      });
    }
    setShowOverrideMenu(false);
    setAssessmentTrigger((v) => v + 1);
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleToggleAutoReplenish = () => {
    const updated = saveAutoReplenishSettings({
      enabled: !autoReplenishSettings.enabled,
    });
    setAutoReplenishSettings(updated);
    setActionNotice({
      type: "info",
      text: updated.enabled
        ? "Đã bật chế độ tự động bổ sung từ vựng & bài tập khi cạn từ mới."
        : "Đã tắt chế độ tự động bổ sung từ vựng.",
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleTriggerManualReplenish = async () => {
    if (isManualGenerating) return;
    setIsManualGenerating(true);
    setActionNotice({
      type: "info",
      text: `🤖 Gemini đang chọn lọc 3 từ vựng & bài tập ngữ pháp chuẩn cấp độ ${profile.effectiveLevel}...`,
    });

    try {
      const res = await triggerAutoReplenish(words, true);
      if (res.success) {
        setActionNotice({
          type: "success",
          text: res.message,
        });
        setAutoReplenishSettings(getAutoReplenishSettings());
        setAssessmentTrigger((v) => v + 1);
        onRefreshWords?.();
      } else {
        setActionNotice({
          type: "error",
          text: res.message,
        });
      }
    } catch (err) {
      setActionNotice({
        type: "error",
        text: "Không thể kết nối với Gemini CLI. Vui lòng kiểm tra CLI binary.",
      });
    } finally {
      setIsManualGenerating(false);
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 md:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] space-y-6 relative">
      {/* TOP HEADER: Assessed Level & Overall Score */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-5">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl bg-teal-700 dark:bg-teal-600 flex-shrink-0 tracking-wider"
          >
            {profile.effectiveLevel}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-zinc-100">
                {levelMeta.label}
              </h3>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
              >
                {levelMeta.titleVn}
              </span>
              {profile.userOverrideLevel && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Cố định thủ công
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Cấp độ tính theo số từ bạn đã thuộc ở từng cấp. Ngữ pháp và thói quen học hiển thị riêng bên dưới.
            </p>
          </div>
        </div>

        {/* Right Controls: CEFR Score & Override Action */}
        <div className="flex items-center gap-3 flex-wrap lg:justify-end">
          <div className="lg:text-right">
            <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-zinc-100">
              {profile.overallScore} <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">/ 100 Điểm</span>
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              {profile.nextLevel ? (
                <span>
                  Tiến độ lên <strong className="text-teal-700 dark:text-teal-300">{profile.nextLevel}</strong>: {profile.progressToNextLevel}%
                </span>
              ) : (
                <span className="text-green-700 dark:text-green-400 font-bold">Cấp độ cao nhất đạt được!</span>
              )}
            </div>
          </div>

          {showPlacement && (
            <PlacementTest
              onClose={() => setShowPlacement(false)}
              onDone={(choice) => {
                setShowPlacement(false);
                // A0 (mất gốc) is studied as A1 with foundation mode on
                setFoundationMode(choice === "A0");
                handleSetOverride(choice === "A0" ? "A1" : choice);
              }}
            />
          )}
          <button
            onClick={() => setShowPlacement(true)}
            title="Từ vựng, ngữ pháp và nghe; khoảng 6–12 câu, 2–4 phút"
            className="inline-flex min-h-11 items-center gap-1.5 px-4 text-sm font-semibold rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-colors"
          >
            Kiểm tra trình độ
          </button>
          <div className="relative">
            <button
              onClick={() => setShowOverrideMenu(!showOverrideMenu)}
              className="inline-flex min-h-11 items-center gap-1.5 px-4 text-sm font-semibold rounded-2xl border border-teal-700/30 bg-white hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:hover:bg-teal-400/10 text-teal-800 dark:text-teal-300 transition-colors"
            >
              <Sliders className="w-4 h-4" />
              <span>{profile.userOverrideLevel ? `Đổi Level (${profile.userOverrideLevel})` : "Tùy chọn Level"}</span>
            </button>

            {showOverrideMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg p-2 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  Chế độ xếp trình độ
                </div>
                <button
                  onClick={() => handleSetOverride(null)}
                  className={`w-full text-left px-3 min-h-11 text-sm font-medium rounded-xl flex items-center justify-between transition-colors ${
                    !profile.userOverrideLevel
                      ? "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300 font-semibold"
                      : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Tự động (theo tiến độ)
                  </span>
                  {!profile.userOverrideLevel && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
                <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />
                {ALL_LEVELS.map((lvl) => {
                  const isCurrent = profile.userOverrideLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() => handleSetOverride(lvl)}
                      className={`w-full text-left px-3 min-h-11 text-sm font-medium rounded-xl flex items-center justify-between transition-colors ${
                        isCurrent
                          ? "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300 font-semibold"
                          : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span>{CEFR_LEVEL_METADATA[lvl].label}</span>
                      {isCurrent && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THREE PILLAR METRICS BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Pillar 1: Grammar Mastery */}
        <div className="min-w-0 p-3 md:p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-teal-700 dark:text-teal-300" /> Ngữ Pháp Tích Lũy
            </span>
            <span className="text-slate-900 dark:text-zinc-100 font-bold tabular-nums">{profile.grammarScore}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-700 dark:bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${profile.grammarScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Tỉ lệ bài ngữ pháp trong lộ trình của bạn đã nắm vững. Không tính vào cấp độ CEFR.
          </p>
        </div>

        {/* Pillar 2: Vocabulary & FSRS Retention */}
        <div className="min-w-0 p-3 md:p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-teal-700 dark:text-teal-300" /> Vốn từ & độ nhớ lâu
            </span>
            <span className="text-slate-900 dark:text-zinc-100 font-bold tabular-nums">{profile.vocabularyScore}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-700 dark:bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${profile.vocabularyScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Đã thuộc {profile.levelVocab[profile.effectiveLevel].known}/{profile.levelVocab[profile.effectiveLevel].target} từ cấp độ{" "}
            {profile.effectiveLevel} • {profile.vocabularyStats.masteredWords}/{profile.vocabularyStats.totalWords} từ bền vững (Độ nhớ TB:{" "}
            {profile.vocabularyStats.avgRetrievability}%).
          </p>
        </div>

        {/* Pillar 3: Learning Consistency */}
        <div className="min-w-0 p-3 md:p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" /> Tính Kỷ Luật & Phản Xạ
            </span>
            <span className="text-slate-900 dark:text-zinc-100 font-bold tabular-nums">{profile.habitScore}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-slate-500 dark:bg-zinc-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${profile.habitScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Chuỗi {profile.learningStats.streak} ngày liên tiếp • Cấp độ XP {profile.learningStats.xpLevel} ({profile.learningStats.rank}).
            Không tính vào cấp độ CEFR.
          </p>
        </div>
      </div>

      {/* CEFR PROGRESSION BARS (A1 -> C1) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-700 dark:text-teal-300" />
            <span>Tiến Trình Cụ Thể Từng Cấp Bậc CEFR</span>
          </h4>
          <span className="text-xs text-slate-600 dark:text-zinc-400">Bấm vào một cấp để xem chi tiết · Hoàn thành = thuộc 80% số từ của cấp</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ALL_LEVELS.map((lvl) => {
            const data = profile.levelBreakdown[lvl];
            const isMastered = data.status === "mastered";
            const isLearning = data.status === "learning";
            const isCurrent = profile.effectiveLevel === lvl;

            const isOpen = openLevel === lvl;

            return (
              <button
                type="button"
                key={lvl}
                onClick={() => setOpenLevel(isOpen ? null : lvl)}
                aria-expanded={isOpen}
                aria-controls="cefr-level-detail"
                title={isOpen ? "Bấm để đóng chi tiết" : `Xem chi tiết cấp ${lvl}`}
                className={`min-w-0 text-left p-3.5 rounded-2xl border transition-colors ${
                  isOpen ? "ring-2 ring-teal-600/60 " : ""
                }${
                  isCurrent
                    ? "border-teal-600 bg-teal-50/60 dark:border-teal-500 dark:bg-teal-400/10"
                    : isMastered
                    ? "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    : "border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1">
                    {lvl}
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                    )}
                  </span>
                  {isMastered ? (
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Đã qua
                    </span>
                  ) : isLearning ? (
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">Đang rèn</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-0.5">
                      <Lock className="w-3 h-3" /> Khóa
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-1 mb-1">
                  {data.description}
                </div>
                <div
                  className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 min-h-[26px] mb-2"
                  title={LEVEL_TENSES[lvl].map((x) => x.name).join(", ") || C1_TENSE_NOTE}
                >
                  <span className="font-semibold text-slate-600 dark:text-zinc-300">Thì: </span>
                  {LEVEL_TENSES[lvl].length > 0 ? LEVEL_TENSES[lvl].map((x) => x.name).join(", ") : "dùng linh hoạt cả 13 thì"}
                </div>

                <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${
                      isMastered ? "bg-green-600" : isLearning ? "bg-teal-700 dark:bg-teal-500" : "bg-slate-400"
                    }`}
                    style={{ width: `${isMastered ? 100 : data.vocabPercent}%` }}
                  />
                </div>

                <div
                  className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400"
                  title="Số từ của cấp độ này bạn đã thuộc / số từ cần để hoàn thành cấp độ"
                >
                  <span>
                    Từ vựng: {profile.levelVocab[lvl].known}/{profile.levelVocab[lvl].target}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    {data.vocabPercent}%
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180 text-teal-700 dark:text-teal-300" : ""}`} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {openLevel && (
          <LevelDetailPanel
            words={words}
            level={openLevel}
            description={profile.levelBreakdown[openLevel].description}
            countedKnown={profile.levelVocab[openLevel].known}
            target={profile.levelVocab[openLevel].target}
            isCurrent={profile.effectiveLevel === openLevel}
            onClose={() => setOpenLevel(null)}
            onOpenGrammarLesson={onOpenGrammarLesson}
          />
        )}
      </div>

      {/* ACTION NOTICE TOAST */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 ${
            actionNotice.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-200"
              : actionNotice.type === "error"
              ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"
              : "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-200"
          }`}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{actionNotice.text}</span>
        </div>
      )}

      {/* SMART AUTO-REPLENISH ENGINE SECTION (AI vocabulary; off while the Oxford deck is the only source) */}
      {AI_VOCAB_ENABLED && <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 md:p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Chế Độ Tự Động Bổ Sung Từ Vựng & Bài Tập (Smart Auto-Replenish)
                </h4>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">
                  AI Adaptive
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                Khi bạn luyện tập đều đặn mà không tự thêm từ mới trong 2 ngày, hệ thống sẽ tự động phân tích và sinh 3 từ vựng & bài tập ngữ pháp chuẩn cấp độ <strong>{profile.effectiveLevel}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Toggle Switch */}
            <button
              onClick={handleToggleAutoReplenish}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                autoReplenishSettings.enabled ? "bg-teal-700 dark:bg-teal-600" : "bg-slate-300 dark:bg-zinc-700"
              }`}
              title="Bật/Tắt tự động sinh bài học mới"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                  autoReplenishSettings.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>

            {/* Manual Trigger Button */}
            <button
              onClick={handleTriggerManualReplenish}
              disabled={isManualGenerating}
              className="inline-flex min-h-11 items-center gap-1.5 px-4 rounded-2xl text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isManualGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang sinh...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Bổ sung ngay (Cấp độ {profile.effectiveLevel})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status / History banner */}
        {autoReplenishSettings.lastReplenishSummary && (
          <div className="text-xs text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
              Lần bổ sung gần nhất: <strong>{autoReplenishSettings.lastReplenishSummary.date}</strong> (Cấp độ {autoReplenishSettings.lastReplenishSummary.level})
            </span>
            <span className="text-teal-700 dark:text-teal-300 font-semibold">
              + {autoReplenishSettings.lastReplenishSummary.words.join(", ")}
              {autoReplenishSettings.lastReplenishSummary.questionCount
                ? ` & ${autoReplenishSettings.lastReplenishSummary.questionCount} bài tập`
                : ""}
            </span>
          </div>
        )}
      </div>}

      {/* RECOMMENDATIONS & AI ADVICE */}
      {profile.recommendations.length > 0 && (
        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 md:p-4 space-y-2">
          <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-300" />
            <span>Gợi ý học tiếp ở cấp độ {profile.effectiveLevel}</span>
          </div>
          <ul className="space-y-1.5">
            {profile.recommendations.map((rec, i) => (
              <li
                key={i}
                className="text-sm text-slate-700 dark:text-zinc-300 flex items-start gap-2"
              >
                <span className="text-teal-700 dark:text-teal-300 font-bold leading-relaxed">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Everything about one level under the cards: where its words stand, what is missing, which words to watch */
function LevelDetailPanel({
  words,
  level,
  description,
  countedKnown,
  target,
  isCurrent,
  onClose,
  onOpenGrammarLesson,
}: {
  words: WordDetail[];
  level: GrammarLevel;
  description: string;
  /** Known words the level card counts (tagged ones, plus untagged ones filling the gap) */
  countedKnown: number;
  target: number;
  isCurrent: boolean;
  onClose: () => void;
  onOpenGrammarLesson?: (lessonId: string) => void;
}) {
  const d = useMemo(() => levelDetail(words, level), [words, level]);
  const deck = CATALOG_LEVEL_COUNTS[level];
  const filled = Math.max(0, countedKnown - d.known);
  const missing = Math.max(0, target - countedKnown);
  const pct = (n: number) => `${deck > 0 ? Math.min(100, (n * 100) / deck) : 0}%`;
  const notMet = Math.max(0, deck - d.met);

  const stats: Array<{ label: string; value: number; hint: string; tone: string }> = [
    { label: "Đã thuộc", value: countedKnown, hint: "Nhận ra nghĩa và nhớ chắc ít nhất 7 ngày", tone: "text-teal-700 dark:text-teal-300" },
    { label: "Nhớ lâu", value: d.longTerm, hint: "Nhớ chắc ít nhất 21 ngày", tone: "text-teal-700 dark:text-teal-300" },
    { label: "Đang học", value: d.learning, hint: "Đã gặp nhưng chưa nhớ chắc 7 ngày", tone: "text-slate-900 dark:text-zinc-100" },
    { label: "Đến hạn ôn", value: d.due, hint: "Phiên ôn tập sẽ hỏi lại ngay", tone: "text-amber-700 dark:text-amber-400" },
    { label: "Đánh dấu đã biết", value: d.markedKnown, hint: "Chờ một lần kiểm tra lại, chưa tính là thuộc", tone: "text-slate-700 dark:text-zinc-200" },
    { label: "Chưa gặp", value: notMet, hint: `Từ ${level} trong bộ Oxford chưa học tới`, tone: "text-slate-600 dark:text-zinc-400" },
  ];

  return (
    <div
      id="cefr-level-detail"
      className="rounded-2xl md:border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-3 md:p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h5 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {CEFR_LEVEL_METADATA[level].label} · {CEFR_LEVEL_METADATA[level].titleVn}
            {isCurrent && <span className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-300">Cấp hiện tại</span>}
          </h5>
          <p className="text-sm text-slate-600 dark:text-zinc-400">{description}</p>
        </div>
        <button onClick={onClose} aria-label="Đóng chi tiết" className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* The level's deck words: known, still learning, not met; the line marks the 80% to complete it */}
      <div className="space-y-1.5">
        <div className="relative h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden flex">
          <div className="h-full bg-teal-700 dark:bg-teal-500" style={{ width: pct(countedKnown) }} />
          <div className="h-full bg-teal-300 dark:bg-teal-800" style={{ width: pct(d.learning) }} />
          <div className="absolute inset-y-0 w-0.5 bg-slate-900/70 dark:bg-white/80" style={{ left: pct(target) }} title={`Mốc hoàn thành: ${target} từ`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <span className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-700 dark:bg-teal-500" /> Đã thuộc</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-300 dark:bg-teal-800" /> Đang học</span>
            <span className="inline-flex items-center gap-1"><span className="w-0.5 h-3 bg-slate-900/70 dark:bg-white/80" /> Mốc hoàn thành ({target} từ)</span>
          </span>
          <span className="tabular-nums">{deck.toLocaleString("vi-VN")} từ {level} trong bộ Oxford</span>
        </div>
        <p className={`text-sm font-semibold ${missing === 0 ? "text-green-700 dark:text-green-400" : "text-slate-800 dark:text-zinc-200"}`}>
          {missing === 0
            ? `Đã hoàn thành cấp ${level} ✓`
            : `Cần thuộc thêm ${missing.toLocaleString("vi-VN")} từ để hoàn thành ${level} (${countedKnown}/${target}).`}
        </p>
        {filled > 0 && (
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Gồm {filled} từ chưa có cấp CEFR (thêm từ trước khi gắn cấp) được tính bù vào cấp thấp nhất còn thiếu.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {stats.map((s) => (
          <div key={s.label} title={s.hint} className="min-w-0 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3 py-2">
            <p className={`text-lg font-bold tabular-nums ${s.tone}`}>{s.value.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-slate-600 dark:text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <LevelTensesBlock level={level} onOpenLesson={onOpenGrammarLesson} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WordChips
          title="Sắp thuộc"
          hint="Đang học, gần mốc 7 ngày nhất: ôn đều là sắp tính vào cấp"
          words={d.almostKnown}
          empty={d.met === 0 ? `Chưa học từ ${level} nào.` : "Không còn từ nào đang học ở cấp này."}
          badge={(w) => `${w.stability}d`}
          tone="cyan"
        />
        <WordChips
          title="Hay quên"
          hint="Quên từ 2 lần trở lên: xem thêm ở mục Từ hay quên"
          words={d.oftenForgotten}
          empty="Chưa có từ nào hay quên ở cấp này."
          badge={(w) => `quên ${w.lapses}×`}
          tone="rose"
        />
      </div>
    </div>
  );
}

function WordChips({
  title,
  hint,
  words,
  empty,
  badge,
  tone,
}: {
  title: string;
  hint: string;
  words: LevelWord[];
  empty: string;
  badge: (w: LevelWord) => string;
  tone: "cyan" | "rose";
}) {
  const badgeCls =
    tone === "cyan" ? "text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10" : "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10";
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{title}</p>
        <p className="text-xs text-slate-600 dark:text-zinc-400">{hint}</p>
      </div>
      {words.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-zinc-400">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span
              key={w.id}
              title={w.meaning}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-200"
            >
              {w.word}
              <span className={`text-xs tabular-nums px-1.5 rounded-full ${badgeCls}`}>{badge(w)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The tenses a level brings in, each with its form, use, an example, and its lesson in the learner's book */
function LevelTensesBlock({ level, onOpenLesson }: { level: GrammarLevel; onOpenLesson?: (lessonId: string) => void }) {
  const [lessons, setLessons] = useState<GrammarBookLesson[] | null>(null);
  useEffect(() => {
    let stale = false;
    getAllBookChapters()
      .then((chs) => !stale && setLessons(chs.flatMap((c) => c.lessons ?? [])))
      .catch(() => !stale && setLessons([]));
    return () => {
      stale = true;
    };
  }, []);
  const tenses = LEVEL_TENSES[level];
  const matched = useMemo(() => matchTenseLessons(tenses, lessons ?? []), [tenses, lessons]);
  const due = useMemo(() => new Set(getDueGrammarLessons()), [lessons]);
  const below = ALL_LEVELS.slice(0, ALL_LEVELS.indexOf(level)).flatMap((l) => LEVEL_TENSES[l]);

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 space-y-2.5">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          {tenses.length > 0 ? `Các thì cần học ở ${level} (${tenses.length})` : `Ngữ pháp thì ở ${level}`}
        </p>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          {tenses.length > 0
            ? below.length > 0
              ? `Thêm vào ${below.length} thì của các cấp dưới, cần nắm trước: ${below.map((x) => x.name).join(", ")}.`
              : "Hai thì nền tảng, dùng nhiều nhất khi nói và viết hằng ngày."
            : C1_TENSE_NOTE}
        </p>
      </div>
      {tenses.length > 0 && (
        <ul className="space-y-1.5">
          {tenses.map((x) => {
            const lesson = matched.get(x);
            return (
              <li
                key={x.name}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {x.name}
                    <span className="ml-2 text-xs font-mono font-normal text-teal-700 dark:text-teal-300">{x.form}</span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    {x.use} · <span className="italic text-slate-600 dark:text-zinc-400">{x.example}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lessons === null ? null : lesson ? (
                    <>
                      <LessonStatusChip status={lessonStatus(lesson.id, new Date(), due)} />
                      {onOpenLesson && (
                        <button
                          type="button"
                          onClick={() => onOpenLesson(lesson.id)}
                          className="min-h-10 px-2 text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                        >
                          Mở bài →
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-600 dark:text-zinc-400" title="Sách ngữ pháp bạn nhập chưa có bài cho thì này">
                      Chưa có trong sách
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
