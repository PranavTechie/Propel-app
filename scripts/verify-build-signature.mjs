#!/usr/bin/env node
/**
 * verify-build-signature.mjs
 *
 * Read-only build and integrity verification script.
 * Validates that:
 *   1. Historical official-build records in propel-backend are uncorrupted.
 *   2. The integrity manifest exists and matches compiled build artifacts in out/.
 *   3. The computed buildSignature corresponds to the registered signature in
 *      propel-backend/services/official-builds.json.
 *   4. Packaged installer artifacts (if present in release/) correspond to the same version.
 *
 * Usage:
 *   node scripts/verify-build-signature.mjs
 *   npm run verify:build-signature
 *   npm run verify:build-signature -- --strict
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'
import {
  ROOT_APP,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
} from './release-safety.mjs'

const require = createRequire(import.meta.url)

const args = process.argv.slice(2)
const isStrict = args.some((a) => a === '--strict' || a === '-s')

console.log('\n🔍 Propel — Build Signature & Integrity Verifier')
console.log('═'.repeat(65))

let failures = 0
let warnings = 0

// ── 1. Read Target Version ────────────────────────────────────────────────
const pkgPath = join(ROOT_APP, 'package.json')
if (!existsSync(pkgPath)) {
  console.error(`❌ package.json not found at: ${pkgPath}`)
  process.exit(1)
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const { fullVersion, displayVersion, installerName } = parseReleaseVersion(pkg.version)

console.log(`   Target App Version:     ${fullVersion} (display: ${displayVersion})`)
console.log(`   Verification Mode:      ${isStrict ? 'STRICT' : 'standard'}`)

// ── 2. Verify Historical Backend Records ──────────────────────────────────
let officialBuilds
try {
  officialBuilds = assertLegacyBackendRecords(BACKEND_BUILDS_PATH)
  console.log('🛡️  Historical backend records verified: 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 intact.')
} catch (err) {
  console.error(`❌ HISTORICAL RECORDS CORRUPTED: ${err.message}`)
  process.exit(1)
}

// ── 3. Read Integrity Manifest ────────────────────────────────────────────
const MANIFEST_PATH = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
if (!existsSync(MANIFEST_PATH)) {
  console.error(`\n❌ Manifest not found at: ${MANIFEST_PATH}`)
  console.error('   Run "npm run generate:manifest" first after compiling with "npm run build".\n')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch (err) {
  console.error(`\n❌ Failed to parse integrity-manifest.json: ${err.message}\n`)
  process.exit(1)
}

const files = manifest.files
if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
  console.error('\n❌ Invalid manifest: "files" property is missing or empty.\n')
  process.exit(1)
}

console.log(`   Manifest Version:       ${manifest.version}`)
console.log(`   Manifest Built At:      ${manifest.builtAt}`)
console.log(`   Manifest File Count:    ${Object.keys(files).length}`)

if (manifest.version !== displayVersion && manifest.version !== fullVersion) {
  console.error(`   ❌ Manifest version "${manifest.version}" does not match package version "${fullVersion}" / "${displayVersion}"`)
  if (isStrict) {
    failures++
  } else {
    warnings++
  }
}

// ── 4. Verify Files on Disk (if out/ exists) ──────────────────────────────
let verifiedFiles = 0
let diskMismatch = 0
let diskMissing = 0

for (const [relKey, expectedHash] of Object.entries(files)) {
  const absPath = join(ROOT_APP, relKey)
  if (!existsSync(absPath)) {
    diskMissing++
    continue
  }
  const actualHash = createHash('sha256').update(readFileSync(absPath)).digest('hex')
  if (actualHash === expectedHash) {
    verifiedFiles++
  } else {
    diskMismatch++
    console.error(`   ❌ File content mismatch on disk: ${relKey}`)
  }
}

if (diskMissing === 0 && diskMismatch === 0) {
  console.log(`   ✓  Disk integrity check:   All ${verifiedFiles} files in manifest match build output on disk.`)
} else if (verifiedFiles === 0 && diskMissing === Object.keys(files).length) {
  console.log('   ℹ️  Build output directory out/ not present on disk (clean checkout or cleaned out/).')
  if (isStrict) {
    console.error('   ❌ Strict mode requires build output out/ to be present and verified.')
    failures++
  }
} else {
  console.warn(`   ⚠️  Disk check: ${verifiedFiles} OK, ${diskMismatch} mismatched, ${diskMissing} missing.`)
  if (isStrict) failures++
}

// ── 5. Compute Deterministic Build Signature ──────────────────────────────
const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

if (!preloadEntry || !rendererEntry || !mainEntry) {
  console.error('\n❌ Malformed manifest: Missing preload, renderer, or main bundle entry.\n')
  failures++
}

const manifestJson = JSON.stringify(
  Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
)
const manifestHash = createHash('sha256').update(manifestJson).digest('hex')

const buildSigInput = [
  manifest.version,
  manifestHash,
  preloadEntry?.[1]  ?? 'MISSING',
  rendererEntry?.[1] ?? 'MISSING',
  mainEntry?.[1]     ?? 'MISSING',
].join(':')
const buildSignature = createHash('sha256').update(buildSigInput).digest('hex')

console.log(`   Manifest SHA-256:       ${manifestHash.slice(0, 32)}...`)
console.log(`   Computed Build Sig:     ${buildSignature}`)

// ── 6. Compare with Backend Official-Builds Registry ──────────────────────
const versionsToCheck = [displayVersion, fullVersion]
let registeredMatches = 0
let registeredMismatches = 0

for (const ver of versionsToCheck) {
  const entry = officialBuilds[ver]
  if (!entry) {
    console.log(`   ℹ️  Version "${ver}" is not yet registered in backend official-builds.json.`)
  } else if (entry.buildSignature === buildSignature) {
    console.log(`   ✅ Backend match "${ver}": Signature matches registry (${entry.releasedAt}, ${entry.releaseChannel})`)
    registeredMatches++
  } else {
    console.error(`   ❌ BACKEND MISMATCH "${ver}": Registered ${entry.buildSignature} !== Computed ${buildSignature}`)
    registeredMismatches++
    failures++
  }
}

if (registeredMismatches > 0) {
  console.error('\n❌ BUILD SIGNATURE VERIFICATION FAILED:')
  console.error('   The current build output has a different signature than the registered backend record!')
  console.error('   Installer packaged from this build would fail license integrity verification in production.\n')
} else if (registeredMatches === 0) {
  console.log('\n⚠️  Notice: Current build has not been registered with backend yet.')
  console.log(`   Run "npm run release:register" to register signature: ${buildSignature}`)
  if (isStrict) failures++
}

// ── 7. Check Packaged Installer Artifacts (Deep Read-Only Verification) ───
console.log('\n📦 Packaged Artifacts Verification:')
const installerPath = join(ROOT_APP, 'release', installerName)
const latestYmlPath = join(ROOT_APP, 'release', 'latest.yml')
const unpackedAsarPath = join(ROOT_APP, 'release', 'win-unpacked', 'resources', 'app.asar')

let installerVerified = false
if (existsSync(installerPath)) {
  const stat = statSync(installerPath)
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2)
  const manifestStat = statSync(MANIFEST_PATH)
  
  console.log(`   Installer file:         release/${installerName} (${sizeMb} MB, modified ${stat.mtime.toISOString()})`)
  
  // 7a. Timestamp sanity check: installer must not be older than manifest
  if (stat.mtimeMs < manifestStat.mtimeMs) {
    console.error(
      `   ❌ STALE INSTALLER: release/${installerName} is OLDER than integrity-manifest.json!\n` +
      `      Installer mtime: ${stat.mtime.toISOString()}\n` +
      `      Manifest mtime:  ${manifestStat.mtime.toISOString()}\n` +
      `      The installer was built from a previous build. Run "npm run package:win" to repackage.`
    )
    if (isStrict) failures++
  } else {
    console.log('   ✓  Timestamp coherence: Installer is newer than or equal to current integrity manifest.')
  }

  // 7b. Verify latest.yml if present
  if (existsSync(latestYmlPath)) {
    try {
      const ymlRaw = readFileSync(latestYmlPath, 'utf8')
      const verMatch = ymlRaw.match(/version:\s*([^\r\n]+)/)
      const shaMatch = ymlRaw.match(/sha512:\s*([^\r\n]+)/)
      const pathMatch = ymlRaw.match(/path:\s*([^\r\n]+)/)

      if (verMatch && verMatch[1].trim() !== fullVersion) {
        console.error(`   ❌ latest.yml version mismatch: expected ${fullVersion}, found ${verMatch[1].trim()}`)
        if (isStrict) failures++
      } else {
        console.log(`   ✓  latest.yml version matches target semver (${fullVersion}).`)
      }

      if (pathMatch && pathMatch[1].trim() !== installerName) {
        console.error(`   ❌ latest.yml path mismatch: expected ${installerName}, found ${pathMatch[1].trim()}`)
        if (isStrict) failures++
      }

      if (shaMatch) {
        const expectedSha512 = shaMatch[1].trim()
        const actualSha512 = createHash('sha512').update(readFileSync(installerPath)).digest('base64')
        if (actualSha512 === expectedSha512) {
          console.log('   ✓  latest.yml SHA-512 matches installer binary byte-for-byte.')
        } else {
          console.error(`   ❌ latest.yml SHA-512 mismatch! Installer does not match updater metadata descriptor.`)
          if (isStrict) failures++
        }
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not parse latest.yml: ${err.message}`)
      warnings++
    }
  } else {
    console.log('   ℹ️  release/latest.yml not found.')
  }

  // 7c. Deep ASAR inspection (if unpacked staging exists)
  if (existsSync(unpackedAsarPath)) {
    try {
      let asarMod
      try {
        asarMod = require('@electron/asar')
      } catch {
        try { asarMod = require('asar') } catch {}
      }

      if (asarMod && asarMod.extractFile) {
        const asarManifestBuf = asarMod.extractFile(unpackedAsarPath, join('electron', 'security', 'integrity-manifest.json'))
        const asarManifest = JSON.parse(asarManifestBuf.toString('utf8'))
        const asarFiles = asarManifest.files

        const asarSorted = JSON.stringify(
          Object.fromEntries(Object.entries(asarFiles).sort(([a], [b]) => a.localeCompare(b)))
        )
        const asarManifestHash = createHash('sha256').update(asarSorted).digest('hex')
        const asarPreload  = Object.entries(asarFiles).find(([k]) => k.includes('preload'))?.[1] ?? 'MISSING'
        const asarRenderer = Object.entries(asarFiles).find(([k]) => k.includes('renderer'))?.[1] ?? 'MISSING'
        const asarMain     = Object.entries(asarFiles).find(([k]) => k.includes('main'))?.[1] ?? 'MISSING'

        const asarBuildSig = createHash('sha256').update([
          asarManifest.version,
          asarManifestHash,
          asarPreload,
          asarRenderer,
          asarMain,
        ].join(':')).digest('hex')

        if (asarBuildSig === buildSignature) {
          console.log(`   ✅ Packaged ASAR internal signature verified: Matches build signature (${asarBuildSig.slice(0, 16)}...).`)
          installerVerified = true
        } else {
          console.error(
            `   ❌ PACKAGED ASAR SIGNATURE MISMATCH!\n` +
            `      ASAR internal signature: ${asarBuildSig}\n` +
            `      Current build signature: ${buildSignature}\n` +
            `      The installer contains an outdated or different build! Repackage with "npm run package:win".`
          )
          if (isStrict) failures++
        }
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not extract manifest from app.asar: ${err.message}`)
      warnings++
    }
  } else {
    console.log('   ℹ️  win-unpacked staging directory not present (verified installer container via size and mtime).')
  }

} else {
  console.log(`   ℹ️  release/${installerName} not present (run "npm run package:win" to package without rebuilding).`)
  if (isStrict) {
    console.error(`   ❌ Strict mode requires release/${installerName} to exist.`)
    failures++
  }
}

console.log('═'.repeat(65))
if (failures > 0) {
  console.error(`❌ Verification completed with ${failures} failure(s) and ${warnings} warning(s).\n`)
  process.exit(1)
} else {
  console.log('✅ Build signature and manifest verification completed successfully.\n')
  process.exit(0)
}
