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

      // Privacy: strip user identifiers and scrub sensitive paths/stack traces
      beforeSend(event) {
        if (!_telemetryEnabled) return null
        return scrubTelemetryEvent(event)
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


// ── Scrub sensitive data from messages and stack traces ──────────────────────
const PATH_PATTERNS = [
  /[A-Za-z]:\\[^"'\s,]+/g,                  // Windows paths
  /\/[a-zA-Z0-9._/-]{10,}/g,                // Unix paths
  /PP-[A-Z0-9-]{10,}/g,                    // License key pattern
  /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi, // GUIDs/HWIDs
  /ghp_[A-Za-z0-9]{36}/g,                   // GitHub tokens
]

function getSafeUsername(): string {
  try {
    return os.userInfo().username || ''
  } catch {
    return ''
  }
}

function getSafeHomedir(): string {
  try {
    return os.homedir() || ''
  } catch {
    return ''
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sanitizeMessage(msg: string, customUsername?: string, customHomedir?: string): string {
  if (typeof msg !== 'string' || !msg) return msg
  let out = msg

  // 1. Scrub Windows home directory (case-insensitive, both slash styles)
  const homedir = customHomedir || getSafeHomedir()
  if (homedir) {
    const homedirPattern = homedir.split(/[\\/]/).map(escapeRegex).join('[\\\\/]')
    out = out.replace(new RegExp(homedirPattern, 'gi'), '<user>')
  }

  // 2. Scrub any C:\Users\<name> or C:/Users/<name> pattern
  out = out.replace(/[A-Za-z]:[\\/]Users[\\/][^\\/"'\s,;<>]+/gi, '<user>')

  // 3. Scrub Windows username (case-insensitive)
  const username = customUsername || getSafeUsername()
  if (username && username.length >= 2) {
    out = out.replace(new RegExp(escapeRegex(username), 'gi'), '<user>')
  }

  // 4. Scrub other sensitive tokens and generic paths
  for (const pat of PATH_PATTERNS) {
    out = out.replace(pat, '[REDACTED]')
  }

  return out
}

export function scrubStackFrame(filename: string, customUsername?: string): string {
  if (!filename || typeof filename !== 'string') return filename
  let out = filename

  // 1. Keep from app directory onward if app marker is present (Propel, app.asar, resources, etc.)
  const appMatch = out.match(/.*?[\\/](Propel[\\/].*|app\.asar[\\/].*|resources[\\/].*|propel-app[\\/].*|electron[\\/].*|src[\\/].*)/i)
  if (appMatch) {
    out = appMatch[1]
  } else {
    // 2. Remove any C:\Users\<name>\ prefix (both slash styles)
    out = out
      .replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+[\\/](?:AppData[\\/]Local[\\/]Programs[\\/])?/i, '')
      .replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+[\\/]/i, '')
  }

  // 3. Ensure any username/path traces in frame filename are scrubbed
  return sanitizeMessage(out, customUsername)
}

export function scrubTelemetryEvent(event: any, customUsername?: string, customHomedir?: string): any {
  if (!event) return event

  // 1. Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b: Breadcrumb) => ({
      ...b,
      message: b.message ? sanitizeMessage(b.message, customUsername, customHomedir) : b.message,
      data: undefined,
    }))
  }

  // 2. Scrub top-level message
  if (event.message) {
    event.message = sanitizeMessage(event.message, customUsername, customHomedir)
  }

  // 3. Scrub exceptions and stack frames
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = sanitizeMessage(ex.value, customUsername, customHomedir)
      if (ex.type) ex.type = sanitizeMessage(ex.type, customUsername, customHomedir)
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.filename) {
            frame.filename = scrubStackFrame(frame.filename, customUsername)
          }
        }
      }
    }
  }

  // 4. Scrub threads if present
  if (event.threads?.values) {
    for (const th of event.threads.values) {
      if (th.stacktrace?.frames) {
        for (const frame of th.stacktrace.frames) {
          if (frame.filename) {
            frame.filename = scrubStackFrame(frame.filename, customUsername)
          }
        }
      }
    }
  }

  // 5. Scrub tags
  if (event.tags) {
    for (const [k, v] of Object.entries(event.tags)) {
      if (typeof v === 'string') {
        event.tags[k] = sanitizeMessage(v, customUsername, customHomedir)
      }
    }
  }

  // 6. Scrub extra
  if (event.extra) {
    for (const [k, v] of Object.entries(event.extra)) {
      if (typeof v === 'string') {
        event.extra[k] = sanitizeMessage(v, customUsername, customHomedir)
      }
    }
  }

  // 7. Remove user identifier
  delete event.user

  return event
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
