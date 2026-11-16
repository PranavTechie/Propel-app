/**
 * Pure helpers for electron/native/system.ts.
 * No Electron or Node side effects here so they can be unit-tested with node:test.
 */

export const DEVICE_NAME_MAX_LENGTH = 100
export const DEFAULT_DEVICE_NAME = 'Windows PC'

/** Cleans a hostname for display in the account's device list (no control chars, max 100). */
export function sanitizeDeviceName(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, DEVICE_NAME_MAX_LENGTH)
    .trim()
  return cleaned || DEFAULT_DEVICE_NAME
}

// ── Drive optimization ──────────────────────────────────────────────────────

export const OPTIMIZE_DRIVE_TIMEOUT_MS = 10 * 60 * 1000

/** "C", "c", "C:" or "C:\" -> "C". Anything else -> null. Undefined -> "C". */
export function normalizeDriveLetter(input: unknown = 'C'): string | null {
  if (typeof input !== 'string') return null
  const m = /^([A-Za-z]):?\\?$/.exec(input.trim())
  return m ? m[1].toUpperCase() : null
}

/**
 * powershell.exe arguments for Optimize-Volume. No -Defrag/-ReTrim flag, so Windows
 * picks the right operation for the media type (TRIM for SSDs, defrag for HDDs).
 * The letter must come from normalizeDriveLetter().
 */
export function buildOptimizeVolumeArgs(driveLetter: string): string[] {
  if (!/^[A-Z]$/.test(driveLetter)) throw new Error('Invalid drive letter')
  return [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Optimize-Volume -DriveLetter ${driveLetter} -ErrorAction Stop`,
  ]
}

export type OptimizeDriveResult = { success: boolean; message?: string; error?: string }

/** User-facing result for an Optimize-Volume run. Technical details stay in the log. */
export function describeOptimizeResult(
  driveLetter: string,
  err: { killed?: boolean; signal?: string | null; code?: unknown } | null,
): OptimizeDriveResult {
  if (!err) {
    return {
      success: true,
      message: `Drive ${driveLetter}: optimized. Windows used the right method for this drive (TRIM for SSDs, defragmentation for hard disks).`,
    }
  }
  if (err.killed || err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT') {
    return {
      success: false,
      error: `Optimizing drive ${driveLetter}: took longer than 10 minutes and was stopped. Please try again later.`,
    }
  }
  return {
    success: false,
    error: `Could not optimize drive ${driveLetter}:. Make sure the drive exists and try again.`,
  }
}
