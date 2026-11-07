import { useEffect, useRef } from "react";

type BackHandler = () => boolean | void;

interface BackEntry {
  id: number;
  handler: BackHandler;
}

let nextId = 1;
const stack: BackEntry[] = [];

/**
 * Registers a LIFO back navigation handler.
 * When the user presses the Android hardware Back button (or Escape on desktop),
 * the most recently registered active handler runs first.
 * If a handler returns `false`, propagation continues to the next handler down the stack;
 * returning `true` or `undefined` marks the back action as consumed.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  const id = nextId++;
  stack.push({ id, handler });
  return () => {
    const idx = stack.findIndex((e) => e.id === id);
    if (idx !== -1) stack.splice(idx, 1);
  };
}

/**
 * React hook to register a back button handler while `enabled` is true.
 */
export function useBackHandler(handler: BackHandler, enabled = true): void {
  const handlerRef = useRef<BackHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    return registerBackHandler(() => handlerRef.current());
  }, [enabled]);
}

/**
 * Invokes the topmost active back handler.
 * Returns `"handled"` if a screen/modal consumed the back press, or `"exit"` if at root.
 */
export function dispatchBackNavigation(): "handled" | "exit" {
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (!entry) continue;
    try {
      const res = entry.handler();
      if (res !== false) {
        return "handled";
      }
    } catch (err) {
      console.error("[BackNavigation] Handler error:", err);
      return "handled";
    }
  }
  return "exit";
}

declare global {
  interface Window {
    __handleAndroidBack?: () => "handled" | "exit";
  }
}

if (typeof window !== "undefined") {
  window.__handleAndroidBack = dispatchBackNavigation;
}
