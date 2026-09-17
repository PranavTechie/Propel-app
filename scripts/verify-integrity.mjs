#!/usr/bin/env node
/**
 * verify-integrity.mjs
 *
 * Standalone integrity verification script.
 * Reads the generated manifest and re-hashes all listed files.
 * Used in CI to validate that the build output matches the manifest
 * before packaging the EXE.
 *
 * Usage:
 *   node scripts/verify-integrity.mjs
 *   npm run verify:integrity
 *
 * Exit codes:
 *   0 = all files match manifest
 *   1 = manifest missing, files missing, or hash mismatch
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT      = resolve(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'electron', 'security', 'integrity-manifest.json')

function sha256(filePath) {
  const data = readFileSync(filePath)
  return createHash('sha256').update(data).digest('hex')
}

console.log('\n🔍 Propel — Integrity Verification\n')

if (!existsSync(MANIFEST_PATH)) {
  console.error('❌ Manifest not found:', MANIFEST_PATH)
  console.error('   Run "npm run generate:manifest" first.\n')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch {
  console.error('❌ Manifest is corrupt or invalid JSON.\n')
  process.exit(1)
}

console.log(`   Version: ${manifest.version}`)
console.log(`   Built:   ${manifest.builtAt}`)
console.log(`   Files:   ${Object.keys(manifest.files).length}\n`)

let passed = 0
let failed = 0

for (const [relKey, expectedHash] of Object.entries(manifest.files)) {
  const abs = join(ROOT, relKey)
  if (!existsSync(abs)) {
    console.error(`   ❌ MISSING  ${relKey}`)
    failed++
    continue
  }
  const actualHash = sha256(abs)
  if (actualHash === expectedHash) {
    console.log(`   ✓  OK      ${relKey}`)
    passed++
  } else {
    console.error(`   ❌ MISMATCH ${relKey}`)
    console.error(`      expected: ${expectedHash.slice(0, 32)}...`)
    console.error(`      actual:   ${actualHash.slice(0, 32)}...`)
    failed++
  }
}

console.log(`\n   Passed: ${passed} / ${passed + failed}`)

if (failed > 0) {
  console.error(`\n❌ Integrity check FAILED — ${failed} file(s) tampered or missing.\n`)
  process.exit(1)
} else {
  console.log('\n✅ All files verified — integrity intact.\n')
}
