import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'
import { applyTheme } from './theme/themes'
import { installCrashHandlers } from './services/crashLogger'
import { initRendererTelemetry } from './services/telemetry'
import { TelemetryErrorBoundary } from './components/common/TelemetryErrorBoundary'
import type { ThemeId } from './theme/themes'

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
      'color: #6366f1; font-weight: bold',
    )
  }).catch(() => { /* non-fatal — never breaks dev server */ })
}


// Apply stored theme before first render to avoid flash of wrong theme
try {
  const raw = localStorage.getItem('cm-settings')
  const stored = raw ? (JSON.parse(raw) as { state?: { themeId?: ThemeId } }) : null
  const id = stored?.state?.themeId
  applyTheme(id === 'light' || id === 'pure-black' ? id : 'light')
} catch {
  applyTheme('light')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Top-level boundary: catches any unhandled crash in the entire React tree */}
    <TelemetryErrorBoundary page="root" feature="app-shell">
      <App />
    </TelemetryErrorBoundary>
  </React.StrictMode>,
)
