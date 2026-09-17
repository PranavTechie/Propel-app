#!/usr/bin/env node
/**
 * generate-integrity-manifest.mjs
 *
 * Generates the SHA-256 integrity manifest for Propel production builds.
 *
 * Run AFTER `electron-vite build` and BEFORE `electron-builder`.
 * The manifest is embedded into app.asar at package time.
 *
 * Files hashed:
 *   out/main/index.js       — Electron main bundle
 *   out/preload/index.js    — Preload bundle (security-critical)
 *   out/renderer/assets/*.js — Renderer bundle(s)
 *
 * Output:
 *   electron/security/integrity-manifest.json
 *   (This file is then bundled into the ASAR and read at runtime)
 *
 * Usage:
 *   node scripts/generate-integrity-manifest.mjs
 *   npm run generate:manifest
 */

import { createHash, createHmac } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs'
import { join, resolve, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT      = resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────────
const APP_VERSION = process.env.VITE_APP_VERSION ?? '3.2.0'

// HMAC key for manifest signature (not secret — provides integrity only,
// not authenticity). A real code-signing cert handles authenticity.
// This key is embedded in the verifier source — changing it = new build.
const MANIFEST_HMAC_KEY = 'propel-manifest-integrity-v1-2026'

// Output path (inside electron/ so it gets bundled into app.asar)
const MANIFEST_PATH = join(ROOT, 'electron', 'security', 'integrity-manifest.json')

// Files to hash — paths relative to ROOT (becomes the key in the manifest)
// Renderer assets use a glob since the filename includes a content hash
const STATIC_FILES = [
  'out/main/index.js',
  'out/preload/index.js',
]

// ── Helpers ───────────────────────────────────────────────────────────────
function sha256(filePath) {
  const data = readFileSync(filePath)
  return createHash('sha256').update(data).digest('hex')
}

function findRendererAssets() {
  const dir = join(ROOT, 'out', 'renderer', 'assets')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => relative(ROOT, join(dir, f)).replace(/\\/g, '/'))
}

function signManifest(files) {
  // Sort keys deterministically, create a canonical string, HMAC it
  const canonical = Object.keys(files)
    .sort()
    .map(k => `${k}:${files[k]}`)
    .join('\n')
  return createHmac('sha256', MANIFEST_HMAC_KEY).update(canonical).digest('hex')
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log('\n🔒 Propel — Integrity Manifest Generator')
console.log(`   Version: ${APP_VERSION}\n`)

// Validate build output exists
for (const rel of STATIC_FILES) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    console.error(`❌ Build output not found: ${rel}`)
    console.error('   Run "npm run build" first.\n')
    process.exit(1)
  }
}

// Collect all files to hash
const allFiles = [
  ...STATIC_FILES,
  ...findRendererAssets(),
]

console.log(`   Hashing ${allFiles.length} file(s)...`)

// Build the hash map — sorted for determinism
const fileHashes = {}
for (const rel of allFiles) {
  const abs  = join(ROOT, rel)
  const hash = sha256(abs)
  const key  = rel.replace(/\\/g, '/')   // always forward slashes
  fileHashes[key] = hash
  console.log(`   ✓ ${key.padEnd(55)} ${hash.slice(0, 16)}...`)
}

// Sign the manifest
const signature = signManifest(fileHashes)

// Assemble manifest
const manifest = {
  version:   APP_VERSION,
  builtAt:   new Date().toISOString(),
  files:     Object.fromEntries(Object.entries(fileHashes).sort(([a], [b]) => a.localeCompare(b))),
  signature,
}

// Write output
mkdirSync(join(ROOT, 'electron', 'security'), { recursive: true })
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')

console.log(`\n✅ Manifest written → ${relative(ROOT, MANIFEST_PATH)}`)
console.log(`   Files:     ${Object.keys(manifest.files).length}`)
console.log(`   Signature: ${signature.slice(0, 16)}...`)
console.log(`   Built at:  ${manifest.builtAt}\n`)
