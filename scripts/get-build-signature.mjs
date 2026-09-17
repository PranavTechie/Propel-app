#!/usr/bin/env node
/**
 * get-build-signature.mjs
 *
 * Computes and prints the buildSignature for the current build output.
 * Run AFTER "npm run build" (or as part of the build pipeline).
 * The printed signature should be pasted into:
 *   propel-backend/services/official-builds.json
 *
 * Usage:
 *   node scripts/get-build-signature.mjs
 *   npm run build:signature
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'electron', 'security', 'integrity-manifest.json')

if (!existsSync(MANIFEST_PATH)) {
  console.error('❌ Manifest not found. Run "npm run generate:manifest" first.\n')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const files = manifest.files

const preloadEntry  = Object.entries(files).find(([k]) => k.includes('preload'))
const rendererEntry = Object.entries(files).find(([k]) => k.includes('renderer'))
const mainEntry     = Object.entries(files).find(([k]) => k.includes('main'))

// Compute manifest hash (same algo as integrityVerifier.ts)
const manifestJson = JSON.stringify(
  Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
)
const manifestHash = createHash('sha256').update(manifestJson).digest('hex')

// Compute build signature (same algo as integrityVerifier.ts)
const buildSigInput = [
  manifest.version,
  manifestHash,
  preloadEntry?.[1]  ?? 'MISSING',
  rendererEntry?.[1] ?? 'MISSING',
  mainEntry?.[1]     ?? 'MISSING',
].join(':')
const buildSignature = createHash('sha256').update(buildSigInput).digest('hex')

console.log('\n🔑 Propel — Build Signature\n')
console.log(`   Version:        ${manifest.version}`)
console.log(`   Built at:       ${manifest.builtAt}`)
console.log(`   Manifest hash:  ${manifestHash.slice(0, 32)}...`)
console.log(`   Build sig:      ${buildSignature}`)
console.log('\n📋 Paste into propel-backend/services/official-builds.json:\n')
console.log(JSON.stringify({
  [manifest.version]: {
    buildSignature,
    releaseChannel: 'stable',
    releasedAt:     new Date().toISOString().slice(0, 10),
  }
}, null, 2))
console.log()
