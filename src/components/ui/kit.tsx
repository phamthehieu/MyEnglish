import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The building blocks of the v2 look (docs/design/stitch/executive_focus/DESIGN.md): teal for the one main action,
 * white cards on a light grey page, 16px corners, 48px touch targets. Screens use these instead of their own classes.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-teal-700 text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500",
  secondary:
    "border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10",
  ghost: "text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-400/10",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; block?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "min-h-14 px-6 text-[17px]" : size === "md" ? "min-h-12 px-5 text-base" : "min-h-10 px-3.5 text-sm",
        block && "w-full",
        BUTTON[variant],
        className
      )}
      {...rest}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5",
        className
      )}
      {...rest}
    />
  );
}

/** A small rounded label: "🔥 12 ngày", "Đã xong" */
export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "teal" | "green" | "amber" | "red" }) {
  const look = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    teal: "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300",
    green: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", look, className)} {...rest} />;
}

/** The sub-pages of a section, as a row of chips under its title (scrolls sideways on a phone) */
export function SubTabs<T extends string>({ items, value, onChange, label }: { items: Array<{ id: T; label: string; badge?: ReactNode }>; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
      {items.map((item) => {
        const on = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
              on
                ? "bg-teal-700 text-white dark:bg-teal-600"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, tone = "teal", className }: { value: number; tone?: "teal" | "green" | "amber"; className?: string }) {
  const fill = { teal: "bg-teal-700 dark:bg-teal-500", green: "bg-green-600", amber: "bg-amber-500" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** A ring that fills with the day's goal; the children sit in its middle */
export function ProgressRing({ value, size = 56, stroke = 6, done = false, children }: { value: number; size?: number; stroke?: number; done?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-zinc-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - shown / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", done ? "stroke-green-600" : "stroke-teal-700 dark:stroke-teal-500")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
