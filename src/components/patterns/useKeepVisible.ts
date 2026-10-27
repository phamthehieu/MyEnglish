import { useEffect, useRef, type RefObject } from "react";

/**
 * On the phone the keyboard covers the lower part of the page and the page does not scroll by itself to the box
 * being typed in. While `input` has the focus, and again whenever the page changes size (the keyboard opening),
 * `area` (the question and its box) is scrolled to the top of the visible page, so both stay above the keyboard.
 * The box may appear after the first render, so the focus is watched on the whole document.
 */
export function useKeepVisible<A extends HTMLElement, I extends HTMLElement>(): { area: RefObject<A>; input: RefObject<I> } {
  const area = useRef<A>(null);
  const input = useRef<I>(null);

  useEffect(() => {
    let timer: number | undefined;
    const show = () => {
      window.clearTimeout(timer);
      // The keyboard takes a moment to open and the page to settle
      timer = window.setTimeout(() => {
        const el = input.current;
        if (el && document.activeElement === el) (area.current ?? el).scrollIntoView({ block: "start", behavior: "smooth" });
      }, 300);
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target === input.current) show();
    };
    document.addEventListener("focusin", onFocus);
    window.addEventListener("resize", show);
    window.visualViewport?.addEventListener("resize", show);
    show();
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("resize", show);
      window.visualViewport?.removeEventListener("resize", show);
    };
  }, []);

  return { area, input };
}
