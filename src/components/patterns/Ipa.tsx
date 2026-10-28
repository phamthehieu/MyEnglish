import { useEffect, useState } from "react";

const KEY = "patterns.ipa";
const EVENT = "patterns-ipa-changed";
/** On unless the learner turned it off */
const read = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};

/** Whether the pronunciation line is shown under the sentences, kept between visits and shared by every screen */
export function useIpa(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      /* only a convenience */
    }
    setOn(value);
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

/** How a sentence is pronounced, in IPA, when the learner wants to see it */
export function IpaLine({ ipa }: { ipa?: string }) {
  const [on] = useIpa();
  if (!on || !ipa) return null;
  return <p className="font-mono text-xs text-violet-600 dark:text-violet-300 break-words">{ipa}</p>;
}

/** The switch for those lines */
export function IpaToggle() {
  const [on, set] = useIpa();
  return (
    <button
      onClick={() => set(!on)}
      aria-pressed={on}
      aria-label="Hiện cách đọc IPA"
      title="IPA = ký hiệu cách đọc"
      className={`shrink-0 px-3 min-h-[40px] rounded-full text-xs font-bold border ${
        on ? "bg-violet-600 border-violet-600 text-white" : "border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300"
      }`}
    >
      IPA
    </button>
  );
}
