/**
 * telemetryTestUtils.ts
 *
 * Developer-only utilities to verify GlitchTip exception ingestion is working.
 * Exposed globally as window.__cmTelemetryTest during `npm run dev`.
 * Tree-shaken out of production bundles entirely.
 *
 * Usage (DevTools console):
 *   window.__cmTelemetryTest.testMessage()       → info-level message
 *   window.__cmTelemetryTest.rendererCrash()     → captureException direct
 *   window.__cmTelemetryTest.unhandledPromise()  → real unhandledrejection event
 *   window.__cmTelemetryTest.ipcFailure()        → local log + forward
 *   window.__cmTelemetryTest.hardTest()          → raw Sentry.captureException, no wrappers
 *   window.__cmTelemetryTest.getStatus()         → SDK init status + DSN info
 */

import * as Sentry from '@sentry/react'
import { logError, logWarning } from '@/services/crashLogger'

// ── Named exports — each function is independently usable ─────────────────

export function testMessage(): void {
  Sentry.captureMessage('[TEST] Manual message from renderer DevTools', 'warning')
  logWarning('renderer', '[TEST] testMessage() triggered from DevTools')
  console.log('[telemetry-test] ✅ testMessage sent — check GlitchTip Issues tab')
}

export function rendererCrash(): string {
  // Direct Sentry call — no wrappers, no guards
  const eventId = Sentry.captureException(
    new Error('[TEST] Renderer crash — Propel HARD TEST ERROR'),
    { tags: { test: 'true', layer: 'renderer', source: 'telemetryTestUtils' } },
  )
  logError('renderer', '[TEST] rendererCrash() triggered from DevTools')
  console.log('[telemetry-test] ✅ Exception sent. GlitchTip event ID:', eventId)
  return eventId
}

export function unhandledPromise(): void {
  // Triggers real browser unhandledrejection event
  // → captured by installCrashHandlers → Sentry.captureException
  Promise.reject(new Error('[TEST] Propel PROMISE TEST — unhandled rejection'))
  console.log('[telemetry-test] ✅ Unhandled promise rejection triggered')
}

export function ipcFailure(): void {
  logError('general', '[TEST] Simulated IPC failure', 'Error: IPC channel timeout after 5000ms')
  console.log('[telemetry-test] ✅ IPC failure logged locally + forwarded to GlitchTip')
}

/**
 * HARD TEST — completely raw, no wrappers, no wrapper guards, no state checks.
 * If this does NOT appear in GlitchTip Issues, the problem is DSN/transport/project config.
 * If this DOES appear, the problem was in the wrapper layer (now fixed).
 */
export function hardTest(): string {
  const err = new Error('Propel HARD TEST ERROR — direct raw captureException')
  const eventId = Sentry.captureException(err)
  console.log('[telemetry-test] 🔴 HARD TEST sent. Event ID:', eventId)
  console.log('[telemetry-test] 🔴 Check GlitchTip Issues tab for "Propel HARD TEST ERROR"')
  return eventId
}

export function getStatus(): {
  initialized: boolean
  enabled: boolean
  dsn: string
  env: string
} {
  const dsn = import.meta.env.VITE_GLITCHTIP_DSN
  const client = Sentry.getClient()
  const options = client?.getOptions()
  return {
    initialized: !!client,
    enabled: !!(client && options),
    dsn: dsn ? dsn.replace(/\/\/.*@/, '//[KEY]@') : 'not set',
    env: import.meta.env.DEV ? 'development' : 'production',
  }
}
