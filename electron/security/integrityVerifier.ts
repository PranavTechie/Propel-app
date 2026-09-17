/**
 * integrityVerifier.ts
 *
 * ASAR integrity + anti-tamper verification for Propel.
 *
 * RUNS ONLY in packaged production builds (app.isPackaged === true).
 * Dev mode bypasses ALL checks unconditionally — no false positives ever.
 *
 * Flow:
 *   1. Load manifest from app.asar resources
 *   2. SHA-256 hash the current files on disk
 *   3. Compare byte-for-byte against manifest
 *   4. On mismatch → security telemetry + local log + dialog + app.exit(1)
 *
 * Performance: hashes only 2-4 files, target <300ms total startup overhead.
 *
 * Bypass limitations (documented honestly):
 *   - An attacker who can modify app.asar can also replace the manifest
 *   - This is NOT a DRM system — it is tamper DETECTION, not prevention
 *   - Hardened further via code signing (see SECURITY.md)
 *   - The manifest itself is signed at build time (see generate-integrity-manifest.mjs)
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app, dialog } from 'electron'
import { APP_VERSION } from '../services/updater/updaterService'

// ── Types ─────────────────────────────────────────────────────────────────
interface IntegrityManifest {
  version:   string
  builtAt:   string
  files:     Record<string, string>   // relativeKey → sha256hex
  signature: string                   // HMAC-SHA256 of sorted file entries (build-time)
}

interface VerificationFailure {
  file:         string
  expected:     string
  actual:       string
  reason:       'mismatch' | 'missing' | 'manifest_missing' | 'manifest_corrupt'
}

/**
 * Compact integrity proof sent to the backend with every license verify request.
 * Contains NO file paths, NO full hashes, NO machine identifiers.
 * All fields are derived from the local manifest and bound to the request nonce.
 */
export interface IntegrityProof {
  /** App version string, e.g. "1.2" */
  appVersion:      string
  /** SHA-256 of the full manifest JSON (compact fingerprint of all file hashes) */
  manifestHash:    string
  /** Local verification result */
  integrityStatus: 'valid' | 'failed' | 'unavailable'
  /** SHA-256 of the preload bundle (from manifest) — first 32 chars only */
  preloadHash:     string
  /** SHA-256 of the renderer bundle (from manifest) — first 32 chars only */
  rendererHash:    string
  /**
   * Deterministic build identity:
   * SHA-256(appVersion + ":" + manifestHash + ":" + preloadHash + ":" + rendererHash)
   * Backend checks this against the known-builds registry.
   */
  buildSignature:  string
  /**
   * Anti-replay binding:
   * HMAC-SHA256(nonce + ":" + manifestHash + ":" + buildSignature)
   * Key = manifest HMAC key (shared between build tooling and verifier)
   */
  proofSignature:  string
}

// ── Security log path (no sensitive user data) ────────────────────────────
function getSecurityLogPath(): string {
  const base = process.env.LOCALAPPDATA ?? os.homedir()
  return path.join(base, 'Propel', 'logs', 'security.log')
}

// ── SHA-256 a file synchronously (blocking, but only 2-4 small files) ────
function sha256File(filePath: string): string | null {
  try {
    const data = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(data).digest('hex')
  } catch {
    return null
  }
}

// ── Write security log entry (never throws) ───────────────────────────────
function writeSecurityLog(entry: string): void {
  try {
    const logPath = getSecurityLogPath()
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    const ts  = new Date().toISOString()
    const line = `[${ts}] [INTEGRITY] ${entry}\n`
    fs.appendFileSync(logPath, line, 'utf8')
  } catch { /* never block the flow */ }
}

// ── Resolve the app root inside the ASAR ─────────────────────────────────
// In packaged builds: <resources>/app.asar
// The JS files are at: app.asar/out/main/index.js etc.
function getAppAsarRoot(): string {
  // app.getAppPath() returns the path to app.asar in production
  return app.getAppPath()
}

// ── Load and validate the manifest ───────────────────────────────────────
function loadManifest(appRoot: string): IntegrityManifest | null {
  try {
    const manifestPath = path.join(appRoot, 'electron', 'security', 'integrity-manifest.json')
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const parsed = JSON.parse(raw) as IntegrityManifest
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.files !== 'object' ||
      Object.keys(parsed.files).length === 0
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ── Send security telemetry (fire-and-forget, never throws) ──────────────
// Import is lazy to avoid circular deps and to ensure telemetry is
// already initialised by the time we call it.
function reportTamperEvent(failure: VerificationFailure): void {
  try {
    // We deliberately do NOT import mainTelemetry at module level
    // to avoid circular dependency issues during early startup.
    // Dynamic require is fine here — this is Node.js main process.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureMainError } = require('../services/telemetry/mainTelemetry') as {
      captureMainError: (err: unknown, feature: string, extra?: Record<string, string>) => void
    }
    const tamperErr = new Error(`[INTEGRITY] Tamper detected: ${failure.reason}`)
    captureMainError(tamperErr, 'integrity-verifier', {
      security:       'true',
      tamper:         'true',
      integrity_fail: 'true',
      reason:         failure.reason,
      // Send only the last path segment — no full machine path
      file:           path.basename(failure.file),
      // Truncated hashes — enough to correlate, not enough to be useful for attackers
      expected_short: failure.expected.slice(0, 16),
      actual_short:   failure.actual.slice(0, 16),
      appVersion:     APP_VERSION,
    })
  } catch { /* telemetry must NEVER block shutdown */ }
}

// ── Show user-facing dialog (generic — reveals nothing technical) ─────────
async function showTamperDialog(): Promise<void> {
  await dialog.showErrorBox(
    'Integrity Verification Failed',
    'Propel detected a problem with its installation files.\n\n' +
    'Please reinstall Propel from the official source at cleanmasterpro.in\n\n' +
    'The application will now close.',
  )
}

// ── Module-level state set by verifyIntegrity() ──────────────────────────
// Cached after startup so getIntegrityProof() never re-hashes files.
let _lastManifest:    IntegrityManifest | null = null
let _integrityPassed: boolean                 = false

// HMAC key for proof signatures — must match generate-integrity-manifest.mjs
const PROOF_HMAC_KEY = 'propel-manifest-integrity-v1-2026'

// ── Main verification entry point ─────────────────────────────────────────
export async function verifyIntegrity(): Promise<void> {
  // ── BYPASS in development — unconditional, no false positives ────────
  if (!app.isPackaged) {
    return
  }

  const startMs  = Date.now()
  const appRoot  = getAppAsarRoot()

  // ── Load manifest ─────────────────────────────────────────────────────
  const manifest = loadManifest(appRoot)
  if (!manifest) {
    const failure: VerificationFailure = {
      file:     'integrity-manifest.json',
      expected: 'present',
      actual:   'missing_or_corrupt',
      reason:   'manifest_missing',
    }
    writeSecurityLog(`Manifest missing or corrupt | appRoot=${path.basename(appRoot)} | version=${APP_VERSION}`)
    reportTamperEvent(failure)
    await showTamperDialog()
    app.exit(1)
    return
  }

  // ── Verify each file in the manifest ─────────────────────────────────
  for (const [relKey, expectedHash] of Object.entries(manifest.files)) {
    const fullPath = path.join(appRoot, relKey)
    const actualHash = sha256File(fullPath)

    if (actualHash === null) {
      const failure: VerificationFailure = {
        file:     relKey,
        expected: expectedHash,
        actual:   'FILE_MISSING',
        reason:   'missing',
      }
      writeSecurityLog(
        `File missing | file=${path.basename(relKey)} | version=${APP_VERSION} | ` +
        `packaged=${String(app.isPackaged)}`
      )
      reportTamperEvent(failure)
      await showTamperDialog()
      app.exit(1)
      return
    }

    if (actualHash !== expectedHash) {
      const failure: VerificationFailure = {
        file:     relKey,
        expected: expectedHash,
        actual:   actualHash,
        reason:   'mismatch',
      }
      writeSecurityLog(
        `Hash mismatch | file=${path.basename(relKey)} | ` +
        `expected=${expectedHash.slice(0, 16)}... | ` +
        `actual=${actualHash.slice(0, 16)}... | ` +
        `version=${APP_VERSION} | packaged=${String(app.isPackaged)}`
      )
      reportTamperEvent(failure)
      await showTamperDialog()
      app.exit(1)
      return
    }
  }

  // ── All checks passed — cache manifest for getIntegrityProof() ───────
  _lastManifest    = manifest
  _integrityPassed = true

  const elapsedMs = Date.now() - startMs
  writeSecurityLog(
    `Verification passed | files=${Object.keys(manifest.files).length} | elapsedMs=${elapsedMs} | version=${APP_VERSION}`
  )
  console.log(`[integrity] Verification passed (${Object.keys(manifest.files).length} files, ${elapsedMs}ms)`)
}

// ── Build compact proof for backend attestation ───────────────────────────
/**
 * Returns a compact IntegrityProof to attach to the license verify request.
 *
 * In dev mode: returns null (backend handles absent proof gracefully).
 * In production after failed integrity: returns a proof with status='failed'
 *   so the backend can score it, but the app has already exited before this
 *   is ever called (exit(1) happens before any IPC). This is purely defensive.
 *
 * nonce: the one-time challenge received from GET /api/nonce
 *        binds the proof to THIS request — prevents replay.
 */
export function getIntegrityProof(nonce: string): IntegrityProof | null {
  // Dev bypass — never send proof in dev mode
  if (!app.isPackaged) return null

  const manifest = _lastManifest

  if (!manifest) {
    // Manifest unavailable (startup check failed and we are somehow still running)
    return {
      appVersion:      APP_VERSION,
      manifestHash:    'UNAVAILABLE',
      integrityStatus: 'unavailable',
      preloadHash:     'UNAVAILABLE',
      rendererHash:    'UNAVAILABLE',
      buildSignature:  'UNAVAILABLE',
      proofSignature:  'UNAVAILABLE',
    }
  }

  // ── Extract known file hashes from the manifest (no re-hashing) ──────
  const files = manifest.files

  // Find preload and renderer hashes by key suffix (not full path)
  const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
  const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
  const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

  const preloadHash  = (preloadEntry?.[1]  ?? 'MISSING').slice(0, 32)
  const rendererHash = (rendererEntry?.[1] ?? 'MISSING').slice(0, 32)
  // mainHash not sent directly — included in buildSignature only
  const mainHash     = mainEntry?.[1] ?? 'MISSING'

  // ── Manifest fingerprint: SHA-256 of the full sorted manifest JSON ────
  const manifestJson = JSON.stringify(
    Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  )
  const manifestHash = crypto.createHash('sha256').update(manifestJson).digest('hex')

  // ── Build signature: deterministic identity for this specific build ───
  // SHA-256(version : manifestHash : preloadFullHash : rendererFullHash : mainHash)
  const buildSigInput = [
    APP_VERSION,
    manifestHash,
    preloadEntry?.[1]  ?? 'MISSING',
    rendererEntry?.[1] ?? 'MISSING',
    mainHash,
  ].join(':')
  const buildSignature = crypto.createHash('sha256').update(buildSigInput).digest('hex')

  // ── Proof signature: HMAC bound to the nonce (anti-replay) ───────────
  // HMAC-SHA256(nonce : manifestHash : buildSignature)
  // Key = PROOF_HMAC_KEY (embedded at build time, matches backend)
  const proofSigInput  = `${nonce}:${manifestHash}:${buildSignature}`
  const proofSignature = crypto
    .createHmac('sha256', PROOF_HMAC_KEY)
    .update(proofSigInput)
    .digest('hex')

  return {
    appVersion:      APP_VERSION,
    manifestHash,
    integrityStatus: _integrityPassed ? 'valid' : 'failed',
    preloadHash,
    rendererHash,
    buildSignature,
    proofSignature,
  }
}

