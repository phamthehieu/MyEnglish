import { useEffect, useRef, useState, type ReactNode } from "react";

interface GiveUpButtonProps {
  /** Called on the second press: the word is graded "not remembered" */
  onConfirm: () => void;
  disabled?: boolean;
  /** What the button says before it is armed (default "Không nhớ") */
  label?: string;
  icon?: ReactNode;
  className?: string;
}

/** A press arms the button for this long; a second press inside it gives up */
const ARMED_MS = 4000;

/**
 * "I don't remember this word": it is graded Quên, so the word comes back. One press only arms the button
 * (it says what the next press does), so a stray tap cannot fail a word the learner knew.
 */
export default function GiveUpButton({ onConfirm, disabled, label = "Không nhớ", icon, className }: GiveUpButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = () => {
    if (armed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), ARMED_MS);
  };

  return (
    <button
      type="button"
      onClick={press}
      disabled={disabled}
      aria-live="polite"
      title="Tính là chưa nhớ: từ này sẽ được hỏi lại"
      className={`min-h-[40px] px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
        armed
          ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/40 font-semibold"
          : "text-slate-600 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
      } ${className ?? ""}`}
    >
      {icon}
      <span>{armed ? "Bấm lần nữa: tính là chưa nhớ" : label}</span>
    </button>
  );
}
