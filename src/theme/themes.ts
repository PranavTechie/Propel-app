// Theme registry. All color values live in src/styles/tokens.css; a theme
// here is only an id that selects a token set via `data-theme` on <html>.
// Dark tokens exist ([data-theme="dark"]) but are not selectable yet.
export type ThemeId = "light";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  light: {
    id: "light",
    name: "Light",
    description: "Warm, calm and focused",
  },
};

export const THEME_ORDER: ThemeId[] = ["light"];

/** Applies a theme by setting `data-theme` on <html>. */
export function applyTheme(id: ThemeId): void {
  if (!THEMES[id]) return;
  document.documentElement.setAttribute("data-theme", id);
}
