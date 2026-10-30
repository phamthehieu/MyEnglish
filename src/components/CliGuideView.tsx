import DisplaySettings from "./dashboard/DisplaySettings";
import type { DashboardTab } from "./dashboard/shared";
import SettingsSection, { OPEN_SETTINGS_SECTION_EVENT, SETTINGS_GROUP } from "./dashboard/SettingsSection";
import { FOCUS_DURATIONS, getFocusSettings, saveFocusSettings } from "@/services/focusSettings";
import AdvancedLearningSettings, { BackupRestoreSettings } from "./dashboard/AdvancedLearningSettings";
import ResetAppDataModal from "./dashboard/ResetAppDataModal";
import FeedbackForm from "./dashboard/FeedbackForm";
import { isPretestEnabled, setPretestEnabled } from "@/services/pretest";
import { getQuietHours } from "@/services/reminderMoments";
import StudyTimesField from "./dashboard/StudyTimesField";
import WebReminders from "./dashboard/WebReminders";
import { getActivityLogs, getDailyGoal, getLocalDateString, setDailyGoal } from "@/services/streak";
import { isMainSessionActive } from "@/services/activeSession";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Bell,
  BellRing,
  ExternalLink,
  ShieldCheck,
  Zap,
  Key,
  Flame,
  Clock,
  Sliders,
  Maximize2,
  VolumeX,
  Hourglass,
  Sparkles,
  Power,
  RotateCcw,
  AlertTriangle,
  GraduationCap,
  Palette,
  Bot,
  Brain,
  Database,
  Target,
  Timer,
  MessageSquareHeart,
} from "lucide-react";
import {
  getSavedAutostartPreference,
  setAutostartEnabled,
  checkSystemAutostartStatus,
} from "@/services/autostartService";
import {
  sendTestNotification,
  markWordDueImmediately,
  srsWorker,
  getFSRSSettings,
  saveFSRSSettings,
  getStudyLimits,
  saveStudyLimits,
} from "@/services/srs";
import {
  getReminderSettings,
  saveReminderSettings,
  triggerReviewPopup,
  cancelSnooze,
  getSnoozeRemainingMinutes,
  getLastPopupDisplayTime,
  getNextReminderTime,
  getNudgesShownToday,
  isSnoozed,
  reminderPause,
  NIGHT_QUIET_START,
  NIGHT_QUIET_END,
  type ReminderSettings,
  type ReminderInterval,
  type SnoozeDuration,
  type BlurOverlayLevel,
} from "@/services/reminderSettings";
import { PAGE_CONTAINER } from "./dashboard/shared";
import { isPhoneApp, isWeb } from "@/lib/platform";
import { SHOW_DEV_TOOLS } from "@/lib/devTools";
import {
  nextPlannedReminder,
  reminderGapMinutes,
  canDrawOverlays,
  requestOverlayPermission,
  testMobileFloatingNudge,
  testMobileFloatingNudgeIn,
  scheduleForBackground,
} from "@/services/mobileReminders";
import { triggerReviewNudge } from "@/services/reminderSettings";

// The phone app (Android reminders, floating card) as opposed to the desktop app; the web app has neither
const IS_MOBILE = isPhoneApp();
const IS_WEB = isWeb();

/** What a section of these settings becomes in the web app, which does not have it yet */
function NotOnWeb({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 md:shadow-sm`}>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{children}</p>
    </div>
  );
}
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Today's activity has reached the daily goal (the same test the reminder worker makes, minus the due-review check) */
function isDailyGoalMet(): boolean {
  return (getActivityLogs()[getLocalDateString()] || 0) >= getDailyGoal();
}

interface CliStatus {
  installed: boolean;
  path: string;
  details?: string;
  error?: string;
}

interface ApiKeyStatus {
  configured: boolean;
  hint?: string | null;
  model?: string;
  defaultModel?: string;
  modelFromEnv?: boolean;
}

interface CliGuideViewProps {
  onRefreshWords?: () => void;
  onNavigateTab?: (tab: DashboardTab) => void;
}

export default function CliGuideView({ onRefreshWords, onNavigateTab }: CliGuideViewProps) {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null);
  const [checkingCli, setCheckingCli] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [apiModelInput, setApiModelInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | number | null>(null);

  // Notification & Pop-up state
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [fsrsSettings, setFsrsSettings] = useState(() => getFSRSSettings());
  const [studyLimits, setStudyLimits] = useState(() => getStudyLimits());
  const [pretestOn, setPretestOn] = useState(isPretestEnabled);
  const [dailyGoal, setDailyGoalState] = useState(getDailyGoal);
  const [focusMinutes, setFocusMinutes] = useState(() => getFocusSettings().minutes);
  const [testingNotif, setTestingNotif] = useState(false);
  const [testingDueWord, setTestingDueWord] = useState(false);
  const [testingPopup, setTestingPopup] = useState(false);

  // Autostart state
  const [autostart, setAutostart] = useState<boolean>(() => getSavedAutostartPreference());
  const [togglingAutostart, setTogglingAutostart] = useState(false);

  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(getReminderSettings());
  const [snoozeMinutesRemaining, setSnoozeMinutesRemaining] = useState<number>(getSnoozeRemainingMinutes());
  const [lastDisplayMs, setLastDisplayMs] = useState<number>(getLastPopupDisplayTime());
  const [nextReminderMs, setNextReminderMs] = useState<number>(getNextReminderTime());
  const [goalMet, setGoalMet] = useState<boolean>(isDailyGoalMet);
  const [showResetModal, setShowResetModal] = useState(false);

  // Phones: the next notification Android was given (re-read at every render, which the 5 s refresh below triggers)
  const phoneNextMs = IS_MOBILE ? nextPlannedReminder() : 0;
  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean>(() => (IS_MOBILE ? canDrawOverlays() : true));
  const [testingNudge, setTestingNudge] = useState(false);

  const formatDisplayTime = (ms: number) => {
    if (!ms || ms <= 0) return "Chưa từng hiển thị";
    const d = new Date(ms);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Custom CLI Path state
  const [customCliPath, setCustomCliPath] = useState("");
  const [customCliSaved, setCustomCliSaved] = useState(false);

  const [selectedOs, setSelectedOs] = useState<"macos" | "windows">(() => {
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("win")) {
      return "windows";
    }
    return "macos";
  });

  const checkCli = async (pathToTest?: string) => {
    setCheckingCli(true);
    try {
      const storedPath = localStorage.getItem("myenglish_custom_cli_path") || undefined;
      const pathParam = pathToTest !== undefined ? (pathToTest.trim() || undefined) : storedPath;
      const res = await invoke<CliStatus>("check_cli_status", { customPath: pathParam });
      setCliStatus(res ?? null);
    } catch (err) {
      setCliStatus({
        installed: false,
        path: pathToTest || customCliPath || "~/.gemini/antigravity-cli",
        error: String(err),
      });
    } finally {
      setCheckingCli(false);
    }
  };

  const refreshApiKeyStatus = async () => {
    try {
      const status = await invoke<ApiKeyStatus>("get_ai_api_key_status");
      setApiKeyStatus(status);
      // Show a custom model in the box; an empty box means "use the default"
      setApiModelInput(status.modelFromEnv || status.model === status.defaultModel ? "" : status.model ?? "");
    } catch {
      setApiKeyStatus({ configured: false });
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingApiKey || !apiKeyInput.trim()) return;
    setSavingApiKey(true);
    setApiKeyMessage(null);
    try {
      await invoke("save_ai_api_key", { key: apiKeyInput, model: apiModelInput });
      setApiKeyInput("");
      setApiKeyMessage({ ok: true, text: "Đã kiểm tra và lưu key. Các tính năng AI đã sẵn sàng." });
      await Promise.all([refreshApiKeyStatus(), checkCli()]);
    } catch (err) {
      setApiKeyMessage({ ok: false, text: String(err) });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleChangeModel = async () => {
    setSavingApiKey(true);
    setApiKeyMessage(null);
    try {
      await invoke("set_ai_model", { model: apiModelInput });
      setApiKeyMessage({ ok: true, text: "Đã kiểm tra và đổi model." });
      await refreshApiKeyStatus();
    } catch (err) {
      setApiKeyMessage({ ok: false, text: String(err) });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleClearApiKey = async () => {
    setSavingApiKey(true);
    setApiKeyMessage(null);
    try {
      await invoke("clear_ai_api_key");
      setApiKeyMessage({ ok: true, text: "Đã xóa key. AI sẽ dùng CLI nếu bạn đã cài." });
      await Promise.all([refreshApiKeyStatus(), checkCli()]);
    } catch (err) {
      setApiKeyMessage({ ok: false, text: String(err) });
    } finally {
      setSavingApiKey(false);
    }
  };

  useEffect(() => {
    refreshApiKeyStatus();
    try {
      const savedPath = localStorage.getItem("myenglish_custom_cli_path");
      if (savedPath) {
        setCustomCliPath(savedPath);
        checkCli(savedPath);
      } else {
        checkCli();
      }
    } catch {
      checkCli();
    }

    // A key used to be saved here in plain text but was never used: remove it
    try {
      localStorage.removeItem("myenglish_gemini_api_key");
    } catch { }

    const syncSettings = () => {
      setReminderSettings(getReminderSettings());
      setSnoozeMinutesRemaining(getSnoozeRemainingMinutes());
      setLastDisplayMs(getLastPopupDisplayTime());
      setNextReminderMs(getNextReminderTime());
      setGoalMet(isDailyGoalMet());
      if (IS_MOBILE) setHasOverlayPermission(canDrawOverlays());
    };
    syncSettings();

    // Check system autostart status
    checkSystemAutostartStatus().then((active) => {
      setAutostart(active);
    });

    const onAutostartChanged = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>;
      if (custom.detail?.enabled !== undefined) {
        setAutostart(custom.detail.enabled);
      }
    };
    window.addEventListener("myenglish-autostart-changed", onAutostartChanged);

    window.addEventListener("myenglish-reminder-settings-updated", syncSettings);
    window.addEventListener("myenglish-popup-displayed", syncSettings);
    // Re-read the settings every 5 s, and only while this page is on screen (the countdown ticks by itself)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") syncSettings();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncSettings();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("myenglish-autostart-changed", onAutostartChanged);
      window.removeEventListener("myenglish-reminder-settings-updated", syncSettings);
      window.removeEventListener("myenglish-popup-displayed", syncSettings);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  const handleToggleAutostart = async (checked: boolean) => {
    setTogglingAutostart(true);
    setAutostart(checked);
    const ok = await setAutostartEnabled(checked);
    setTogglingAutostart(false);
    if (ok) {
      setNotifFeedback(
        checked
          ? "Đã bật tự khởi động cùng hệ điều hành (mặc định mở khay hệ thống)."
          : "Đã tắt tự khởi động cùng hệ điều hành."
      );
    } else {
      setNotifFeedback("Đã lưu thiết lập vào ứng dụng.");
    }
  };

  const handleUpdateReminder = (partial: Partial<ReminderSettings>) => {
    const updated = saveReminderSettings(partial);
    setReminderSettings(updated);
    setNextReminderMs(getNextReminderTime());
    srsWorker.restart();
    if (IS_MOBILE) {
      scheduleForBackground();
    }
    setNotifFeedback("Đã lưu thiết lập nhắc học và cập nhật bộ đếm thời gian!");
  };

  const handleTestPopupQuiz = async () => {
    setTestingPopup(true);
    setNotifFeedback(null);
    try {
      await triggerReviewPopup();
      setNotifFeedback(
        "Đã mở thẻ ôn toàn màn hình! Bạn có thể nhấn Esc để tắt nhanh, dùng phím 1-4 để chọn đáp án, hoặc bấm Hoãn."
      );
    } catch (e) {
      setNotifFeedback(`Lỗi khi mở pop-up: ${e}`);
    } finally {
      setTestingPopup(false);
    }
  };

  const handleTestNudge = async () => {
    setTestingNudge(true);
    setNotifFeedback(null);
    try {
      if (IS_MOBILE) {
        if (!canDrawOverlays()) {
          requestOverlayPermission();
          setNotifFeedback("Bạn chưa cấp quyền 'Xuất hiện trên cùng'. Đang mở Cài đặt...");
          return;
        }
        const ok = await testMobileFloatingNudge();
        if (ok) {
          setNotifFeedback("Đã hiển thị Flash-Quiz nổi trên màn hình!");
          return;
        }
      }
      await triggerReviewNudge(5);
      setNotifFeedback("Đã mở thẻ nhắc ôn tập (Nudge)!");
    } catch (e) {
      setNotifFeedback(`Lỗi khi mở popup nhắc: ${e}`);
    } finally {
      setTestingNudge(false);
    }
  };

  const handleTestNudgeIn = async (seconds: number = 5) => {
    setTestingNudge(true);
    setNotifFeedback(null);
    try {
      if (IS_MOBILE) {
        if (!canDrawOverlays()) {
          requestOverlayPermission();
          setNotifFeedback("Bạn chưa cấp quyền 'Xuất hiện trên cùng'. Đang mở Cài đặt...");
          return;
        }
        const ok = await testMobileFloatingNudgeIn(seconds);
        if (ok) {
          setNotifFeedback(`Đã lên lịch popup sau ${seconds}s! Hãy bấm nút Home thoát ra màn hình chính ngay.`);
          return;
        }
      }
      setNotifFeedback("Tính năng hẹn giờ thử chỉ áp dụng trên điện thoại.");
    } catch (e) {
      setNotifFeedback(`Lỗi: ${e}`);
    } finally {
      setTestingNudge(false);
    }
  };

  const handleRequestOverlay = () => {
    const opened = requestOverlayPermission();
    if (opened) {
      setNotifFeedback("Đang mở Cài đặt hệ thống để cấp quyền 'Xuất hiện trên cùng'...");
    } else {
      setNotifFeedback("Thiết bị đã được cấp quyền hoặc không hỗ trợ.");
    }
  };

  const handleCancelSnooze = () => {
    cancelSnooze();
    setSnoozeMinutesRemaining(0);
    setNotifFeedback("Đã hủy trạng thái hoãn. Lịch nhắc học hoạt động bình thường.");
  };

  const handleCopy = (text: string, index: string | number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    setNotifFeedback(null);
    try {
      const res = await sendTestNotification();
      setNotifFeedback(res.message);
    } catch (e) {
      setNotifFeedback(`Lỗi: ${e}`);
    } finally {
      setTestingNotif(false);
    }
  };

  const handleMarkDueTest = async () => {
    setTestingDueWord(true);
    try {
      const word = await markWordDueImmediately();
      if (word) {
        onRefreshWords?.();
        setNotifFeedback(
          `Đã chuyển từ "${word}" thành trạng thái đến hạn ôn tập ngay! Bạn có thể nhấp vào thông báo nổi bên trên hoặc mở phần Ôn tập.`
        );
      } else {
        setNotifFeedback("Thư viện hiện chưa có từ vựng nào. Hãy thêm từ vựng trước.");
      }
    } catch (e) {
      setNotifFeedback(`Lỗi: ${e}`);
    } finally {
      setTestingDueWord(false);
    }
  };

  const handleSaveCustomPath = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCliPath.trim();
    if (trimmed) {
      localStorage.setItem("myenglish_custom_cli_path", trimmed);
    } else {
      localStorage.removeItem("myenglish_custom_cli_path");
    }
    setCustomCliSaved(true);
    setTimeout(() => setCustomCliSaved(false), 2000);
    checkCli(trimmed || undefined);
  };

  const handleResetCustomPath = () => {
    setCustomCliPath("");
    localStorage.removeItem("myenglish_custom_cli_path");
    checkCli(undefined);
  };

  // Why the clock reminder is not showing right now, or null
  const pauseReason =
    reminderSettings.enabled && reminderSettings.intervalMinutes > 0 ? getPauseReason(reminderSettings, goalMet) : null;

  return (
    <div className={`${PAGE_CONTAINER} space-y-8`}>

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 flex items-center justify-center shrink-0">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Cài đặt</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Phần quan trọng cho việc học ở trên cùng; AI và phần nâng cao được thu gọn, cần thì mở ra. Mỗi thay
            đổi được lưu ngay.
          </p>
        </div>
      </div>

      {/* Jump to a section */}
      <nav className="-mt-4 flex flex-wrap gap-1.5" aria-label="Các mục cài đặt">
        {(
          [
            ["study", "Học mỗi ngày"],
            ["reminders", "Nhắc học"],
            ["display", "Giao diện & âm thanh"],
            ["ai", "AI"],
            ["algorithm", "Lịch ôn thông minh"],
            ["data", "Dữ liệu"],
            ["feedback", "Góp ý"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              // A folded section opens first, then the page scrolls to it
              window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_SECTION_EVENT, { detail: id }));
              window.setTimeout(() => document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
            className="min-h-10 px-4 py-2 rounded-full text-sm font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Feedback alert message */}
      {notifFeedback && (
        <div className="p-3.5 md:p-4 rounded-2xl bg-teal-50 dark:bg-teal-400/10 border border-teal-200 dark:border-teal-800 text-sm text-teal-900 dark:text-teal-100 flex items-start justify-between gap-3 animate-in fade-in flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notifFeedback}</span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("review")}
              className="shrink-0 min-h-10 px-3.5 py-1.5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Mở phần Ôn tập ngay →</span>
            </button>
          )}
        </div>
      )}
      {/* 1. HỌC MỖI NGÀY: what shapes the learning, first and highlighted */}
      <SettingsSection
        id="study"
        tone="primary"
        icon={<GraduationCap className="w-5 h-5" />}
        title="Học mỗi ngày"
        description="Bạn học bao nhiêu mỗi ngày: mục tiêu, số từ mới, độ dài một phiên."
        summary={`${dailyGoal} câu/ngày · ${studyLimits.newCardsPerDay} thẻ mới`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {/* Daily goal: the answers that count a day as done (streak, Today) */}
          <div className={`${SETTINGS_GROUP} md:p-4 md:first:pt-4 md:rounded-xl md:bg-white md:dark:bg-zinc-950 space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Mục tiêu mỗi ngày
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400">Số câu trả lời để tính là đã học xong hôm nay (giữ chuỗi ngày học).</p>
              </div>
              <span className="text-sm font-bold font-mono text-teal-700 dark:text-teal-300">{dailyGoal}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 15, 30, 45, 60].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setDailyGoal(g);
                    setDailyGoalState(g);
                    setNotifFeedback(`Đã đặt mục tiêu mỗi ngày: ${g} câu.`);
                  }}
                  className={`min-h-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${dailyGoal === g
                      ? "bg-teal-700 text-white shadow-sm font-bold dark:bg-teal-600"
                      : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Focus session length: what "Tập trung" starts everywhere */}
          <div className={`${SETTINGS_GROUP} md:p-4 md:first:pt-4 md:rounded-xl md:bg-white md:dark:bg-zinc-950 space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Độ dài phiên tập trung
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400">Bấm "Tập trung" ở bất kỳ đâu sẽ học trọn chừng này phút, tắt nhắc nhở.</p>
              </div>
              <span className="text-sm font-bold font-mono text-teal-700 dark:text-teal-300">{focusMinutes}′</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {FOCUS_DURATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    saveFocusSettings({ minutes: m });
                    setFocusMinutes(m);
                  }}
                  className={`min-h-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${focusMinutes === m
                      ? "bg-teal-700 text-white shadow-sm font-bold dark:bg-teal-600"
                      : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                    }`}
                >
                  {m} phút
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Daily study limits */}
        <div className={`${SETTINGS_GROUP} md:p-4 md:first:pt-4 md:rounded-xl md:bg-white md:dark:bg-zinc-950 space-y-3`}>
          {([
            {
              key: "newCardsPerDay" as const,
              title: "Số thẻ mới mỗi ngày",
              desc: "Gồm từ mới và lượt tập gõ lại từ đã nhớ (thẻ nhớ lại mới). Giữ thấp để lượng ôn các ngày sau không dồn ứ.",
              options: [3, 5, 8, 10, 20],
            },
            {
              key: "maxSessionSize" as const,
              title: "Số thẻ tối đa mỗi phiên",
              desc: "Từ đến hạn được ưu tiên trước, từ mới xen kẽ đều trong phiên.",
              options: [20, 30, 40, 50, 100],
            },
          ]).map((cfg) => (
            <div key={cfg.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{cfg.title}</div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">{cfg.desc}</p>
                </div>
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300 font-mono">
                  {studyLimits[cfg.key]}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {cfg.options.map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      saveStudyLimits({ [cfg.key]: val });
                      setStudyLimits((prev) => ({ ...prev, [cfg.key]: val }));
                      setNotifFeedback(`Đã cập nhật "${cfg.title}" thành ${val}!`);
                    }}
                    className={`min-h-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${studyLimits[cfg.key] === val
                        ? "bg-teal-700 text-white shadow-sm font-bold dark:bg-teal-600"
                        : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                      }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-start justify-between gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Đoán nghĩa trước khi học từ mới</div>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Trước thẻ giới thiệu, đoán nghĩa từ trong một câu ví dụ (3 lựa chọn). Đoán trước, kể cả đoán sai, giúp nhớ lâu hơn. Không tính điểm.
              </p>
            </div>
            <input
              type="checkbox"
              checked={pretestOn}
              onChange={(e) => {
                setPretestEnabled(e.target.checked);
                setPretestOn(e.target.checked);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700"
            />
          </label>
        </div>
      </SettingsSection>

      {/* 2. NHẮC HỌC: khi nào app nhắc bạn */}
      <SettingsSection
        id="reminders"
        icon={<Bell className="w-5 h-5" />}
        title="Nhắc học"
        description="Khi nào app nhắc bạn ôn: mỗi bao lâu, vào giờ nào, giờ yên tĩnh."
        summary={IS_WEB ? "Thông báo theo giờ học" : reminderSettings.enabled ? (reminderSettings.intervalMinutes > 0 ? `Bật · mỗi ${reminderSettings.intervalMinutes} phút` : "Bật · theo giờ học") : "Đang tắt"}
      >
        {IS_WEB ? (
          <WebReminders />
        ) : (
        <div className="space-y-6">
          {/* SECTION 0: AUTOSTART SYSTEM SETTING (desktop only) */}
          {!IS_MOBILE && (
            <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-4 md:shadow-sm`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 shrink-0">
                    <Power className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Tự khởi động cùng hệ điều hành
                      </h3>
                      <span className="whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Mặc định: Bật
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      Tự động mở MyEnglish khi khởi động máy tính để không bỏ lỡ lịch nhắc từ vựng và phím tắt tra từ nhanh
                    </p>
                  </div>
                </div>

                {/* Autostart Toggle */}
                <button
                  type="button"
                  disabled={togglingAutostart}
                  onClick={() => handleToggleAutostart(!autostart)}
                  className={`min-h-10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ${autostart
                      ? "bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white"
                      : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${autostart ? "bg-white animate-pulse" : "bg-slate-400"
                      }`}
                  />
                  <span>
                    {togglingAutostart
                      ? "Đang cập nhật..."
                      : autostart
                        ? "Tự khởi động: Bật"
                        : "Tự khởi động: Tắt"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: SETTINGS & SCHEDULE CONFIGURATION */}
          <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-6 md:shadow-sm`}>
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 shrink-0">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Lịch nhắc và câu hỏi nhanh
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    {IS_MOBILE
                      ? "Tùy chỉnh tần suất nhắc, giờ học cố định và giờ yên tĩnh"
                      : "Tùy chỉnh tần suất nhắc, thời gian hoãn, dạng câu hỏi và độ mờ màn hình"}
                  </p>
                </div>
              </div>

              {/* Master Toggle */}
              <button
                onClick={() => handleUpdateReminder({ enabled: !reminderSettings.enabled })}
                className={`min-h-10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${reminderSettings.enabled
                    ? "bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${reminderSettings.enabled ? "bg-white animate-pulse" : "bg-slate-400"}`} />
                <span>{reminderSettings.enabled ? "Đang bật nhắc" : "Đã tạm dừng"}</span>
              </button>
            </div>

            {/* Realtime Schedule & Countdown Card */}
            {/* On a phone the time shown is the next notification handed to Android, and the button opens the quick quiz in the app */}
            {reminderSettings.enabled && reminderSettings.intervalMinutes > 0 && (
              <div className="p-3 md:p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-400/5 border border-teal-200/80 dark:border-teal-800/60 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold shrink-0">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    {pauseReason ? (
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Đang tạm dừng: {pauseReason}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {IS_MOBILE ? "Nhắc kế tiếp:" : "Lần hiển thị kế tiếp:"}
                        </span>
                        {IS_MOBILE && phoneNextMs === 0 ? (
                          <span className="text-xs text-slate-600 dark:text-zinc-400">
                            chưa đặt: thoát app ra màn hình chính một lần để đặt nhắc
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-200 bg-teal-100/80 dark:bg-teal-400/10 px-2 py-0.5 rounded-full">
                              {formatDisplayTime(IS_MOBILE ? phoneNextMs : nextReminderMs)}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                              (Còn lại: <ReminderCountdown nextMs={IS_MOBILE ? phoneNextMs : nextReminderMs} />)
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      {IS_MOBILE ? (
                        <span className="text-teal-700 dark:text-teal-300 font-medium">
                          Nhắc cách nhau khoảng {reminderGapMinutes(reminderSettings)} phút ban ngày (tối đa {reminderSettings.maxNudgesPerDay || "không giới hạn"} lần/ngày), kể cả khi đã đóng app
                        </span>
                      ) : (
                        <>
                          Lần hiển thị gần nhất: <strong className="text-slate-700 dark:text-zinc-300 font-mono">{formatDisplayTime(lastDisplayMs)}</strong>
                          <span className="ml-2 text-teal-700 dark:text-teal-300 font-medium">
                            • Chu kỳ: {reminderSettings.intervalMinutes} phút (tính từ lần cuối popup hiển thị)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trying the popup: desktop only (on a phone, for the developer) */}
                {(!IS_MOBILE || SHOW_DEV_TOOLS) && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={handleTestNudge}
                    disabled={testingNudge}
                    className="min-h-11 px-3.5 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                    title="Mở popup nhắc nhỏ có kèm 1 câu quiz"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{testingNudge ? "Đang mở..." : "Thử Popup nổi"}</span>
                  </button>
                  <button
                    onClick={handleTestPopupQuiz}
                    disabled={testingPopup}
                    className={`min-h-11 px-3 py-2 rounded-2xl bg-white dark:bg-transparent hover:bg-teal-50 dark:hover:bg-teal-400/10 text-teal-800 dark:text-teal-300 text-sm font-semibold transition-colors border border-teal-700/30 dark:border-teal-400/40 items-center gap-1.5 shrink-0 ${IS_MOBILE ? "hidden" : "flex"}`}
                  >
                    <span>{testingPopup ? "Đang mở..." : "Toàn màn hình"}</span>
                  </button>
                </div>
                )}
              </div>
            )}

            {/* Android: Floating Overlay Permission Banner */}
            {IS_MOBILE && !hasOverlayPermission && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="text-xl shrink-0">🦉</span>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Quyền hiển thị trên ứng dụng khác chưa bật</div>
                    <div className="text-xs text-slate-600 dark:text-zinc-400">
                      Bật quyền để thẻ nhắc ôn tập & 1 câu quiz có thể xuất hiện nổi trên màn hình khi bạn đang mở app khác.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRequestOverlay}
                  className="min-h-11 px-3.5 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold transition-colors shrink-0"
                >
                  Cấp quyền hiển thị nổi
                </button>
              </div>
            )}

            {IS_MOBILE && hasOverlayPermission && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-center justify-between gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium min-w-0">
                  <span className="text-sm">✓</span>
                  <span>Đã bật quyền hiển thị thẻ nhắc nổi trên các ứng dụng khác</span>
                </div>
                {SHOW_DEV_TOOLS && (
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    onClick={() => handleTestNudgeIn(5)}
                    disabled={testingNudge}
                    className="min-h-10 px-3 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 active:scale-95 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    Thử sau 5s (thoát app)
                  </button>
                  <button
                    onClick={handleTestNudge}
                    disabled={testingNudge}
                    className="min-h-10 px-3 py-2 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 hover:bg-teal-50 dark:hover:bg-teal-400/10 text-teal-800 dark:text-teal-300 font-semibold text-xs transition-colors"
                  >
                    {testingNudge ? "Đang mở..." : "Thử popup ngay"}
                  </button>
                </div>
                )}
              </div>
            )}

            {/* Active Snooze Alert if currently snoozed */}
            {snoozeMinutesRemaining > 0 && (
              <div className="p-3 md:p-4 rounded-2xl bg-amber-50dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <Hourglass className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin-slow shrink-0" />
                  <span>
                    Đang hoãn nhắc: còn khoảng{" "}
                    <strong>{snoozeMinutesRemaining} phút</strong> trước lần nhắc kế tiếp.
                  </span>
                </div>
                <button
                  onClick={handleCancelSnooze}
                  className="min-h-10 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  Hủy hoãn ngay
                </button>
              </div>
            )}

            {/* SETTING FIELDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Field 1: Reminder Interval */}
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                    Khoảng thời gian nhắc học:
                  </span>
                  <span className="text-xs font-mono text-teal-700 dark:text-teal-300 font-semibold">
                    {reminderSettings.intervalMinutes === 0 ? "Chỉ mở thủ công" : `Mỗi ${reminderSettings.intervalMinutes} phút`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([15, 30, 45, 60, 120, 0] as ReminderInterval[]).map((val) => {
                    const isSelected = reminderSettings.intervalMinutes === val;
                    const label = val === 0 ? "Tắt tự động" : val >= 60 ? `${val / 60} giờ` : `${val} phút`;
                    return (
                      <button
                        key={val}
                        onClick={() => handleUpdateReminder({ intervalMinutes: val })}
                        className={`min-h-10 min-h-10 py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-teal-500"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-tight">
                  Khuyên dùng: <strong>30 phút</strong> để vừa tập trung làm việc vừa duy trì nhịp ôn tập đều đặn.
                </p>
              </div>

              {/* Field 2: Snooze Duration (the desktop popup's "Hoãn" button) */}
              {!IS_MOBILE && (
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                    Thời gian hoãn nhắc:
                  </span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {reminderSettings.snoozeMinutes} phút
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([5, 10, 15, 30] as SnoozeDuration[]).map((val) => {
                    const isSelected = reminderSettings.snoozeMinutes === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleUpdateReminder({ snoozeMinutes: val })}
                        className={`min-h-10 min-h-10 py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-amber-500"
                          }`}
                      >
                        {val} phút
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-tight">
                  Khi đang bận, bạn chỉ cần bấm nút <strong>Hoãn [S]</strong> trên pop-up để dời thời điểm ôn.
                </p>
              </div>
              )}

              {/* Field: fixed study times, e.g. after lunch (the reminder worker only acts on them when the popup is on) */}
              <StudyTimesField
                anchors={reminderSettings.anchors ?? []}
                active={reminderSettings.enabled}
                nightQuiet={reminderSettings.nightQuiet}
                onChange={(anchors) => handleUpdateReminder({ anchors })}
              />

              {/* Field 3: Trigger Condition (desktop popup worker only; Android plans its own notifications) */}
              {!IS_MOBILE && (
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                  Điều kiện kích hoạt hiển thị:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "due_only" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "due_only"
                        ? "border-teal-700 bg-teal-50 dark:border-teal-500 dark:bg-teal-400/10 text-teal-900 dark:text-teal-100 ring-1 ring-teal-700 dark:ring-teal-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">Chỉ khi có từ đến hạn ôn</span>
                    <span className="text-xs opacity-75">Nhắc đúng lịch ôn, không nhắc thừa</span>
                  </button>

                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "due_then_random" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "due_then_random"
                        ? "border-teal-700 bg-teal-50 dark:border-teal-500 dark:bg-teal-400/10 text-teal-900 dark:text-teal-100 ring-1 ring-teal-700 dark:ring-teal-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">Đến hạn → Hết thì ngẫu nhiên</span>
                    <span className="text-xs opacity-75">Ưu tiên đúng hạn, hết thì ôn thêm</span>
                  </button>

                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "all_words" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "all_words"
                        ? "border-teal-700 bg-teal-50 dark:border-teal-500 dark:bg-teal-400/10 text-teal-900 dark:text-teal-100 ring-1 ring-teal-700 dark:ring-teal-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">Luôn nhắc nhở ngẫu nhiên</span>
                    <span className="text-xs opacity-75">Duy trì phản xạ từ vựng liên tục</span>
                  </button>
                </div>
              </div>
              )}

              {/* Field 3b: Do not disturb */}
              {/* On a phone only the last three apply (mobileReminders.ts): the others watch the desktop */}
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80">
                {!IS_MOBILE && (<>
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Không làm phiền khi đang bận
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Tự hoãn pop-up khi có ứng dụng toàn màn hình (trình chiếu, video, họp), khi đang chia sẻ màn
                      hình Zoom, khi bật Focus/Không làm phiền (nếu macOS cho phép đọc) hoặc khi bạn rời máy quá 5
                      phút. Khi đến giờ, một thẻ nhỏ hiện ở góc màn hình (không chiếm bàn phím) lúc bạn tạm dừng
                      thao tác; bỏ qua thì thẻ tự hoãn sau 20 giây, bấm Học ngay để mở bài ôn.
                    </span>
                    {!IS_MAC && (
                      <span className="block text-xs font-semibold text-amber-700 dark:text-amber-400 pt-1">
                        Hiện chỉ hoạt động trên macOS.
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.respectFocus}
                    onChange={(e) => handleUpdateReminder({ respectFocus: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Luôn hiện trên màn hình chính
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Mặc định nhắc nhở hiện trên màn hình bạn đang làm việc (nơi có con trỏ chuột).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.preferPrimaryMonitor}
                    onChange={(e) => handleUpdateReminder({ preferPrimaryMonitor: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Nhắc vào lúc chuyển việc
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Ngoài chu kỳ trên, nhắc sớm hơn vào lúc bạn vừa quay lại máy (buổi sáng, sau khi rời máy hoặc
                      máy ngủ), vừa tắt chia sẻ màn hình hoặc vừa thoát ứng dụng toàn màn hình. Chỉ khi có thẻ cần ôn,
                      và cách lời nhắc trước ít nhất 20 phút.
                    </span>
                    {!IS_MAC && (
                      <span className="block text-xs font-semibold text-amber-700 dark:text-amber-400 pt-1">
                        Hiện chỉ hoạt động trên macOS.
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.contextMoments}
                    onChange={(e) => handleUpdateReminder({ contextMoments: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Né giờ bạn hay bỏ qua lời nhắc
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Học từ 30 ngày gần nhất: giờ nào lời nhắc gần như luôn bị hoãn hoặc bỏ qua thì không nhắc theo
                      chu kỳ vào giờ đó (lời nhắc lúc chuyển việc vẫn hiện).
                      {getQuietHours().length > 0 && ` Hiện đang né: ${getQuietHours().map((h) => `${h}h`).join(", ")}.`}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.avoidQuietHours}
                    onChange={(e) => handleUpdateReminder({ avoidQuietHours: e.target.checked })}
                  />
                </label>
                </>)}
                <label className="mt-3 pt-3 border-t first:mt-0 first:pt-0 first:border-t-0 border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Xong mục tiêu ngày thì thôi nhắc
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Đạt mục tiêu hôm nay rồi thì nghỉ, mai nhắc tiếp. Bạn vẫn có thể tự mở bài ôn bất cứ lúc nào.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.stopAfterGoal}
                    onChange={(e) => handleUpdateReminder({ stopAfterGoal: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Không nhắc ban đêm ({NIGHT_QUIET_START}:00–{String(NIGHT_QUIET_END).padStart(2, "0")}:00)
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Ngủ đủ giúp nhớ từ tốt hơn học khuya.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-teal-700 shrink-0"
                    checked={reminderSettings.nightQuiet}
                    onChange={(e) => handleUpdateReminder({ nightQuiet: e.target.checked })}
                  />
                </label>
                <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Tối đa số lần nhắc mỗi ngày
                    </span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 block leading-snug">
                      Nhắc quá nhiều dễ thành thói quen bấm bỏ qua.
                    </span>
                  </span>
                  <select
                    className="text-sm min-h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 shrink-0"
                    value={reminderSettings.maxNudgesPerDay}
                    onChange={(e) => handleUpdateReminder({ maxNudgesPerDay: Number(e.target.value) })}
                  >
                    {[4, 6, 8, 12, 0].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "Không giới hạn" : `${n} lần`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 4: Words per Session and Field 5: blur — the desktop popup only */}
              {!IS_MOBILE && (<>
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                    Số từ mỗi lần nhắc:
                  </span>
                  <span className="text-xs font-mono text-teal-700 dark:text-teal-300 font-semibold">
                    {reminderSettings.wordsPerSession} từ / phiên
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { count: 3, label: "3 từ", desc: "~15s nhanh" },
                    { count: 5, label: "5 từ", desc: "~30s chuẩn" },
                    { count: 10, label: "10 từ", desc: "~1p sâu" },
                  ].map((item) => {
                    const isSelected = reminderSettings.wordsPerSession === item.count;
                    return (
                      <button
                        key={item.count}
                        onClick={() => handleUpdateReminder({ wordsPerSession: item.count })}
                        className={`min-h-10 py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center flex flex-col items-center gap-0.5 ${isSelected
                            ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-teal-500"
                          }`}
                      >
                        <span className="font-bold">{item.label}</span>
                        <span className={`text-xs ${isSelected ? "text-teal-50" :"text-slate-600 dark:text-zinc-400"}`}>
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-tight">
                  Các câu hỏi trong phiên pop-up được tự động phân bổ ngẫu nhiên giữa trắc nghiệm 1-4, gõ từ vựng và tự động xen kẽ các bài ngữ pháp đã học.
                </p>
              </div>

              {/* Field 5: Fullscreen Overlay Blur Level & Audio Policy */}
              <div className="p-3 md:p-4 rounded-2xl bg-slate-50/80dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                    Độ mờ màn hình nền:
                  </span>
                  <span className="text-xs font-mono text-teal-700 dark:text-teal-300 font-semibold">
                    {reminderSettings.blurOverlay === "light" ? "Mờ nhẹ" : reminderSettings.blurOverlay === "heavy" ? "Mờ đậm" : "Mờ vừa"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "medium", "heavy"] as BlurOverlayLevel[]).map((level) => {
                    const isSelected = reminderSettings.blurOverlay === level;
                    const label = level === "light" ? "Mờ nhẹ" : level === "heavy" ? "Mờ đậm" : "Mờ vừa";
                    return (
                      <button
                        key={level}
                        onClick={() => handleUpdateReminder({ blurOverlay: level })}
                        className={`min-h-10 py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-teal-500"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-1">
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  <span>Đã tắt âm thanh tự động khi hiển thị từ để không làm phiền bạn.</span>
                </div>
              </div>
              </>)}
            </div>
          </div>
        </div>
        )}
      </SettingsSection>

      {/* 3. GIAO DIỆN: chế độ, cỡ chữ, âm thanh, giọng đọc */}
      <SettingsSection
        id="display"
        icon={<Palette className="w-5 h-5" />}
        title="Giao diện, âm thanh & giọng đọc"
        description="Cỡ chữ, chế độ đơn giản, cuộc đua xếp hạng, âm thanh phản hồi, giọng đọc tiếng Anh."
      >
        <DisplaySettings />
      </SettingsSection>

      {/* 4. AI: không bắt buộc để học, thu gọn */}
      <SettingsSection
        id="ai"
        tone="muted"
        icon={<Bot className="w-5 h-5" />}
        title="AI (không bắt buộc)"
        description="Chỉ cần cho các tính năng AI như Viết và sửa lỗi. Không có AI bạn vẫn học bình thường."
        summary={IS_WEB ? "Chưa có trên bản web" : !cliStatus ? "Đang kiểm tra…" : cliStatus.installed ? "● Đã kết nối" : "○ Chưa kết nối"}
        defaultOpen={false}
      >
        {IS_WEB ? (
          <NotOnWeb>
            Các tính năng AI (Viết và sửa lỗi, tạo hội thoại mới) chưa có trên bản web. Mọi bài học khác dùng bình thường;
            muốn dùng AI, hãy mở app trên điện thoại Android hoặc máy tính.
          </NotOnWeb>
        ) : (
        <div className="space-y-6">
          {/* AI CLI status: information only. Without it the app still works; only the AI features are off */}
          <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 md:shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cliStatus?.installed
                    ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                  }`}
              >
                {cliStatus?.installed ? <CheckCircle2 className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Trạng thái AI (API key hoặc CLI):
                  </span>
                  <span
                    className={`text-xs font-semibold font-mono px-2.5 py-0.5 rounded-full border ${cliStatus?.installed
                        ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                      }`}
                  >
                    {cliStatus === null ? "○ ĐANG KIỂM TRA" : cliStatus.installed ? "● ĐÃ KẾT NỐI" : "○ CHƯA KẾT NỐI"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  {cliStatus?.installed
                    ? "Sẵn sàng cho các tính năng AI."
                    : "Bạn vẫn học bình thường khi chưa có. Chỉ các tính năng AI (như Viết và sửa lỗi) cần API key hoặc AI CLI."}
                </p>
                <p className={`text-xs text-slate-600 dark:text-zinc-400 font-mono ${IS_MOBILE ? "hidden" : ""}`}>
                  Đường dẫn:{" "}
                  <span className="text-slate-800 dark:text-zinc-200 font-bold">
                    {cliStatus?.path || "~/.gemini/antigravity-cli"}
                  </span>
                </p>
                {cliStatus?.details && (
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">✓ {cliStatus.details}</p>
                )}
                {cliStatus?.error && (
                  <p className="text-xs text-slate-600 dark:text-zinc-400">Chi tiết: {cliStatus.error}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => checkCli()}
              disabled={checkingCli}
              className="min-h-11 px-4 py-2 rounded-2xl bg-white hover:bg-teal-50 dark:bg-transparent dark:hover:bg-teal-400/10 border border-teal-700/30 dark:border-teal-400/40 text-sm font-semibold text-teal-800 dark:text-teal-300 transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingCli ? "animate-spin" : ""}`} />
              <span>Kiểm tra lại kết nối</span>
            </button>
          </div>

          {/* Gemini API key: the easy way, no CLI to install. Stored in the OS credential store by the Rust side */}
          <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-4 md:shadow-[0_1px_3px_rgba(15,23,42,0.05)]`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-semibold text-sm">
                <Key className="w-4 h-4" />
                <span>Cách đơn giản: dùng Gemini API key</span>
              </div>
              {apiKeyStatus?.configured && (
                <span className="text-xs font-semibold font-mono px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300">
                  ● ĐÃ LƯU (…{apiKeyStatus.hint})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Không cần cài CLI hay đăng nhập Google. Dán API key miễn phí vào đây, mọi tính năng AI sẽ gọi thẳng Gemini.
              Key được lưu {IS_MOBILE ? "trong bộ nhớ riêng của ứng dụng trên điện thoại" : `trong kho khóa của hệ điều hành (${IS_MAC ? "Keychain" : "Windows Credential Manager"})`}, không nằm trong dữ liệu học hay file sao lưu.
              Khi dùng AI, nội dung từ vựng và câu bạn viết sẽ được gửi tới Google.
            </p>

            <div className="space-y-3 p-3 md:p-4 rounded-xl bg-slate-50dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cách lấy Gemini API Key:</h4>
              <ol className="text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 list-decimal pl-5 leading-relaxed">
                <li>
                  Truy cập vào trang{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 dark:text-teal-300 underline font-semibold inline-flex items-center gap-1"
                  >
                    Google AI Studio (aistudio.google.com)
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Đăng nhập bằng tài khoản Google (Gmail thông thường miễn phí).</li>
                <li>Bấm nút <strong>&quot;Create API key&quot;</strong> và copy chuỗi key tạo ra.</li>
                <li>Dán key vào ô bên dưới rồi bấm <strong>Lưu &amp; Kiểm tra</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleSaveApiKey} autoComplete="off" className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={apiKeyStatus?.configured ? "Dán key mới để thay thế key đã lưu" : "Dán Gemini API key (bắt đầu bằng AIza…)"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors shrink-0"
                aria-pressed={showApiKey}
              >
                {showApiKey ? "Ẩn key" : "Hiện key"}
              </button>
              <button
                type="submit"
                disabled={savingApiKey || !apiKeyInput.trim()}
                className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors shrink-0 shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingApiKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kiểm tra…</span>
                  </>
                ) : (
                  <span>Lưu &amp; Kiểm tra</span>
                )}
              </button>
              {apiKeyStatus?.configured && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  disabled={savingApiKey}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/40 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                >
                  Xóa key
                </button>
              )}
            </form>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <label htmlFor="ai-model-input" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 shrink-0">
                Model (tùy chọn)
              </label>
              <input
                id="ai-model-input"
                type="text"
                value={apiModelInput}
                onChange={(e) => setApiModelInput(e.target.value)}
                placeholder={apiKeyStatus?.defaultModel ?? "gemini-3.8-flash"}
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              {apiKeyStatus?.configured && (
                <button
                  type="button"
                  onClick={handleChangeModel}
                  disabled={savingApiKey || !!apiKeyStatus.modelFromEnv}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors shrink-0"
                >
                  Đổi model
                </button>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Đang dùng: <code className="font-mono">{apiKeyStatus?.model ?? "gemini-3.8-flash"}</code>
              {apiKeyStatus?.modelFromEnv ? " (đặt bởi biến môi trường MYENGLISH_AI_MODEL)" : ""}. Để trống ô để dùng model mặc
              định. Nếu Google ngừng model cũ và báo lỗi 404, hãy nhập tên model mới (xem tại AI Studio) rồi bấm Đổi model.
            </p>
            {apiKeyMessage && (
              <p
                role="status"
                className={`text-xs font-medium ${apiKeyMessage.ok ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"
                  }`}
              >
                {apiKeyMessage.text}
              </p>
            )}
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Có key thì app dùng key, không dùng CLI. Gói miễn phí có giới hạn số lượt gọi mỗi phút và mỗi ngày. {IS_MOBILE ? "" : "Phần cài CLI bên dưới chỉ dành cho ai muốn dùng cách đăng nhập Google."}
            </p>
          </div>

          {!IS_MOBILE && (
            <>
              {/* Custom CLI Path Configuration (Especially for Windows or custom install paths) */}
              <div className={`${SETTINGS_GROUP} md:p-4 md:first:pt-4 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 md:shadow-sm space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Đường dẫn CLI tùy chỉnh (Tự động nhận diện hoặc chỉ định thủ công)
                    </span>
                  </div>
                  {customCliPath && (
                    <button
                      type="button"
                      onClick={handleResetCustomPath}
                      className="text-xs text-slate-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
                    >
                      Đặt lại mặc định
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveCustomPath} autoComplete="off" className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={customCliPath}
                    onChange={(e) => setCustomCliPath(e.target.value)}
                    placeholder="Ví dụ: C:\Users\<tên bạn>\.gemini\antigravity-cli (hoặc C:\Users\<tên bạn>\.gemini\antigravity-cli\agy.exe)"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="submit"
                    disabled={checkingCli}
                    className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm transition-colors shrink-0 shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {customCliSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Đã lưu!</span>
                      </>
                    ) : (
                      <span>Lưu & Kiểm tra</span>
                    )}
                  </button>
                </form>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Hệ thống tự động tìm trong <code className="font-mono text-teal-700 dark:text-teal-300">.gemini\antigravity-cli</code>, <code className="font-mono text-teal-700 dark:text-teal-300">.gemini\bin</code>, và biến môi trường PATH. Nếu bạn cài đặt ở đường dẫn riêng, hãy dán đường dẫn thư mục hoặc file <code className="font-mono text-teal-700 dark:text-teal-300">agy.exe</code> vào ô trên.
                </p>
              </div>
              {/* OS Switcher Tabs */}
              <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOs("macos")}
                    className={`min-h-10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${selectedOs === "macos"
                        ? "bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 border border-slate-200/80 dark:border-zinc-700"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.38-.56.65-.98 1.7-0.85 2.76 1.04.08 2.07-.53 2.6-1.27z" />
                    </svg>
                    <span>Hướng dẫn macOS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOs("windows")}
                    className={`min-h-10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${selectedOs === "windows"
                        ? "bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 border border-slate-200/80 dark:border-zinc-700"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
                    </svg>
                    <span>Hướng dẫn Windows (10 / 11)</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/60 dark:bg-zinc-700/50 text-xs font-mono text-slate-600 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  <span>Đang chọn: {selectedOs === "macos" ? "macOS" : "Windows"}</span>
                </div>
              </div>

              {/* Account compatibility notice */}
              <div className="p-3 md:p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-400/5 border border-teal-200 dark:border-teal-800/50 space-y-2">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Khả năng tương thích tài khoản Google (Free vs Plus)</span>
                </div>
                <ul className="text-xs text-slate-700 dark:text-zinc-300 space-y-1.5 list-disc pl-5 leading-relaxed">
                  <li>
                    <strong className="text-slate-900 dark:text-white">Tài khoản cá nhân Free (Gmail miễn phí):</strong>{" "}
                    Hoàn toàn sử dụng được! Bạn chỉ cần đăng nhập qua trình duyệt khi CLI yêu cầu. Hệ thống cấp hạn ngạch (quota) hàng ngày đủ để bạn tra cứu và học hàng trăm từ vựng mới mỗi ngày.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">Tài khoản Plus / Advanced (Google One AI Premium / Workspace):</strong>{" "}
                    Được ưu tiên băng thông, tốc độ sinh từ vựng và câu ví dụ nhanh hơn với giới hạn request cao hơn.
                  </li>
                </ul>
              </div>

              {/* ============================================================== */}
              {/* GUIDE FOR MACOS                                                */}
              {/* ============================================================== */}
              {selectedOs === "macos" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="p-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.38-.56.65-.98 1.7-0.85 2.76 1.04.08 2.07-.53 2.6-1.27z" />
                        </svg>
                      </span>
                      <span>Quy trình cài đặt & Kết nối Antigravity CLI trên macOS</span>
                    </h3>
                    <span className="text-xs font-mono text-teal-700 dark:text-teal-300">
                      Binary: ~/.gemini/bin/agy
                    </span>
                  </div>

                  {/* Step 1: Install */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          1
                        </span>
                        Tải & Cài đặt Antigravity CLI
                      </span>
                      <button
                        onClick={() => handleCopy("curl -fsSL https://antigravity.google/install.sh | bash", "mac-1")}
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-1" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-1" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>curl -fsSL https://antigravity.google/install.sh | bash</code>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <p>• Hoặc nếu máy bạn đã có Node.js / npm, có thể chạy lệnh: <code className="text-teal-700 dark:text-teal-300 font-mono">npm install -g @google/antigravity-cli</code></p>
                      <p>• Script sẽ tự động tải binary và đặt vào thư mục người dùng: <code className="text-teal-700 dark:text-teal-300 font-mono">~/.gemini/bin/agy</code></p>
                    </div>
                  </div>

                  {/* Step 2: Permissions & PATH */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          2
                        </span>
                        Cấp quyền thực thi & Đưa vào biến môi trường PATH
                      </span>
                      <button
                        onClick={() =>
                          handleCopy("chmod +x ~/.gemini/bin/agy && echo 'export PATH=\"$HOME/.gemini/bin:$PATH\"' >> ~/.zshrc && source ~/.zshrc", "mac-2")
                        }
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-2" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-2" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>chmod +x ~/.gemini/bin/agy &amp;&amp; echo 'export PATH="$HOME/.gemini/bin:$PATH"' &gt;&gt; ~/.zshrc &amp;&amp; source ~/.zshrc</code>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      Lệnh này đảm bảo binary có quyền chạy trên macOS và bạn có thể gõ trực tiếp lệnh <code className="text-teal-700 dark:text-teal-300 font-mono">agy</code> trong mọi cửa sổ Terminal.
                    </p>
                  </div>

                  {/* Step 3: Auth */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          3
                        </span>
                        Đăng nhập tài khoản Google (Xác thực 1 lần duy nhất)
                      </span>
                      <button
                        onClick={() => handleCopy("~/.gemini/bin/agy auth login", "mac-3")}
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-3" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-3" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>~/.gemini/bin/agy auth login</code>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      Mở Terminal và dán lệnh trên. Trình duyệt Safari/Chrome sẽ tự động mở trang xác thực của Google. Bạn chỉ cần chọn tài khoản Gmail và bấm <strong>Cho phép (Allow)</strong>.
                    </p>
                  </div>

                  {/* Step 4: Test & App Connection */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          4
                        </span>
                        Kiểm tra phản hồi & Kết nối với MyEnglish
                      </span>
                      <button
                        onClick={() =>
                          handleCopy('~/.gemini/bin/agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"', "mac-4")
                        }
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-4" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-4" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>~/.gemini/bin/agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"</code>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <p>• Khi lệnh in ra câu chào phản hồi từ Gemini, CLI đã hoạt động hoàn toàn chính xác.</p>
                      <p>• <strong>Trong app MyEnglish</strong>: Ứng dụng tự động phát hiện đường dẫn <code className="text-teal-700 dark:text-teal-300 font-mono">~/.gemini/bin/agy</code>. Bạn chỉ cần nhấn nút <strong>"Kiểm tra lại kết nối"</strong> ở banner trên để thấy trạng thái xanh lá.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* GUIDE FOR WINDOWS (10 / 11)                                    */}
              {/* ============================================================== */}
              {selectedOs === "windows" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="p-1 rounded-md bg-teal-700 dark:bg-teal-600 text-white">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
                        </svg>
                      </span>
                      <span>Quy trình cài đặt & Kết nối Antigravity CLI trên Windows (10 / 11)</span>
                    </h3>
                    <span className="text-xs font-mono text-teal-700 dark:text-teal-300">
                      Binary: agy.exe
                    </span>
                  </div>

                  {/* Step 1: Install Windows */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          1
                        </span>
                        Cài đặt Antigravity CLI qua PowerShell (Khuyên dùng)
                      </span>
                      <button
                        onClick={() => handleCopy("iwr -useb https://antigravity.google/install.ps1 | iex", "win-1")}
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-1" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-1" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>iwr -useb https://antigravity.google/install.ps1 | iex</code>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <p>• Nhấn phím <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border text-xs">Win</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border text-xs">X</kbd>, chọn <strong>Terminal</strong> hoặc <strong>PowerShell</strong> và dán lệnh trên.</p>
                      <p>• Hoặc nếu máy bạn đã có Node.js: <code className="text-teal-700 dark:text-teal-300 font-mono">npm install -g @google/antigravity-cli</code></p>
                      <p>• Thư mục cài đặt mặc định trên Windows: <code className="text-teal-700 dark:text-teal-300 font-mono">%USERPROFILE%\.gemini\antigravity-cli\agy.exe</code></p>
                    </div>
                  </div>

                  {/* Step 2: Auth Windows */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          2
                        </span>
                        Đăng nhập tài khoản Google (OAuth Web Login)
                      </span>
                      <button
                        onClick={() => handleCopy("agy auth login", "win-2")}
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-2" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-2" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>agy auth login</code>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <p>• Nếu PowerShell báo chưa tìm thấy lệnh, hãy dùng đường dẫn đầy đủ: <code className="text-teal-700 dark:text-teal-300 font-mono">&amp; "$env:USERPROFILE\.gemini\antigravity-cli\agy.exe" auth login</code></p>
                      <p>• Trình duyệt Edge/Chrome sẽ mở trang đăng nhập Google để bạn xác thực tài khoản Gmail (miễn phí hoặc Plus).</p>
                    </div>
                  </div>

                  {/* Step 3: Test Windows */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          3
                        </span>
                        Chạy thử nghiệm lệnh phân tích trên PowerShell
                      </span>
                      <button
                        onClick={() =>
                          handleCopy('agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"', "win-3")
                        }
                        className="text-xs text-slate-500 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-300 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-3" ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-3" ? "Đã copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"</code>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      Khi nhận được phản hồi câu chào từ Gemini, CLI đã hoạt động thành công trên máy Windows của bạn.
                    </p>
                  </div>

                  {/* Step 4: Configure App on Windows */}
                  <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-mono">
                          4
                        </span>
                        Cấu hình & Kết nối trong MyEnglish (Windows)
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-2 leading-relaxed">
                      <p>
                        Ứng dụng MyEnglish tự động quét các vị trí cài đặt phổ biến trên Windows:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-teal-700 dark:text-teal-300">
                        <li>%USERPROFILE%\.gemini\antigravity-cli\agy.exe</li>
                        <li>%LOCALAPPDATA%\Programs\antigravity\agy.exe</li>
                        <li>%APPDATA%\npm\agy.cmd (nếu cài qua npm)</li>
                        <li>Biến môi trường PATH hệ thống (lệnh where agy.exe)</li>
                      </ul>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 md:border border-slate-200 dark:border-zinc-700 space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                          Nếu bạn cài đặt ở thư mục tùy chỉnh (Ví dụ ổ D:\tools\agy.exe):
                        </p>
                        <p className="text-slate-600 dark:text-zinc-400">
                          Hãy dán đường dẫn file <code className="font-mono text-teal-700 dark:text-teal-300">agy.exe</code> vào ô <strong>"Đường dẫn CLI tùy chỉnh"</strong> ở trên và bấm <strong>"Lưu &amp; Kiểm tra"</strong>.
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400">
                        💡 <em>Lưu ý: Trên Windows, ứng dụng MyEnglish đã được tích hợp cờ <code className="font-mono text-slate-700 dark:text-zinc-300">CREATE_NO_WINDOW</code>, bảo đảm hoàn toàn không xuất hiện cửa sổ Command Prompt màu đen nhấp nháy khi bạn tra từ.</em>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
        )}
      </SettingsSection>

      {/* 5. THUẬT TOÁN LỊCH ÔN: nâng cao, đã có sẵn cấu hình mặc định */}
      <SettingsSection
        id="algorithm"
        tone="muted"
        icon={<Brain className="w-5 h-5" />}
        title="Lịch ôn thông minh (nâng cao)"
        description="Mục tiêu ghi nhớ, khoảng ôn dài nhất, tối ưu theo trí nhớ của bạn. Mặc định đã tốt, ít khi cần đổi."
        summary={`Mục tiêu ghi nhớ ${Math.round(fsrsSettings.requestRetention * 100)}%`}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-4 md:shadow-sm`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-semibold text-sm">
                <Zap className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                <span>Lịch ôn thông minh</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 font-semibold">
                Đang bật
              </span>
            </div>

            {/* Retention Control Widget */}
            <div className="p-3 md:p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Mục tiêu ghi nhớ
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Xác suất bạn muốn nhớ được từ khi đến ngày hẹn ôn tập. Mặc định 90% (tối ưu nhất).
                  </p>
                </div>
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300 font-mono">
                  {Math.round(fsrsSettings.requestRetention * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0.8, 0.85, 0.9, 0.95].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      saveFSRSSettings({ requestRetention: val });
                      setFsrsSettings((prev) => ({ ...prev, requestRetention: val }));
                      setNotifFeedback(`Đã cập nhật mục tiêu ghi nhớ thành ${Math.round(val * 100)}%!`);
                    }}
                    className={`min-h-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${fsrsSettings.requestRetention === val
                        ? "bg-teal-700 text-white shadow-sm font-bold dark:bg-teal-600"
                        : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                      }`}
                  >
                    {Math.round(val * 100)}%{val === 0.9 ? " (Chuẩn)" : ""}
                  </button>
                ))}
              </div>
            </div>

            <AdvancedLearningSettings />

            <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-2 leading-relaxed">
              <p>
                <strong>1. Không bị kẹt ở chu kỳ ngắn:</strong> Khi bạn quên một từ, app tự tính lại khoảng ôn cho từ đó theo độ khó và độ chắc của nó, chứ không bắt từ đó lặp lại dày mãi.
              </p>
              <p>
                <strong>2. Ít lượt ôn hơn:</strong> Khoảng cách ôn được tính theo đường cong quên của trí nhớ, giúp bạn nhớ lâu hơn mà tốn ít thời gian lặp lại hơn.
              </p>
              <p>
                <strong>3. Nhắc ôn khi app đang mở:</strong> Khi MyEnglish đang mở (hoặc thu nhỏ), app tự kiểm tra định kỳ theo số phút bạn chọn ở phần Nhắc học để nhắc bạn ôn kịp lúc.
              </p>
              <details className="pt-1">
                <summary className="cursor-pointer select-none min-h-10 inline-flex items-center font-semibold text-slate-700 dark:text-zinc-300">Tên kỹ thuật (cho người muốn tìm hiểu thêm)</summary>
                <p className="pt-1 text-slate-600 dark:text-zinc-400">
                  Thuật toán là FSRS: nó mô hình hóa trí nhớ bằng 3 chỉ số (độ khó, độ bền, khả năng nhớ lại), thay cho hệ số cố định của thuật toán cũ SM-2 vốn hay làm từ khó bị lặp dày mãi.
                </p>
              </details>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* 6. DỮ LIỆU & ĐẶT LẠI */}
      <SettingsSection
        id="data"
        tone="muted"
        icon={<Database className="w-5 h-5" />}
        title="Dữ liệu & đặt lại"
        description="Sao lưu, khôi phục tiến trình học, hoặc xóa hết để bắt đầu lại."
        defaultOpen={false}
      >
        <BackupRestoreSettings onWordsChanged={onRefreshWords} />
        <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-4 md:shadow-sm`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>Đặt lại ứng dụng từ đầu</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Xóa toàn bộ quá trình học, lịch sử ôn tập, từ vựng cá nhân, chuỗi ngày học liên tiếp và điểm XP.
                Ứng dụng sẽ tự động nạp lại trọn bộ 5.000 từ vựng Oxford và 31 chương ngữ pháp, sau đó mở lại màn hình khảo sát ban đầu (chọn trình độ, thì bắt đầu học, kế hoạch mỗi ngày).
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="min-h-12 px-5 py-2.5 rounded-2xl border border-red-200 dark:border-red-500/40 bg-white hover:bg-red-50 dark:bg-transparent dark:hover:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-semibold flex items-center gap-2 shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại dữ liệu...</span>
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* 7. GÓP Ý: nhắn cho người làm app (lỗi, nội dung sai, ý tưởng) */}
      <SettingsSection
        id="feedback"
        icon={<MessageSquareHeart className="w-5 h-5" />}
        title="Góp ý cho app"
        description="Gặp lỗi, thấy bài sai, hay muốn app có thêm gì? Nhắn thẳng cho người làm app."
        defaultOpen={false}
      >
        <FeedbackForm />
      </SettingsSection>

      {/* 8. CÔNG CỤ CHO NHÀ PHÁT TRIỂN: thu gọn, người học không cần dùng */}
      {SHOW_DEV_TOOLS && (
      <details className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 p-3.5 md:p-4">
        <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-zinc-400">
          Công cụ cho nhà phát triển (kiểm thử thông báo, tạo từ đến hạn)
        </summary>
        <div className="mt-4 space-y-4">
          <div className={`${SETTINGS_GROUP} md:p-5 md:first:pt-5 md:rounded-2xl md:bg-white md:dark:bg-zinc-900 space-y-4 md:shadow-sm`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-teal-700 dark:text-teal-300" />
              <span>Trung tâm kiểm tra thực tế (Testing Center)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {/* Test 1: Pop-up Focus Review (desktop only: a phone has no popup window) */}
              {!IS_MOBILE && (
                <div className="p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                      <span>Test 1: Pop-up Quiz toàn màn hình</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-snug pt-1">
                      Bật ngay cửa sổ làm mờ toàn màn hình. Bạn có thể nhấn <strong>Esc</strong> để tắt nhanh, dùng phím <strong>1-4</strong> để chọn, hoặc <strong>S</strong> để hoãn.
                    </p>
                  </div>
                  <button
                    onClick={handleTestPopupQuiz}
                    disabled={testingPopup}
                    className="min-h-11 w-full py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Zap className={`w-3.5 h-3.5 ${testingPopup ? "animate-bounce" : ""}`} />
                    <span>{testingPopup ? "Đang mở..." : "Bật thử Pop-up Quiz ngay"}</span>
                  </button>
                </div>
              )}

              {/* Test 2: Native Desktop Notification */}
              <div className="p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                    <span>Test 2: Gửi thông báo thử</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-snug pt-1">
                    Gửi một thông báo thử lên màn hình hệ thống (trên macOS kèm tiếng chuông "Glass").
                  </p>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testingNotif}
                  className="min-h-11 w-full py-2.5 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent hover:bg-teal-50 dark:hover:bg-teal-400/10 disabled:opacity-40 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Bell className={`w-3.5 h-3.5 ${testingNotif ? "animate-bounce" : ""}`} />
                  <span>{testingNotif ? "Đang gửi..." : "Gửi thông báo thử"}</span>
                </button>
              </div>

              {/* Test 3: Mark word due in SQLite */}
              <div className="p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span>Test 3: Tạo từ đến hạn ôn tập thật</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-snug pt-1">
                    Đặt 1 từ trong SQLite về quá hạn để kiểm tra thuật toán tự động nhận diện từ đến hạn.
                  </p>
                </div>
                <button
                  onClick={handleMarkDueTest}
                  disabled={testingDueWord}
                  className="min-h-11 w-full py-2.5 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent hover:bg-teal-50 dark:hover:bg-teal-400/10 disabled:opacity-40 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{testingDueWord ? "Đang thiết lập..." : "Đặt 1 từ thành 'Cần ôn ngay'"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </details>
      )}

      <ResetAppDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}

/** Whole seconds to the next reminder, as "12m 05s" */
function formatCountdown(totalSec: number) {
  if (totalSec <= 0) return "Đang đến giờ hiển thị!";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

/** Counts down by itself, so the page does not re-render every second */
function ReminderCountdown({ nextMs }: { nextMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatCountdown(Math.max(0, Math.ceil((nextMs - now) / 1000)))}</>;
}

/** Why the clock reminder is not showing now, in the same order as the reminder worker (srs.ts) */
function getPauseReason(settings: ReminderSettings, goalMet: boolean): string | null {
  if (isSnoozed()) {
    const until = new Date(settings.snoozedUntil ?? 0).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `đang hoãn đến ${until}`;
  }
  if (isMainSessionActive()) return "bạn đang ôn trong cửa sổ chính";
  const pause = reminderPause(settings, {
    hour: new Date().getHours(),
    goalReached: goalMet,
    shownToday: getNudgesShownToday(),
  });
  if (pause === "night") return `ban đêm (${NIGHT_QUIET_START}:00–${String(NIGHT_QUIET_END).padStart(2, "0")}:00)`;
  if (pause === "goal_reached") return "đã đạt mục tiêu hôm nay";
  if (pause === "daily_cap") return "đủ số lần nhắc hôm nay";
  return null;
}
