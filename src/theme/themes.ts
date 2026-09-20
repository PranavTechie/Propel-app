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

export function applyTheme(id: ThemeId): void {
  const v = THEMES[id]?.vars;
  if (!v) return;
  const r = document.documentElement;
  r.setAttribute("data-theme", id);
  const values: Record<string, string> = {
    "--t-bg-base": v.bgBase,
    "--t-bg-surface": v.bgSurface,
    "--t-bg-elevated": v.bgElevated,
    "--t-border": v.border,
    "--t-text-primary": v.textPrimary,
    "--t-text-secondary": v.textSecondary,
    "--t-text-muted": v.textMuted,
    "--t-text-accent": v.textAccent,
    "--t-accent": v.accent,
    "--t-accent2": v.accent2,
    "--t-accent3": v.accent3,
    "--c-accent": v.accent,
    "--t-app-bg": v.appBg,
    "--t-app-bloom-1": v.appBloom1,
    "--t-app-bloom-2": v.appBloom2,
    "--t-app-bloom-3": v.appBloom3,
    "--t-card-bg": v.cardBg,
    "--t-card-border": v.cardBorder,
    "--t-card-shadow": v.cardShadow,
    "--t-card-blur": v.cardBlur,
    "--t-card-highlight": v.cardHighlight,
    "--t-card-hover-bg": v.cardHoverBg,
    "--t-card-hover-border": v.cardHoverBorder,
    "--t-card-hover-shadow": v.cardHoverShadow,
    "--t-card-elevated-bg": v.cardElevatedBg,
    "--t-card-elevated-border": v.cardElevatedBorder,
    "--t-card-elevated-shadow": v.cardElevatedShadow,
    "--t-glass-shadow": v.glassShadow,
    "--t-glass-elevated-shadow": v.glassElevatedShadow,
    "--t-sidebar-bg": v.sidebarBg,
    "--t-sidebar-border-right": v.sidebarBorderRight,
    "--t-sidebar-active-bg": v.sidebarActiveBg,
    "--t-sidebar-active-border": v.sidebarActiveBorder,
    "--t-sidebar-active-shadow": v.sidebarActiveShadow,
    "--t-sidebar-hover-bg": v.sidebarHoverBg,
    "--t-btn-bg": v.btnPrimaryBg,
    "--t-btn-shadow": v.btnPrimaryShadow,
    "--t-progress-track": v.progressTrack,
    "--t-progress-gradient": v.progressGradient,
    "--t-glow-primary": v.glowPrimary,
    "--graph-1": v.graph1,
    "--graph-2": v.graph2,
    "--graph-3": v.graph3,
    "--t-chart-grid": v.chartGrid,
    "--t-scroll-thumb": v.scrollThumb,
    "--t-scroll-thumb-hover": v.scrollThumbHover,
    "--t-modal-bg": v.modalBg,
    "--t-modal-border": v.modalBorder,
    "--t-modal-shadow": v.modalShadow,
    "--overlay-bg": v.overlayBg,
    "--t-selection-bg": v.selectionBg,
    "--t-selection-text": v.selectionText,
    "--t-skeleton-from": v.skeletonFrom,
    "--t-skeleton-to": v.skeletonTo,
  };
  Object.entries(values).forEach(([key, value]) =>
    r.style.setProperty(key, value),
  );
}
