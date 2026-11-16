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
