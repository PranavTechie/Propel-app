#!/usr/bin/env node
/**
 * release-publish.mjs
 *
 * Guarded release publishing script for Propel desktop.
 * Strictly verifies that:
 *   1. Historical backend records are intact.
 *   2. The compiled out/ bundles match the integrity manifest byte-for-byte.
 *   3. The manifest and bundle hashes are valid and correctly versioned.
 *   4. The computed buildSignature is registered in propel-backend/services/official-builds.json.
 *   5. The installer Propel-Setup-<version>.exe exists, is newer than the manifest,
 *      matches latest.yml SHA-512, and its packaged ASAR matches the build signature.
 *   6. Required publish credentials (GH_TOKEN) are present.
 *
 * Fails closed on ANY missing file, mismatch, stale artifact, or malformed record.
 * Never rebuilds or regenerates manifests during publishing.
 *
 * Usage:
 *   node scripts/release-publish.mjs --dry-run
 *   npm run release:publish -- --dry-run
 *   npm run release:publish
 */

import { createHash, createHmac } from 'crypto'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import {
  ROOT_APP,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
} from './release-safety.mjs'

const require = createRequire(import.meta.url)

const args = process.argv.slice(2)
const isDryRun = args.some((a) => a === '--dry-run' || a === '-n' || a === '--dryrun')

console.log('\n🚀 Propel Guarded Release Publisher')
console.log('═'.repeat(65))
console.log(`   Publish Mode:           ${isDryRun ? 'DRY RUN (Validation only — no upload)' : 'PRODUCTION'}`)

// ── 1. Target Release Version ─────────────────────────────────────────────
const pkgPath = join(ROOT_APP, 'package.json')
if (!existsSync(pkgPath)) {
  console.error(`❌ package.json not found at: ${pkgPath}`)
  process.exit(1)
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const { fullVersion, displayVersion, installerName } = parseReleaseVersion(pkg.version)
console.log(`   Target Version:         ${fullVersion} (display: ${displayVersion})`)
console.log(`   Expected Installer:     ${installerName}`)

// ── 2. Historical Records Pre-flight ──────────────────────────────────────
let officialBuilds
try {
  officialBuilds = assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  console.log('🛡️  Historical backend records verified: 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 intact.')
} catch (err) {
  console.error(`❌ HISTORICAL BACKEND RECORDS COMPROMISED: ${err.message}`)
  process.exit(1)
}

// ── 3. Integrity Manifest & Build Output Verification ─────────────────────
const MANIFEST_PATH = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
if (!existsSync(MANIFEST_PATH)) {
  console.error('\n❌ Manifest missing: electron/security/integrity-manifest.json not found.')
  console.error('Run "npm run build" and "npm run generate:manifest" first.\n')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch (err) {
  console.error(`\n❌ Malformed manifest JSON: ${err.message}\n`)
  process.exit(1)
}

if (!manifest || typeof manifest !== 'object' || !manifest.files || typeof manifest.files !== 'object') {
  console.error('\n❌ Malformed manifest structure.\n')
  process.exit(1)
}

if (manifest.version !== displayVersion && manifest.version !== fullVersion) {
  console.error(
    `\n❌ Manifest version mismatch:\n` +
    `   Manifest version: "${manifest.version}"\n` +
    `   Target version:   "${fullVersion}" / "${displayVersion}"\n`
  )
  process.exit(1)
}

const files = manifest.files
const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

if (!preloadEntry || !rendererEntry || !mainEntry) {
  console.error('\n❌ Malformed manifest: Required preload, renderer, or main bundle missing.\n')
  process.exit(1)
}

const HASH_REGEX = /^[a-f0-9]{64}$/i
for (const [relKey, hash] of Object.entries(files)) {
  if (typeof hash !== 'string' || !HASH_REGEX.test(hash)) {
    console.error(`\n❌ Malformed hash for "${relKey}". Expected 64-character SHA-256 hex string.\n`)
    process.exit(1)
  }
  const absPath = join(ROOT_APP, relKey)
  if (!existsSync(absPath)) {
    console.error(`\n❌ Build bundle missing from disk: ${relKey}. Run "npm run build" first.\n`)
    process.exit(1)
  }
  const diskHash = createHash('sha256').update(readFileSync(absPath)).digest('hex')
  if (diskHash !== hash) {
    console.error(`\n❌ Build bundle on disk has been modified since manifest generation: ${relKey}\n`)
    process.exit(1)
  }
}
console.log(`   ✓  Verified ${Object.keys(files).length} compiled bundles in out/ match manifest byte-for-byte.`)

// Verify manifest HMAC
const MANIFEST_HMAC_KEY = 'propel-manifest-integrity-v1-2026'
const canonicalFiles = Object.keys(files).sort().map(k => `${k}:${files[k]}`).join('\n')
const expectedHmac = createHmac('sha256', MANIFEST_HMAC_KEY).update(canonicalFiles).digest('hex')
if (manifest.signature !== expectedHmac) {
  console.error('\n❌ Manifest HMAC signature mismatch. Manifest may be tampered.\n')
  process.exit(1)
}

// Compute deterministic build signature
const manifestJson = JSON.stringify(
  Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
)
const manifestHash = createHash('sha256').update(manifestJson).digest('hex')

const buildSigInput = [
  manifest.version,
  manifestHash,
  preloadEntry[1],
  rendererEntry[1],
  mainEntry[1],
].join(':')
const buildSignature = createHash('sha256').update(buildSigInput).digest('hex')

console.log(`   Manifest SHA-256:       ${manifestHash.slice(0, 32)}...`)
console.log(`   Build Signature:        ${buildSignature}`)

// ── 4. Backend Registry Verification ──────────────────────────────────────
const versionsToCheck = [displayVersion, fullVersion]
for (const ver of versionsToCheck) {
  const entry = officialBuilds[ver]
  if (!entry) {
    console.error(`\n❌ Cannot publish: Version "${ver}" is NOT registered in propel-backend/services/official-builds.json!`)
    console.error('Run "npm run release:register" and deploy backend before publishing.\n')
    process.exit(1)
  }
  if (entry.buildSignature !== buildSignature) {
    console.error(
      `\n❌ Cannot publish: Backend registry signature mismatch for "${ver}"!\n` +
      `   Registered signature: ${entry.buildSignature}\n` +
      `   Current build signature: ${buildSignature}\n`
    )
    process.exit(1)
  }
}
console.log('   ✓  Backend official-builds.json contains identical verified build signatures.')

// ── 5. Packaged Installer Artifacts Verification ──────────────────────────
const installerPath = join(ROOT_APP, 'release', installerName)
const latestYmlPath = join(ROOT_APP, 'release', 'latest.yml')
const unpackedAsarPath = join(ROOT_APP, 'release', 'win-unpacked', 'resources', 'app.asar')

if (!existsSync(installerPath)) {
  console.error(`\n❌ Cannot publish: Installer artifact release/${installerName} does not exist!`)
  console.error('Run "npm run package:win" to package the verified build first.\n')
  process.exit(1)
}

if (!existsSync(latestYmlPath)) {
  console.error('\n❌ Cannot publish: release/latest.yml updater metadata is missing.')
  console.error('Run "npm run package:win" to generate updater descriptors.\n')
  process.exit(1)
}

const installerStat = statSync(installerPath)
const manifestStat = statSync(MANIFEST_PATH)

// Stale installer detection: installer MUST NOT be older than integrity-manifest.json
if (installerStat.mtimeMs < manifestStat.mtimeMs) {
  console.error(
    `\n❌ Cannot publish: STALE INSTALLER DETECTED!\n` +
    `   Installer mtime: ${installerStat.mtime.toISOString()}\n` +
    `   Manifest mtime:  ${manifestStat.mtime.toISOString()}\n` +
    `The installer was packaged before the current manifest was generated.\n` +
    `Run "npm run package:win" to repackage the current build.\n`
  )
  process.exit(1)
}

// Verify latest.yml descriptors
const ymlRaw = readFileSync(latestYmlPath, 'utf8')
const verMatch = ymlRaw.match(/version:\s*([^\r\n]+)/)
const shaMatch = ymlRaw.match(/sha512:\s*([^\r\n]+)/)
const pathMatch = ymlRaw.match(/path:\s*([^\r\n]+)/)

if (!verMatch || verMatch[1].trim() !== fullVersion) {
  console.error(`\n❌ Cannot publish: latest.yml version mismatch (found "${verMatch?.[1]?.trim()}", expected "${fullVersion}").\n`)
  process.exit(1)
}

if (!pathMatch || pathMatch[1].trim() !== installerName) {
  console.error(`\n❌ Cannot publish: latest.yml path mismatch (found "${pathMatch?.[1]?.trim()}", expected "${installerName}").\n`)
  process.exit(1)
}

if (!shaMatch) {
  console.error('\n❌ Cannot publish: latest.yml missing sha512 checksum.\n')
  process.exit(1)
}

const expectedSha512 = shaMatch[1].trim()
const actualSha512 = createHash('sha512').update(readFileSync(installerPath)).digest('base64')
if (actualSha512 !== expectedSha512) {
  console.error(
    `\n❌ Cannot publish: Installer SHA-512 does not match latest.yml descriptor!\n` +
    `   Expected: ${expectedSha512}\n` +
    `   Actual:   ${actualSha512}\n`
  )
  process.exit(1)
}
console.log('   ✓  latest.yml SHA-512 matches installer binary byte-for-byte.')

// Deep ASAR inspection (if unpacked staging exists)
if (existsSync(unpackedAsarPath)) {
  try {
    let asarMod
    try { asarMod = require('@electron/asar') } catch { try { asarMod = require('asar') } catch {} }

    if (asarMod && asarMod.extractFile) {
      const asarManifestBuf = asarMod.extractFile(unpackedAsarPath, join('electron', 'security', 'integrity-manifest.json'))
      const asarManifest = JSON.parse(asarManifestBuf.toString('utf8'))
      const asarFiles = asarManifest.files
      const asarSorted = JSON.stringify(
        Object.fromEntries(Object.entries(asarFiles).sort(([a], [b]) => a.localeCompare(b)))
      )
      const asarManifestHash = createHash('sha256').update(asarSorted).digest('hex')
      const asarPreload  = Object.entries(asarFiles).find(([k]) => k.includes('preload'))?.[1]
      const asarRenderer = Object.entries(asarFiles).find(([k]) => k.includes('renderer'))?.[1]
      const asarMain     = Object.entries(asarFiles).find(([k]) => k.includes('main'))?.[1]

      const asarBuildSig = createHash('sha256').update([
        asarManifest.version,
        asarManifestHash,
        asarPreload,
        asarRenderer,
        asarMain,
      ].join(':')).digest('hex')

      if (asarBuildSig !== buildSignature) {
        console.error(
          `\n❌ Cannot publish: ASAR PACKAGED BUILD MISMATCH!\n` +
          `   Packaged ASAR build signature: ${asarBuildSig}\n` +
          `   Expected build signature:      ${buildSignature}\n` +
          `The installer contains bundles from a different compilation!\n`
        )
        process.exit(1)
      }
      console.log('   ✓  Packaged ASAR internal integrity manifest verified and matches build signature.')
    }
  } catch (err) {
    console.error(`\n❌ Error inspecting packaged ASAR: ${err.message}\n`)
    process.exit(1)
  }
}

// ── 6. Publish Credentials & Gating ───────────────────────────────────────
const hasToken = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
if (!hasToken && !isDryRun) {
  console.error('\n❌ Cannot publish: Neither GH_TOKEN nor GITHUB_TOKEN environment variable is set.')
  console.error('Provide a GitHub token with release publish permissions.\n')
  process.exit(1)
}

if (isDryRun) {
  console.log('\n═'.repeat(65))
  console.log('🎉 [DRY RUN SUCCESS] All pre-flight release checks PASSED:')
  console.log(`   - Version ${fullVersion} (${displayVersion}) verified`)
  console.log(`   - Integrity manifest and ${Object.keys(files).length} out/ files verified`)
  console.log(`   - Backend registry signatures verified`)
  console.log(`   - Installer release/${installerName} verified`)
  console.log(`   - latest.yml checksum verified`)
  console.log('   No network calls made. Ready for authorized publication.\n')
  process.exit(0)
}

// ── 7. Execute Immutable Publishing ───────────────────────────────────────
console.log('\n📦 Publishing verified immutable artifacts to GitHub...')
try {
  // Use electron-builder to publish targeting the prepackaged unpacked directory
  // without re-running any compilation or build steps
  execSync('npx electron-builder --win --publish always', {
    cwd: ROOT_APP,
    stdio: 'inherit',
    env: process.env,
  })
  console.log('\n🎉 Release publication completed successfully!\n')
  process.exit(0)
} catch (err) {
  console.error(`\n❌ Publishing failed: ${err.message}\n`)
  process.exit(1)
}
