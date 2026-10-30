import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/google-sans-flex/wght.css";
import "./index.css";
import { initTheme } from "./services/theme";
import { restoreLocalStorageFromDb, startLocalStorageBackup } from "./services/storageBackup";
import { getInitialWindowLabel } from "./lib/windowLabel";
import { initStrictInputGuards } from "./lib/inputGuards";
import { installErrorReporting } from "./services/errorReport";

// Errors nothing handles go to the developer (src/services/errorReport.ts), from the very start
installErrorReporting();
// Initialize theme (dark/light/system) before first paint
initTheme();
// Enforce strict raw keyboard input across all inputs in the system
initStrictInputGuards();

async function bootstrap() {
  // Restore learning progress mirrored in SQLite before services read localStorage.
  // Wait for it fully: a backup started before restore finished could overwrite SQLite with defaults.
  if ("__TAURI_INTERNALS__" in window) {
    try {
      if (getInitialWindowLabel() === "main") {
        // Main window only: loaded on demand so the other windows (popup, nudge) don't pull the
        // migration's services (grammar book, catalog, db, smart review) into their startup
        const { ensureReleaseMigrationV27 } = await import("./services/releaseMigration");
        await ensureReleaseMigrationV27();
      }
      await restoreLocalStorageFromDb();
      // Windows share localStorage, so only the main window mirrors it back
      if (getInitialWindowLabel() === "main") startLocalStorageBackup();
    } catch (err) {
      console.warn("localStorage restore failed, backup disabled for this session:", err);
    }
  } else {
    // index.css sizes the web app to what shows between a phone browser's bars
    document.documentElement.classList.add("web-app");
    // Words read aloud by themselves stay silent in a browser until a first tap unlocks speech
    void import("./components/review/speech").then(({ unlockWebSpeechOnFirstTap }) => unlockWebSpeechOnFirstTap());
    // The web app: offline use and updates through its service worker (not in development: it would cache the
    // files being edited)
    if (import.meta.env.PROD) void import("./services/webApp").then(({ startWebApp }) => startWebApp());
    // Its database lives in this browser and one tab holds it; open it before anything shows, so a second tab says
    // so instead of showing an empty app
    try {
      const { getDatabase } = await import("./services/db");
      await getDatabase();
    } catch (err) {
      const { DatabaseInUseError } = await import("./services/sqlite/open");
      if (err instanceof DatabaseInUseError) {
        const { default: OpenElsewhere } = await import("./components/OpenElsewhere");
        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<OpenElsewhere message={err.message} />);
        return;
      }
      console.error("Database initialization failed:", err);
    }
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
