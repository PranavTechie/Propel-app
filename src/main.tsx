import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'
import { initTheme } from './theme/themes'
import { useSettingsStore } from './store/settingsStore'
import { installCrashHandlers } from './services/crashLogger'
import { initRendererTelemetry } from './services/telemetry'
import { TelemetryErrorBoundary } from './components/common/TelemetryErrorBoundary'

// ── Theme: apply synchronously BEFORE anything renders ───────────────────
// Sets data-theme + color-scheme on <html> so the first paint already uses
// the right token set. A missing/invalid/old saved value falls back to light.
try {
  initTheme(useSettingsStore.getState().themeId)
} catch {
  initTheme('light')
}

// ── Telemetry: init BEFORE rendering, non-blocking ───────────────────────
initRendererTelemetry()

// ── Local crash handlers: window.onerror + unhandledrejection ────────────
installCrashHandlers()

// ── Dev-only: expose test utilities on window.__cmTelemetryTest ──────────
// Dynamic import inside DEV guard → Vite tree-shakes this out of production bundles entirely.
if (import.meta.env.DEV) {
  import('./services/telemetryTestUtils').then((mod) => {
    window.__cmTelemetryTest = {
      testMessage:      mod.testMessage,
      rendererCrash:    mod.rendererCrash,
      unhandledPromise: mod.unhandledPromise,
      ipcFailure:       mod.ipcFailure,
      hardTest:         mod.hardTest,
      getStatus:        mod.getStatus,
    }
    console.log(
      '%c[Propel Dev] Telemetry test suite ready → window.__cmTelemetryTest',
      'font-weight: bold',
    )
  }).catch(() => { /* non-fatal — never breaks dev server */ })
}


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Top-level boundary: catches any unhandled crash in the entire React tree */}
    <TelemetryErrorBoundary page="root" feature="app-shell">
      <App />
    </TelemetryErrorBoundary>
  </React.StrictMode>,
)
