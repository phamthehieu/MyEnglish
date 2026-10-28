/**
 * Screens that are for the developer, not for learners: they write to the real database or ask for JSON and
 * prompts. A dev build shows them; on an installed app `localStorage.setItem("myenglish_dev_tools", "1")`
 * turns them on.
 */
export const SHOW_DEV_TOOLS: boolean = (() => {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem("myenglish_dev_tools") === "1";
  } catch {
    return false;
  }
})();
