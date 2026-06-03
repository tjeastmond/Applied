export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "applied-dev-theme";

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function themeInitScript(): string {
  return `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;
}
