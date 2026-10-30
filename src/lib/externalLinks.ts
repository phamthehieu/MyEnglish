import { isTauri } from "./platform";

/** The privacy policy, published with the web app (public/privacy.html) */
export const PRIVACY_URL = "https://phamthehieu.github.io/MyEnglish/privacy.html";

/** Open a web page outside the app: the system browser from the apps, a new tab from the web app */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}
