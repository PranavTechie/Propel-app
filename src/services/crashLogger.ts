const MAX_ENTRIES = 100
const STORAGE_KEY = 'cm_crash_log'

export type LogLevel    = 'error' | 'warning' | 'info'
export type LogCategory = 'renderer' | 'cleaner' | 'memory' | 'activation' | 'general'

export interface LogEntry {
  id:        string
  level:     LogLevel
  category:  LogCategory
  message:   string
  detail?:   string
  timestamp: number
}

function readLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    return []
  }
}

function writeLog(entries: LogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // storage full — silently drop oldest
  }
}

function pushEntry(level: LogLevel, category: LogCategory, message: string, detail?: string): void {
  const entries = readLog()
  entries.push({
    id:        `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    level,
    category,
    message,
    detail,
    timestamp: Date.now(),
  })
  writeLog(entries)
}

export function logError(category: LogCategory, message: string, detail?: string): void {
  pushEntry('error', category, message, detail)
  // Forward to GlitchTip (lazy import to avoid circular deps + never throws)
  try {
    import('./telemetry').then(({ captureRendererError }) => {
      captureRendererError(new Error(message), category)
    }).catch(() => { /* telemetry unavailable — local log already saved */ })
  } catch { /* non-fatal */ }
}

export function logWarning(category: LogCategory, message: string, detail?: string): void {
  pushEntry('warning', category, message, detail)
  // Forward warnings to GlitchTip too (lower severity)
  try {
    import('./telemetry').then(({ captureRendererWarning }) => {
      captureRendererWarning(message, category)
    }).catch(() => { /* ignore */ })
  } catch { /* non-fatal */ }
}

export function logInfo(category: LogCategory, message: string, detail?: string): void {
  pushEntry('info', category, message, detail)
}

export function getLogs(): LogEntry[] {
  return readLog().slice().reverse()
}

export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export interface LogSummary {
  total:    number
  errors:   number
  warnings: number
  lastAt:   number | null
}

export function getLogSummary(): LogSummary {
  const logs = readLog()
  return {
    total:    logs.length,
    errors:   logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warning').length,
    lastAt:   logs.length > 0 ? logs[logs.length - 1].timestamp : null,
  }
}

export function getLogsAsText(): string {
  return getLogs()
    .map(l => {
      const ts  = new Date(l.timestamp).toISOString()
      const hdr = `[${ts}] [${l.level.toUpperCase()}] [${l.category}]`
      return l.detail ? `${hdr} ${l.message}\n  ${l.detail}` : `${hdr} ${l.message}`
    })
    .join('\n')
}

/**
 * Install global unhandled error + rejection handlers.
 * Call once on app boot (e.g. in main.tsx).
 *
 * Two-track capture:
 *   1. logError() — always runs, writes to localStorage (local fallback)
 *   2. Sentry.captureException() — direct call via lazy import, bypasses
 *      the _initialized wrapper guard so errors reach GlitchTip reliably.
 */
export function installCrashHandlers(): void {
  window.addEventListener('error', ev => {
    // Track 1: local log
    logError(
      'renderer',
      ev.message ?? 'Uncaught error',
      ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
    )
    // Track 2: direct Sentry capture
    const err = ev.error instanceof Error
      ? ev.error
      : new Error(ev.message ?? 'Uncaught error')
    import('./telemetry').then(({ Sentry }) => {
      Sentry.captureException(err, {
        tags: { source: 'window.onerror' },
      })
    }).catch(() => { /* telemetry unavailable — local log saved */ })
  })

  window.addEventListener('unhandledrejection', ev => {
    const err = ev.reason instanceof Error
      ? ev.reason
      : new Error(String(ev.reason ?? 'Unhandled promise rejection'))
    // Track 1: local log
    logError('renderer', err.message, err.stack)
    // Track 2: direct Sentry capture
    import('./telemetry').then(({ Sentry }) => {
      Sentry.captureException(err, {
        tags: { source: 'unhandledrejection' },
      })
    }).catch(() => { /* telemetry unavailable — local log saved */ })
  })
}
