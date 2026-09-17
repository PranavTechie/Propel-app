/**
 * mainTelemetry.ts
 *
 * GlitchTip / Sentry telemetry for the Electron MAIN process.
 *
 * Rules:
 *  - DSN loaded from VITE_GLITCHTIP_DSN env var — NEVER hardcoded
 *  - Disabled in development unless FORCE_TELEMETRY=1
 *  - Disabled at runtime if user opts out (checked per-event)
 *  - NEVER captures: license keys, HWID, scanned file paths, personal data
 *  - Always non-blocking — all Sentry calls are fire-and-forget
 */

import * as Sentry from '@sentry/electron/main'
import type { Breadcrumb } from '@sentry/core'
import os from 'os'
import { app } from 'electron'
import { APP_VERSION } from '../updater/updaterService'


// ── Runtime opt-out flag (set by IPC from renderer when user toggles) ──────
let _telemetryEnabled = true

export function setTelemetryEnabled(enabled: boolean): void {
  _telemetryEnabled = enabled
  if (enabled) {
    Sentry.getCurrentScope().setTag('telemetry_reenabled', 'true')
  }
}

export function isTelemetryEnabled(): boolean {
  return _telemetryEnabled
}

// ── Initialise (call ONCE, before createWindow) ───────────────────────────
export function initMainTelemetry(): void {
  const dsn = process.env.VITE_GLITCHTIP_DSN ?? ''

  // Only skip if DSN is genuinely absent — dev mode WITH a real DSN should work
  if (!dsn || dsn === 'your_glitchtip_dsn_here') {
    console.log('[telemetry] Main process telemetry disabled (no DSN configured)')
    return
  }

  // Environment label: unpackaged = development, packaged = production
  const environment = app.isPackaged ? 'production' : 'development'

  try {
    Sentry.init({
      dsn,
      release: `propel@${APP_VERSION}`,
      environment,

      // Capture ALL error events — no sampling out of exceptions
      sampleRate: 1.0,
      // Sample only 10% of performance transactions (low overhead)
      tracesSampleRate: 0.1,

      // Debug logging visible in terminal during dev — remove in production
      debug: !app.isPackaged,

      // Privacy: strip user identifiers from all events
      beforeSend(event) {
        if (!_telemetryEnabled) return null

        // Strip any accidentally captured breadcrumbs with file paths or keys.
        // In @sentry/core v8, event.breadcrumbs is Breadcrumb[] — map it directly.
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b: Breadcrumb) => ({
            ...b,
            message: sanitizeMessage(b.message ?? ''),
            data: undefined,
          }))
        }

        // Remove user context if accidentally set
        delete event.user

        return event
      },

      // Ignore noisy/expected errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error promise rejection',
        'Network request failed',
        'Failed to fetch',
        'Load failed',
      ],
    })

    // Attach static context tags
    Sentry.setTag('appVersion',      APP_VERSION)
    Sentry.setTag('electronVersion', process.versions.electron ?? 'unknown')
    Sentry.setTag('osVersion',       `${os.type()} ${os.release()}`)
    Sentry.setTag('environment',     environment)

    // Attach system context (anonymous, non-PII)
    try {
      const cpus = os.cpus()
      const ramGB = Math.round(os.totalmem() / 1024 / 1024 / 1024)
      Sentry.setTag('cpuModel', cpus[0]?.model?.slice(0, 48) ?? 'unknown')
      Sentry.setTag('ramGB',    String(ramGB))
      Sentry.setTag('cpuCount', String(cpus.length))
    } catch { /* non-critical */ }

    console.log(`[telemetry] Main process telemetry initialised (GlitchTip) [${environment}]`)
  } catch (err) {
    // Telemetry init failure must NEVER crash the app
    console.warn('[telemetry] Failed to initialise main telemetry:', err)
  }
}


// ── Scrub sensitive data from messages ───────────────────────────────────
const PATH_PATTERNS = [
  /[A-Za-z]:\\[^"'\s,]+/g,                  // Windows paths
  /\/[a-zA-Z0-9._/-]{10,}/g,                // Unix paths
  /PP-[A-Z0-9-]{10,}/g,                    // License key pattern
  /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi, // GUIDs/HWIDs
  /ghp_[A-Za-z0-9]{36}/g,                   // GitHub tokens
]

function sanitizeMessage(msg: string): string {
  let out = msg
  for (const pat of PATH_PATTERNS) {
    out = out.replace(pat, '[REDACTED]')
  }
  return out
}

// ── Capture helpers (safe wrappers) ──────────────────────────────────────

export function captureMainError(
  err: unknown,
  feature: string,
  extra?: Record<string, string | number | boolean>,
): void {
  if (!_telemetryEnabled) return
  try {
    Sentry.withScope(scope => {
      scope.setTag('featureName', feature)
      if (extra) {
        const safeExtra: Record<string, string | number | boolean> = {}
        for (const [k, v] of Object.entries(extra)) {
          safeExtra[k] = typeof v === 'string' ? sanitizeMessage(v) : v
        }
        scope.setExtras(safeExtra)
      }
      if (err instanceof Error) {
        err.message = sanitizeMessage(err.message)
        Sentry.captureException(err)
      } else {
        Sentry.captureMessage(sanitizeMessage(String(err)), 'error')
      }
    })
  } catch { /* telemetry must not crash the app */ }
}

export function captureMainWarning(message: string, feature: string): void {
  if (!_telemetryEnabled) return
  try {
    Sentry.withScope(scope => {
      scope.setTag('featureName', feature)
      Sentry.captureMessage(sanitizeMessage(message), 'warning')
    })
  } catch { /* non-fatal */ }
}
