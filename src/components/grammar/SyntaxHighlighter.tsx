import { useState } from "react";
import type { SyntaxToken } from "@/types/grammar";

interface SyntaxHighlighterProps {
  tokens?: SyntaxToken[];
  fallbackText?: string;
  className?: string;
  showLabels?: boolean;
}

/**
 * The parts of a sentence keep their own colours (the colour is the meaning), but calm ones: a pale fill, a dark
 * text of the same hue (readable on white), and in dark mode a faint tint with a light text.
 */
const ROLE_STYLES: Record<string, { bg: string; text: string; border: string; labelBg: string }> = {
  subject: {
    bg: "bg-sky-50 dark:bg-sky-400/10",
    text: "text-sky-800 dark:text-sky-200 font-semibold",
    border: "border-sky-200 dark:border-sky-400/25",
    labelBg: "text-sky-700 dark:text-sky-300",
  },
  verb: {
    bg: "bg-amber-50 dark:bg-amber-400/10",
    text: "text-amber-900 dark:text-amber-200 font-semibold",
    border: "border-amber-200 dark:border-amber-400/25",
    labelBg: "text-amber-800 dark:text-amber-300",
  },
  auxiliary: {
    bg: "bg-orange-50 dark:bg-orange-400/10",
    text: "text-orange-900 dark:text-orange-200 font-semibold",
    border: "border-orange-200 dark:border-orange-400/25",
    labelBg: "text-orange-800 dark:text-orange-300",
  },
  object: {
    bg: "bg-green-50 dark:bg-green-400/10",
    text: "text-green-800 dark:text-green-200 font-medium",
    border: "border-green-200 dark:border-green-400/25",
    labelBg: "text-green-700 dark:text-green-300",
  },
  modifier: {
    bg: "bg-violet-50 dark:bg-violet-400/10",
    text: "text-violet-800 dark:text-violet-200",
    border: "border-violet-200 dark:border-violet-400/25",
    labelBg: "text-violet-700 dark:text-violet-300",
  },
  complement: {
    bg: "bg-teal-50 dark:bg-teal-400/10",
    text: "text-teal-800 dark:text-teal-200 font-medium",
    border: "border-teal-200 dark:border-teal-400/25",
    labelBg: "text-teal-700 dark:text-teal-300",
  },
  connector: {
    bg: "bg-slate-100 dark:bg-zinc-800",
    text: "text-slate-800 dark:text-zinc-100 font-semibold",
    border: "border-slate-300 dark:border-zinc-700",
    labelBg: "text-slate-600 dark:text-zinc-400",
  },
};

export default function SyntaxHighlighter({
  tokens,
  fallbackText,
  className = "",
  showLabels = true,
}: SyntaxHighlighterProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!tokens || tokens.length === 0) {
    return <span className={className}>{fallbackText || ""}</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 leading-relaxed ${className}`}>
      {tokens.map((token, index) => {
        const style = ROLE_STYLES[token.role] || {
          bg: "bg-slate-100 dark:bg-zinc-800",
          text: "text-slate-800 dark:text-zinc-200",
          border: "border-slate-200 dark:border-zinc-700",
          labelBg: "text-slate-600 dark:text-zinc-400",
        };

        const isHovered = hoveredIndex === index;

        return (
          <span
            key={index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`relative inline-flex flex-col items-center px-2.5 py-1 rounded-xl border transition-colors cursor-pointer ${
              style.bg
            } ${style.border} ${isHovered ? "ring-2 ring-teal-600 dark:ring-teal-400 z-10" : ""}`}
          >
            <span className={`text-base ${style.text}`}>{token.text}</span>
            {showLabels && (
              <span
                className={`text-[11px] font-medium leading-tight mt-0.5 ${
                  style.labelBg
                }`}
              >
                {token.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
