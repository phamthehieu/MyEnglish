import { useEffect, useState, lazy, Suspense } from "react";
import { getInitialWindowLabel } from "@/lib/windowLabel";
import { applyUiScale } from "@/services/learnerProfile";
import ErrorBoundary from "@/components/ErrorBoundary";
// Each window (main, review-popup, review-nudge) loads only the code it renders
const MainDashboard = lazy(() => import("@/components/MainDashboard"));
const FocusReviewModal = lazy(() => import("@/components/FocusReviewModal"));
const ReviewNudge = lazy(() => import("@/components/ReviewNudge"));

/** Floating windows rendered over other apps on a transparent background */
const TRANSPARENT_WINDOWS = ["review-popup", "review-nudge"];
import { useUpdateStore } from "@/services/updateService";
import { syncAutostartWithSystem } from "@/services/autostartService";
import { startMobileReminders } from "@/services/mobileReminders";

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Synchronously apply transparent window styles before React render
if (typeof document !== "undefined") {
  const initialLabel = getInitialWindowLabel();
  if (TRANSPARENT_WINDOWS.includes(initialLabel)) {
    document.documentElement.classList.add("transparent-window");
    document.body.classList.add("transparent-window");
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }
}

export default function App() {
  const [windowLabel, setWindowLabel] = useState<string>(getInitialWindowLabel);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);

  // Check for updates and sync autostart on startup in the main window
  useEffect(() => {
    if (windowLabel !== "main") return;
    // Bigger text (Settings → Cỡ chữ) applies to the main window only: popups have fixed sizes
    applyUiScale();
    checkForUpdates();
    syncAutostartWithSystem();
    // Phones: reminders are scheduled with the system (a stopped app runs no timer); no-op on desktop
    const stopMobileReminders = startMobileReminders();
    const timer = window.setInterval(() => checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      stopMobileReminders();
    };
  }, [checkForUpdates, windowLabel]);

  // Account (Supabase): restore the session and keep the progress in step with it. Main window only: it is
  // the one that runs sync, and the floating windows share the same database.
  useEffect(() => {
    if (windowLabel !== "main") return;
    let stops: Array<() => void> = [];
    let cancelled = false;
    (async () => {
      const [{ useAuthStore }, { startSyncScheduler }, { startStanding }] = await Promise.all([
        import("@/stores/authStore"),
        import("@/services/sync/manager"),
        import("@/stores/standingStore"),
      ]);
      await useAuthStore.getState().init();
      if (!cancelled) stops = [startSyncScheduler(), startStanding()];
    })().catch((err) => console.warn("Account init failed:", err));
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [windowLabel]);

  useEffect(() => {
    // Fallback sync in case window label is resolved late
    const label = getInitialWindowLabel();
    if (label !== windowLabel) {
      setWindowLabel(label);
    }
  }, [windowLabel]);

  useEffect(() => {
    if (TRANSPARENT_WINDOWS.includes(windowLabel)) {
      document.documentElement.classList.add("transparent-window");
      document.body.classList.add("transparent-window");
      document.documentElement.style.background = "transparent";
      document.documentElement.style.backgroundColor = "transparent";
      document.body.style.background = "transparent";
      document.body.style.backgroundColor = "transparent";
    } else {
      document.documentElement.classList.remove("transparent-window");
      document.body.classList.remove("transparent-window");
    }
  }, [windowLabel]);

  // When inside the corner reminder window
  if (windowLabel === "review-nudge") {
    return (
      <ErrorBoundary key={windowLabel} windowLabel={windowLabel}>
      <Suspense fallback={null}>
        <ReviewNudge
          onDone={() => {
            if (!("__TAURI_INTERNALS__" in window)) {
              setWindowLabel("main");
            }
          }}
        />
      </Suspense>
      </ErrorBoundary>
    );
  }

  // When inside the Review Popup floating window
  if (windowLabel === "review-popup") {
    return (
      <ErrorBoundary key={windowLabel} windowLabel={windowLabel}>
      <Suspense fallback={null}>
        <FocusReviewModal
          onClose={() => {
            if (!("__TAURI_INTERNALS__" in window)) {
              setWindowLabel("main");
            }
          }}
        />
      </Suspense>
      </ErrorBoundary>
    );
  }

  // When inside the Main Dashboard window
  return (
    <ErrorBoundary key={windowLabel} windowLabel={windowLabel}>
      <Suspense fallback={null}>
        <MainDashboard
          // Browser preview only: it swaps the whole page for the popup. Inside the app (a phone has one window) the
          // quiz opens as a box over the current screen, which is what MainDashboard does without this prop.
          onOpenReviewPopupPreview={"__TAURI_INTERNALS__" in window ? undefined : () => setWindowLabel("review-popup")}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
