#!/usr/bin/env node
/**
 * verify-release-version.mjs
 *
 * Verifies that all intentional version references across propel-app,
 * propel-website, and propel-backend match the expected target version,
 * and confirms that no stale references or corrupted historical records exist.
 *
 * Usage:
 *   node scripts/verify-release-version.mjs
 *   npm run release:verify
 *   npm run release:verify -- 1.4.0
 */

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  ROOT_APP,
  ROOT_WORKSPACE,
  BACKEND_BUILDS_PATH,
  WEBSITE_CONSTANTS_PATH,
  WEBSITE_ROBOTS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
} from './release-safety.mjs'

const args = process.argv.slice(2)
const explicitVersion = args.find((a) => !a.startsWith('--'))

// ── 1. Determine Target Version ───────────────────────────────────────────
const pkgPath = join(ROOT_APP, 'package.json')
const currentPkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const targetVersionStr = explicitVersion ?? currentPkg.version

let target
try {
  target = parseReleaseVersion(targetVersionStr)
} catch (err) {
  console.error(`\n❌ Error parsing target version: ${err.message}\n`)
  process.exit(1)
}

const { fullVersion, displayVersion, gitTag, installerName, downloadPath } = target

console.log('\n🔎 Propel Release Integrity & Version Verifier')
console.log('═'.repeat(65))
console.log(`   Expected Semver (Full):     ${fullVersion}`)
console.log(`   Expected Display Version:   ${displayVersion}`)
console.log(`   Expected Git Release Tag:   ${gitTag}`)
console.log(`   Expected Installer Binary:  ${installerName}`)
console.log(`   Expected Web Download URL:  ${downloadPath}`)
console.log('═'.repeat(65))

const checks = []

function addCheck(file, description, pass, details = '') {
  checks.push({ file, description, pass, details })
}

// ── 2. propel-app package.json ────────────────────────────────────────────
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  addCheck('propel-app/package.json', 'Root semver version match', pkg.version === fullVersion, `Found: ${pkg.version}`)
} catch (err) {
  addCheck('propel-app/package.json', 'File read error', false, err.message)
}

// ── 3. propel-app package-lock.json ───────────────────────────────────────
const lockPath = join(ROOT_APP, 'package-lock.json')
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const rootMatch = lock.version === fullVersion
  const pkgDescMatch = lock.packages?.['']?.version === fullVersion
  addCheck(
    'propel-app/package-lock.json',
    'Lockfile root and package descriptor version match',
    rootMatch && pkgDescMatch,
    `root: ${lock.version}, packages[""]: ${lock.packages?.['']?.version}`,
  )
} catch (err) {
  addCheck('propel-app/package-lock.json', 'File read error', false, err.message)
}

// ── 4. updaterService.ts ──────────────────────────────────────────────────
const updaterPath = join(ROOT_APP, 'electron', 'services', 'updater', 'updaterService.ts')
try {
  const content = readFileSync(updaterPath, 'utf8')
  const pass = content.includes(`export const APP_VERSION = '${displayVersion}'`)
  addCheck('updaterService.ts', `Main process APP_VERSION = '${displayVersion}'`, pass)
} catch (err) {
  addCheck('updaterService.ts', 'File read error', false, err.message)
}

// ── 5. handlers.ts ────────────────────────────────────────────────────────
const handlersPath = join(ROOT_APP, 'electron', 'ipc', 'handlers.ts')
try {
  const content = readFileSync(handlersPath, 'utf8')
  const pass = content.includes(`const APP_VERSION = '${displayVersion}'`)
  addCheck('handlers.ts', `IPC APP_VERSION = '${displayVersion}'`, pass)
} catch (err) {
  addCheck('handlers.ts', 'File read error', false, err.message)
}

// ── 6. telemetry.ts ───────────────────────────────────────────────────────
const telemetryPath = join(ROOT_APP, 'src', 'services', 'telemetry.ts')
try {
  const content = readFileSync(telemetryPath, 'utf8')
  const pass = content.includes(`?? '${displayVersion}'`)
  addCheck('telemetry.ts', `Telemetry fallback APP_VERSION = '${displayVersion}'`, pass)
} catch (err) {
  addCheck('telemetry.ts', 'File read error', false, err.message)
}

// ── 7. SplashScreen.tsx ───────────────────────────────────────────────────
const splashPath = join(ROOT_APP, 'src', 'pages', 'SplashScreen.tsx')
try {
  const content = readFileSync(splashPath, 'utf8')
  const pass = content.includes(`<span>Version ${displayVersion}</span>`)
  addCheck('SplashScreen.tsx', `Splash screen displays "Version ${displayVersion}"`, pass)
} catch (err) {
  addCheck('SplashScreen.tsx', 'File read error', false, err.message)
}

// ── 8. LoginPage.tsx ──────────────────────────────────────────────────────
const loginPath = join(ROOT_APP, 'src', 'pages', 'LoginPage.tsx')
try {
  const content = readFileSync(loginPath, 'utf8')
  const pass = content.includes(`Propel ${displayVersion} · Built for Windows`)
  addCheck('LoginPage.tsx', `Login page sidebar displays "Propel ${displayVersion} · Built for Windows"`, pass)
} catch (err) {
  addCheck('LoginPage.tsx', 'File read error', false, err.message)
}

// ── 9. AboutPage.tsx ──────────────────────────────────────────────────────
const aboutPath = join(ROOT_APP, 'src', 'pages', 'AboutPage.tsx')
try {
  const content = readFileSync(aboutPath, 'utf8')
  const badgeMatch = new RegExp(`text-text-muted">\\s*${displayVersion}\\s*</span>`).test(content)
  const statusMatch = content.includes(`Propel ${displayVersion} is the latest version.`)
  addCheck('AboutPage.tsx', `About hero badge and latest version status show "${displayVersion}"`, badgeMatch && statusMatch)
} catch (err) {
  addCheck('AboutPage.tsx', 'File read error', false, err.message)
}

// ── 10. generate-integrity-manifest.mjs ────────────────────────────────────
const genManifestPath = join(ROOT_APP, 'scripts', 'generate-integrity-manifest.mjs')
try {
  const content = readFileSync(genManifestPath, 'utf8')
  const pass = content.includes(`process.env.VITE_APP_VERSION ?? '${displayVersion}'`)
  addCheck('generate-integrity-manifest.mjs', `Fallback manifest version = '${displayVersion}'`, pass)
} catch (err) {
  addCheck('generate-integrity-manifest.mjs', 'File read error', false, err.message)
}

// ── 11. upload-sourcemaps.mjs ─────────────────────────────────────────────
const uploadMapsPath = join(ROOT_APP, 'scripts', 'upload-sourcemaps.mjs')
try {
  const content = readFileSync(uploadMapsPath, 'utf8')
  const pass = content.includes(`process.env.VITE_APP_VERSION ?? '${displayVersion}'`)
  addCheck('upload-sourcemaps.mjs', `Fallback sourcemaps version = '${displayVersion}'`, pass)
} catch (err) {
  addCheck('upload-sourcemaps.mjs', 'File read error', false, err.message)
}

// ── 12. propel-website site-constants.ts ──────────────────────────────────
try {
  const content = readFileSync(WEBSITE_CONSTANTS_PATH, 'utf8')
  const vMatch = content.includes(`export const APP_VERSION = "${displayVersion}";`)
  const fMatch = content.includes(`export const DOWNLOAD_FILENAME = "${installerName}";`)
  const pMatch = content.includes(`export const DOWNLOAD_PATH = "${downloadPath}";`)
  addCheck('propel-website site-constants.ts', `APP_VERSION, DOWNLOAD_FILENAME, DOWNLOAD_PATH match target`, vMatch && fMatch && pMatch)
} catch (err) {
  addCheck('propel-website site-constants.ts', 'File read error', false, err.message)
}

// ── 13. propel-website robots.txt ─────────────────────────────────────────
try {
  const content = readFileSync(WEBSITE_ROBOTS_PATH, 'utf8')
  const pass = content.includes(`Disallow: ${downloadPath}`)
  addCheck('propel-website robots.txt', `Disallow directive matches "${downloadPath}"`, pass)
} catch (err) {
  addCheck('propel-website robots.txt', 'File read error', false, err.message)
}

// ── 14. propel-website overview.tsx & Navbar.tsx ──────────────────────────
const overviewPath = resolve(ROOT_WORKSPACE, 'propel-website', 'app', 'routes', 'overview.tsx')
const navbarPath   = resolve(ROOT_WORKSPACE, 'propel-website', 'app', 'components', 'Navbar.tsx')
try {
  const oContent = readFileSync(overviewPath, 'utf8')
  const nContent = readFileSync(navbarPath, 'utf8')
  const oClean = oContent.includes('DOWNLOAD_PATH') && !oContent.includes('/Propel-Setup-')
  const nClean = nContent.includes('DOWNLOAD_PATH') && !nContent.includes('/Propel-Setup-')
  addCheck('propel-website overview.tsx', 'Uses site-constants (no hardcoded .exe)', oClean)
  addCheck('propel-website Navbar.tsx', 'Uses site-constants (no hardcoded .exe)', nClean)
} catch (err) {
  addCheck('propel-website routes/components', 'File read error', false, err.message)
}

// ── 15. propel-backend Historical Records Protection ──────────────────────
try {
  assertLegacyBackendRecords()
  addCheck('propel-backend official-builds.json', 'Historical 1.2, 1.2.0, 1.3, 1.3.0 records are 100% intact', true)
} catch (err) {
  addCheck('propel-backend official-builds.json', 'Historical records integrity check', false, err.message)
}

// ── Print Results Checklist ───────────────────────────────────────────────
console.log('\nVerification Checklist:')
let hasFailure = false

for (const c of checks) {
  const statusIcon = c.pass ? '✅' : '❌'
  const detailStr = c.details ? ` (${c.details})` : ''
  console.log(`   ${statusIcon} [${c.file}] ${c.description}${detailStr}`)
  if (!c.pass) hasFailure = true
}

console.log('═'.repeat(65))

if (hasFailure) {
  console.error('\n❌ VERIFICATION FAILED: One or more intentional version references are inconsistent.\n')
  process.exit(1)
} else {
  console.log(`\n✅ ALL CHECKS PASSED: Workspace is completely synchronized to ${fullVersion} (${displayVersion}).\n`)
  process.exit(0)
}
