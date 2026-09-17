#!/usr/bin/env node
/**
 * upload-sourcemaps.mjs
 *
 * Uploads hidden source maps to GlitchTip after a production build.
 * GlitchTip is Sentry-compatible — we use @sentry/cli directly.
 *
 * Required environment variables (in electron-app/.env or CI secrets):
 *   SENTRY_AUTH_TOKEN   — GlitchTip API token (Settings → API Tokens)
 *   SENTRY_ORG          — GlitchTip organization slug
 *   SENTRY_PROJECT      — GlitchTip project slug
 *   SENTRY_URL          — Your GlitchTip instance URL (e.g. https://app.glitchtip.com)
 *   VITE_APP_VERSION    — App version (defaults to 1.2)
 *
 * Usage:
 *   node scripts/upload-sourcemaps.mjs
 *
 * Or via npm:
 *   npm run sourcemaps:upload
 *
 * Typical CI flow:
 *   npm run build:win          # generates out/{main,preload,renderer} + .map files
 *   npm run sourcemaps:upload  # uploads maps to GlitchTip, then deletes them
 *   npm run dist               # package EXE (maps already deleted, not bundled)
 */

import { execSync } from 'child_process'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────────
const APP_VERSION   = process.env.VITE_APP_VERSION ?? '1.2'
const RELEASE       = `propel@${APP_VERSION}`
const SENTRY_URL    = process.env.SENTRY_URL    ?? 'https://app.glitchtip.com'
const SENTRY_ORG    = process.env.SENTRY_ORG    ?? ''
const SENTRY_PROJ   = process.env.SENTRY_PROJECT ?? ''
const AUTH_TOKEN    = process.env.SENTRY_AUTH_TOKEN ?? ''

// Directories containing source maps
const MAP_DIRS = [
  join(ROOT, 'out', 'main'),
  join(ROOT, 'out', 'preload'),
  join(ROOT, 'out', 'renderer'),
]

function validate() {
  const missing = []
  if (!AUTH_TOKEN)  missing.push('SENTRY_AUTH_TOKEN')
  if (!SENTRY_ORG)  missing.push('SENTRY_ORG')
  if (!SENTRY_PROJ) missing.push('SENTRY_PROJECT')
  if (missing.length) {
    console.error(`\n❌ Missing required env vars: ${missing.join(', ')}`)
    console.error('   See SOURCEMAP_UPLOAD.md for setup instructions.\n')
    process.exit(1)
  }
  for (const dir of MAP_DIRS) {
    if (!existsSync(dir)) {
      console.error(`\n❌ Build output not found: ${dir}`)
      console.error('   Run "npm run build:win" first.\n')
      process.exit(1)
    }
  }
}

function run(cmd) {
  console.log(`  $ ${cmd}`)
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, SENTRY_URL, SENTRY_AUTH_TOKEN: AUTH_TOKEN },
  })
}

function deleteMapFiles() {
  let deleted = 0
  for (const dir of MAP_DIRS) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.map')) {
        unlinkSync(join(dir, file))
        deleted++
      }
    }
  }
  console.log(`  ✅ Deleted ${deleted} .map files from output directories`)
}

async function main() {
  console.log(`\n🗺  Propel — Source Map Upload`)
  console.log(`   Release:  ${RELEASE}`)
  console.log(`   Server:   ${SENTRY_URL}`)
  console.log(`   Org/Proj: ${SENTRY_ORG}/${SENTRY_PROJ}\n`)

  validate()

  const cli = `npx @sentry/cli --url "${SENTRY_URL}" --auth-token "${AUTH_TOKEN}"`
  const rel = `${cli} releases --org "${SENTRY_ORG}" --project "${SENTRY_PROJ}"`

  console.log('📋 Step 1/4 — Creating release...')
  run(`${rel} new "${RELEASE}"`)

  console.log('\n📤 Step 2/4 — Uploading source maps...')
  for (const dir of MAP_DIRS) {
    if (!existsSync(dir)) continue
    const label = dir.split('out/')[1] ?? dir
    console.log(`   Uploading ${label}/...`)
    run(
      `${rel} files "${RELEASE}" upload-sourcemaps "${dir}" ` +
      `--rewrite --url-prefix "~/${label}"`,
    )
  }

  console.log('\n🔗 Step 3/4 — Finalizing release...')
  run(`${rel} finalize "${RELEASE}"`)

  console.log('\n🗑  Step 4/4 — Deleting .map files from output (security)...')
  deleteMapFiles()

  console.log(`\n✅ Source maps uploaded and cleaned up for release: ${RELEASE}`)
  console.log('   GlitchTip will now resolve stack traces to original TypeScript files.\n')
}

main().catch(err => {
  console.error('\n❌ Source map upload failed:', err.message)
  process.exit(1)
})
