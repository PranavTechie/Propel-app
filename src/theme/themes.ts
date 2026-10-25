export type ThemeId = "light";

export interface ThemeVars {
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textAccent: string;
  accent: string;
  accent2: string;
  accent3: string;
  appBg: string;
  appBloom1: string;
  appBloom2: string;
  appBloom3: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  cardBlur: string;
  cardHighlight: string;
  cardHoverBg: string;
  cardHoverBorder: string;
  cardHoverShadow: string;
  cardElevatedBg: string;
  cardElevatedBorder: string;
  cardElevatedShadow: string;
  glassShadow: string;
  glassElevatedShadow: string;
  sidebarBg: string;
  sidebarBorderRight: string;
  sidebarActiveBg: string;
  sidebarActiveBorder: string;
  sidebarActiveShadow: string;
  sidebarHoverBg: string;
  btnPrimaryBg: string;
  btnPrimaryShadow: string;
  progressTrack: string;
  progressGradient: string;
  glowPrimary: string;
  graph1: string;
  graph2: string;
  graph3: string;
  chartGrid: string;
  scrollThumb: string;
  scrollThumbHover: string;
  modalBg: string;
  modalBorder: string;
  modalShadow: string;
  overlayBg: string;
  selectionBg: string;
  selectionText: string;
  skeletonFrom: string;
  skeletonTo: string;
  success: string;
  warning: string;
  danger: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  preview: { bg: string; card: string; accent: string; text: string };
  vars: ThemeVars;
}

export const THEMES: Record<ThemeId, Theme> = {
  light: {
    id: "light",
    name: "Light",
    description: "Warm, calm and focused",
    preview: {
      bg: "#F5F6F1",
      card: "#FFFFFF",
      accent: "#5AA63C",
      text: "#151914",
    },
    vars: {
      bgBase: "245 246 241",
      bgSurface: "250 251 248",
      bgElevated: "255 255 255",
      border: "87 101 81",
      textPrimary: "21 25 20",
      textSecondary: "104 112 100",
      textMuted: "150 157 145",
      textAccent: "63 127 42",
      accent: "90 166 60",
      accent2: "63 127 42",
      accent3: "117 145 71",
      appBg: "linear-gradient(145deg, #f8f9f5 0%, #f3f5ef 54%, #f7f8f3 100%)",
      appBloom1: "rgba(90,166,60,.06)",
      appBloom2: "rgba(63,127,42,.04)",
      appBloom3: "rgba(117,145,71,.03)",
      cardBg: "rgba(255,255,255,.92)",
      cardBorder: "1px solid rgba(76,91,70,.12)",
      cardShadow:
        "0 1px 2px rgba(28,40,24,.04), 0 8px 24px rgba(28,40,24,.035)",
      cardBlur: "10px",
      cardHighlight: "rgba(255,255,255,.85)",
      cardHoverBg: "#ffffff",
      cardHoverBorder: "1px solid rgba(90,166,60,.28)",
      cardHoverShadow:
        "0 2px 4px rgba(28,40,24,.05), 0 12px 30px rgba(28,40,24,.07)",
      cardElevatedBg: "#ffffff",
      cardElevatedBorder: "1px solid rgba(76,91,70,.14)",
      cardElevatedShadow: "0 16px 44px rgba(28,40,24,.11)",
      glassShadow:
        "0 1px 2px rgba(28,40,24,.04), 0 8px 24px rgba(28,40,24,.035)",
      glassElevatedShadow: "0 16px 44px rgba(28,40,24,.11)",
      sidebarBg: "rgba(250,251,248,.96)",
      sidebarBorderRight: "1px solid rgba(76,91,70,.12)",
      sidebarActiveBg: "rgba(90,166,60,.11)",
      sidebarActiveBorder: "1px solid rgba(90,166,60,.22)",
      sidebarActiveShadow: "inset 3px 0 #5AA63C",
      sidebarHoverBg: "rgba(90,166,60,.055)",
      btnPrimaryBg: "#4f9636",
      btnPrimaryShadow:
        "0 1px 2px rgba(35,80,24,.18), 0 6px 14px rgba(63,127,42,.16)",
      progressTrack: "rgba(90,166,60,.12)",
      progressGradient: "linear-gradient(90deg,#5AA63C,#3F7F2A)",
      glowPrimary: "0 0 0 4px rgba(90,166,60,.12)",
      graph1: "#4f9636",
      graph2: "#9a7b45",
      graph3: "#687064",
      chartGrid: "rgba(87,101,81,.10)",
      scrollThumb: "rgba(87,101,81,.22)",
      scrollThumbHover: "rgba(90,166,60,.42)",
      modalBg: "rgba(255,255,255,.98)",
      modalBorder: "1px solid rgba(76,91,70,.14)",
      modalShadow: "0 28px 80px rgba(28,40,24,.18)",
      overlayBg: "rgba(248,249,245,.97)",
      selectionBg: "rgba(90,166,60,.20)",
      selectionText: "#151914",
      skeletonFrom: "rgba(63,80,57,.045)",
      skeletonTo: "rgba(90,166,60,.11)",
      success: "#3F7F2A",
      warning: "#B7791F",
      danger: "#C94C43",
    },
  },
};

export const THEME_ORDER: ThemeId[] = ["light"];

/**
 * Applies a theme by setting `data-theme` on <html>. All color values live
 * in src/styles/tokens.css; this function no longer writes inline CSS vars
 * (inline vars would override the token file). `THEMES` is kept for the
 * Settings preview only.
 */
export function applyTheme(id: ThemeId): void {
  if (!THEMES[id]) return;
  const r = document.documentElement;
  r.setAttribute("data-theme", id);
}
