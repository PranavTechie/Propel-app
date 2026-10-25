// Theme registry + runtime. All color values live in src/styles/tokens.css;
// a theme only selects a token set via `data-theme` on <html>.
//
// Modes:   light | dark | system   (what the user picked, persisted)
// Resolved: light | dark           (what is painted right now)
//
// Safety: every entry point is wrapped so a bad saved value or a missing
// bridge can never leave the window blank. Unknown values fall back to light.

export type ThemeId = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  light: { id: "light", name: "Light", description: "Bright and calm" },
  dark: { id: "dark", name: "Dark", description: "Easy on the eyes at night" },
  system: { id: "system", name: "System", description: "Follows your Windows setting" },
};

export const THEME_ORDER: ThemeId[] = ["light", "dark", "system"];

export function isThemeId(value: unknown): value is ThemeId {
  return value === "light" || value === "dark" || value === "system";
}

// The overlay HUD window loads the same renderer; it never drives the
// native theme or the main window background.
const IS_OVERLAY = (() => {
  try {
    return new URLSearchParams(window.location.search).get("mode") === "overlay";
  } catch {
    return false;
  }
})();

let currentMode: ThemeId = "light";
let resolved: ResolvedTheme = "light";
let systemListenerAttached = false;
let fadeTimer: number | undefined;
const listeners = new Set<() => void>();

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Paints a resolved theme on <html>. Optional 160ms cross-fade. */
function paint(next: ResolvedTheme, animate: boolean): void {
  const root = document.documentElement;
  if (animate && next !== resolved && !prefersReducedMotion()) {
    root.classList.add("theme-transition");
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 220);
  }
  root.setAttribute("data-theme", next);
  root.style.colorScheme = next;
  root.dataset.themeMode = currentMode;
  if (next !== resolved) {
    resolved = next;
    listeners.forEach((l) => l());
  }
}

function attachSystemListener(): void {
  if (systemListenerAttached) return;
  systemListenerAttached = true;
  try {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      // Only meaningful while following Windows; in light/dark mode the main
      // process pins nativeTheme, so these events are ignored.
      if (currentMode !== "system") return;
      paint(e.matches ? "dark" : "light", true);
      // Keep the native window background in step with Windows.
      if (!IS_OVERLAY) window.electronAPI?.theme?.set("system").catch(() => {});
    };
    mql.addEventListener("change", onChange);
  } catch {
    /* matchMedia unavailable: system mode simply stays on its first value */
  }
}

/**
 * Applies a theme mode. Safe to call with anything: invalid values become
 * "light". Syncs nativeTheme + window background through the main process.
 */
export function applyTheme(id: ThemeId, opts: { animate?: boolean } = {}): void {
  try {
    const mode: ThemeId = isThemeId(id) ? id : "light";
    currentMode = mode;
    const next: ResolvedTheme =
      mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
    paint(next, opts.animate ?? true);
    attachSystemListener();

    if (!IS_OVERLAY) {
      window.electronAPI?.theme
        ?.set(mode)
        .then((res) => {
          // In system mode the main process is the authority on Windows' theme.
          if (res?.ok && currentMode === "system") paint(res.dark ? "dark" : "light", true);
        })
        .catch(() => {
          /* bridge unavailable: renderer theme still applied */
        });
    }
  } catch {
    try {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
    } catch {
      /* nothing else we can do */
    }
  }
}

/** Startup entry: apply synchronously, without the cross-fade. */
export function initTheme(saved: unknown): void {
  applyTheme(isThemeId(saved) ? saved : "light", { animate: false });
}

export function getResolvedTheme(): ResolvedTheme {
  return resolved;
}

export function subscribeResolvedTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
