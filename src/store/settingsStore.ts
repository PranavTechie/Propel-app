import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@/theme/themes'

// ── Accent color definitions ───────────────────────────────────────────────
export type AccentColor   = 'purple' | 'blue' | 'red' | 'emerald' | 'orange'
export type ToastPosition = 'bottom-right' | 'top-right' | 'system-default'

export const ACCENT_DEFS: Record<AccentColor, {
  label:    string
  rgb:      string     // space-sep for CSS rgb()
  hex:      string
  tw:       string     // Tailwind color name
}> = {
  purple:  { label: 'Purple',  rgb: '99 102 241',  hex: '#6366f1', tw: 'indigo'  },
  blue:    { label: 'Blue',    rgb: '59 130 246',   hex: '#3b82f6', tw: 'blue'    },
  red:     { label: 'Red',     rgb: '239 68 68',    hex: '#ef4444', tw: 'red'     },
  emerald: { label: 'Emerald', rgb: '16 185 129',   hex: '#10b981', tw: 'emerald' },
  orange:  { label: 'Orange',  rgb: '249 115 22',   hex: '#f97316', tw: 'orange'  },
}

// Tailwind class sets per accent (static strings → all included by JIT)
export const ACCENT_TW: Record<AccentColor, {
  active:    string
  indicator: string
  icon:      string
  chevron:   string
}> = {
  purple:  { active: 'bg-brand-primary/10 text-brand-primary', indicator: 'bg-brand-primary/10 border-brand-primary/20', icon: 'text-brand-primary', chevron: 'text-brand-primary/50' },
  blue:    { active: 'bg-blue-500/10 text-blue-400',      indicator: 'bg-blue-500/10 border-blue-500/20',      icon: 'text-blue-400',    chevron: 'text-blue-400/50'    },
  red:     { active: 'bg-red-500/10 text-red-400',        indicator: 'bg-red-500/10 border-red-500/20',        icon: 'text-red-400',     chevron: 'text-red-400/50'     },
  emerald: { active: 'bg-emerald-500/10 text-emerald-400', indicator: 'bg-emerald-500/10 border-emerald-500/20', icon: 'text-emerald-400', chevron: 'text-emerald-400/50' },
  orange:  { active: 'bg-orange-500/10 text-orange-400',  indicator: 'bg-orange-500/10 border-orange-500/20',  icon: 'text-orange-400',  chevron: 'text-orange-400/50'  },
}

// ── Store ─────────────────────────────────────────────────────────────────
interface SettingsState {
  accentColor:    AccentColor
  soundEnabled:   boolean
  toastPosition:  ToastPosition
  overlayEnabled: boolean
  themeId:        ThemeId
  // Crash reporting — default ON in production, OFF in dev
  crashReporting: boolean
  setAccentColor:      (c: AccentColor)   => void
  setSoundEnabled:     (v: boolean)       => void
  setToastPosition:    (p: ToastPosition) => void
  setOverlayEnabled:   (v: boolean)       => void
  setThemeId:          (t: ThemeId)       => void
  setCrashReporting:   (v: boolean)       => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      accentColor:    'purple',
      soundEnabled:   false,
      toastPosition:  'bottom-right',
      overlayEnabled: false,
      themeId:        'light',
      // Default ON in production, OFF in dev so engineers aren't tracked during development
      crashReporting: import.meta.env.PROD ?? true,
      setAccentColor:    (c) => set({ accentColor: c }),
      setSoundEnabled:   (v) => set({ soundEnabled: v }),
      setToastPosition:  (p) => set({ toastPosition: p }),
      setOverlayEnabled: (v) => set({ overlayEnabled: v }),
      setThemeId:        (t) => set({ themeId: t }),
      setCrashReporting: (v) => {
        set({ crashReporting: v })
        // Propagate to renderer telemetry immediately
        import('@/services/telemetry').then(({ setRendererTelemetryEnabled }) => {
          setRendererTelemetryEnabled(v)
        }).catch(() => {})
        // Propagate to main process via IPC (best-effort)
        try {
          window.electronAPI?.telemetry?.setEnabled(v)
        } catch { /* non-fatal */ }
      },
    }),
    { name: 'cm-settings' },
  ),
)
