export type ThemeId = 'light' | 'pure-black'


// ThemeVars every visual layer of the application

export interface ThemeVars {
  // Tailwind-compat (space-sep RGB used in rgb(var(--X) / alpha))
  bgBase:        string
  bgSurface:     string
  bgElevated:    string
  border:        string
  textPrimary:   string
  textSecondary: string
  textMuted:     string
  textAccent:    string
  accent:        string   // also drives --c-accent
  accent2:       string
  accent3:       string

  // App atmosphere full CSS values
  appBg:    string   // background property value (can be gradient)
  appBloom1: string  // rgba for ambient blob 1
  appBloom2: string  // rgba for ambient blob 2
  appBloom3: string  // rgba for ambient blob 3

  // Card surfaces â€” glassmorphism / matte / frosted per theme
  cardBg:              string  // background
  cardBorder:          string  // full border shorthand
  cardShadow:          string  // box-shadow
  cardBlur:            string  // e.g. '28px' â€” used inside backdrop-filter: blur()
  cardHighlight:       string  // inset top-edge glow (light on dark, subtle on light)
  cardHoverBg:         string
  cardHoverBorder:     string
  cardHoverShadow:     string
  cardElevatedBg:      string
  cardElevatedBorder:  string
  cardElevatedShadow:  string
  glassShadow:         string  // outer shadow for .glass utility class
  glassElevatedShadow: string  // outer shadow for .glass-elevated utility class

  // Sidebar atmosphere
  sidebarBg:           string
  sidebarBorderRight:  string
  sidebarActiveBg:     string
  sidebarActiveBorder: string  // border-left shorthand for active pill
  sidebarActiveShadow: string
  sidebarHoverBg:      string

  // Button â€” primary action
  btnPrimaryBg:     string  // background (gradient)
  btnPrimaryShadow: string  // box-shadow

  // Progress / stat bars
  progressTrack:    string  // track background
  progressGradient: string  // fill gradient

  // Glow system
  glowPrimary: string  // full box-shadow value for .glow-primary

  // Charts (hex â€” read directly by Recharts)
  graph1:    string
  graph2:    string
  graph3:    string
  chartGrid: string  // rgba for CartesianGrid stroke

  // Scrollbar
  scrollThumb:      string
  scrollThumbHover: string

  // Modal surfaces
  modalBg:     string
  modalBorder: string
  modalShadow: string

  // Floating overlay window
  overlayBg: string

  // Text selection
  selectionBg:   string  // ::selection background
  selectionText: string  // ::selection text color

  // Skeleton shimmer
  skeletonFrom: string  // skeleton animation low color
  skeletonTo:   string  // skeleton animation peak color

  // Semantic (fixed across themes for legibility)
  success: string
  warning: string
  danger:  string
}

export interface Theme {
  id:          ThemeId
  name:        string
  description: string
  preview: {
    bg:     string
    card:   string
    accent: string
    text:   string
  }
  vars: ThemeVars
}

// THEME DEFINITIONS — every theme must provide values for all ThemeVars
export const THEMES: Record<ThemeId, Theme> = {


  // Premium warm light mode Â· Apple / Windows 11 aesthetic Â· frosted glass cards
  'light': {
    id: 'light',
    name: 'Light',
    description: 'Premium warm light mode frosted glass cards with soft elevated surfaces',
    preview: { bg: '#f0f0f8', card: '#ffffff', accent: '#6366f1', text: '#0f0f23' },
    vars: {
      bgBase:        '240 240 248',
      bgSurface:     '248 248 255',
      bgElevated:    '255 255 255',
      border:        '100 100 140',
      textPrimary:   '15 15 35',
      textSecondary: '88 88 120',
      textMuted:     '148 148 175',
      textAccent:    '99 102 241',
      accent:        '99 102 241',
      accent2:       '139 92 246',
      accent3:       '59 130 246',
      appBg:
        'radial-gradient(ellipse 80% 60% at 15% 50%, rgba(99,102,241,0.07) 0%, transparent 60%),' +
        'radial-gradient(ellipse 60% 50% at 88% 15%, rgba(59,130,246,0.05) 0%, transparent 55%),' +
        'radial-gradient(ellipse 50% 70% at 50% 100%, rgba(139,92,246,0.04) 0%, transparent 60%),' +
        'linear-gradient(155deg, #f5f5ff 0%, #f0f0f8 45%, #f4f8ff 100%)',
      appBloom1: 'rgba(99,102,241,0.09)',
      appBloom2: 'rgba(59,130,246,0.07)',
      appBloom3: 'rgba(139,92,246,0.05)',
      // Light frosted glass — warm white translucent surfaces
      cardBg:              'rgba(255,255,255,0.68)',
      cardBorder:          '1px solid rgba(100,100,140,0.14)',
      cardShadow:          '0 4px 24px rgba(0,0,30,0.08), inset 0 1px 0 rgba(255,255,255,0.90)',
      cardBlur:            '20px',
      cardHighlight:       'rgba(255,255,255,0.80)',
      cardHoverBg:         'rgba(255,255,255,0.88)',
      cardHoverBorder:     '1px solid rgba(99,102,241,0.24)',
      cardHoverShadow:     '0 8px 32px rgba(0,0,30,0.12), 0 0 0 1px rgba(99,102,241,0.12), 0 0 24px rgba(99,102,241,0.06)',
      cardElevatedBg:      'rgba(255,255,255,0.85)',
      cardElevatedBorder:  '1px solid rgba(100,100,140,0.18)',
      cardElevatedShadow:  '0 8px 36px rgba(0,0,30,0.11), inset 0 1px 0 rgba(255,255,255,0.95)',
      glassShadow:         '0 4px 24px rgba(0,0,30,0.09)',
      glassElevatedShadow: '0 8px 36px rgba(0,0,30,0.12)',
      // Light matte sidebar
      sidebarBg:           'rgba(242,242,252,0.92)',
      sidebarBorderRight:  '1px solid rgba(100,100,140,0.12)',
      sidebarActiveBg:     'rgba(99,102,241,0.10)',
      sidebarActiveBorder: '3px solid rgba(99,102,241,0.55)',
      sidebarActiveShadow: 'inset 0 0 20px rgba(99,102,241,0.07)',
      sidebarHoverBg:      'rgba(99,102,241,0.06)',
      btnPrimaryBg:     'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #7c3aed 100%)',
      btnPrimaryShadow: '0 4px 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.30)',
      progressTrack:    'rgba(99,102,241,0.10)',
      progressGradient: 'linear-gradient(90deg, #4338ca, #6366f1, #8b5cf6)',
      glowPrimary:  '0 0 20px rgba(99,102,241,0.28), 0 0 56px rgba(99,102,241,0.10)',
      graph1:    '#6366f1',
      graph2:    '#8b5cf6',
      graph3:    '#3b82f6',
      chartGrid: 'rgba(99,102,241,0.07)',
      scrollThumb:      'rgba(100,100,140,0.22)',
      scrollThumbHover: 'rgba(99,102,241,0.40)',
      modalBg:     'rgba(248,248,255,0.97)',
      modalBorder: '1px solid rgba(100,100,140,0.18)',
      modalShadow: '0 28px 80px rgba(0,0,30,0.18), 0 0 0 1px rgba(100,100,140,0.12)',
      overlayBg:  'rgba(242,242,252,0.95)',
      selectionBg:   'rgba(99,102,241,0.20)',
      selectionText: '#0f0f23',
      skeletonFrom:  'rgba(0,0,30,0.04)',
      skeletonTo:    'rgba(0,0,30,0.08)',
      success: '#059669',
      warning: '#d97706',
      danger:  '#dc2626',
    },
  },

  //  Pure Black
  // AMOLED-optimised ultra-premium dark Â· matte void black Â· neon purple glow
  'pure-black': {
    id: 'pure-black',
    name: 'Pure Black',
    description: 'AMOLED-optimized ultra-premium dark neon glow on void black',
    preview: { bg: '#000000', card: '#0d0d0d', accent: '#a855f7', text: '#ffffff' },
    vars: {
      bgBase:        '0 0 0',
      bgSurface:     '8 8 8',
      bgElevated:    '14 14 14',
      border:        '200 200 200',
      textPrimary:   '255 255 255',
      textSecondary: '160 160 160',
      textMuted:     '88 88 88',
      textAccent:    '192 132 252',
      accent:        '168 85 247',
      accent2:       '192 132 252',
      accent3:       '96 165 250',
      appBg:
        'radial-gradient(ellipse 65% 55% at 20% 60%, rgba(168,85,247,0.10) 0%, transparent 58%),' +
        'radial-gradient(ellipse 50% 45% at 85% 15%, rgba(96,165,250,0.07) 0%, transparent 55%),' +
        '#000000',
      appBloom1: 'rgba(168,85,247,0.12)',
      appBloom2: 'rgba(96,165,250,0.08)',
      appBloom3: 'rgba(192,132,252,0.06)',
      // MATTE black no blur for OLED efficiency, razor-sharp edges
      cardBg:              'rgba(12,12,12,0.96)',
      cardBorder:          '1px solid rgba(255,255,255,0.07)',
      cardShadow:          '0 4px 24px rgba(0,0,0,0.80), inset 0 1px 0 rgba(255,255,255,0.04)',
      cardBlur:            '0px',
      cardHighlight:       'rgba(255,255,255,0.04)',
      cardHoverBg:         'rgba(20,20,20,0.98)',
      cardHoverBorder:     '1px solid rgba(192,132,252,0.30)',
      cardHoverShadow:     '0 8px 36px rgba(0,0,0,0.88), 0 0 0 1px rgba(168,85,247,0.22), 0 0 28px rgba(168,85,247,0.12)',
      cardElevatedBg:      'rgba(16,16,16,0.98)',
      cardElevatedBorder:  '1px solid rgba(255,255,255,0.09)',
      cardElevatedShadow:  '0 8px 32px rgba(0,0,0,0.84), inset 0 1px 0 rgba(255,255,255,0.05)',
      glassShadow:         '0 8px 32px rgba(0,0,0,0.80)',
      glassElevatedShadow: '0 12px 40px rgba(0,0,0,0.88)',
      sidebarBg:           'rgba(0,0,0,0.98)',
      sidebarBorderRight:  '1px solid rgba(255,255,255,0.06)',
      sidebarActiveBg:     'rgba(168,85,247,0.12)',
      sidebarActiveBorder: '3px solid rgba(192,132,252,0.60)',
      sidebarActiveShadow: 'inset 0 0 28px rgba(168,85,247,0.10)',
      sidebarHoverBg:      'rgba(255,255,255,0.04)',
      btnPrimaryBg:     'linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #a855f7 100%)',
      btnPrimaryShadow: '0 4px 22px rgba(168,85,247,0.50), inset 0 1px 0 rgba(255,255,255,0.16)',
      progressTrack:    'rgba(168,85,247,0.10)',
      progressGradient: 'linear-gradient(90deg, #581c87, #7e22ce, #c084fc)',
      glowPrimary:  '0 0 28px rgba(168,85,247,0.55), 0 0 80px rgba(168,85,247,0.22)',
      graph1:    '#a855f7',
      graph2:    '#c084fc',
      graph3:    '#60a5fa',
      chartGrid: 'rgba(168,85,247,0.08)',
      scrollThumb:      'rgba(168,85,247,0.38)',
      scrollThumbHover: 'rgba(168,85,247,0.62)',
      modalBg:     'rgba(4,4,4,0.99)',
      modalBorder: '1px solid rgba(255,255,255,0.09)',
      modalShadow: '0 28px 80px rgba(0,0,0,0.96), 0 0 0 1px rgba(168,85,247,0.16)',
      overlayBg:  'rgba(0,0,0,0.97)',
      selectionBg:   'rgba(168,85,247,0.40)',
      selectionText: '#ffffff',
      skeletonFrom:  'rgba(255,255,255,0.03)',
      skeletonTo:    'rgba(255,255,255,0.07)',
      success: '#10b981',
      warning: '#f59e0b',
      danger:  '#ef4444',
    },
  },
}

export const THEME_ORDER: ThemeId[] = [
  'light',
  'pure-black',
]

// ─────────────────────────────────────────────────────────────────────────────
// applyTheme — injects all CSS variables into document.documentElement.style
// ─────────────────────────────────────────────────────────────────────────────
export function applyTheme(id: ThemeId): void {
  const theme = THEMES[id]
  if (!theme) return
  const v = theme.vars
  const r = document.documentElement

  // data-theme attribute (for CSS selector overrides)
  r.setAttribute('data-theme', id) // Core CSS variables for Tailwind and custom styles

  // Tailwind-compat vars (space-sep RGB)
  r.style.setProperty('--t-bg-base',        v.bgBase)
  r.style.setProperty('--t-bg-surface',     v.bgSurface)
  r.style.setProperty('--t-bg-elevated',    v.bgElevated)
  r.style.setProperty('--t-border',         v.border)
  r.style.setProperty('--t-text-primary',   v.textPrimary)
  r.style.setProperty('--t-text-secondary', v.textSecondary)
  r.style.setProperty('--t-text-muted',     v.textMuted)
  r.style.setProperty('--t-text-accent',    v.textAccent)
  r.style.setProperty('--t-accent',         v.accent)
  r.style.setProperty('--t-accent2',        v.accent2)
  r.style.setProperty('--t-accent3',        v.accent3)
  r.style.setProperty('--c-accent',         v.accent)   // alias for accent picker

  // App atmosphere
  r.style.setProperty('--t-app-bg',      v.appBg)
  r.style.setProperty('--t-app-bloom-1', v.appBloom1)
  r.style.setProperty('--t-app-bloom-2', v.appBloom2)
  r.style.setProperty('--t-app-bloom-3', v.appBloom3)

  // Card surfaces
  r.style.setProperty('--t-card-bg',                  v.cardBg)
  r.style.setProperty('--t-card-border',              v.cardBorder)
  r.style.setProperty('--t-card-shadow',              v.cardShadow)
  r.style.setProperty('--t-card-blur',                v.cardBlur)
  r.style.setProperty('--t-card-highlight',           v.cardHighlight)
  r.style.setProperty('--t-card-hover-bg',            v.cardHoverBg)
  r.style.setProperty('--t-card-hover-border',        v.cardHoverBorder)
  r.style.setProperty('--t-card-hover-shadow',        v.cardHoverShadow)
  r.style.setProperty('--t-card-elevated-bg',         v.cardElevatedBg)
  r.style.setProperty('--t-card-elevated-border',     v.cardElevatedBorder)
  r.style.setProperty('--t-card-elevated-shadow',     v.cardElevatedShadow)
  r.style.setProperty('--t-glass-shadow',             v.glassShadow)
  r.style.setProperty('--t-glass-elevated-shadow',    v.glassElevatedShadow)

  // Sidebar
  r.style.setProperty('--t-sidebar-bg',            v.sidebarBg)
  r.style.setProperty('--t-sidebar-border-right',  v.sidebarBorderRight)
  r.style.setProperty('--t-sidebar-active-bg',     v.sidebarActiveBg)
  r.style.setProperty('--t-sidebar-active-border', v.sidebarActiveBorder)
  r.style.setProperty('--t-sidebar-active-shadow', v.sidebarActiveShadow)
  r.style.setProperty('--t-sidebar-hover-bg',      v.sidebarHoverBg)

  // Buttons
  r.style.setProperty('--t-btn-bg',     v.btnPrimaryBg)
  r.style.setProperty('--t-btn-shadow', v.btnPrimaryShadow)

  // Progress
  r.style.setProperty('--t-progress-track',    v.progressTrack)
  r.style.setProperty('--t-progress-gradient', v.progressGradient)

  // Glow
  r.style.setProperty('--t-glow-primary', v.glowPrimary)

  // Charts
  r.style.setProperty('--graph-1',      v.graph1)
  r.style.setProperty('--graph-2',      v.graph2)
  r.style.setProperty('--graph-3',      v.graph3)
  r.style.setProperty('--t-chart-grid', v.chartGrid)

  // Scrollbar
  r.style.setProperty('--t-scroll-thumb',       v.scrollThumb)
  r.style.setProperty('--t-scroll-thumb-hover', v.scrollThumbHover)

  // Modal
  r.style.setProperty('--t-modal-bg',     v.modalBg)
  r.style.setProperty('--t-modal-border', v.modalBorder)
  r.style.setProperty('--t-modal-shadow', v.modalShadow)

  // Overlay
  r.style.setProperty('--overlay-bg', v.overlayBg)

  // Selection
  r.style.setProperty('--t-selection-bg',   v.selectionBg)
  r.style.setProperty('--t-selection-text', v.selectionText)

  // Skeleton
  r.style.setProperty('--t-skeleton-from', v.skeletonFrom)
  r.style.setProperty('--t-skeleton-to',   v.skeletonTo)
}
