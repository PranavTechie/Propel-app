/**
 * mainBreadcrumbs.ts — Main process breadcrumb helper
 *
 * Structured breadcrumbs for the Electron main process.
 * Mirrors the renderer breadcrumbs.ts API for consistency.
 *
 * Usage:
 *   import { addMainBreadcrumb, addIPCBreadcrumb, addSecurityBreadcrumb } from '../telemetry/mainBreadcrumbs'
 *
 *   addMainBreadcrumb('system', 'License verification', 'started')
 *   addIPCBreadcrumb('license:verify', 'resolved', { status: 'licensed' })
 *   addSecurityBreadcrumb('HMAC validation failed', 'hmac_invalid')
 */

import * as Sentry from '@sentry/electron/main'

// ── General main process breadcrumb ──────────────────────────────────────
export function addMainBreadcrumb(
  category: string,
  operation: string,
  state: 'started' | 'completed' | 'failed' | 'info',
  extra?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({
    type:     'debug',
    category: `main.${category}`,
    message:  `${operation}: ${state}`,
    level:    state === 'failed' ? 'warning' : 'info',
    data:     extra,
  })
}

// ── IPC breadcrumbs (main-side) ───────────────────────────────────────────
export function addIPCBreadcrumb(
  channel: string,
  state: 'received' | 'resolved' | 'failed' | 'rejected',
  extra?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({
    type:     'debug',
    category: 'ipc.main',
    message:  `ipcMain.handle(${channel}) → ${state}`,
    level:    state === 'failed' || state === 'rejected' ? 'error' : 'debug',
    data:     extra,
  })
}

// ── Security event breadcrumbs ────────────────────────────────────────────
export function addSecurityBreadcrumb(
  event: string,
  attackType?: string,
): void {
  Sentry.addBreadcrumb({
    type:     'error',
    category: 'security.main',
    message:  event,
    level:    'warning',
    data:     attackType ? { attackType } : undefined,
  })
}

// ── System / PowerShell breadcrumbs ───────────────────────────────────────
export function addSchedulerBreadcrumb(
  task: string,
  state: 'started' | 'completed' | 'failed' | 'skipped',
  extra?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({
    type:     'debug',
    category: 'scheduler',
    message:  `Scheduler: ${task} → ${state}`,
    level:    state === 'failed' ? 'warning' : 'info',
    data:     extra,
  })
}
