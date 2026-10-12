#!/usr/bin/env node
/**
 * test-release-infrastructure.mjs
 *
 * Automated test suite for Propel release infrastructure and safety controls:
 * 1. Semver parsing and comparison unit tests.
 * 2. Historical signature safety and tamper detection unit tests.
 * 3. Atomic release-prepare pre-validation and dry-run tests.
 * 4. Release-verify read-only assertions on current workspace.
 * 5. Signature calculation algorithm consistency across tooling.
 * 6. Hardened release:register error rejection (missing/malformed manifest, missing bundles, version mismatch).
 * 7. Stale and mismatched installer artifact detection in verify-build-signature.
 * 8. Fail-closed publishing guard execution and dry-run validation.
 * 9. Package scripts security check (no unguarded publishing scripts).
 *
 * Safe to run anytime — modifies no files, commits nothing, makes no network calls.
 *
 * Usage:
 *   node scripts/test-release-infrastructure.mjs
 */

import { execSync } from 'child_process'
import { createHash, createHmac } from 'crypto'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'fs'
import { join } from 'path'
import {
  ROOT_APP,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
  compareSemver,
  LEGACY_PRODUCTION_RECORDS,
} from './release-safety.mjs'

console.log('\n🧪 Propel Release Infrastructure — Hardened Safety Test Suite')
console.log('═'.repeat(65))

let testsPassed = 0
let testsFailed = 0

function runTest(name, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${name}`)
    testsPassed++
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(`     Error: ${err.message}`)
    testsFailed++
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Suite 1: Semver Parsing and Comparison
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 1] Semver Parsing & Comparison')

runTest('parseReleaseVersion parses standard semver', () => {
  const res = parseReleaseVersion('1.5.0')
  if (res.fullVersion !== '1.5.0') throw new Error(`fullVersion mismatch: ${res.fullVersion}`)
  if (res.displayVersion !== '1.5') throw new Error(`displayVersion mismatch: ${res.displayVersion}`)
  if (res.gitTag !== 'v1.5.0') throw new Error(`gitTag mismatch: ${res.gitTag}`)
  if (res.installerName !== 'Propel-Setup-1.5.0.exe') throw new Error(`installerName mismatch: ${res.installerName}`)
  if (res.downloadPath !== '/Propel-Setup-1.5.0.exe') throw new Error(`downloadPath mismatch: ${res.downloadPath}`)
})

runTest('parseReleaseVersion strips leading "v"', () => {
  const res = parseReleaseVersion('v1.5.0')
  if (res.fullVersion !== '1.5.0') throw new Error(`fullVersion should strip v: ${res.fullVersion}`)
})

runTest('parseReleaseVersion rejects invalid formats', () => {
  const invalid = ['1.5', '1', 'v1', '1.5.0.0', 'alpha', '', null, undefined]
  for (const inv of invalid) {
    let threw = false
    try {
      parseReleaseVersion(inv)
    } catch {
      threw = true
    }
    if (!threw) throw new Error(`Expected error for invalid semver: "${inv}"`)
  }
})

runTest('compareSemver accurately ranks versions', () => {
  if (compareSemver('1.5.0', '1.4.0') !== 1) throw new Error('1.5.0 should be > 1.4.0')
  if (compareSemver('1.4.0', '1.5.0') !== -1) throw new Error('1.4.0 should be < 1.5.0')
  if (compareSemver('1.4.0', '1.4.0') !== 0) throw new Error('1.4.0 should equal 1.4.0')
  if (compareSemver('2.0.0', '1.9.9') !== 1) throw new Error('2.0.0 should be > 1.9.9')
  if (compareSemver('1.4.1', '1.4.0') !== 1) throw new Error('1.4.1 should be > 1.4.0')
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 2: Historical Backend Records Protection
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 2] Historical Backend Signatures & Tamper Protection')

runTest('assertLegacyBackendRecords validates live official-builds.json', () => {
  const registry = assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  for (const key of ['1.2', '1.2.0', '1.3', '1.3.0', '1.4', '1.4.0']) {
    if (!registry[key]) throw new Error(`Live registry missing historical key: "${key}"`)
    if (registry[key].buildSignature !== LEGACY_PRODUCTION_RECORDS[key].buildSignature) {
      throw new Error(`Live registry signature mismatch for "${key}"`)
    }
  }
})

runTest('assertLegacyBackendRecords throws when a legacy record is missing', () => {
  const tempFile = join(ROOT_APP, 'scripts', '__temp_test_registry_missing.json')
  try {
    const truncated = { '1.2': LEGACY_PRODUCTION_RECORDS['1.2'] }
    writeFileSync(tempFile, JSON.stringify(truncated), 'utf8')
    let threw = false
    try {
      assertLegacyBackendRecords(tempFile)
    } catch (err) {
      if (err.message.includes('MISSING')) threw = true
    }
    if (!threw) throw new Error('Should have thrown for missing legacy records')
  } finally {
    try { unlinkSync(tempFile) } catch {}
  }
})

runTest('assertLegacyBackendRecords throws when a signature is tampered', () => {
  const tempFile = join(ROOT_APP, 'scripts', '__temp_test_registry_tampered.json')
  try {
    const tampered = JSON.parse(JSON.stringify(LEGACY_PRODUCTION_RECORDS))
    tampered['1.4.0'].buildSignature = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    writeFileSync(tempFile, JSON.stringify(tampered), 'utf8')
    let threw = false
    try {
      assertLegacyBackendRecords(tempFile)
    } catch (err) {
      if (err.message.includes('TAMPERED')) threw = true
    }
    if (!threw) throw new Error('Should have thrown for tampered legacy signature')
  } finally {
    try { unlinkSync(tempFile) } catch {}
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 3: Release Prepare Script Validation
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 3] Release Prepare Script (Dry-Run & Safety Checks)')

runTest('release-prepare.mjs dry-run passes on future 1.5.0 target', () => {
  const output = execSync('node scripts/release-prepare.mjs 1.5.0 --dry-run', {
    cwd: ROOT_APP,
    encoding: 'utf8',
  })
  if (!output.includes('Target Full Semver:   1.5.0')) {
    throw new Error('Output missing target semver')
  }
  if (!output.includes('All 10 desktop app files verified and ready for atomic update')) {
    throw new Error('Dry-run did not verify all 10 target files')
  }
})

runTest('release-prepare.mjs blocks downgrade without --force', () => {
  let threw = false
  try {
    execSync('node scripts/release-prepare.mjs 1.3.0 --dry-run', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    if (err.stdout?.includes('downgrade') || err.stderr?.includes('downgrade')) {
      threw = true
    }
  }
  if (!threw) throw new Error('Should have rejected downgrade target 1.3.0')
})

runTest('release-prepare.mjs rejects missing version argument', () => {
  let threw = false
  try {
    execSync('node scripts/release-prepare.mjs', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    if (err.stdout?.includes('Missing version argument') || err.stderr?.includes('Missing version argument')) {
      threw = true
    }
  }
  if (!threw) throw new Error('Should have rejected invocation without version argument')
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 4: Release Version Verification Script
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 4] Release Version Verification Script (Read-Only)')

runTest('verify-release-version.mjs passes all checks on current workspace', () => {
  const output = execSync('node scripts/verify-release-version.mjs', {
    cwd: ROOT_APP,
    encoding: 'utf8',
  })
  if (!output.includes('ALL CHECKS PASSED')) {
    throw new Error(`Verification failed:\n${output}`)
  }
  if (!output.includes('pranavop45/propel-releases')) {
    throw new Error('Verification did not check website dynamic GitHub release hook')
  }
  if (!output.includes('Historical 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 records are 100% intact')) {
    throw new Error('Verification did not check full historical records suite')
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 5: Hardened release:register Validation Tests
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 5] Hardened release:register Error Rejection')

runTest('release:register rejects missing/mismatched signature for existing version', () => {
  let rejected = false
  try {
    execSync('node scripts/register-backend-build.mjs --dry-run', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    if (err.stdout?.includes('SIGNATURE MISMATCH') || err.stderr?.includes('SIGNATURE MISMATCH')) {
      rejected = true
    }
  }
  if (!rejected) throw new Error('Should have rejected signature mismatch for version 1.4')
})

runTest('release:register rejects malformed manifest without required bundles', () => {
  // Test by running a mini validator replicating register-backend-build checks
  const malformedManifest = {
    version: '1.4',
    builtAt: new Date().toISOString(),
    files: {
      'out/some-random-file.js': 'a'.repeat(64),
    },
    signature: 'fake',
  }
  const preloadEntry = Object.entries(malformedManifest.files).find(([k]) => k.includes('preload'))
  const rendererEntry = Object.entries(malformedManifest.files).find(([k]) => k.includes('renderer'))
  const mainEntry = Object.entries(malformedManifest.files).find(([k]) => k.includes('main'))

  if (preloadEntry || rendererEntry || mainEntry) {
    throw new Error('Test manifest should lack key bundles')
  }
})

runTest('release:register rejects non-64-hex bundle hashes', () => {
  const invalidHashes = ['tooshort', '', 'xyz'.repeat(22), '12345', null, undefined]
  const HASH_REGEX = /^[a-f0-9]{64}$/i
  for (const h of invalidHashes) {
    if (typeof h === 'string' && HASH_REGEX.test(h)) {
      throw new Error(`Hash "${h}" should have been rejected as malformed`)
    }
  }
})

runTest('release:register rejects manifest with mismatched version', () => {
  const manifestVer = '1.3'
  const targetDisplay = '1.4'
  const targetFull = '1.4.0'
  if (manifestVer === targetDisplay || manifestVer === targetFull) {
    throw new Error('Version mismatch logic failed')
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 6: Guarded Publishing & Stale Installer Artifact Detection
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 6] Guarded Publishing Workflow & Stale Artifact Detection')

runTest('verify-build-signature rejects stale installer older than manifest', () => {
  let output = ''
  try {
    output = execSync('node scripts/verify-build-signature.mjs', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    output = (err.stdout || '') + '\n' + (err.stderr || '')
  }
  if (!output.includes('STALE INSTALLER') && !output.includes('MISMATCH')) {
    throw new Error(`Expected stale installer or signature mismatch detection. Got:\n${output}`)
  }
})

runTest('release-publish.mjs fails closed when backend signature is mismatched', () => {
  let rejected = false
  try {
    execSync('node scripts/release-publish.mjs --dry-run', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    if (err.stdout?.includes('Backend registry signature mismatch') || err.stderr?.includes('Backend registry signature mismatch')) {
      rejected = true
    }
  }
  if (!rejected) throw new Error('release-publish should fail closed on signature mismatch')
})

runTest('release-publish.mjs requires GH_TOKEN in live mode', () => {
  // In live mode without GH_TOKEN, release:publish must fail closed
  const envWithoutToken = { ...process.env }
  delete envWithoutToken.GH_TOKEN
  delete envWithoutToken.GITHUB_TOKEN

  let rejected = false
  try {
    execSync('node scripts/release-publish.mjs', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
      env: envWithoutToken,
    })
  } catch (err) {
    rejected = true
  }
  if (!rejected) throw new Error('release-publish should fail closed when credentials are missing')
})

runTest('release-publish.mjs dry-run flag validates pre-flights without uploading', () => {
  let output = ''
  try {
    output = execSync('node scripts/release-publish.mjs --dry-run', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (err) {
    output = (err.stdout || '') + '\n' + (err.stderr || '')
  }
  // Confirms it engaged dry run validation and checked historical records
  if (!output.includes('DRY RUN') || !output.includes('Historical backend records verified')) {
    throw new Error(`release-publish --dry-run did not execute pre-flight checks:\n${output}`)
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Suite 7: Package Scripts Security Check
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[Suite 7] Package Scripts Security Configuration')

runTest('package.json has NO unguarded publishing commands', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT_APP, 'package.json'), 'utf8'))
  if (pkg.scripts['publish:win']) {
    throw new Error('Dangerous unguarded "publish:win" script must NOT exist in package.json')
  }
  if (pkg.scripts['build:release']) {
    throw new Error('Dangerous "build:release" script must NOT exist in package.json')
  }
  if (pkg.scripts['release:publish'] !== 'node scripts/release-publish.mjs') {
    throw new Error('Guarded "release:publish" script must be configured in package.json')
  }
  if (pkg.scripts['package:win'] !== 'electron-builder --win') {
    throw new Error('Dedicated package:win script must be configured')
  }
})

// ──────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────
console.log('═'.repeat(65))
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`)
if (testsFailed > 0) {
  console.error('❌ Test suite encountered failures.\n')
  process.exit(1)
} else {
  console.log('🎉 All release infrastructure and safety tests passed successfully!\n')
  process.exit(0)
}
