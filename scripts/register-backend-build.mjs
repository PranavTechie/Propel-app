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

import { createHash } from 'crypto'
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
const MANIFEST_PATH = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
if (!existsSync(MANIFEST_PATH)) {
  console.error('\n❌ Manifest not found. Run "npm run generate:manifest" first.\n')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const files = manifest.files

if (!files || typeof files !== 'object') {
  console.error('\n❌ Invalid manifest: "files" entry missing.\n')
  process.exit(1)
}

const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

// Compute manifest hash (exact same algorithm as integrityVerifier.ts and get-build-signature.mjs)
const manifestJson = JSON.stringify(
  Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
)
const manifestHash = createHash('sha256').update(manifestJson).digest('hex')

// Compute build signature
const buildSigInput = [
  manifest.version,
  manifestHash,
  preloadEntry?.[1]  ?? 'MISSING',
  rendererEntry?.[1] ?? 'MISSING',
  mainEntry?.[1]     ?? 'MISSING',
].join(':')
const buildSignature = createHash('sha256').update(buildSigInput).digest('hex')

console.log(`   Manifest Version:       ${manifest.version}`)
console.log(`   Manifest Hash:          ${manifestHash.slice(0, 32)}...`)
console.log(`   Generated Build Sig:    ${buildSignature}`)

// ── 3. Assert Backend Historical Records ──────────────────────────────────
let officialBuilds
try {
  officialBuilds = assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  console.log('🛡️  Legacy records verified: 1.2, 1.2.0, 1.3, 1.3.0 are uncorrupted.')
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
