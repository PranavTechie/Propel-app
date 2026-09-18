/**
 * release-safety.mjs
 *
 * Shared safety assertions, semver parsing, and legacy record validators
 * for Propel release automation scripts.
 */

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
export const ROOT_APP = resolve(__dirname, '..')
export const ROOT_WORKSPACE = resolve(ROOT_APP, '..')
export const BACKEND_BUILDS_PATH = resolve(ROOT_WORKSPACE, 'propel-backend', 'services', 'official-builds.json')
export const WEBSITE_CONSTANTS_PATH = resolve(ROOT_WORKSPACE, 'propel-website', 'app', 'lib', 'site-constants.ts')
export const WEBSITE_ROBOTS_PATH = resolve(ROOT_WORKSPACE, 'propel-website', 'public', 'robots.txt')

/**
 * Immutable historical production signatures.
 * These records MUST NEVER be deleted, altered, or overwritten.
 */
export const LEGACY_PRODUCTION_RECORDS = Object.freeze({
  '1.2': {
    buildSignature: 'c415d07d65b9b979b258b2c6477c549330b6a0718c8e681655b9fb727feb6e94',
    releaseChannel: 'stable',
    releasedAt: '2026-09-18',
    notes: 'Propel release 1.2',
  },
  '1.2.0': {
    buildSignature: 'c415d07d65b9b979b258b2c6477c549330b6a0718c8e681655b9fb727feb6e94',
    releaseChannel: 'stable',
    releasedAt: '2026-09-18',
    notes: 'Propel release 1.2.0',
  },
  '1.3': {
    buildSignature: 'b6ca1360f144f39c907d083877fcc677c7afa2a6f8b3c581943a413e89e64bac',
    releaseChannel: 'stable',
    releasedAt: '2026-09-18',
    notes: 'Propel release 1.3',
  },
  '1.3.0': {
    buildSignature: 'b6ca1360f144f39c907d083877fcc677c7afa2a6f8b3c581943a413e89e64bac',
    releaseChannel: 'stable',
    releasedAt: '2026-09-18',
    notes: 'Propel release 1.3.0',
  },
})

/**
 * Asserts that official-builds.json exists and still contains the exact historical records.
 * @param {string} [filePath]
 * @returns {object} The parsed official builds object
 */
export function assertLegacyBackendRecords(filePath = BACKEND_BUILDS_PATH) {
  if (!existsSync(filePath)) {
    throw new Error(`[safety] Backend registry not found at: ${filePath}`)
  }

  const raw = readFileSync(filePath, 'utf8')
  let registry
  try {
    registry = JSON.parse(raw)
  } catch (err) {
    throw new Error(`[safety] Could not parse official-builds.json: ${err.message}`)
  }

  for (const [ver, expected] of Object.entries(LEGACY_PRODUCTION_RECORDS)) {
    const actual = registry[ver]
    if (!actual) {
      throw new Error(`[safety] CRITICAL: Historical release entry "${ver}" is MISSING from official-builds.json!`)
    }
    if (actual.buildSignature !== expected.buildSignature) {
      throw new Error(
        `[safety] CRITICAL: Historical build signature for "${ver}" was TAMPERED! ` +
        `Expected ${expected.buildSignature}, got ${actual.buildSignature}`
      )
    }
    if (actual.releaseChannel !== expected.releaseChannel) {
      throw new Error(`[safety] Release channel for "${ver}" was altered!`)
    }
    if (actual.releasedAt !== expected.releasedAt) {
      throw new Error(`[safety] Released date for "${ver}" was altered!`)
    }
  }

  return registry
}

/**
 * Validates and decomposes a semver string.
 * @param {string} versionStr e.g. "1.4.0"
 * @returns {{ fullVersion: string, displayVersion: string, gitTag: string, installerName: string, downloadPath: string, major: number, minor: number, patch: number }}
 */
export function parseReleaseVersion(versionStr) {
  if (!versionStr || typeof versionStr !== 'string') {
    throw new Error('Version argument is required (e.g. 1.4.0)')
  }

  const clean = versionStr.trim().replace(/^v/, '')
  const semverMatch = clean.match(/^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/)
  if (!semverMatch) {
    throw new Error(`Invalid semver version: "${versionStr}". Must follow X.Y.Z format (e.g. 1.4.0)`)
  }

  const major = parseInt(semverMatch[1], 10)
  const minor = parseInt(semverMatch[2], 10)
  const patch = parseInt(semverMatch[3], 10)
  const prerelease = semverMatch[4] ?? ''

  const fullVersion = clean
  const displayVersion = `${major}.${minor}${prerelease ? prerelease : ''}`
  const gitTag = `v${fullVersion}`
  const installerName = `Propel-Setup-${fullVersion}.exe`
  const downloadPath = `/${installerName}`

  return {
    fullVersion,
    displayVersion,
    gitTag,
    installerName,
    downloadPath,
    major,
    minor,
    patch,
  }
}

/**
 * Compares two semvers to detect downgrades.
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
export function compareSemver(v1, v2) {
  const p1 = parseReleaseVersion(v1)
  const p2 = parseReleaseVersion(v2)

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1
  return 0
}
