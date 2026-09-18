import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@/theme/themes'

export type ToastPosition = 'bottom-right' | 'top-right' | 'system-default'

// ── Store ─────────────────────────────────────────────────────────────────
interface SettingsState {
  soundEnabled:   boolean
  toastPosition:  ToastPosition
  overlayEnabled: boolean
  themeId:        ThemeId
  // Crash reporting — default ON in production, OFF in dev
  crashReporting: boolean
  setSoundEnabled:     (v: boolean)       => void
  setToastPosition:    (p: ToastPosition) => void
  setOverlayEnabled:   (v: boolean)       => void
  setThemeId:          (t: ThemeId)       => void
  setCrashReporting:   (v: boolean)       => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled:   false,
      toastPosition:  'bottom-right',
      overlayEnabled: false,
      themeId:        'light',
      // Default ON in production, OFF in dev so engineers aren't tracked during development
      crashReporting: import.meta.env.PROD ?? true,
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
