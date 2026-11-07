import { useBackHandler } from "@/lib/backNavigation";

/**
 * The Android Back button (or gesture) while `enabled`: runs `handler` instead of leaving the app.
 */
export function useBackButton(enabled: boolean, handler: () => boolean | void) {
  useBackHandler(handler, enabled);
}
