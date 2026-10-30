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
/**
 * A group of settings inside a section. On phones it is a plain block under a thin divider (no box inside the
 * section's box, so the text keeps the width); from md up it is its own bordered box. Add the md: padding,
 * corners and background of the box (with md:first:pt-* matching the padding).
 */
export const SETTINGS_GROUP =
  "border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 dark:border-zinc-800 md:border md:first:border-t md:border-slate-200 md:dark:border-zinc-800";

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
      ? "border-teal-700/30 dark:border-teal-400/30 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
      : tone === "muted"
        ? "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

  return (
    <section id={`settings-${id}`} className={`scroll-mt-4 rounded-2xl border ${shell}`}>
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full min-h-14 flex items-center gap-3 px-3.5 sm:px-5 py-3 sm:py-4 text-left">
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            tone === "primary"
              ? "bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900 dark:text-zinc-100">{title}</span>
          {description && <span className="block text-sm text-slate-500 dark:text-zinc-400">{description}</span>}
          {/* The state at a glance: on its own line on phones, on the right of the title from sm up */}
          {!open && summary && <span className="block sm:hidden mt-0.5 text-sm font-medium text-teal-700 dark:text-teal-300">{summary}</span>}
        </span>
        {!open && summary && <span className="hidden sm:block shrink-0 text-sm text-slate-500 dark:text-zinc-400 text-right max-w-[45%] truncate">{summary}</span>}
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-slate-100 dark:border-zinc-800 px-3.5 sm:px-5 pt-4 pb-5 space-y-4">{children}</div>}
    </section>
  );
}
