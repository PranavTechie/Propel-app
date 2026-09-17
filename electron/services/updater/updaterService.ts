import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { captureServiceError, captureServiceWarning } from '../telemetry/serviceCapture'

// ── Constants ──────────────────────────────────────────────────────────────
const VERSION_URL =
  'https://raw.githubusercontent.com/pranavop45/Propel/refs/heads/main/version.json'
export const APP_VERSION = '1.2'

// ── Remote version.json shape ──────────────────────────────────────────────
interface RemoteVersionInfo {
  version: string
  mandatory_after_days?: number
  website_url?: string
  title?: string
  changelog?: string[]
}

// ── Local skip-storage shape ───────────────────────────────────────────────
interface SkipStorage {
  skippedVersion: string
  firstDetectedAt: number   // epoch ms when user first clicked "Skip" for this version
}

// ── Exported result type (matches updaterBridge.ts) ───────────────────────
export interface UpdateState {
  available: boolean
  currentVersion: string
  latestVersion: string
  title: string
  changelog: string[]
  websiteUrl: string
  mandatory: boolean          // true = skip period expired, user must update
  mandatoryAfterDays: number
  firstDetectedAt?: number
}

// ── Skip-storage helpers ───────────────────────────────────────────────────
function getSkipPath(): string {
  const base = process.env.APPDATA ?? os.homedir()
  return path.join(base, 'cm_update_skip.json')
}

function loadSkipStorage(): SkipStorage | null {
  try {
    const raw = fs.readFileSync(getSkipPath(), 'utf8')
    return JSON.parse(raw) as SkipStorage
  } catch {
    return null
  }
}

function saveSkipStorage(data: SkipStorage): void {
  try {
    fs.writeFileSync(getSkipPath(), JSON.stringify(data, null, 2), 'utf8')
  } catch { /* read-only fs edge case — non-fatal */ }
}

// ── Semantic version comparison ────────────────────────────────────────────
// Returns >0 if a > b, 0 if equal, <0 if a < b
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// ── Check for update (called from IPC handler) ────────────────────────────
// Returns null on any failure — NEVER blocks the app on updater errors.
export async function checkForUpdate(): Promise<UpdateState | null> {
  try {
    const res = await axios.get<RemoteVersionInfo>(VERSION_URL, { timeout: 8000 })
    const remote = res.data

    // Validate shape
    if (!remote?.version || typeof remote.version !== 'string') {
      captureServiceWarning('Update check returned malformed version.json', {
        service:   'updater',
        operation: 'checkForUpdate',
        phase:     'parse',
        extra: { hasVersion: String(!!remote?.version) },
      })
      return null
    }

    // No update if remote is not newer
    if (compareVersions(remote.version, APP_VERSION) <= 0) return null

    const latestVersion       = remote.version
    const mandatoryAfterDays  = typeof remote.mandatory_after_days === 'number'
      ? remote.mandatory_after_days : 3

    const skip = loadSkipStorage()

    let mandatory        = false
    let firstDetectedAt: number | undefined

    if (skip?.skippedVersion === latestVersion) {
      firstDetectedAt = skip.firstDetectedAt
      const elapsed   = Date.now() - skip.firstDetectedAt
      mandatory       = elapsed >= mandatoryAfterDays * 86_400_000
    }

    return {
      available:         true,
      currentVersion:    APP_VERSION,
      latestVersion,
      title:             remote.title ?? `Update Available — v${latestVersion}`,
      changelog:         Array.isArray(remote.changelog) ? remote.changelog : [],
      websiteUrl:        remote.website_url ?? 'https://cleanmasterpro.in',
      mandatory,
      mandatoryAfterDays,
      firstDetectedAt,
    }
  } catch (err) {
    // Network failure / invalid JSON / timeout / GitHub unavailable
    // Capture as warning — never block the app on updater failure
    const isNetwork = axios.isAxiosError(err) &&
      (!err.response || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND')
    captureServiceWarning(
      isNetwork ? 'Update check: network unavailable' : 'Update check failed unexpectedly',
      {
        service:   'updater',
        operation: 'checkForUpdate',
        phase:     'fetch',
        extra: {
          isNetwork:   String(isNetwork),
          axiosCode:   axios.isAxiosError(err) ? (err.code ?? 'unknown') : 'non-axios',
        },
      },
    )
    return null
  }
}

// ── Record that user clicked Skip for this version ────────────────────────
// Saves firstDetectedAt only once per version (preserves original timestamp).
export function recordSkip(latestVersion: string): void {
  const existing = loadSkipStorage()
  if (existing?.skippedVersion === latestVersion) return // timestamp already recorded
  saveSkipStorage({ skippedVersion: latestVersion, firstDetectedAt: Date.now() })
}
