/** Theme preference (9.8: follow the system by default). Stored per browser. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "sava.theme";

/**
 * Runs before paint (inlined in the root layout) so the page never flashes the wrong theme.
 * Keep it dependency-free and tiny.
 */
export const themeInitScript = `(() => {
  try {
    var p = localStorage.getItem("${THEME_STORAGE_KEY}") || "system";
    var dark = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();`;

export function readThemePreference(): ThemePreference {
  try {
    const p = localStorage.getItem(THEME_STORAGE_KEY);
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(p: ThemePreference) {
  try {
    if (p === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, p);
  } catch {
    // storage blocked: the choice still applies for this page view
  }
  const dark = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
