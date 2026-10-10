import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyTheme, type ThemeId } from '@/theme/themes'

// ── Store ─────────────────────────────────────────────────────────────────
interface SettingsState {
  soundEnabled:   boolean

  themeId:        ThemeId
  // Crash reporting — default ON in production, OFF in dev
  crashReporting: boolean
  aiAdvisorConsent: boolean
  setSoundEnabled:     (v: boolean)       => void

  setThemeId:          (t: ThemeId)       => void
  setCrashReporting:   (v: boolean)       => void
  setAiAdvisorConsent: (v: boolean)       => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled:   false,

      themeId:        'light',
      // Default ON in production, OFF in dev so engineers aren't tracked during development
      crashReporting: import.meta.env.PROD ?? true,
      aiAdvisorConsent: false,
      setSoundEnabled:   (v) => set({ soundEnabled: v }),
      setAiAdvisorConsent: (v) => set({ aiAdvisorConsent: v }),

      setThemeId:        (t) => {
        set({ themeId: t })
        applyTheme(t)
      },
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
    { 
      name: 'propel-settings',
      version: 2, // bump to migrate away from removed 'pure-black' theme
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        // Any prior version may have stored themeId: 'pure-black' — force light
        if (version < 2) {
          state.themeId = 'light'
        }
        return state
      },
    },
  ),
)
