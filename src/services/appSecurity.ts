/**
 * Global App Security & Anti-Inspection Module
 *
 * 1. Blocks Developer Tools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U (view source), Ctrl+S, Ctrl+P.
 * 2. Blocks context menu (right-click inspect & save).
 * 3. Screenshot & Screen Capture Defense (Web & Desktop):
 *    - Intercepts PrintScreen and empties the clipboard.
 *    - Blurs content when window loses focus (neutralizing Windows Snipping Tool Win+Shift+S and third-party screenshot software).
 * 4. CSS Print Shield: hides all content when printing or exporting to PDF.
 * 5. Console & Data Sanitization: suppresses logging and inspect traps in production builds.
 */

let initialized = false;

export function initAppSecurity(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // 1. BLOCK KEYBOARD SHORTCUTS (F12, DevTools, View Source, Print/Save)
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + Shift + I/J/C (Developer Tools / Inspector / Console)
      if (isCtrlOrMeta && e.shiftKey) {
        const k = (e.key || "").toUpperCase();
        if (k === "I" || k === "J" || k === "C") {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }

      // Ctrl/Cmd + U (View Source), Ctrl/Cmd + S (Save Page), Ctrl/Cmd + P (Print / Save to PDF)
      if (isCtrlOrMeta) {
        const k = (e.key || "").toUpperCase();
        if (k === "U" || k === "S" || k === "P") {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },
    { capture: true }
  );

  // 2. BLOCK CONTEXT MENU (Right Click)
  window.addEventListener(
    "contextmenu",
    (e: MouseEvent) => {
      // Allow context menu only if explicitly permitted (none in core app)
      e.preventDefault();
      return false;
    },
    { capture: true }
  );

  // 3. BLOCK COPY / CUT / DRAG ON NON-INPUT CONTENT
  window.addEventListener(
    "copy",
    (e: ClipboardEvent) => {
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (!isInput) {
        e.preventDefault();
      }
    },
    { capture: true }
  );

  window.addEventListener(
    "cut",
    (e: ClipboardEvent) => {
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (!isInput) {
        e.preventDefault();
      }
    },
    { capture: true }
  );

  window.addEventListener(
    "dragstart",
    (e: DragEvent) => {
      e.preventDefault();
    },
    { capture: true }
  );

  // 4. SCREENSHOT DEFENSE FOR WEB (PrintScreen & Window Blur / Snipping Tool)
  window.addEventListener(
    "keyup",
    (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        // Clear clipboard immediately
        try {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText("");
          }
        } catch {
          // ignore
        }
        triggerScreenShield(1500);
      }
    },
    { capture: true }
  );

  // When window loses focus (e.g. Snipping Tool Win+Shift+S or external tool takes focus), blur the app
  const isTouchDevice = () => window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const onWindowBlur = () => {
    // Only shield on desktop / browser where external screen grabbers steal focus
    if (!isTouchDevice()) {
      document.documentElement.classList.add("app-screen-shield-active");
    }
  };

  const onWindowFocus = () => {
    document.documentElement.classList.remove("app-screen-shield-active");
  };

  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      document.documentElement.classList.add("app-screen-shield-active");
    } else {
      document.documentElement.classList.remove("app-screen-shield-active");
    }
  });

  // 5. PRODUCTION CONSOLE LOCKDOWN & DEVTOOLS RESIZE DETECTOR
  if (!import.meta.env.DEV) {
    try {
      const noop = () => {};
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.warn = noop;
    } catch {
      // ignore
    }

    const checkDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if (widthDiff || heightDiff) {
        console.clear();
      }
    };
    window.addEventListener("resize", checkDevTools, { passive: true });
  }
}

let shieldTimer: ReturnType<typeof setTimeout> | null = null;
function triggerScreenShield(durationMs: number): void {
  document.documentElement.classList.add("app-screen-shield-active");
  if (shieldTimer) clearTimeout(shieldTimer);
  shieldTimer = setTimeout(() => {
    document.documentElement.classList.remove("app-screen-shield-active");
    shieldTimer = null;
  }, durationMs);
}

