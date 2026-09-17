/**
 * breadcrumbs.ts — Renderer breadcrumb helper
 *
 * Adds structured breadcrumbs to the Sentry event timeline.
 * These show EXACTLY what the user was doing before a crash:
 *
 *   Opened Dashboard
 *   Started Deep Scan
 *   IPC: cleaner:scan → called
 *   PowerShell cleanup completed
 *   CRASH
 *
 * Rules:
 *  - Breadcrumbs are lightweight (no file paths, no keys, no PII)
 *  - Max data per breadcrumb: category + message + 3-5 simple extra fields
 *  - Call these from UI components and service wrappers
 *  - They ONLY have effect if Sentry is initialized (otherwise no-op)
 *
 * Usage:
 *   import { addNavBreadcrumb, addActionBreadcrumb, addSecurityBreadcrumb } from '@/services/breadcrumbs'
 *   addNavBreadcrumb('Cleaner')
 *   addActionBreadcrumb('Deep Scan', 'started', { mode: 'full' })
 */

import * as Sentry from '@sentry/react'

// ── Navigation breadcrumbs ────────────────────────────────────────────────
/** Call when user navigates to a new page/view */
export function addNavBreadcrumb(
  page: string,
  extra?: Record<string, string>,
): void {
  Sentry.addBreadcrumb({
    type:     'navigation',
    category: 'navigation',
    message:  `Opened ${page}`,
    level:    'info',
    data:     extra,
  })
}

// ── User action breadcrumbs ───────────────────────────────────────────────
/** Call when user triggers a significant action (scan, boost, activation…) */
export function addActionBreadcrumb(
  action: string,
  state: 'started' | 'completed' | 'failed' | 'cancelled',
  extra?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({
    type:     'user',
    category: 'action',
    message:  `${action}: ${state}`,
    level:    state === 'failed' ? 'warning' : 'info',
    data:     extra,
  })
}

// ── IPC breadcrumbs ───────────────────────────────────────────────────────
/** Call before/after significant IPC calls to track the communication timeline */
export function addIPCBreadcrumb(
  channel: string,
  state: 'called' | 'resolved' | 'failed' | 'timeout',
  extra?: Record<string, string | number>,
): void {
  Sentry.addBreadcrumb({
    type:     'debug',
    category: 'ipc',
    message:  `IPC ${channel} → ${state}`,
    level:    state === 'failed' || state === 'timeout' ? 'error' : 'debug',
    data:     extra,
  })
}

// ── Security event breadcrumbs ────────────────────────────────────────────
/** Call for security-relevant events: nonce mismatch, HMAC fail, blocked calls */
export function addSecurityBreadcrumb(
  event: string,
  detail?: string,
): void {
  Sentry.addBreadcrumb({
    type:     'error',
    category: 'security',
    message:  event,
    level:    'warning',
    data:     detail ? { detail } : undefined,
  })
}

// ── System operation breadcrumbs ──────────────────────────────────────────
/** Call for background system operations: PowerShell, cleanup, scan completion */
export function addSystemBreadcrumb(
  operation: string,
  state: 'started' | 'completed' | 'failed',
  extra?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({
    type:     'debug',
    category: 'system',
    message:  `${operation}: ${state}`,
    level:    state === 'failed' ? 'warning' : 'info',
    data:     extra,
  })
}

// ── Error/warning breadcrumbs ─────────────────────────────────────────────
/** Call for non-fatal warnings and retries that precede potential crashes */
export function addWarnBreadcrumb(
  message: string,
  category: string = 'app',
): void {
  Sentry.addBreadcrumb({
    type:     'error',
    category,
    message,
    level:    'warning',
  })
}
