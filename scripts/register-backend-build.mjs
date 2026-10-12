#!/usr/bin/env node
/**
 * register-backend-build.mjs
 *
 * Computes the buildSignature from current build output / manifest
 * and safely registers both displayVersion (e.g. "1.4") and fullVersion (e.g. "1.4.0")
 * into propel-backend/services/official-builds.json.
 *
 * Runs AFTER:
 *   npm run build
 *   npm run generate:manifest
 *
 * Usage:
 *   node scripts/register-backend-build.mjs
 *   npm run release:register
 *   npm run release:register -- --dry-run
 */

import { createHash, createHmac } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  ROOT_APP,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
} from './release-safety.mjs'

const args = process.argv.slice(2)
const isDryRun = args.some((a) => a === '--dry-run' || a === '-n' || a === '--dryrun')

console.log('\n🔐 Propel — Backend Official Build Signature Registrar')
console.log('═'.repeat(65))

// ── 1. Read Current Version from package.json ─────────────────────────────
const pkgPath = join(ROOT_APP, 'package.json')
if (!existsSync(pkgPath)) {
  console.error(`❌ package.json not found at: ${pkgPath}`)
  process.exit(1)
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const { fullVersion, displayVersion } = parseReleaseVersion(pkg.version)

console.log(`   Target App Version:     ${fullVersion}`)
console.log(`   User-Facing Version:    ${displayVersion}`)
console.log(`   Dry-Run Mode:           ${isDryRun ? 'ENABLED' : 'disabled'}`)

// ── 2. Read Integrity Manifest ────────────────────────────────────────────
// ── 2. Read and Strictly Validate Integrity Manifest ─────────────────────
const MANIFEST_PATH = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
if (!existsSync(MANIFEST_PATH)) {
  console.error('\n❌ Manifest not found. Run "npm run generate:manifest" first.\n')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch (err) {
  console.error(`\n❌ Malformed manifest: Invalid JSON in integrity-manifest.json (${err.message}).\n`)
  process.exit(1)
}

if (!manifest || typeof manifest !== 'object') {
  console.error('\n❌ Malformed manifest: Root is not a valid JSON object.\n')
  process.exit(1)
}

const files = manifest.files
if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) {
  console.error('\n❌ Malformed manifest: "files" map is missing or empty.\n')
  process.exit(1)
}

// Validate manifest version against target release version
if (!manifest.version || (manifest.version !== displayVersion && manifest.version !== fullVersion)) {
  console.error(
    `\n❌ Manifest version mismatch:\n` +
    `   Manifest version: "${manifest.version}"\n` +
    `   Target version:   "${displayVersion}" / "${fullVersion}"\n` +
    `Refusing to register. Run "npm run generate:manifest" with the current version first.\n`
  )
  process.exit(1)
}

// Validate presence and format of required security-critical bundles
const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

if (!preloadEntry) {
  console.error('\n❌ Malformed manifest: Preload bundle entry missing from manifest.files.\n')
  process.exit(1)
}
if (!rendererEntry) {
  console.error('\n❌ Malformed manifest: Renderer bundle entry missing from manifest.files.\n')
  process.exit(1)
}
if (!mainEntry) {
  console.error('\n❌ Malformed manifest: Main process bundle entry missing from manifest.files.\n')
  process.exit(1)
}

const HASH_REGEX = /^[a-f0-9]{64}$/i
for (const [relKey, hash] of Object.entries(files)) {
  if (typeof hash !== 'string' || !HASH_REGEX.test(hash)) {
    console.error(`\n❌ Malformed bundle hash for "${relKey}": "${hash}". Expected 64-char hex SHA-256.\n`)
    process.exit(1)
  }
}

// Validate manifest HMAC signature
const MANIFEST_HMAC_KEY = 'propel-manifest-integrity-v1-2026'
const canonicalFiles = Object.keys(files).sort().map(k => `${k}:${files[k]}`).join('\n')
const expectedHmac = createHmac('sha256', MANIFEST_HMAC_KEY).update(canonicalFiles).digest('hex')
if (manifest.signature !== expectedHmac) {
  console.error('\n❌ Invalid manifest signature: HMAC does not match canonical files. Manifest may be tampered.\n')
  process.exit(1)
}

// ── 2b. Recompute and Verify Bundle Hashes Against Files in out/ ───────────
console.log(`   Verifying ${Object.keys(files).length} files on disk against manifest...`)
for (const [relKey, expectedHash] of Object.entries(files)) {
  const absPath = join(ROOT_APP, relKey)
  if (!existsSync(absPath)) {
    console.error(`\n❌ Compiled build file missing from disk: ${relKey}`)
    console.error('Cannot register signature for unbuilt or incomplete build. Run "npm run build" first.\n')
    process.exit(1)
  }
  const diskHash = createHash('sha256').update(readFileSync(absPath)).digest('hex')
  if (diskHash !== expectedHash) {
    console.error(`\n❌ Hash discrepancy on disk for "${relKey}":\n` +
      `   Manifest hash: ${expectedHash}\n` +
      `   On-disk hash:  ${diskHash}\n` +
      `Build output does not match manifest. Run "npm run generate:manifest" first.\n`
    )
    process.exit(1)
  }
}
console.log('   ✓  All files in out/ match manifest SHA-256 hashes byte-for-byte.')

// Compute canonical manifest hash
const manifestJson = JSON.stringify(
  Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
)
const manifestHash = createHash('sha256').update(manifestJson).digest('hex')

// Compute deterministic build signature
const buildSigInput = [
  manifest.version,
  manifestHash,
  preloadEntry[1],
  rendererEntry[1],
  mainEntry[1],
].join(':')
const buildSignature = createHash('sha256').update(buildSigInput).digest('hex')

if (!HASH_REGEX.test(buildSignature)) {
  console.error('\n❌ Failed to calculate valid build signature.\n')
  process.exit(1)
}

console.log(`   Manifest Version:       ${manifest.version}`)
console.log(`   Manifest Hash:          ${manifestHash.slice(0, 32)}...`)
console.log(`   Generated Build Sig:    ${buildSignature}`)

// ── 3. Assert Backend Historical Records ──────────────────────────────────
let officialBuilds
try {
  officialBuilds = assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  console.log('🛡️  Legacy records verified: 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 are uncorrupted.')
} catch (err) {
  console.error(`\n❌ PRE-CHECK FAILED: ${err.message}\n`)
  process.exit(1)
}

// ── 4. Verify / Prepare Entries ───────────────────────────────────────────
const versionsToRegister = [displayVersion, fullVersion]
const today = new Date().toISOString().slice(0, 10)
let modified = false

for (const ver of versionsToRegister) {
  const existing = officialBuilds[ver]
  if (existing) {
    if (existing.buildSignature === buildSignature) {
      console.log(`   ℹ️  Version "${ver}" already registered with identical signature. Skipping.`)
    } else {
      console.error(
        `\n❌ SIGNATURE MISMATCH for "${ver}":\n` +
        `   Already registered signature: ${existing.buildSignature}\n` +
        `   Current build signature:      ${buildSignature}\n` +
        `Refusing to overwrite without explicit manual intervention. Aborting.\n`
      )
      process.exit(1)
    }
  } else {
    officialBuilds[ver] = {
      buildSignature,
      releaseChannel: 'stable',
      releasedAt: today,
      notes: `Propel release ${ver}`,
    }
    console.log(`   ➕ Staged new registry entry: "${ver}"`)
    modified = true
  }
}

if (!modified) {
  console.log('\n✅ Registry is already up to date with the current build signature.')
  process.exit(0)
}

// ── 5. Write Updates (or Dry Run) ─────────────────────────────────────────
if (isDryRun) {
  console.log('\n[DRY RUN] Would write the following new entries to official-builds.json:')
  for (const ver of versionsToRegister) {
    console.log(`   "${ver}": ${JSON.stringify(officialBuilds[ver])}`)
  }
  process.exit(0)
}

const originalJson = readFileSync(BACKEND_BUILDS_PATH, 'utf8')
writeFileSync(BACKEND_BUILDS_PATH, JSON.stringify(officialBuilds, null, 2) + '\n', 'utf8')

// ── 6. Post-Write Assertion ───────────────────────────────────────────────
try {
  assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  console.log('🛡️  POST-WRITE CHECK PASSED: Historical records remain byte-for-byte intact.')
} catch (err) {
  console.error(`\n🚨 POST-WRITE REVERSION: ${err.message}`)
  writeFileSync(BACKEND_BUILDS_PATH, originalJson, 'utf8')
  console.error('Reverted official-builds.json to original state.')
  process.exit(1)
}

console.log('═'.repeat(65))
console.log(`🎉 BACKEND REGISTRATION SUCCESSFUL: Registered "${displayVersion}" and "${fullVersion}"\n`)
