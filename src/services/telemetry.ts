/**
 * telemetry.ts — Renderer process telemetry wrapper
 *
 * GlitchTip/Sentry for the React renderer.
 * DSN injected via Vite's import.meta.env — never hardcoded.
 *
 * Privacy rules:
 *  - No file paths, license keys, HWID, or personal data
 *  - Only disabled if NO DSN is configured (dev without DSN is fine, dev WITH DSN works)
 *  - Respects user opt-out (crashReporting setting)
 */

import * as Sentry from '@sentry/react'

// Version constant — keep in sync with updaterService.ts APP_VERSION
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.4'

let _initialized = false
let _enabled = true

// ── Scrub file paths and license keys from strings ────────────────────────
// NOTE: never mutate the original Error object — always sanitize a copy
const REDACT_PATTERNS = [
  /[A-Za-z]:\\[^"'\s,;]{6,}/g,  // Windows paths
  /PP-[A-Z0-9-]{8,}/g,          // License keys
]
function sanitize(s: string): string {
  let out = s
  for (const p of REDACT_PATTERNS) out = out.replace(p, '[REDACTED]')
  return out
}

// ── Init (call once in main.tsx before ReactDOM.render) ───────────────────
export function initRendererTelemetry(): void {
  const dsn = import.meta.env.VITE_GLITCHTIP_DSN

  // Only skip if DSN is genuinely absent — dev mode with a real DSN SHOULD work
  if (!dsn || dsn === 'your_glitchtip_dsn_here') {
    console.log('[telemetry] Renderer telemetry disabled (no DSN configured)')
    return
  }

  // Determine environment label: dev build with DSN = "development", packaged = "production"
  const environment = import.meta.env.DEV ? 'development' : 'production'

  try {
    Sentry.init({
      dsn,
      release: `propel@${APP_VERSION}`,
      environment,

      // ── Sampling ────────────────────────────────────────────────────────
      // sampleRate: 1.0 → capture ALL error/exception events (no sampling)
      // tracesSampleRate: 0.1 → sample 10% of performance transactions
      sampleRate: 1.0,
      tracesSampleRate: 0.1,

      // ── Debug: log SDK internals so we can see if events are dropped ────
      debug: import.meta.env.DEV,

      integrations: [
        Sentry.browserTracingIntegration(),
      ],

      beforeSend(event) {
        // Opt-out: user disabled crash reporting in Settings
        if (!_enabled) return null

        // Scrub exception values — clone message to avoid mutating the Error in-place
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = sanitize(ex.value)
            if (ex.stacktrace?.frames) {
              for (const f of ex.stacktrace.frames) {
                if (f.filename) f.filename = f.filename.replace(/.*[\\/]src[\\/]/, 'src/')
              }
            }
          }
        }

        // Strip user context (PII)
        delete event.user
        if (event.request) {
          delete event.request.cookies
          delete event.request.headers
        }

        return event  // Always return the event — never null for exceptions
      },

      // Only ignore genuinely unactionable browser noise
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // NOT filtering "Non-Error exception captured" — we want those for debugging
      ],

      denyUrls: [
        /extensions\//i,
        /^chrome(-extension)?:\/\//i,
      ],
    })

    // Static tags
    Sentry.setTag('appVersion', APP_VERSION)
    Sentry.setTag('layer', 'renderer')
    Sentry.setTag('environment', environment)

    _initialized = true
    console.log(`[telemetry] Renderer telemetry initialised (GlitchTip) [${environment}]`)
  } catch (err) {
    console.warn('[telemetry] Failed to init renderer telemetry:', err)
  }
}

// ── Toggle (wired to settings store) ─────────────────────────────────────
export function setRendererTelemetryEnabled(enabled: boolean): void {
  _enabled = enabled
  console.log(`[telemetry] Renderer telemetry ${enabled ? 'enabled' : 'disabled'} by user`)
}

export function isRendererTelemetryEnabled(): boolean {
  return _initialized && _enabled
}

// ── Capture helpers ───────────────────────────────────────────────────────

export function captureRendererError(
  err: unknown,
  page: string,
  feature?: string,
): void {
  if (!_initialized || !_enabled) return
  try {
    Sentry.withScope(scope => {
      scope.setTag('page', page)
      if (feature) scope.setTag('featureName', feature)
      if (err instanceof Error) {
        // IMPORTANT: do NOT mutate err.message — clone a sanitized copy instead
        const sanitizedErr = new Error(sanitize(err.message))
        sanitizedErr.name = err.name
        sanitizedErr.stack = err.stack
        Sentry.captureException(sanitizedErr)
      } else {
        Sentry.captureMessage(sanitize(String(err)), 'error')
      }
    })
  } catch { /* telemetry must not crash the app */ }
}

export function captureRendererWarning(message: string, page: string): void {
  if (!_initialized || !_enabled) return
  try {
    Sentry.withScope(scope => {
      scope.setTag('page', page)
      Sentry.captureMessage(sanitize(message), 'warning')
    })
  } catch { /* non-fatal */ }
}

// Re-export Sentry for direct use in TelemetryErrorBoundary
export { Sentry }
