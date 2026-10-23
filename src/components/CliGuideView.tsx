import DisplaySettings from "./dashboard/DisplaySettings";
import SettingsSection from "./dashboard/SettingsSection";
import { FOCUS_DURATIONS, getFocusSettings, saveFocusSettings } from "@/services/focusSettings";
import AdvancedLearningSettings from "./dashboard/AdvancedLearningSettings";
import ResetAppDataModal from "./dashboard/ResetAppDataModal";
import Jargon from "./Jargon";
import { isPretestEnabled, setPretestEnabled } from "@/services/pretest";
import { ANCHOR_TIMES, getQuietHours, type ReminderAnchor } from "@/services/reminderMoments";
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
import { isMobilePlatform } from "@/lib/platform";
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

const IS_MOBILE = isMobilePlatform();
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
  onNavigateTab?: (tab: "library" | "capture" | "review" | "analytics" | "guide" | "grammar") => void;
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
    if (!ms || ms <= 0) return "ChÆ°a tá»«ng hiá»ƒn thá»‹";
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
      setApiKeyMessage({ ok: true, text: "ÄÃ£ kiá»ƒm tra vÃ  lÆ°u key. CÃ¡c tÃ­nh nÄƒng AI Ä‘Ã£ sáºµn sÃ ng." });
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
      setApiKeyMessage({ ok: true, text: "ÄÃ£ kiá»ƒm tra vÃ  Ä‘á»•i model." });
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
      setApiKeyMessage({ ok: true, text: "ÄÃ£ xÃ³a key. AI sáº½ dÃ¹ng CLI náº¿u báº¡n Ä‘Ã£ cÃ i." });
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
          ? "ÄÃ£ báº­t tá»± khá»Ÿi Ä‘á»™ng cÃ¹ng há»‡ Ä‘iá»u hÃ nh (máº·c Ä‘á»‹nh má»Ÿ khay há»‡ thá»‘ng)."
          : "ÄÃ£ táº¯t tá»± khá»Ÿi Ä‘á»™ng cÃ¹ng há»‡ Ä‘iá»u hÃ nh."
      );
    } else {
      setNotifFeedback("ÄÃ£ lÆ°u thiáº¿t láº­p vÃ o á»©ng dá»¥ng.");
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
    setNotifFeedback("ÄÃ£ lÆ°u thiáº¿t láº­p nháº¯c há»c vÃ  cáº­p nháº­t bá»™ Ä‘áº¿m thá»i gian!");
  };

  const handleTestPopupQuiz = async () => {
    setTestingPopup(true);
    setNotifFeedback(null);
    try {
      await triggerReviewPopup();
      setNotifFeedback(
        "ÄÃ£ kÃ­ch hoáº¡t Pop-up Focus Review toÃ n mÃ n hÃ¬nh! Báº¡n cÃ³ thá»ƒ nháº¥n Esc Ä‘á»ƒ táº¯t nhanh, dÃ¹ng phÃ­m 1-4 Ä‘á»ƒ chá»n Ä‘Ã¡p Ã¡n, hoáº·c báº¥m HoÃ£n (Snooze)."
      );
    } catch (e) {
      setNotifFeedback(`Lá»—i khi má»Ÿ pop-up: ${e}`);
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
          setNotifFeedback("Báº¡n chÆ°a cáº¥p quyá»n 'Xuáº¥t hiá»‡n trÃªn cÃ¹ng'. Äang má»Ÿ CÃ i Ä‘áº·t...");
          return;
        }
        const ok = await testMobileFloatingNudge();
        if (ok) {
          setNotifFeedback("ÄÃ£ hiá»ƒn thá»‹ Flash-Quiz ná»•i trÃªn mÃ n hÃ¬nh!");
          return;
        }
      }
      await triggerReviewNudge(5);
      setNotifFeedback("ÄÃ£ má»Ÿ tháº» nháº¯c Ã´n táº­p (Nudge)!");
    } catch (e) {
      setNotifFeedback(`Lá»—i khi má»Ÿ popup nháº¯c: ${e}`);
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
          setNotifFeedback("Báº¡n chÆ°a cáº¥p quyá»n 'Xuáº¥t hiá»‡n trÃªn cÃ¹ng'. Äang má»Ÿ CÃ i Ä‘áº·t...");
          return;
        }
        const ok = await testMobileFloatingNudgeIn(seconds);
        if (ok) {
          setNotifFeedback(`ÄÃ£ lÃªn lá»‹ch popup sau ${seconds}s! HÃ£y báº¥m nÃºt Home thoÃ¡t ra mÃ n hÃ¬nh chÃ­nh ngay.`);
          return;
        }
      }
      setNotifFeedback("TÃ­nh nÄƒng háº¹n giá» thá»­ chá»‰ Ã¡p dá»¥ng trÃªn Ä‘iá»‡n thoáº¡i.");
    } catch (e) {
      setNotifFeedback(`Lá»—i: ${e}`);
    } finally {
      setTestingNudge(false);
    }
  };

  const handleRequestOverlay = () => {
    const opened = requestOverlayPermission();
    if (opened) {
      setNotifFeedback("Äang má»Ÿ CÃ i Ä‘áº·t há»‡ thá»‘ng Ä‘á»ƒ cáº¥p quyá»n 'Xuáº¥t hiá»‡n trÃªn cÃ¹ng'...");
    } else {
      setNotifFeedback("Thiáº¿t bá»‹ Ä‘Ã£ Ä‘Æ°á»£c cáº¥p quyá»n hoáº·c khÃ´ng há»— trá»£.");
    }
  };

  const handleCancelSnooze = () => {
    cancelSnooze();
    setSnoozeMinutesRemaining(0);
    setNotifFeedback("ÄÃ£ há»§y tráº¡ng thÃ¡i hoÃ£n. Lá»‹ch nháº¯c há»c hoáº¡t Ä‘á»™ng bÃ¬nh thÆ°á»ng.");
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
      setNotifFeedback(`Lá»—i: ${e}`);
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
          `ÄÃ£ chuyá»ƒn tá»« "${word}" thÃ nh tráº¡ng thÃ¡i Ä‘áº¿n háº¡n Ã´n táº­p ngay! Báº¡n cÃ³ thá»ƒ nháº¥p vÃ o thÃ´ng bÃ¡o ná»•i bÃªn trÃªn hoáº·c má»Ÿ Daily Review.`
        );
      } else {
        setNotifFeedback("ThÆ° viá»‡n hiá»‡n chÆ°a cÃ³ tá»« vá»±ng nÃ o. HÃ£y thÃªm tá»« vá»±ng trÆ°á»›c.");
      }
    } catch (e) {
      setNotifFeedback(`Lá»—i: ${e}`);
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

  const anchorsActive = reminderSettings.enabled && reminderSettings.intervalMinutes > 0;
  // Why the clock reminder is not showing right now, or null
  const pauseReason =
    reminderSettings.enabled && reminderSettings.intervalMinutes > 0 ? getPauseReason(reminderSettings, goalMet) : null;

  return (
    <div className={`${PAGE_CONTAINER} space-y-8`}>

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">CÃ i Ä‘áº·t</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pháº§n quan trá»ng cho viá»‡c há»c á»Ÿ trÃªn cÃ¹ng; giao diá»‡n, AI vÃ  pháº§n nÃ¢ng cao Ä‘Æ°á»£c thu gá»n, cáº§n thÃ¬ má»Ÿ ra. Má»—i thay
            Ä‘á»•i Ä‘Æ°á»£c lÆ°u ngay.
          </p>
        </div>
      </div>

      {/* Jump to a section */}
      <nav className="-mt-4 flex flex-wrap gap-1.5" aria-label="CÃ¡c má»¥c cÃ i Ä‘áº·t">
        {(
          [
            ["study", "Há»c má»—i ngÃ y"],
            ["reminders", "Nháº¯c há»c"],
            ["display", "Giao diá»‡n & Ã¢m thanh"],
            ["ai", "AI"],
            ["algorithm", "Thuáº­t toÃ¡n lá»‹ch Ã´n"],
            ["data", "Dá»¯ liá»‡u"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Feedback alert message */}
      {notifFeedback && (
        <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-950 dark:text-cyan-200 flex items-start justify-between gap-3 animate-in fade-in flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notifFeedback}</span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("review")}
              className="shrink-0 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Má»Ÿ Daily Review ngay â†’</span>
            </button>
          )}
        </div>
      )}
      {/* 1. Há»ŒC Má»–I NGÃ€Y: what shapes the learning, first and highlighted */}
      <SettingsSection
        id="study"
        tone="primary"
        icon={<GraduationCap className="w-5 h-5" />}
        title="Há»c má»—i ngÃ y"
        description="Báº¡n há»c bao nhiÃªu má»—i ngÃ y: má»¥c tiÃªu, sá»‘ tá»« má»›i, Ä‘á»™ dÃ i má»™t phiÃªn."
        summary={`${dailyGoal} cÃ¢u/ngÃ y Â· ${studyLimits.newCardsPerDay} tháº» má»›i`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {/* Daily goal: the answers that count a day as done (streak, Today) */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500" /> Má»¥c tiÃªu má»—i ngÃ y
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Sá»‘ cÃ¢u tráº£ lá»i Ä‘á»ƒ tÃ­nh lÃ  Ä‘Ã£ há»c xong hÃ´m nay (giá»¯ chuá»—i ngÃ y há»c).</p>
              </div>
              <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{dailyGoal}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 15, 30, 45, 60].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setDailyGoal(g);
                    setDailyGoalState(g);
                    setNotifFeedback(`ÄÃ£ Ä‘áº·t má»¥c tiÃªu má»—i ngÃ y: ${g} cÃ¢u.`);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${dailyGoal === g
                      ? "bg-emerald-600 text-white shadow-sm font-bold"
                      : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Focus session length: what "Táº­p trung" starts everywhere */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-violet-500" /> Äá»™ dÃ i phiÃªn táº­p trung
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Báº¥m "Táº­p trung" á»Ÿ báº¥t ká»³ Ä‘Ã¢u sáº½ há»c trá»n chá»«ng nÃ y phÃºt, táº¯t nháº¯c nhá»Ÿ.</p>
              </div>
              <span className="text-sm font-bold font-mono text-violet-600 dark:text-violet-400">{focusMinutes}â€²</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {FOCUS_DURATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    saveFocusSettings({ minutes: m });
                    setFocusMinutes(m);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${focusMinutes === m
                      ? "bg-violet-600 text-white shadow-sm font-bold"
                      : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                    }`}
                >
                  {m} phÃºt
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Daily study limits */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
          {([
            {
              key: "newCardsPerDay" as const,
              title: "Sá»‘ tháº» má»›i má»—i ngÃ y",
              desc: "Gá»“m tá»« má»›i vÃ  lÆ°á»£t táº­p gÃµ láº¡i tá»« Ä‘Ã£ nhá»› (tháº» nhá»› láº¡i má»›i). Giá»¯ tháº¥p Ä‘á»ƒ lÆ°á»£ng Ã´n cÃ¡c ngÃ y sau khÃ´ng dá»“n á»©.",
              options: [3, 5, 8, 10, 20],
            },
            {
              key: "maxSessionSize" as const,
              title: "Sá»‘ tháº» tá»‘i Ä‘a má»—i phiÃªn",
              desc: "Tá»« Ä‘áº¿n háº¡n Ä‘Æ°á»£c Æ°u tiÃªn trÆ°á»›c, tá»« má»›i xen káº½ Ä‘á»u trong phiÃªn.",
              options: [20, 30, 40, 50, 100],
            },
          ]).map((cfg) => (
            <div key={cfg.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{cfg.title}</div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">{cfg.desc}</p>
                </div>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-mono">
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
                      setNotifFeedback(`ÄÃ£ cáº­p nháº­t "${cfg.title}" thÃ nh ${val}!`);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${studyLimits[cfg.key] === val
                        ? "bg-cyan-600 text-white shadow-sm font-bold"
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
              <div className="text-xs font-bold text-slate-900 dark:text-white">ÄoÃ¡n nghÄ©a trÆ°á»›c khi há»c tá»« má»›i</div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                TrÆ°á»›c tháº» giá»›i thiá»‡u, Ä‘oÃ¡n nghÄ©a tá»« trong má»™t cÃ¢u vÃ­ dá»¥ (3 lá»±a chá»n). ÄoÃ¡n trÆ°á»›c, ká»ƒ cáº£ Ä‘oÃ¡n sai, giÃºp nhá»› lÃ¢u hÆ¡n. KhÃ´ng tÃ­nh Ä‘iá»ƒm.
              </p>
            </div>
            <input
              type="checkbox"
              checked={pretestOn}
              onChange={(e) => {
                setPretestEnabled(e.target.checked);
                setPretestOn(e.target.checked);
              }}
              className="mt-1 accent-cyan-600"
            />
          </label>
        </div>
      </SettingsSection>

      {/* 2. NHáº®C Há»ŒC: khi nÃ o app nháº¯c báº¡n */}
      <SettingsSection
        id="reminders"
        icon={<Bell className="w-5 h-5" />}
        title="Nháº¯c há»c"
        description="Khi nÃ o app nháº¯c báº¡n Ã´n: má»—i bao lÃ¢u, vÃ o giá» nÃ o, giá» yÃªn tÄ©nh."
        summary={reminderSettings.enabled ? (reminderSettings.intervalMinutes > 0 ? `Báº­t Â· má»—i ${reminderSettings.intervalMinutes} phÃºt` : "Báº­t Â· theo giá» há»c") : "Äang táº¯t"}
      >
        <div className="space-y-6">
          {/* SECTION 0: AUTOSTART SYSTEM SETTING (desktop only) */}
          {!IS_MOBILE && (
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md shadow-rose-500/20">
                    <Power className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Tá»± khá»Ÿi Ä‘á»™ng cÃ¹ng há»‡ Ä‘iá»u hÃ nh
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Máº·c Ä‘á»‹nh: Báº­t
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Tá»± Ä‘á»™ng má»Ÿ MyEnglish khi khá»Ÿi Ä‘á»™ng mÃ¡y tÃ­nh Ä‘á»ƒ khÃ´ng bá» lá»¡ lá»‹ch nháº¯c tá»« vá»±ng vÃ  phÃ­m táº¯t tra tá»« nhanh
                    </p>
                  </div>
                </div>

                {/* Autostart Toggle */}
                <button
                  type="button"
                  disabled={togglingAutostart}
                  onClick={() => handleToggleAutostart(!autostart)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ${autostart
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${autostart ? "bg-white animate-pulse" : "bg-slate-400"
                      }`}
                  />
                  <span>
                    {togglingAutostart
                      ? "Äang cáº­p nháº­t..."
                      : autostart
                        ? "Tá»± khá»Ÿi Ä‘á»™ng: Báº­t"
                        : "Tá»± khá»Ÿi Ä‘á»™ng: Táº¯t"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: SETTINGS & SCHEDULE CONFIGURATION */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/20">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cáº¥u hÃ¬nh Lá»‹ch nháº¯c & Pop-up Quiz (Focus Review)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    TÃ¹y chá»‰nh táº§n suáº¥t nháº¯c nhá»Ÿ, thá»i gian hoÃ£n (Snooze), dáº¡ng cÃ¢u há»i vÃ  hiá»‡u á»©ng má» mÃ n hÃ¬nh
                  </p>
                </div>
              </div>

              {/* Master Toggle */}
              <button
                onClick={() => handleUpdateReminder({ enabled: !reminderSettings.enabled })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${reminderSettings.enabled
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${reminderSettings.enabled ? "bg-white animate-pulse" : "bg-slate-400"}`} />
                <span>{reminderSettings.enabled ? "Äang báº­t Pop-up" : "ÄÃ£ táº¡m dá»«ng"}</span>
              </button>
            </div>

            {/* Realtime Schedule & Countdown Card */}
            {/* On a phone the time shown is the next notification handed to Android, and the button opens the quick quiz in the app */}
            {reminderSettings.enabled && reminderSettings.intervalMinutes > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-purple-500/10 border border-cyan-200/80 dark:border-cyan-800/60 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold shrink-0">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    {pauseReason ? (
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Äang táº¡m dá»«ng: {pauseReason}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {IS_MOBILE ? "Nháº¯c káº¿ tiáº¿p:" : "Láº§n hiá»ƒn thá»‹ káº¿ tiáº¿p:"}
                        </span>
                        {IS_MOBILE && phoneNextMs === 0 ? (
                          <span className="text-xs text-slate-500 dark:text-zinc-400">
                            chÆ°a Ä‘áº·t: thoÃ¡t app ra mÃ n hÃ¬nh chÃ­nh má»™t láº§n Ä‘á»ƒ Ä‘áº·t nháº¯c
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100/80 dark:bg-cyan-950/80 px-2 py-0.5 rounded-md">
                              {formatDisplayTime(IS_MOBILE ? phoneNextMs : nextReminderMs)}
                            </span>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              (CÃ²n láº¡i: <ReminderCountdown nextMs={IS_MOBILE ? phoneNextMs : nextReminderMs} />)
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {IS_MOBILE ? (
                        <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                          Nháº¯c cÃ¡ch nhau khoáº£ng {reminderGapMinutes(reminderSettings)} phÃºt ban ngÃ y (tá»‘i Ä‘a {reminderSettings.maxNudgesPerDay || "khÃ´ng giá»›i háº¡n"} láº§n/ngÃ y), ká»ƒ cáº£ khi Ä‘Ã£ Ä‘Ã³ng app
                        </span>
                      ) : (
                        <>
                          Láº§n hiá»ƒn thá»‹ gáº§n nháº¥t: <strong className="text-slate-700 dark:text-zinc-300 font-mono">{formatDisplayTime(lastDisplayMs)}</strong>
                          <span className="ml-2 text-cyan-600 dark:text-cyan-400 font-medium">
                            â€¢ Chu ká»³: {reminderSettings.intervalMinutes} phÃºt (tÃ­nh tá»« láº§n cuá»‘i popup hiá»ƒn thá»‹)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={handleTestNudge}
                    disabled={testingNudge}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                    title="Má»Ÿ popup nháº¯c nhá» cÃ³ kÃ¨m 1 cÃ¢u quiz"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{testingNudge ? "Äang má»Ÿ..." : "Thá»­ Popup ná»•i"}</span>
                  </button>
                  <button
                    onClick={handleTestPopupQuiz}
                    disabled={testingPopup}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-all border border-slate-300 dark:border-zinc-700 flex items-center gap-1.5 shrink-0"
                  >
                    <span>{testingPopup ? "Äang má»Ÿ..." : "ToÃ n mÃ n hÃ¬nh"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Android: Floating Overlay Permission Banner */}
            {IS_MOBILE && !hasOverlayPermission && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="text-xl shrink-0">ðŸ¦‰</span>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Quyá»n hiá»ƒn thá»‹ trÃªn á»©ng dá»¥ng khÃ¡c chÆ°a báº­t</div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                      Báº­t quyá»n Ä‘á»ƒ tháº» nháº¯c Ã´n táº­p & 1 cÃ¢u quiz cÃ³ thá»ƒ xuáº¥t hiá»‡n ná»•i trÃªn mÃ n hÃ¬nh khi báº¡n Ä‘ang má»Ÿ app khÃ¡c.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRequestOverlay}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  Cáº¥p quyá»n hiá»ƒn thá»‹ ná»•i
                </button>
              </div>
            )}

            {IS_MOBILE && hasOverlayPermission && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="text-sm">âœ“</span>
                  <span>ÄÃ£ báº­t quyá»n hiá»ƒn thá»‹ tháº» nháº¯c ná»•i trÃªn cÃ¡c á»©ng dá»¥ng khÃ¡c</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    onClick={() => handleTestNudgeIn(5)}
                    disabled={testingNudge}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-semibold text-[11px] transition-colors whitespace-nowrap shadow-sm"
                  >
                    Thá»­ sau 5s (thoÃ¡t app)
                  </button>
                  <button
                    onClick={handleTestNudge}
                    disabled={testingNudge}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors whitespace-nowrap"
                  >
                    {testingNudge ? "Äang má»Ÿ..." : "Thá»­ popup ngay"}
                  </button>
                </div>
              </div>
            )}

            {/* Active Snooze Alert if currently snoozed */}
            {snoozeMinutesRemaining > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <Hourglass className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin-slow shrink-0" />
                  <span>
                    Äang trong thá»i gian hoÃ£n (Snooze): CÃ²n khoáº£ng{" "}
                    <strong>{snoozeMinutesRemaining} phÃºt</strong> trÆ°á»›c láº§n nháº¯c káº¿ tiáº¿p.
                  </span>
                </div>
                <button
                  onClick={handleCancelSnooze}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  Há»§y hoÃ£n ngay
                </button>
              </div>
            )}

            {/* SETTING FIELDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Field 1: Reminder Interval */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Khoáº£ng thá»i gian nháº¯c há»c:
                  </span>
                  <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {reminderSettings.intervalMinutes === 0 ? "Chá»‰ má»Ÿ thá»§ cÃ´ng" : `Má»—i ${reminderSettings.intervalMinutes} phÃºt`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([15, 30, 45, 60, 120, 0] as ReminderInterval[]).map((val) => {
                    const isSelected = reminderSettings.intervalMinutes === val;
                    const label = val === 0 ? "Táº¯t tá»± Ä‘á»™ng" : val >= 60 ? `${val / 60} giá»` : `${val} phÃºt`;
                    return (
                      <button
                        key={val}
                        onClick={() => handleUpdateReminder({ intervalMinutes: val })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-cyan-500"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                  KhuyÃªn dÃ¹ng: <strong>30 phÃºt</strong> Ä‘á»ƒ vá»«a táº­p trung lÃ m viá»‡c vá»«a duy trÃ¬ nhá»‹p Ã´n táº­p Ä‘á»u Ä‘áº·n.
                </p>
              </div>

              {/* Field 2: Snooze Duration */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                    Thá»i gian HoÃ£n há»c (Snooze):
                  </span>
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {reminderSettings.snoozeMinutes} phÃºt
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([5, 10, 15, 30] as SnoozeDuration[]).map((val) => {
                    const isSelected = reminderSettings.snoozeMinutes === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleUpdateReminder({ snoozeMinutes: val })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-amber-500"
                          }`}
                      >
                        {val} phÃºt
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                  Khi Ä‘ang báº­n, báº¡n chá»‰ cáº§n báº¥m nÃºt <strong>HoÃ£n [S]</strong> trÃªn pop-up Ä‘á»ƒ dá»i thá»i Ä‘iá»ƒm Ã´n.
                </p>
              </div>

              {/* Field: fixed study times, e.g. after lunch (the reminder worker only acts on them when the popup is on) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Giá» há»c cá»‘ Ä‘á»‹nh:
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Nháº¯c Ä‘Ãºng lÃºc báº¡n hay há»c trong ngÃ y, má»—i má»‘c má»™t láº§n má»—i ngÃ y. Má»‘c nÃ y khÃ´ng bá»‹ giá»›i háº¡n sá»‘ láº§n nháº¯c tá»‘i Ä‘a.
                </p>
                <div className="space-y-1.5">
                  {(Object.keys(ANCHOR_TIMES) as ReminderAnchor[]).map((anchor) => {
                    const chosen = (reminderSettings.anchors ?? []).includes(anchor);
                    return (
                      <label
                        key={anchor}
                        className={`flex items-center gap-2 text-xs ${anchorsActive
                            ? "cursor-pointer text-slate-700 dark:text-zinc-300"
                            : "text-slate-400 dark:text-zinc-500"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-cyan-600"
                          checked={chosen}
                          disabled={!anchorsActive}
                          onChange={(e) => {
                            const current = reminderSettings.anchors ?? [];
                            handleUpdateReminder({
                              anchors: e.target.checked ? [...current, anchor] : current.filter((a) => a !== anchor),
                            });
                          }}
                        />
                        <span>{ANCHOR_TIMES[anchor].label}</span>
                      </label>
                    );
                  })}
                </div>
                {!anchorsActive && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                    Chá»‰ cÃ³ tÃ¡c dá»¥ng khi báº­t pop-up vÃ  chá»n má»™t khoáº£ng thá»i gian nháº¯c (khÃ´ng pháº£i &quot;Táº¯t tá»± Ä‘á»™ng&quot;).
                  </p>
                )}
              </div>

              {/* Field 3: Trigger Condition */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                  Äiá»u kiá»‡n kÃ­ch hoáº¡t hiá»ƒn thá»‹:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "due_only" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "due_only"
                        ? "border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-200 ring-1 ring-cyan-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">Chá»‰ khi cÃ³ tá»« Ä‘áº¿n háº¡n (FSRS)</span>
                    <span className="text-[10px] opacity-75">TÃ´n trá»ng chu ká»³ phÃ¢n bá»• khoa há»c</span>
                  </button>

                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "due_then_random" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "due_then_random"
                        ? "border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-200 ring-1 ring-cyan-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">Äáº¿n háº¡n â†’ Háº¿t thÃ¬ ngáº«u nhiÃªn</span>
                    <span className="text-[10px] opacity-75">Æ¯u tiÃªn Ä‘Ãºng háº¡n, háº¿t thÃ¬ Ã´n thÃªm</span>
                  </button>

                  <button
                    onClick={() => handleUpdateReminder({ triggerCondition: "all_words" })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${reminderSettings.triggerCondition === "all_words"
                        ? "border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-200 ring-1 ring-cyan-500"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      }`}
                  >
                    <span className="text-xs font-bold">LuÃ´n nháº¯c nhá»Ÿ ngáº«u nhiÃªn</span>
                    <span className="text-[10px] opacity-75">Duy trÃ¬ pháº£n xáº¡ tá»« vá»±ng liÃªn tá»¥c</span>
                  </button>
                </div>
              </div>

              {/* Field 3b: Do not disturb */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      KhÃ´ng lÃ m phiá»n khi Ä‘ang báº­n
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Tá»± hoÃ£n pop-up khi cÃ³ á»©ng dá»¥ng toÃ n mÃ n hÃ¬nh (trÃ¬nh chiáº¿u, video, há»p), khi Ä‘ang chia sáº» mÃ n
                      hÃ¬nh Zoom, khi báº­t Focus/KhÃ´ng lÃ m phiá»n (náº¿u macOS cho phÃ©p Ä‘á»c) hoáº·c khi báº¡n rá»i mÃ¡y quÃ¡ 5
                      phÃºt. Khi Ä‘áº¿n giá», má»™t tháº» nhá» hiá»‡n á»Ÿ gÃ³c mÃ n hÃ¬nh (khÃ´ng chiáº¿m bÃ n phÃ­m) lÃºc báº¡n táº¡m dá»«ng
                      thao tÃ¡c; bá» qua thÃ¬ tháº» tá»± hoÃ£n sau 20 giÃ¢y, báº¥m Há»c ngay Ä‘á»ƒ má»Ÿ bÃ i Ã´n.
                    </span>
                    {!IS_MAC && (
                      <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400 pt-1">
                        Hiá»‡n chá»‰ hoáº¡t Ä‘á»™ng trÃªn macOS.
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.respectFocus}
                    onChange={(e) => handleUpdateReminder({ respectFocus: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      LuÃ´n hiá»‡n trÃªn mÃ n hÃ¬nh chÃ­nh
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Máº·c Ä‘á»‹nh nháº¯c nhá»Ÿ hiá»‡n trÃªn mÃ n hÃ¬nh báº¡n Ä‘ang lÃ m viá»‡c (nÆ¡i cÃ³ con trá» chuá»™t).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.preferPrimaryMonitor}
                    onChange={(e) => handleUpdateReminder({ preferPrimaryMonitor: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Nháº¯c vÃ o lÃºc chuyá»ƒn viá»‡c
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      NgoÃ i chu ká»³ trÃªn, nháº¯c sá»›m hÆ¡n vÃ o lÃºc báº¡n vá»«a quay láº¡i mÃ¡y (buá»•i sÃ¡ng, sau khi rá»i mÃ¡y hoáº·c
                      mÃ¡y ngá»§), vá»«a táº¯t chia sáº» mÃ n hÃ¬nh hoáº·c vá»«a thoÃ¡t á»©ng dá»¥ng toÃ n mÃ n hÃ¬nh. Chá»‰ khi cÃ³ tháº» cáº§n Ã´n,
                      vÃ  cÃ¡ch lá»i nháº¯c trÆ°á»›c Ã­t nháº¥t 20 phÃºt.
                    </span>
                    {!IS_MAC && (
                      <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400 pt-1">
                        Hiá»‡n chá»‰ hoáº¡t Ä‘á»™ng trÃªn macOS.
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.contextMoments}
                    onChange={(e) => handleUpdateReminder({ contextMoments: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      NÃ© giá» báº¡n hay bá» qua lá»i nháº¯c
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Há»c tá»« 30 ngÃ y gáº§n nháº¥t: giá» nÃ o lá»i nháº¯c gáº§n nhÆ° luÃ´n bá»‹ hoÃ£n hoáº·c bá» qua thÃ¬ khÃ´ng nháº¯c theo
                      chu ká»³ vÃ o giá» Ä‘Ã³ (lá»i nháº¯c lÃºc chuyá»ƒn viá»‡c váº«n hiá»‡n).
                      {getQuietHours().length > 0 && ` Hiá»‡n Ä‘ang nÃ©: ${getQuietHours().map((h) => `${h}h`).join(", ")}.`}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.avoidQuietHours}
                    onChange={(e) => handleUpdateReminder({ avoidQuietHours: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Xong má»¥c tiÃªu ngÃ y thÃ¬ thÃ´i nháº¯c
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Äáº¡t má»¥c tiÃªu hÃ´m nay rá»“i thÃ¬ nghá»‰, mai nháº¯c tiáº¿p. Báº¡n váº«n cÃ³ thá»ƒ tá»± má»Ÿ bÃ i Ã´n báº¥t cá»© lÃºc nÃ o.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.stopAfterGoal}
                    onChange={(e) => handleUpdateReminder({ stopAfterGoal: e.target.checked })}
                  />
                </label>
                <label className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      KhÃ´ng nháº¯c ban Ä‘Ãªm ({NIGHT_QUIET_START}:00â€“{String(NIGHT_QUIET_END).padStart(2, "0")}:00)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Ngá»§ Ä‘á»§ giÃºp nhá»› tá»« tá»‘t hÆ¡n há»c khuya.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-600 shrink-0"
                    checked={reminderSettings.nightQuiet}
                    onChange={(e) => handleUpdateReminder({ nightQuiet: e.target.checked })}
                  />
                </label>
                <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-start justify-between gap-3">
                  <span className="space-y-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Tá»‘i Ä‘a sá»‘ láº§n nháº¯c má»—i ngÃ y
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-snug">
                      Nháº¯c quÃ¡ nhiá»u dá»… thÃ nh thÃ³i quen báº¥m bá» qua.
                    </span>
                  </span>
                  <select
                    className="text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 shrink-0"
                    value={reminderSettings.maxNudgesPerDay}
                    onChange={(e) => handleUpdateReminder({ maxNudgesPerDay: Number(e.target.value) })}
                  >
                    {[4, 6, 8, 12, 0].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "KhÃ´ng giá»›i háº¡n" : `${n} láº§n`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 4: Words per Session */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Sá»‘ lÆ°á»£ng tá»« má»—i láº§n Pop-up:
                  </span>
                  <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {reminderSettings.wordsPerSession} tá»« / phiÃªn
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { count: 3, label: "3 tá»«", desc: "~15s nhanh" },
                    { count: 5, label: "5 tá»«", desc: "~30s chuáº©n" },
                    { count: 10, label: "10 tá»«", desc: "~1p sÃ¢u" },
                  ].map((item) => {
                    const isSelected = reminderSettings.wordsPerSession === item.count;
                    return (
                      <button
                        key={item.count}
                        onClick={() => handleUpdateReminder({ wordsPerSession: item.count })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center flex flex-col items-center gap-0.5 ${isSelected
                            ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-cyan-500"
                          }`}
                      >
                        <span className="font-bold">{item.label}</span>
                        <span className={`text-[10px] ${isSelected ? "text-cyan-100" : "text-slate-400 dark:text-zinc-500"}`}>
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                  CÃ¡c cÃ¢u há»i trong phiÃªn pop-up Ä‘Æ°á»£c tá»± Ä‘á»™ng phÃ¢n bá»• ngáº«u nhiÃªn giá»¯a tráº¯c nghiá»‡m 1-4, gÃµ tá»« vá»±ng vÃ  tá»± Ä‘á»™ng xen káº½ cÃ¡c bÃ i ngá»¯ phÃ¡p Ä‘Ã£ há»c.
                </p>
              </div>

              {/* Field 5: Fullscreen Overlay Blur Level & Audio Policy */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                    Äá»™ má» mÃ n hÃ¬nh (Backdrop Blur):
                  </span>
                  <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    {reminderSettings.blurOverlay === "light" ? "Má» nháº¹" : reminderSettings.blurOverlay === "heavy" ? "Má» Ä‘áº­m" : "Má» vá»«a"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "medium", "heavy"] as BlurOverlayLevel[]).map((level) => {
                    const isSelected = reminderSettings.blurOverlay === level;
                    const label = level === "light" ? "Má» nháº¹" : level === "heavy" ? "Má» Ä‘áº­m" : "Má» vá»«a";
                    return (
                      <button
                        key={level}
                        onClick={() => handleUpdateReminder({ blurOverlay: level })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all text-center ${isSelected
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-indigo-500"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  <span>ÄÃ£ táº¯t Ã¢m thanh tá»± Ä‘á»™ng khi hiá»ƒn thá»‹ tá»« Ä‘á»ƒ khÃ´ng lÃ m phiá»n báº¡n.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* 3. GIAO DIá»†N: cháº¿ Ä‘á»™, cá»¡ chá»¯, Ã¢m thanh, giá»ng Ä‘á»c */}
      <SettingsSection
        id="display"
        icon={<Palette className="w-5 h-5" />}
        title="Giao diá»‡n, Ã¢m thanh & giá»ng Ä‘á»c"
        description="Cháº¿ Ä‘á»™ Ä‘Æ¡n giáº£n, cháº¿ Ä‘á»™ máº¥t gá»‘c, cá»¡ chá»¯, Ã¢m thanh pháº£n há»“i, giá»ng Ä‘á»c tiáº¿ng Anh."
        defaultOpen={false}
      >
        <DisplaySettings />
      </SettingsSection>

      {/* 4. AI: khÃ´ng báº¯t buá»™c Ä‘á»ƒ há»c, thu gá»n */}
      <SettingsSection
        id="ai"
        tone="muted"
        icon={<Bot className="w-5 h-5" />}
        title="AI (khÃ´ng báº¯t buá»™c)"
        description="Chá»‰ cáº§n cho cÃ¡c tÃ­nh nÄƒng AI nhÆ° Viáº¿t vÃ  sá»­a lá»—i. KhÃ´ng cÃ³ AI báº¡n váº«n há»c bÃ¬nh thÆ°á»ng."
        summary={!cliStatus ? "Äang kiá»ƒm traâ€¦" : cliStatus.installed ? "â— ÄÃ£ káº¿t ná»‘i" : "â—‹ ChÆ°a káº¿t ná»‘i"}
        defaultOpen={false}
      >
        <div className="space-y-6">
          {/* AI CLI status: information only. Without it the app still works; only the AI features are off */}
          <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cliStatus?.installed
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                  }`}
              >
                {cliStatus?.installed ? <CheckCircle2 className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Tráº¡ng thÃ¡i AI (API key hoáº·c CLI):
                  </span>
                  <span
                    className={`text-xs font-semibold font-mono px-2.5 py-0.5 rounded-full border ${cliStatus?.installed
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                      }`}
                  >
                    {cliStatus === null ? "â—‹ ÄANG KIá»‚M TRA" : cliStatus.installed ? "â— ÄÃƒ Káº¾T Ná»I" : "â—‹ CHÆ¯A Káº¾T Ná»I"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {cliStatus?.installed
                    ? "Sáºµn sÃ ng cho cÃ¡c tÃ­nh nÄƒng AI."
                    : "Báº¡n váº«n há»c bÃ¬nh thÆ°á»ng khi chÆ°a cÃ³. Chá»‰ cÃ¡c tÃ­nh nÄƒng AI (nhÆ° Viáº¿t vÃ  sá»­a lá»—i) cáº§n API key hoáº·c AI CLI."}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  ÄÆ°á»ng dáº«n:{" "}
                  <span className="text-slate-800 dark:text-zinc-200 font-bold">
                    {cliStatus?.path || "~/.gemini/antigravity-cli"}
                  </span>
                </p>
                {cliStatus?.details && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">âœ“ {cliStatus.details}</p>
                )}
                {cliStatus?.error && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Chi tiáº¿t: {cliStatus.error}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => checkCli()}
              disabled={checkingCli}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingCli ? "animate-spin" : ""}`} />
              <span>Kiá»ƒm tra láº¡i káº¿t ná»‘i</span>
            </button>
          </div>

          {/* Gemini API key: the easy way, no CLI to install. Stored in the OS credential store by the Rust side */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Key className="w-4 h-4" />
                <span>CÃ¡ch Ä‘Æ¡n giáº£n: dÃ¹ng Gemini API key</span>
              </div>
              {apiKeyStatus?.configured && (
                <span className="text-xs font-semibold font-mono px-2.5 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  â— ÄÃƒ LÆ¯U (â€¦{apiKeyStatus.hint})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              KhÃ´ng cáº§n cÃ i CLI hay Ä‘Äƒng nháº­p Google. DÃ¡n API key miá»…n phÃ­ vÃ o Ä‘Ã¢y, má»i tÃ­nh nÄƒng AI sáº½ gá»i tháº³ng Gemini.
              Key Ä‘Æ°á»£c lÆ°u {IS_MOBILE ? "trong bá»™ nhá»› riÃªng cá»§a á»©ng dá»¥ng trÃªn Ä‘iá»‡n thoáº¡i" : `trong kho khÃ³a cá»§a há»‡ Ä‘iá»u hÃ nh (${IS_MAC ? "Keychain" : "Windows Credential Manager"})`}, khÃ´ng náº±m trong dá»¯ liá»‡u há»c hay file sao lÆ°u.
              Khi dÃ¹ng AI, ná»™i dung tá»« vá»±ng vÃ  cÃ¢u báº¡n viáº¿t sáº½ Ä‘Æ°á»£c gá»­i tá»›i Google.
            </p>

            <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">CÃ¡ch láº¥y Gemini API Key:</h4>
              <ol className="text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 list-decimal pl-5 leading-relaxed">
                <li>
                  Truy cáº­p vÃ o trang{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 underline font-semibold inline-flex items-center gap-1"
                  >
                    Google AI Studio (aistudio.google.com)
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>ÄÄƒng nháº­p báº±ng tÃ i khoáº£n Google (Gmail thÃ´ng thÆ°á»ng miá»…n phÃ­).</li>
                <li>Báº¥m nÃºt <strong>&quot;Create API key&quot;</strong> vÃ  copy chuá»—i key táº¡o ra.</li>
                <li>DÃ¡n key vÃ o Ã´ bÃªn dÆ°á»›i rá»“i báº¥m <strong>LÆ°u &amp; Kiá»ƒm tra</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleSaveApiKey} autoComplete="off" className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={apiKeyStatus?.configured ? "DÃ¡n key má»›i Ä‘á»ƒ thay tháº¿ key Ä‘Ã£ lÆ°u" : "DÃ¡n Gemini API key (báº¯t Ä‘áº§u báº±ng AIzaâ€¦)"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors shrink-0"
                aria-pressed={showApiKey}
              >
                {showApiKey ? "áº¨n key" : "Hiá»‡n key"}
              </button>
              <button
                type="submit"
                disabled={savingApiKey || !apiKeyInput.trim()}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingApiKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Äang kiá»ƒm traâ€¦</span>
                  </>
                ) : (
                  <span>LÆ°u &amp; Kiá»ƒm tra</span>
                )}
              </button>
              {apiKeyStatus?.configured && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  disabled={savingApiKey}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/40 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                >
                  XÃ³a key
                </button>
              )}
            </form>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <label htmlFor="ai-model-input" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 shrink-0">
                Model (tÃ¹y chá»n)
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
                className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {apiKeyStatus?.configured && (
                <button
                  type="button"
                  onClick={handleChangeModel}
                  disabled={savingApiKey || !!apiKeyStatus.modelFromEnv}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors shrink-0"
                >
                  Äá»•i model
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              Äang dÃ¹ng: <code className="font-mono">{apiKeyStatus?.model ?? "gemini-3.8-flash"}</code>
              {apiKeyStatus?.modelFromEnv ? " (Ä‘áº·t bá»Ÿi biáº¿n mÃ´i trÆ°á»ng MYENGLISH_AI_MODEL)" : ""}. Äá»ƒ trá»‘ng Ã´ Ä‘á»ƒ dÃ¹ng model máº·c
              Ä‘á»‹nh. Náº¿u Google ngá»«ng model cÅ© vÃ  bÃ¡o lá»—i 404, hÃ£y nháº­p tÃªn model má»›i (xem táº¡i AI Studio) rá»“i báº¥m Äá»•i model.
            </p>
            {apiKeyMessage && (
              <p
                role="status"
                className={`text-xs font-medium ${apiKeyMessage.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
              >
                {apiKeyMessage.text}
              </p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              CÃ³ key thÃ¬ app dÃ¹ng key, khÃ´ng dÃ¹ng CLI. GÃ³i miá»…n phÃ­ cÃ³ giá»›i háº¡n sá»‘ lÆ°á»£t gá»i má»—i phÃºt vÃ  má»—i ngÃ y. {IS_MOBILE ? "" : "Pháº§n cÃ i CLI bÃªn dÆ°á»›i chá»‰ dÃ nh cho ai muá»‘n dÃ¹ng cÃ¡ch Ä‘Äƒng nháº­p Google."}
            </p>
          </div>

          {!IS_MOBILE && (
            <>
              {/* Custom CLI Path Configuration (Especially for Windows or custom install paths) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      ÄÆ°á»ng dáº«n CLI tÃ¹y chá»‰nh (Tá»± Ä‘á»™ng nháº­n diá»‡n hoáº·c chá»‰ Ä‘á»‹nh thá»§ cÃ´ng)
                    </span>
                  </div>
                  {customCliPath && (
                    <button
                      type="button"
                      onClick={handleResetCustomPath}
                      className="text-[11px] text-slate-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
                    >
                      Äáº·t láº¡i máº·c Ä‘á»‹nh
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveCustomPath} autoComplete="off" className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={customCliPath}
                    onChange={(e) => setCustomCliPath(e.target.value)}
                    placeholder="VÃ­ dá»¥: C:\Users\<tÃªn báº¡n>\.gemini\antigravity-cli (hoáº·c C:\Users\<tÃªn báº¡n>\.gemini\antigravity-cli\agy.exe)"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    className="flex-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={checkingCli}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {customCliSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>ÄÃ£ lÆ°u!</span>
                      </>
                    ) : (
                      <span>LÆ°u & Kiá»ƒm tra</span>
                    )}
                  </button>
                </form>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Há»‡ thá»‘ng tá»± Ä‘á»™ng tÃ¬m trong <code className="font-mono text-cyan-600 dark:text-cyan-400">.gemini\antigravity-cli</code>, <code className="font-mono text-cyan-600 dark:text-cyan-400">.gemini\bin</code>, vÃ  biáº¿n mÃ´i trÆ°á»ng PATH. Náº¿u báº¡n cÃ i Ä‘áº·t á»Ÿ Ä‘Æ°á»ng dáº«n riÃªng, hÃ£y dÃ¡n Ä‘Æ°á»ng dáº«n thÆ° má»¥c hoáº·c file <code className="font-mono text-cyan-600 dark:text-cyan-400">agy.exe</code> vÃ o Ã´ trÃªn.
                </p>
              </div>
              {/* OS Switcher Tabs */}
              <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOs("macos")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${selectedOs === "macos"
                        ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200/80 dark:border-zinc-700 shadow-md"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.38-.56.65-.98 1.7-0.85 2.76 1.04.08 2.07-.53 2.6-1.27z" />
                    </svg>
                    <span>HÆ°á»›ng dáº«n macOS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOs("windows")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${selectedOs === "windows"
                        ? "bg-white dark:bg-zinc-900 text-cyan-600 dark:text-cyan-400 border border-slate-200/80 dark:border-zinc-700 shadow-md"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                      }`}
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
                    </svg>
                    <span>HÆ°á»›ng dáº«n Windows (10 / 11)</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/60 dark:bg-zinc-700/50 text-[11px] font-mono text-slate-600 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span>Äang chá»n: {selectedOs === "macos" ? "macOS" : "Windows"}</span>
                </div>
              </div>

              {/* Account compatibility notice */}
              <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 space-y-2">
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300 font-bold text-xs uppercase tracking-wider font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Kháº£ nÄƒng tÆ°Æ¡ng thÃ­ch tÃ i khoáº£n Google (Free vs Plus)</span>
                </div>
                <ul className="text-xs text-slate-700 dark:text-zinc-300 space-y-1.5 list-disc pl-5 leading-relaxed">
                  <li>
                    <strong className="text-slate-900 dark:text-white">TÃ i khoáº£n cÃ¡ nhÃ¢n Free (Gmail miá»…n phÃ­):</strong>{" "}
                    HoÃ n toÃ n sá»­ dá»¥ng Ä‘Æ°á»£c! Báº¡n chá»‰ cáº§n Ä‘Äƒng nháº­p qua trÃ¬nh duyá»‡t khi CLI yÃªu cáº§u. Há»‡ thá»‘ng cáº¥p háº¡n ngáº¡ch (quota) hÃ ng ngÃ y Ä‘á»§ Ä‘á»ƒ báº¡n tra cá»©u vÃ  há»c hÃ ng trÄƒm tá»« vá»±ng má»›i má»—i ngÃ y.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">TÃ i khoáº£n Plus / Advanced (Google One AI Premium / Workspace):</strong>{" "}
                    ÄÆ°á»£c Æ°u tiÃªn bÄƒng thÃ´ng, tá»‘c Ä‘á»™ sinh tá»« vá»±ng vÃ  cÃ¢u vÃ­ dá»¥ nhanh hÆ¡n vá»›i giá»›i háº¡n request cao hÆ¡n.
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
                      <span>Quy trÃ¬nh cÃ i Ä‘áº·t & Káº¿t ná»‘i Antigravity CLI trÃªn macOS</span>
                    </h3>
                    <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                      Binary: ~/.gemini/bin/agy
                    </span>
                  </div>

                  {/* Step 1: Install */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          1
                        </span>
                        Táº£i & CÃ i Ä‘áº·t Antigravity CLI
                      </span>
                      <button
                        onClick={() => handleCopy("curl -fsSL https://antigravity.google/install.sh | bash", "mac-1")}
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-1" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-1" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>curl -fsSL https://antigravity.google/install.sh | bash</code>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <p>â€¢ Hoáº·c náº¿u mÃ¡y báº¡n Ä‘Ã£ cÃ³ Node.js / npm, cÃ³ thá»ƒ cháº¡y lá»‡nh: <code className="text-cyan-600 dark:text-cyan-400 font-mono">npm install -g @google/antigravity-cli</code></p>
                      <p>â€¢ Script sáº½ tá»± Ä‘á»™ng táº£i binary vÃ  Ä‘áº·t vÃ o thÆ° má»¥c ngÆ°á»i dÃ¹ng: <code className="text-cyan-600 dark:text-cyan-400 font-mono">~/.gemini/bin/agy</code></p>
                    </div>
                  </div>

                  {/* Step 2: Permissions & PATH */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          2
                        </span>
                        Cáº¥p quyá»n thá»±c thi & ÄÆ°a vÃ o biáº¿n mÃ´i trÆ°á»ng PATH
                      </span>
                      <button
                        onClick={() =>
                          handleCopy("chmod +x ~/.gemini/bin/agy && echo 'export PATH=\"$HOME/.gemini/bin:$PATH\"' >> ~/.zshrc && source ~/.zshrc", "mac-2")
                        }
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-2" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-2" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>chmod +x ~/.gemini/bin/agy &amp;&amp; echo 'export PATH="$HOME/.gemini/bin:$PATH"' &gt;&gt; ~/.zshrc &amp;&amp; source ~/.zshrc</code>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Lá»‡nh nÃ y Ä‘áº£m báº£o binary cÃ³ quyá»n cháº¡y trÃªn macOS vÃ  báº¡n cÃ³ thá»ƒ gÃµ trá»±c tiáº¿p lá»‡nh <code className="text-cyan-600 dark:text-cyan-400 font-mono">agy</code> trong má»i cá»­a sá»• Terminal.
                    </p>
                  </div>

                  {/* Step 3: Auth */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          3
                        </span>
                        ÄÄƒng nháº­p tÃ i khoáº£n Google (XÃ¡c thá»±c 1 láº§n duy nháº¥t)
                      </span>
                      <button
                        onClick={() => handleCopy("~/.gemini/bin/agy auth login", "mac-3")}
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-3" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-3" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>~/.gemini/bin/agy auth login</code>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Má»Ÿ Terminal vÃ  dÃ¡n lá»‡nh trÃªn. TrÃ¬nh duyá»‡t Safari/Chrome sáº½ tá»± Ä‘á»™ng má»Ÿ trang xÃ¡c thá»±c cá»§a Google. Báº¡n chá»‰ cáº§n chá»n tÃ i khoáº£n Gmail vÃ  báº¥m <strong>Cho phÃ©p (Allow)</strong>.
                    </p>
                  </div>

                  {/* Step 4: Test & App Connection */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          4
                        </span>
                        Kiá»ƒm tra pháº£n há»“i & Káº¿t ná»‘i vá»›i MyEnglish
                      </span>
                      <button
                        onClick={() =>
                          handleCopy('~/.gemini/bin/agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"', "mac-4")
                        }
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "mac-4" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "mac-4" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>~/.gemini/bin/agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"</code>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <p>â€¢ Khi lá»‡nh in ra cÃ¢u chÃ o pháº£n há»“i tá»« Gemini, CLI Ä‘Ã£ hoáº¡t Ä‘á»™ng hoÃ n toÃ n chÃ­nh xÃ¡c.</p>
                      <p>â€¢ <strong>Trong app MyEnglish</strong>: á»¨ng dá»¥ng tá»± Ä‘á»™ng phÃ¡t hiá»‡n Ä‘Æ°á»ng dáº«n <code className="text-cyan-600 dark:text-cyan-400 font-mono">~/.gemini/bin/agy</code>. Báº¡n chá»‰ cáº§n nháº¥n nÃºt <strong>"Kiá»ƒm tra láº¡i káº¿t ná»‘i"</strong> á»Ÿ banner trÃªn Ä‘á»ƒ tháº¥y tráº¡ng thÃ¡i xanh lÃ¡.</p>
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
                      <span className="p-1 rounded-md bg-cyan-600 text-white">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
                        </svg>
                      </span>
                      <span>Quy trÃ¬nh cÃ i Ä‘áº·t & Káº¿t ná»‘i Antigravity CLI trÃªn Windows (10 / 11)</span>
                    </h3>
                    <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                      Binary: agy.exe
                    </span>
                  </div>

                  {/* Step 1: Install Windows */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          1
                        </span>
                        CÃ i Ä‘áº·t Antigravity CLI qua PowerShell (KhuyÃªn dÃ¹ng)
                      </span>
                      <button
                        onClick={() => handleCopy("iwr -useb https://antigravity.google/install.ps1 | iex", "win-1")}
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-1" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-1" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>iwr -useb https://antigravity.google/install.ps1 | iex</code>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <p>â€¢ Nháº¥n phÃ­m <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border text-[10px]">Win</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border text-[10px]">X</kbd>, chá»n <strong>Terminal</strong> hoáº·c <strong>PowerShell</strong> vÃ  dÃ¡n lá»‡nh trÃªn.</p>
                      <p>â€¢ Hoáº·c náº¿u mÃ¡y báº¡n Ä‘Ã£ cÃ³ Node.js: <code className="text-cyan-600 dark:text-cyan-400 font-mono">npm install -g @google/antigravity-cli</code></p>
                      <p>â€¢ ThÆ° má»¥c cÃ i Ä‘áº·t máº·c Ä‘á»‹nh trÃªn Windows: <code className="text-cyan-600 dark:text-cyan-400 font-mono">%USERPROFILE%\.gemini\antigravity-cli\agy.exe</code></p>
                    </div>
                  </div>

                  {/* Step 2: Auth Windows */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          2
                        </span>
                        ÄÄƒng nháº­p tÃ i khoáº£n Google (OAuth Web Login)
                      </span>
                      <button
                        onClick={() => handleCopy("agy auth login", "win-2")}
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-2" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-2" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>agy auth login</code>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <p>â€¢ Náº¿u PowerShell bÃ¡o chÆ°a tÃ¬m tháº¥y lá»‡nh, hÃ£y dÃ¹ng Ä‘Æ°á»ng dáº«n Ä‘áº§y Ä‘á»§: <code className="text-cyan-600 dark:text-cyan-400 font-mono">&amp; "$env:USERPROFILE\.gemini\antigravity-cli\agy.exe" auth login</code></p>
                      <p>â€¢ TrÃ¬nh duyá»‡t Edge/Chrome sáº½ má»Ÿ trang Ä‘Äƒng nháº­p Google Ä‘á»ƒ báº¡n xÃ¡c thá»±c tÃ i khoáº£n Gmail (miá»…n phÃ­ hoáº·c Plus).</p>
                    </div>
                  </div>

                  {/* Step 3: Test Windows */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          3
                        </span>
                        Cháº¡y thá»­ nghiá»‡m lá»‡nh phÃ¢n tÃ­ch trÃªn PowerShell
                      </span>
                      <button
                        onClick={() =>
                          handleCopy('agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"', "win-3")
                        }
                        className="text-xs text-slate-500 hover:text-cyan-600 dark:text-zinc-400 flex items-center gap-1 font-mono"
                      >
                        {copiedIndex === "win-3" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === "win-3" ? "ÄÃ£ copy" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
                      <code>agy --dangerously-skip-permissions --model gemini-3.8-flash-low -p "Hello, world!"</code>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Khi nháº­n Ä‘Æ°á»£c pháº£n há»“i cÃ¢u chÃ o tá»« Gemini, CLI Ä‘Ã£ hoáº¡t Ä‘á»™ng thÃ nh cÃ´ng trÃªn mÃ¡y Windows cá»§a báº¡n.
                    </p>
                  </div>

                  {/* Step 4: Configure App on Windows */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-mono">
                          4
                        </span>
                        Cáº¥u hÃ¬nh & Káº¿t ná»‘i trong MyEnglish (Windows)
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-2 leading-relaxed">
                      <p>
                        á»¨ng dá»¥ng MyEnglish tá»± Ä‘á»™ng quÃ©t cÃ¡c vá»‹ trÃ­ cÃ i Ä‘áº·t phá»• biáº¿n trÃªn Windows:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                        <li>%USERPROFILE%\.gemini\antigravity-cli\agy.exe</li>
                        <li>%LOCALAPPDATA%\Programs\antigravity\agy.exe</li>
                        <li>%APPDATA%\npm\agy.cmd (náº¿u cÃ i qua npm)</li>
                        <li>Biáº¿n mÃ´i trÆ°á»ng PATH há»‡ thá»‘ng (lá»‡nh where agy.exe)</li>
                      </ul>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-1.5 text-[11px]">
                        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                          Náº¿u báº¡n cÃ i Ä‘áº·t á»Ÿ thÆ° má»¥c tÃ¹y chá»‰nh (VÃ­ dá»¥ á»• D:\tools\agy.exe):
                        </p>
                        <p className="text-slate-600 dark:text-zinc-400">
                          HÃ£y dÃ¡n Ä‘Æ°á»ng dáº«n file <code className="font-mono text-cyan-600 dark:text-cyan-400">agy.exe</code> vÃ o Ã´ <strong>"ÄÆ°á»ng dáº«n CLI tÃ¹y chá»‰nh"</strong> á»Ÿ trÃªn vÃ  báº¥m <strong>"LÆ°u &amp; Kiá»ƒm tra"</strong>.
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        ðŸ’¡ <em>LÆ°u Ã½: TrÃªn Windows, á»©ng dá»¥ng MyEnglish Ä‘Ã£ Ä‘Æ°á»£c tÃ­ch há»£p cá» <code className="font-mono text-slate-700 dark:text-zinc-300">CREATE_NO_WINDOW</code>, báº£o Ä‘áº£m hoÃ n toÃ n khÃ´ng xuáº¥t hiá»‡n cá»­a sá»• Command Prompt mÃ u Ä‘en nháº¥p nhÃ¡y khi báº¡n tra tá»«.</em>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </SettingsSection>

      {/* 5. THUáº¬T TOÃN Lá»ŠCH Ã”N: nÃ¢ng cao, Ä‘Ã£ cÃ³ sáºµn cáº¥u hÃ¬nh máº·c Ä‘á»‹nh */}
      <SettingsSection
        id="algorithm"
        tone="muted"
        icon={<Brain className="w-5 h-5" />}
        title="Thuáº­t toÃ¡n lá»‹ch Ã´n (nÃ¢ng cao)"
        description="Má»¥c tiÃªu ghi nhá»›, tá»« khÃ³, tá»‘i Æ°u tham sá»‘ FSRS. Máº·c Ä‘á»‹nh Ä‘Ã£ tá»‘t, Ã­t khi cáº§n Ä‘á»•i."
        summary={`Má»¥c tiÃªu ghi nhá»› ${Math.round(fsrsSettings.requestRetention * 100)}%`}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Zap className="w-4 h-4 text-amber-500" />
                <Jargon
                  term="Thuáº­t toÃ¡n Spaced Repetition Tháº¿ Há»‡ Má»›i: FSRS"
                  plain="Thuáº­t toÃ¡n lá»‹ch Ã´n thÃ´ng minh"
                  hint="FSRS: tÃ­nh ngÃ y Ã´n láº¡i theo Ä‘á»™ khÃ³, Ä‘á»™ bá»n vÃ  kháº£ nÄƒng nhá»› cá»§a tá»«ng tá»«"
                />
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                <Jargon term="FSRS-6 Active (DSR Model)" plain="Äang báº­t" hint="PhiÃªn báº£n FSRS-6 Ä‘ang cháº¡y trong app" />
              </span>
            </div>

            {/* Retention Control Widget */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Má»¥c tiÃªu ghi nhá»› (Desired Retention)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    XÃ¡c suáº¥t báº¡n muá»‘n nhá»› Ä‘Æ°á»£c tá»« khi Ä‘áº¿n ngÃ y háº¹n Ã´n táº­p. Máº·c Ä‘á»‹nh 90% (tá»‘i Æ°u nháº¥t).
                  </p>
                </div>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-mono">
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
                      setNotifFeedback(`ÄÃ£ cáº­p nháº­t má»¥c tiÃªu ghi nhá»› FSRS thÃ nh ${Math.round(val * 100)}%!`);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${fsrsSettings.requestRetention === val
                        ? "bg-cyan-600 text-white shadow-sm font-bold"
                        : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                      }`}
                  >
                    {Math.round(val * 100)}%{val === 0.9 ? " (Chuáº©n)" : ""}
                  </button>
                ))}
              </div>
            </div>

            <AdvancedLearningSettings onWordsChanged={onRefreshWords} />

            <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-2 leading-relaxed">
              <p>
                <strong>
                  1.{" "}
                  <Jargon
                    term='Kháº¯c phá»¥c "Ease Hell" cá»§a SM-2'
                    plain="KhÃ´ng bá»‹ káº¹t á»Ÿ chu ká»³ ngáº¯n"
                    hint="SM-2 lÃ  thuáº­t toÃ¡n cÅ©: sau nhiá»u láº§n quÃªn, há»‡ sá»‘ Ã´n bá»‹ háº¡ mÃ£i nÃªn tá»« hiá»‡n quÃ¡ dÃ y"
                  />
                  :
                </strong>{" "}
                FSRS khÃ´ng dÃ¹ng há»‡ sá»‘ cá»‘ Ä‘á»‹nh mÃ  mÃ´ hÃ¬nh hÃ³a trÃ­ nhá»› theo 3 biáº¿n sá»‘ <strong>DSR (Äá»™ khÃ³ - Äá»™ bá»n - Kháº£ nÄƒng nhá»› láº¡i)</strong>. Khi báº¡n báº¥m quÃªn má»™t tá»«, thuáº­t toÃ¡n sáº½ tá»± cÃ¢n báº±ng láº¡i chá»© khÃ´ng pháº¡t káº¹t tá»« á»Ÿ chu ká»³ ngáº¯n vÄ©nh viá»…n.
              </p>
              <p>
                <strong>2. Giáº£m 20% â€“ 30% sá»‘ lÆ°á»£t Ã´n táº­p:</strong> Khoáº£ng cÃ¡ch Ã´n Ä‘Æ°á»£c tÃ­nh toÃ¡n toÃ¡n há»c chÃ­nh xÃ¡c theo Ä‘Æ°á»ng cong quÃªn Ebbinghaus hiá»‡n Ä‘áº¡i, giÃºp báº¡n nhá»› lÃ¢u hÆ¡n nhÆ°ng tá»‘n Ã­t thá»i gian láº·p láº¡i hÆ¡n.
              </p>
              <p>
                <strong>3. Tiáº¿n trÃ¬nh quÃ©t ngáº§m thÃ´ng minh:</strong> Khi á»©ng dá»¥ng MyEnglish Ä‘ang má»Ÿ (hoáº·c thu nhá» á»Ÿ Dock/Tray), tiáº¿n trÃ¬nh ngáº§m sáº½ tá»± Ä‘á»™ng quÃ©t cÆ¡ sá»Ÿ dá»¯ liá»‡u Ä‘á»‹nh ká»³ theo sá»‘ phÃºt báº¡n cáº¥u hÃ¬nh á»Ÿ trÃªn Ä‘á»ƒ nháº¯c báº¡n Ã´n táº­p ká»‹p thá»i.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* 6. Dá»® LIá»†U & Äáº¶T Láº I */}
      <SettingsSection
        id="data"
        tone="muted"
        icon={<Database className="w-5 h-5" />}
        title="Dá»¯ liá»‡u & Ä‘áº·t láº¡i"
        description="XoÃ¡ toÃ n bá»™ quÃ¡ trÃ¬nh há»c Ä‘á»ƒ báº¯t Ä‘áº§u láº¡i nhÆ° báº£n cÃ i má»›i."
        defaultOpen={false}
      >
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Äáº·t láº¡i á»©ng dá»¥ng tá»« Ä‘áº§u (Reset Data)</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                XÃ³a toÃ n bá»™ quÃ¡ trÃ¬nh há»c, lá»‹ch sá»­ Ã´n táº­p FSRS, tá»« vá»±ng cÃ¡ nhÃ¢n, chuá»—i Streak vÃ  Ä‘iá»ƒm XP.
                á»¨ng dá»¥ng sáº½ tá»± Ä‘á»™ng náº¡p láº¡i trá»n bá»™ 5.000 tá»« vá»±ng Oxford vÃ  31 chÆ°Æ¡ng ngá»¯ phÃ¡p, sau Ä‘Ã³ má»Ÿ láº¡i mÃ n hÃ¬nh kháº£o sÃ¡t ban Ä‘áº§u (chá»n trÃ¬nh Ä‘á»™, thÃ¬ báº¯t Ä‘áº§u há»c, káº¿ hoáº¡ch má»—i ngÃ y).
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 shrink-0 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Äáº·t láº¡i dá»¯ liá»‡u...</span>
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* 7. CÃ”NG Cá»¤ CHO NHÃ€ PHÃT TRIá»‚N: thu gá»n, ngÆ°á»i há»c khÃ´ng cáº§n dÃ¹ng */}
      <details className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 p-4">
        <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-zinc-400">
          CÃ´ng cá»¥ cho nhÃ  phÃ¡t triá»ƒn (kiá»ƒm thá»­ thÃ´ng bÃ¡o, táº¡o tá»« Ä‘áº¿n háº¡n)
        </summary>
        <div className="mt-4 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Trung tÃ¢m kiá»ƒm tra thá»±c táº¿ (Testing Center)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {/* Test 1: Pop-up Focus Review (desktop only: a phone has no popup window) */}
              {!IS_MOBILE && (
                <div className="p-4 rounded-2xl border border-cyan-200 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/20 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Test 1: Pop-up Quiz toÃ n mÃ n hÃ¬nh</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug pt-1">
                      Báº­t ngay cá»­a sá»• lÃ m má» toÃ n mÃ n hÃ¬nh. Báº¡n cÃ³ thá»ƒ nháº¥n <strong>Esc</strong> Ä‘á»ƒ táº¯t nhanh, dÃ¹ng phÃ­m <strong>1-4</strong> Ä‘á»ƒ chá»n, hoáº·c <strong>S</strong> Ä‘á»ƒ hoÃ£n.
                    </p>
                  </div>
                  <button
                    onClick={handleTestPopupQuiz}
                    disabled={testingPopup}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all shadow-cyan-600/20"
                  >
                    <Zap className={`w-3.5 h-3.5 ${testingPopup ? "animate-bounce" : ""}`} />
                    <span>{testingPopup ? "Äang má»Ÿ..." : "Báº­t thá»­ Pop-up Quiz ngay"}</span>
                  </button>
                </div>
              )}

              {/* Test 2: Native Desktop Notification */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    <span>Test 2: Gá»­i thÃ´ng bÃ¡o thá»­</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug pt-1">
                    Gá»­i má»™t thÃ´ng bÃ¡o thá»­ lÃªn mÃ n hÃ¬nh há»‡ thá»‘ng (trÃªn macOS kÃ¨m tiáº¿ng chuÃ´ng "Glass").
                  </p>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testingNotif}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Bell className={`w-3.5 h-3.5 ${testingNotif ? "animate-bounce" : ""}`} />
                  <span>{testingNotif ? "Äang gá»­i..." : "Gá»­i thÃ´ng bÃ¡o thá»­"}</span>
                </button>
              </div>

              {/* Test 3: Mark word due in SQLite */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>Test 3: Táº¡o tá»« Ä‘áº¿n háº¡n Ã´n táº­p tháº­t</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug pt-1">
                    Äáº·t 1 tá»« trong SQLite vá» quÃ¡ háº¡n Ä‘á»ƒ kiá»ƒm tra thuáº­t toÃ¡n tá»± Ä‘á»™ng nháº­n diá»‡n tá»« Ä‘áº¿n háº¡n.
                  </p>
                </div>
                <button
                  onClick={handleMarkDueTest}
                  disabled={testingDueWord}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{testingDueWord ? "Äang thiáº¿t láº­p..." : "Äáº·t 1 tá»« thÃ nh 'Cáº§n Ã´n ngay'"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </details>

      <ResetAppDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}

/** Whole seconds to the next reminder, as "12m 05s" */
function formatCountdown(totalSec: number) {
  if (totalSec <= 0) return "Äang Ä‘áº¿n giá» hiá»ƒn thá»‹!";
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
    return `Ä‘ang hoÃ£n Ä‘áº¿n ${until}`;
  }
  if (isMainSessionActive()) return "báº¡n Ä‘ang Ã´n trong cá»­a sá»• chÃ­nh";
  const pause = reminderPause(settings, {
    hour: new Date().getHours(),
    goalReached: goalMet,
    shownToday: getNudgesShownToday(),
  });
  if (pause === "night") return `ban Ä‘Ãªm (${NIGHT_QUIET_START}:00â€“${String(NIGHT_QUIET_END).padStart(2, "0")}:00)`;
  if (pause === "goal_reached") return "Ä‘Ã£ Ä‘áº¡t má»¥c tiÃªu hÃ´m nay";
  if (pause === "daily_cap") return "Ä‘á»§ sá»‘ láº§n nháº¯c hÃ´m nay";
  return null;
}
