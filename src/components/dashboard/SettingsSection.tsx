import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const OPEN_KEY = "myenglish_settings_open_v1";

function readOpen(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

interface SettingsSectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  /** One line under the title (what the section is for) */
  description?: string;
  /** Shown on the right while closed: the current state at a glance ("Đã kết nối", "90%") */
  summary?: ReactNode;
  /** primary: the settings that shape studying, highlighted; normal; muted: optional extras */
  tone?: "primary" | "normal" | "muted";
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A block of the Settings screen that can be folded. The learner's choice (open or closed) is remembered per
 * section, so extras folded once stay out of the way.
 */
/** Event a link to a section sends to open it if it is folded: detail = the section id */
export const OPEN_SETTINGS_SECTION_EVENT = "myenglish-open-settings-section";

export default function SettingsSection({ id, icon, title, description, summary, tone = "normal", defaultOpen = true, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(() => readOpen()[id] ?? defaultOpen);
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) setOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_SECTION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_SECTION_EVENT, onOpen);
  }, [id]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: next }));
    } catch {}
  };
  const shell =
    tone === "primary"
      ? "border-cyan-300 dark:border-cyan-800/70 bg-gradient-to-br from-cyan-50/70 to-white dark:from-cyan-950/25 dark:to-zinc-900 shadow-md shadow-cyan-500/5"
      : tone === "muted"
        ? "border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40"
        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm";

  return (
    <section id={`settings-${id}`} className={`scroll-mt-4 rounded-2xl border ${shell}`}>
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full min-h-14 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-left">
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            tone === "primary"
              ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
              : tone === "muted"
                ? "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-bold text-slate-900 dark:text-white ${tone === "primary" ? "text-base" : "text-sm"}`}>{title}</span>
          {description && <span className="block text-xs text-slate-600 dark:text-zinc-400">{description}</span>}
          {/* The state at a glance: on its own line on phones, on the right of the title from sm up */}
          {!open && summary && <span className="block sm:hidden mt-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">{summary}</span>}
        </span>
        {!open && summary && <span className="hidden sm:block shrink-0 text-xs text-slate-600 dark:text-zinc-400 text-right max-w-[45%] truncate">{summary}</span>}
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 space-y-4">{children}</div>}
    </section>
  );
}
