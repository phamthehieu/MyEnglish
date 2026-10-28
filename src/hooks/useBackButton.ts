import { useEffect, useRef } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { isMobilePlatform } from "@/lib/platform";

/**
 * The Android Back button (or gesture) while `enabled`: runs `handler` instead of leaving the app.
 * Does nothing on desktop. The default behavior comes back as soon as `enabled` turns false.
 */
export function useBackButton(enabled: boolean, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !isMobilePlatform()) return;
    let cancelled = false;
    let unregister: (() => void) | undefined;
    onBackButtonPress(() => handlerRef.current())
      .then((listener) => {
        if (cancelled) void listener.unregister().catch(() => {});
        else unregister = () => void listener.unregister().catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unregister?.();
    };
  }, [enabled]);
}
