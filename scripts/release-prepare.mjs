#!/usr/bin/env node
/**
 * release-prepare.mjs
 *
 * Atomically synchronizes all intentional application version references
 * across propel-app, propel-backend, and propel-website for a new release.
 *
 * Usage:
 *   node scripts/release-prepare.mjs 1.4.0
 *   npm run release:prepare -- 1.4.0
 *   npm run release:prepare -- 1.4.0 --dry-run
 *   npm run release:prepare -- 1.4.0 --force
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  ROOT_APP,
  ROOT_WORKSPACE,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
  compareSemver,
} from './release-safety.mjs'

const args = process.argv.slice(2)
const isDryRun = args.some((a) => a === '--dry-run' || a === '-n' || a === '--dryrun')
const isForce  = args.some((a) => a === '--force' || a === '-f')
const versionArg = args.find((a) => !a.startsWith('-'))

if (!versionArg) {
  console.error('\n❌ Error: Missing version argument.')
  console.error('Usage: npm run release:prepare -- <version> [--dry-run] [--force]\n')
  console.error('Example: npm run release:prepare -- 1.4.0\n')
  process.exit(1)
}

// ── 1. Parse & Validate Target Version ─────────────────────────────────────
let target
try {
  target = parseReleaseVersion(versionArg)
} catch (err) {
  console.error(`\n❌ Error: ${err.message}\n`)
  process.exit(1)
}

const { fullVersion, displayVersion, gitTag, installerName, downloadPath } = target

console.log('\n🚀 Propel Release Preparation — Version Synchronizer')
console.log('═'.repeat(60))
console.log(`   Target Full Semver:   ${fullVersion}`)
console.log(`   User-Facing Version:  ${displayVersion}`)
console.log(`   Git Release Tag:      ${gitTag}`)
console.log(`   Windows Installer:    ${installerName}`)
console.log(`   Website Download URL: ${downloadPath}`)
console.log(`   Dry-Run Mode:         ${isDryRun ? 'ENABLED (No files will be modified)' : 'disabled'}`)
console.log('═'.repeat(60))

// ── 2. Safety Assertion on Backend Historical Records ─────────────────────
try {
  assertLegacyBackendRecords()
  console.log('🛡️  Legacy backend records verified: 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 are intact.')
} catch (err) {
  console.error(`\n❌ PRE-CHECK FAILED: ${err.message}\n`)
  process.exit(1)
}

// ── 3. Read Current App Version ───────────────────────────────────────────
const pkgPath = join(ROOT_APP, 'package.json')
const currentPkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const currentVersion = currentPkg.version

console.log(`📦 Current Package Version: ${currentVersion}`)

if (!isForce) {
  const cmp = compareSemver(fullVersion, currentVersion)
  if (cmp === 0) {
    console.log(`ℹ️  Current version is already ${fullVersion}. Nothing to update (use --force to override).`)
    process.exit(0)
  }
  if (cmp < 0) {
    console.error(
      `\n❌ Target version ${fullVersion} is lower than current version ${currentVersion} (downgrade). ` +
      `Use --force if you intentionally want to downgrade.\n`
    )
    process.exit(1)
  }
}

// ── 4. Target Files Definitions & Replacements ─────────────────────────────
const targetFiles = [
  {
    name: 'propel-app package.json',
    path: pkgPath,
    transform: (content) => {
      const parsed = JSON.parse(content)
      parsed.version = fullVersion
      return JSON.stringify(parsed, null, 2) + '\n'
    },
    verify: (content) => content.includes(`"version": "${fullVersion}"`),
  },
  {
    name: 'propel-app package-lock.json',
    path: join(ROOT_APP, 'package-lock.json'),
    transform: (content) => {
      const parsed = JSON.parse(content)
      parsed.version = fullVersion
      if (parsed.packages && parsed.packages['']) {
        parsed.packages[''].version = fullVersion
      }
      return JSON.stringify(parsed, null, 2) + '\n'
    },
    verify: (content) => {
      const parsed = JSON.parse(content)
      return parsed.version === fullVersion && parsed.packages?.['']?.version === fullVersion
    },
  },
  {
    name: 'updaterService.ts (Main Process Version)',
    path: join(ROOT_APP, 'electron', 'services', 'updater', 'updaterService.ts'),
    transform: (content) => {
      const pattern = /export const APP_VERSION = '[^']+'/
      if (!pattern.test(content)) throw new Error('Pattern "export const APP_VERSION = \'...\'" not found')
      return content.replace(pattern, `export const APP_VERSION = '${displayVersion}'`)
    },
    verify: (content) => content.includes(`export const APP_VERSION = '${displayVersion}'`),
  },
  {
    name: 'handlers.ts (IPC Version Handler)',
    path: join(ROOT_APP, 'electron', 'ipc', 'handlers.ts'),
    transform: (content) => {
      const pattern = /const APP_VERSION = '[^']+'/
      if (!pattern.test(content)) throw new Error('Pattern "const APP_VERSION = \'...\'" not found')
      return content.replace(pattern, `const APP_VERSION = '${displayVersion}'`)
    },
    verify: (content) => content.includes(`const APP_VERSION = '${displayVersion}'`),
  },
  {
    name: 'telemetry.ts (Renderer Fallback Version)',
    path: join(ROOT_APP, 'src', 'services', 'telemetry.ts'),
    transform: (content) => {
      const pattern = /(VITE_APP_VERSION as string \| undefined\) \?\? ')[^']+'/
      if (!pattern.test(content)) throw new Error('Pattern "VITE_APP_VERSION ... ?? \'...\'" not found')
      return content.replace(pattern, `$1${displayVersion}'`)
    },
    verify: (content) => content.includes(`?? '${displayVersion}'`),
  },
  {
    name: 'SplashScreen.tsx (UI Version Label)',
    path: join(ROOT_APP, 'src', 'pages', 'SplashScreen.tsx'),
    transform: (content) => {
      // The redesigned splash uses a bare text node inside <motion.p>:
      //   Version 1.3
      // Match: optional whitespace + "Version " + semver digits/dots + optional whitespace
      const pattern = /(>[\s\r\n]*)(Version [0-9]+\.[0-9]+(?:\.[0-9]+)?)(\s*<\/motion\.p>)/
      if (!pattern.test(content)) throw new Error('Pattern "Version X.Y[.Z] text node in <motion.p>" not found in SplashScreen.tsx')
      return content.replace(pattern, `$1Version ${displayVersion}$3`)
    },
    verify: (content) => {
      const pattern = /(>[\s\r\n]*)(Version [0-9]+\.[0-9]+(?:\.[0-9]+)?)(\s*<\/motion\.p>)/
      const m = pattern.exec(content)
      return m !== null && m[2] === `Version ${displayVersion}`
    },
  },
  {
    name: 'LoginPage.tsx (UI Sidebar Label)',
    path: join(ROOT_APP, 'src', 'pages', 'LoginPage.tsx'),
    transform: (content) => {
      const pattern = /Propel [0-9.]+ · Built for Windows/
      if (!pattern.test(content)) throw new Error('Pattern "Propel ... · Built for Windows" not found')
      return content.replace(pattern, `Propel ${displayVersion} · Built for Windows`)
    },
    verify: (content) => content.includes(`Propel ${displayVersion} · Built for Windows`),
  },
  {
    name: 'AboutPage.tsx (Badge & Up-to-Date Status)',
    path: join(ROOT_APP, 'src', 'pages', 'AboutPage.tsx'),
    transform: (content) => {
      // 1. Badge version
      const badgePattern = /(px-2\.5 py-0\.5 text-text-muted">\s*)([0-9.]+)(\s*<\/span>)/
      if (!badgePattern.test(content)) throw new Error('AboutPage badge version pattern not found')
      let updated = content.replace(badgePattern, `$1${displayVersion}$3`)

      // 2. Status text
      const statusPattern = /Propel [0-9.]+ is the latest version\./
      if (!statusPattern.test(updated)) throw new Error('AboutPage status text pattern not found')
      updated = updated.replace(statusPattern, `Propel ${displayVersion} is the latest version.`)
      return updated
    },
    verify: (content) => content.includes(`Propel ${displayVersion} is the latest version.`),
  },
  {
    name: 'generate-integrity-manifest.mjs (Build Manifest Script Fallback)',
    path: join(ROOT_APP, 'scripts', 'generate-integrity-manifest.mjs'),
    transform: (content) => {
      const pattern = /(process\.env\.VITE_APP_VERSION \?\? ')[^']+'/
      if (!pattern.test(content)) throw new Error('Manifest generator fallback version pattern not found')
      return content.replace(pattern, `$1${displayVersion}'`)
    },
    verify: (content) => content.includes(`process.env.VITE_APP_VERSION ?? '${displayVersion}'`),
  },
  {
    name: 'upload-sourcemaps.mjs (Sourcemap Upload Script Fallback)',
    path: join(ROOT_APP, 'scripts', 'upload-sourcemaps.mjs'),
    transform: (content) => {
      const pattern = /(process\.env\.VITE_APP_VERSION \?\? ')[^']+'/
      if (!pattern.test(content)) throw new Error('Sourcemap script fallback version pattern not found')
      let updated = content.replace(pattern, `$1${displayVersion}'`)
      // Also update comment if present
      updated = updated.replace(/\(defaults to [0-9.]+\)/, `(defaults to ${displayVersion})`)
      return updated
    },
    verify: (content) => content.includes(`process.env.VITE_APP_VERSION ?? '${displayVersion}'`),
  },
]

// ── 5. In-Memory Atomic Transformation Test ────────────────────────────────
console.log('\n🔍 Analyzing and pre-validating all target files...')
const preparedWrites = []

for (const targetFile of targetFiles) {
  if (!existsSync(targetFile.path)) {
    console.error(`\n❌ Error: File not found: ${targetFile.path}`)
    process.exit(1)
  }

  const originalContent = readFileSync(targetFile.path, 'utf8')
  let transformedContent
  try {
    transformedContent = targetFile.transform(originalContent)
  } catch (err) {
    console.error(`\n❌ Target transformation failed on ${targetFile.name}: ${err.message}`)
    console.error('Operation aborted. No files were modified.\n')
    process.exit(1)
  }

  if (!targetFile.verify(transformedContent)) {
    console.error(`\n❌ Verification assertion failed on transformed content for ${targetFile.name}`)
    console.error('Operation aborted. No files were modified.\n')
    process.exit(1)
  }

  preparedWrites.push({
    ...targetFile,
    originalContent,
    transformedContent,
  })

  console.log(`   ✓ Pre-validation passed: ${targetFile.name}`)
}

// ── 6. Execute Writes (or Dry Run) ─────────────────────────────────────────
if (isDryRun) {
  console.log('\n[DRY RUN] All 10 desktop app files verified and ready for atomic update. No changes written.')
  process.exit(0)
}

console.log('\n✍️  Writing changes to disk...')
for (const writeItem of preparedWrites) {
  writeFileSync(writeItem.path, writeItem.transformedContent, 'utf8')
  console.log(`   ✓ Updated: ${writeItem.name}`)
}

// ── 7. Post-Write Safety Assertion ─────────────────────────────────────────
try {
  assertLegacyBackendRecords()
  console.log('\n🛡️  POST-WRITE CHECK PASSED: All legacy backend records remain 100% byte-for-byte identical.')
} catch (err) {
  console.error(`\n🚨 CRITICAL POST-CHECK FAILURE: ${err.message}`)
  console.error('Restoring all files from memory...')
  for (const writeItem of preparedWrites) {
    writeFileSync(writeItem.path, writeItem.originalContent, 'utf8')
  }
  console.error('All modified files reverted successfully.\n')
  process.exit(1)
}

console.log('\n' + '═'.repeat(60))
console.log(`🎉 RELEASE PREPARATION COMPLETE: All files synchronized to ${fullVersion} (${displayVersion})`)
console.log('═'.repeat(60))
console.log('\nNext steps for production release:')
console.log('   1. npm run release:verify')
console.log('   2. npm run build')
console.log('   3. npm run generate:manifest')
console.log('   4. npm run release:register')
console.log('   5. npm run verify:build-signature')
console.log('   6. npm run package:win')
console.log('   7. Deploy backend (commit official-builds.json and deploy)')
console.log('   8. npm run publish:win (or npx electron-builder --win --publish always)\n')
