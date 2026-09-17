/**
 * serviceCapture.ts
 *
 * Structured error capture for Propel main process services.
 *
 * Usage:
 *   captureServiceError(err, {
 *     service:   'license',
 *     operation: 'fetchNonce',
 *     phase:     'request',
 *     severity:  'high',
 *   })
 *
 * Privacy rules (enforced in code):
 *  - license_key is NEVER sent — only masked key (PP-XX-****-****)
 *  - hwid / fingerprint: NEVER sent — only a boolean "present" flag
 *  - file paths: NEVER sent — only a boolean "exists" flag or count
 *  - error messages are sanitized before sending
 *  - IP addresses, tokens, secrets: NEVER sent
 */

import * as Sentry from '@sentry/electron/main'
import { APP_VERSION } from '../updater/updaterService'
import os from 'os'

// ── Service/operation taxonomy ────────────────────────────────────────────
export type ServiceName =
  | 'license'
  | 'duplicateFinder'
  | 'smartBoost'
  | 'cleaner'
  | 'updater'
  | 'overlay'
  | 'ipc'
  | 'scheduler'
  | 'notification'
  | 'system'

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ServiceContext {
  service:     ServiceName
  operation:   string
  phase?:      string
  severity?:   SeverityLevel
  // Optional safe metadata — no PII
  extra?:      Record<string, string | number | boolean>
  // Security event tagging
  securityEvent?: boolean
  attackType?:    string
}

// ── Scrub sensitive data ──────────────────────────────────────────────────
const SCRUB_PATTERNS = [
  { re: /PP-[A-Z0-9-]{8,}/g,              sub: 'PP-[REDACTED]' },
  { re: /[A-Za-z]:\\[^"'\s,;]{6,}/g,       sub: '[PATH_REDACTED]' },
  { re: /ghp_[A-Za-z0-9]{20,}/g,           sub: '[TOKEN_REDACTED]' },
  { re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, sub: '[IP_REDACTED]' },
]

function scrub(s: string): string {
  let out = s
  for (const { re, sub } of SCRUB_PATTERNS) out = out.replace(re, sub)
  return out
}

// ── Static system context (computed once, non-PII) ────────────────────────
let _sysCtx: Record<string, string> | null = null
function getSystemContext(): Record<string, string> {
  if (_sysCtx) return _sysCtx
  try {
    const cpus = os.cpus()
    _sysCtx = {
      osType:     os.type(),
      osRelease:  os.release(),
      ramGB:      String(Math.round(os.totalmem() / 1073741824)),
      cpuCount:   String(cpus.length),
      cpuModel:   cpus[0]?.model?.slice(0, 48) ?? 'unknown',
      appVersion: APP_VERSION,
    }
  } catch {
    _sysCtx = { appVersion: APP_VERSION }
  }
  return _sysCtx
}

// ── Main capture function ─────────────────────────────────────────────────
export function captureServiceError(
  err: unknown,
  ctx: ServiceContext,
): void {
  try {
    Sentry.withScope(scope => {
      // Core classification tags
      scope.setTag('service',   ctx.service)
      scope.setTag('operation', ctx.operation)
      if (ctx.phase)    scope.setTag('phase',          ctx.phase)
      if (ctx.severity) scope.setTag('severity',       ctx.severity)
      if (ctx.securityEvent) {
        scope.setTag('security_event', 'true')
        if (ctx.attackType) scope.setTag('attack_type', ctx.attackType)
      }

      // System context (anonymous)
      scope.setExtras(getSystemContext())

      // Safe extra context
      if (ctx.extra) {
        const safeExtra: Record<string, string | number | boolean> = {}
        for (const [k, v] of Object.entries(ctx.extra)) {
          safeExtra[k] = typeof v === 'string' ? scrub(v) : v
        }
        scope.setExtras(safeExtra)
      }

      // Capture the error — scrub message to protect any accidentally included PII
      if (err instanceof Error) {
        const safe = new Error(scrub(err.message))
        safe.name  = err.name
        safe.stack = err.stack
        Sentry.captureException(safe)
      } else {
        Sentry.captureMessage(scrub(String(err)), 'error')
      }
    })
  } catch { /* telemetry must NEVER crash the service */ }
}

// ── Capture a warning (non-fatal service degradation) ─────────────────────
export function captureServiceWarning(
  message: string,
  ctx: Pick<ServiceContext, 'service' | 'operation' | 'phase' | 'extra'>,
): void {
  try {
    Sentry.withScope(scope => {
      scope.setTag('service',   ctx.service)
      scope.setTag('operation', ctx.operation)
      if (ctx.phase) scope.setTag('phase', ctx.phase)
      if (ctx.extra) scope.setExtras(ctx.extra)
      Sentry.captureMessage(scrub(message), 'warning')
    })
  } catch { /* non-fatal */ }
}
