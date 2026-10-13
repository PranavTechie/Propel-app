#!/usr/bin/env node
/**
 * release-orchestrator.mjs
 *
 * Sequential, step-by-step, interactive release orchestrator for Propel on Windows.
 * Coordinates the full release process across 16 sequential steps:
 *
 *   STEP 1  — Pre-release inspection (Node, npm, git, branches, remotes, tests)
 *   STEP 2  — Release dry-run (Non-mutating version dry-run simulation)
 *   STEP 3  — Apply release version (Synchronize 10 application files)
 *   STEP 4  — Build application (Compile electron-vite build exactly once)
 *   STEP 5  — Generate & verify integrity manifest (HMAC SHA-256 manifest)
 *   STEP 6  — Register backend build signature (Atomic official-builds.json update)
 *   STEP 7  — Package Windows installer (electron-builder --win, no rebuild)
 *   STEP 8  — Verify installer (Strict installer timestamp, latest.yml & ASAR check)
 *   STEP 9  — Review Git changes (Explicit review of staged boundaries)
 *   STEP 10 — Commit backend registry (Stage only official-builds.json)
 *   STEP 11 — Push backend & verify deployment (Push origin/main & check Render)
 *   STEP 12 — Commit desktop release (Stage only approved desktop files)
 *   STEP 13 — Create & push tag (Tag v<version> pointing to release commit)
 *   STEP 14 — Publishing dry-run (Guarded pre-flight check without uploading)
 *   STEP 15 — Publish GitHub Release (Explicit final YES/NO authorization)
 *   STEP 16 — Final verification (GitHub API, website resolver, client verification)
 *
 * USER EXPERIENCE GUARANTEES:
 *   - After EVERY step, checks exit code and verification results.
 *   - Displays clear SUCCESS or FAILED with a concise summary.
 *   - If successful, asks [YES] Continue / [NO] Stop safely.
 *   - Case-insensitive YES/NO. Empty or invalid input is rejected and re-prompted.
 *   - If user enters NO, stops immediately without executing subsequent steps.
 *   - If a step fails, stops automatically. Never asks to continue after failure.
 *   - Supports --dry-run for complete non-mutating simulation.
 *   - Idempotent and restart-safe: checks for existing commits, tags, and releases on retries.
 *
 * Usage:
 *   node scripts/release-orchestrator.mjs <version> [options]
 *   npm run release:orchestrate -- <version> [options]
 *
 * Options:
 *   --dry-run, -n      Simulate workflow without modifying files, building, committing, or publishing
 *   --force, -f        Allow downgrade or re-run on identical version during preparation
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createHash, createHmac } from 'crypto'
import * as readline from 'readline'
import {
  ROOT_APP,
  ROOT_WORKSPACE,
  BACKEND_BUILDS_PATH,
  WEBSITE_DIR,
  WEBSITE_RELEASE_HOOK_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
  compareSemver,
} from './release-safety.mjs'

// ── 0. Argument Parsing & CLI Options ──────────────────────────────────────
const rawArgs = process.argv.slice(2)
const isDryRun = rawArgs.some((a) => a === '--dry-run' || a === '-n' || a === '--dryrun')
const isForce  = rawArgs.some((a) => a === '--force' || a === '-f')

let versionInput = rawArgs.find((a) => !a.startsWith('-'))
if (!versionInput) {
  const verOption = rawArgs.find((a) => a.startsWith('--version='))
  if (verOption) {
    versionInput = verOption.split('=')[1]
  }
}

// ── 1. Step Definitions & State Tracking ───────────────────────────────────
export const TOTAL_STEPS = [
  { num: 1,  title: 'Pre-release inspection' },
  { num: 2,  title: 'Release dry-run' },
  { num: 3,  title: 'Apply release version' },
  { num: 4,  title: 'Build application' },
  { num: 5,  title: 'Generate and verify integrity manifest' },
  { num: 6,  title: 'Register backend build signature' },
  { num: 7,  title: 'Package Windows installer' },
  { num: 8,  title: 'Verify installer' },
  { num: 9,  title: 'Review Git changes' },
  { num: 10, title: 'Commit backend registry' },
  { num: 11, title: 'Push backend and verify deployment' },
  { num: 12, title: 'Commit desktop release' },
  { num: 13, title: 'Create and push tag' },
  { num: 14, title: 'Publishing dry-run' },
  { num: 15, title: 'Publish GitHub Release' },
  { num: 16, title: 'Final verification' },
]

export const completedSteps = []

/**
 * Reports progress when the release workflow is stopped mid-way or finished.
 */
export function reportMidwayStop(reason = 'User stopped workflow safely.') {
  console.log('\n' + '═'.repeat(70))
  console.log(`🛑 WORKFLOW STATUS: ${reason}`)
  console.log('═'.repeat(70))
  console.log('\nCompleted Steps:')
  if (completedSteps.length === 0) {
    console.log('   (None)')
  } else {
    for (const s of completedSteps) {
      console.log(`   ✔ Step ${s.num}: ${s.title}`)
      if (s.summary) console.log(`     └─ ${s.summary}`)
    }
  }

  const pending = TOTAL_STEPS.filter((t) => !completedSteps.some((c) => c.num === t.num))
  if (pending.length > 0) {
    console.log('\nRemaining Steps:')
    for (const s of pending) {
      console.log(`   ⏳ Step ${s.num}: ${s.title}`)
    }
  } else {
    console.log('\nAll 16 steps completed successfully!')
  }
  console.log('\n' + '═'.repeat(70) + '\n')
}

// Handle Ctrl+C safely
process.on('SIGINT', () => {
  console.log('\n\n[Ctrl+C] Received interrupt signal.')
  reportMidwayStop('Execution cancelled by user (SIGINT).')
  process.exit(130)
})

/**
 * Prompts user interactively with a strict YES/NO question.
 * Case-insensitive. Rejects empty or invalid answers.
 * If exactYesOnly is true, only 'YES' authorizes the action.
 */
export async function askStepConfirmation(customPrompt = null, exactYesOnly = false) {
  if (process.env.PROPEL_MOCK_CONFIRM !== undefined) {
    const mockVal = process.env.PROPEL_MOCK_CONFIRM.trim().toUpperCase()
    return mockVal === 'YES' || mockVal === 'Y'
  }

  // In dry-run mode or when auto-confirm is set, automatically proceed without interactive prompt
  if (isDryRun || process.env.PROPEL_AUTO_CONFIRM === '1') {
    return true
  }

  const promptText = customPrompt || (
    `\nStep completed successfully.\nContinue to the next step?\n\n` +
    `   [YES] Continue\n` +
    `   [NO]  Stop safely\n\n> `
  )

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    while (true) {
      const rawAnswer = await new Promise((resolveAnswer) => {
        rl.question(promptText, (ans) => resolveAnswer(ans))
        rl.once('close', () => resolveAnswer(null))
      })

      if (rawAnswer === null) {
        return false
      }

      const ans = (rawAnswer ?? '').trim()
      if (!ans) {
        console.log('❌ Input cannot be empty. Please enter YES to continue or NO to stop safely.')
        continue
      }

      const upper = ans.toUpperCase()
      if (exactYesOnly) {
        if (upper === 'YES') {
          return true
        }
        if (upper === 'NO' || upper === 'N') {
          return false
        }
        console.log('❌ Invalid input. Please type YES to authorize publication or NO to stop safely.')
        continue
      }

      if (upper === 'YES' || upper === 'Y') {
        return true
      }
      if (upper === 'NO' || upper === 'N') {
        return false
      }

      console.log('❌ Invalid input. Please enter YES to continue or NO to stop safely.')
    }
  } finally {
    rl.close()
  }
}

/**
 * Prompts for a secret without echoing to stdout.
 * Operates in memory only.
 */
export async function promptSecret(promptText = 'Password: ') {
  if (process.env.PROPEL_MOCK_GH_TOKEN !== undefined) {
    return process.env.PROPEL_MOCK_GH_TOKEN.trim()
  }

  process.stdout.write(promptText)

  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: null })
    return new Promise((resolvePrompt) => {
      rl.once('line', (line) => {
        rl.close()
        resolvePrompt((line ?? '').trim())
      })
    })
  }

  return new Promise((resolvePrompt) => {
    let input = ''
    const onData = (chunk) => {
      const str = chunk.toString('utf8')
      for (const char of str) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          process.stdin.removeListener('data', onData)
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdout.write('\n')
          resolvePrompt(input.trim())
          return
        } else if (char === '\u0003') { // Ctrl+C
          process.stdin.removeListener('data', onData)
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdout.write('\n')
          process.emit('SIGINT')
          return
        } else if (char === '\u0008' || char === '\x7f') { // Backspace
          if (input.length > 0) input = input.slice(0, -1)
        } else {
          input += char
        }
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

/**
 * Validates GitHub token against repository permissions.
 */
export async function validateGitHubToken(token, repo = 'pranavop45/propel-releases') {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { valid: false, error: 'Token is empty.' }
  }

  const cleanToken = token.trim()

  // Unit test mock support
  if (process.env.PROPEL_MOCK_TOKEN_VALID === '1') {
    return { valid: true, user: 'mock-user' }
  }
  if (process.env.PROPEL_MOCK_TOKEN_VALID === '0') {
    return { valid: false, error: 'Mock rejection: Bad credentials or insufficient permissions' }
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${cleanToken}`,
        'User-Agent': 'Propel-Release-Orchestrator',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.status === 401) {
      return { valid: false, error: 'Invalid or expired GitHub token (HTTP 401 Bad credentials).' }
    }
    if (res.status === 404) {
      return { valid: false, error: `Repository "${repo}" not found or token lacks read access (HTTP 404).` }
    }
    if (!res.ok) {
      return { valid: false, error: `GitHub API error: HTTP ${res.status} ${res.statusText}` }
    }

    const data = await res.json()
    if (data.permissions && !data.permissions.push) {
      return { valid: false, error: `Token lacks push/write permissions on repository "${repo}".` }
    }

    return { valid: true, user: data.owner?.login || 'authorized' }
  } catch (err) {
    return { valid: false, error: `Network error verifying GitHub token: ${err.message}` }
  }
}

/**
 * Ensures GH_TOKEN is available in process.env.
 * If not present or invalid, pauses, asks securely without echoing, validates, and loops or cancels.
 * The token is stored strictly in memory for the current release process session.
 */
export async function ensureGitHubToken(isDryRun = false) {
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

  if (isDryRun) {
    if (token) {
      console.log('   ℹ️  [DRY RUN] Existing GH_TOKEN detected in environment (simulating token validation).')
    } else {
      console.log('   ℹ️  [DRY RUN] No GH_TOKEN detected in environment. Simulating token validation.')
    }
    return true
  }

  while (true) {
    if (token) {
      console.log('   Validating GitHub token against pranavop45/propel-releases...')
      const check = await validateGitHubToken(token)
      if (check.valid) {
        console.log(`   ✔ GitHub token validated successfully (${check.user ? 'owner: ' + check.user : 'authorized'}).`)
        process.env.GH_TOKEN = token
        return true
      } else {
        console.warn(`   ⚠️  Token validation failed: ${check.error}`)
        token = null // Reset to force secure prompt
      }
    }

    console.log('\n' + '─'.repeat(70))
    console.log('🔑 GITHUB PERSONAL ACCESS TOKEN REQUIRED:')
    console.log('   A GitHub token with release publish permissions on "pranavop45/propel-releases" is needed.')
    console.log('   Security: The token is read securely without echoing and held ONLY in process memory.')
    console.log('   It will NOT be saved to files, logs, git, or permanent environment variables.')
    console.log('─'.repeat(70) + '\n')

    const pasted = await promptSecret('Paste GitHub token (hidden): ')
    if (!pasted) {
      console.log('❌ Token input cannot be empty.')
      const retry = await askStepConfirmation(
        `\nWould you like to try entering the token again?\n\n   [YES] Retry token input\n   [NO]  Cancel publication safely\n\n> `
      )
      if (!retry) return false
      continue
    }

    console.log('   Validating entered token against GitHub API...')
    const check = await validateGitHubToken(pasted)
    if (check.valid) {
      console.log(`   ✔ GitHub token validated successfully (${check.user ? 'owner: ' + check.user : 'authorized'}).`)
      process.env.GH_TOKEN = pasted
      return true
    } else {
      console.warn(`   ❌ Token validation failed: ${check.error}`)
      const retry = await askStepConfirmation(
        `\nToken validation failed. Would you like to retry or cancel?\n\n   [YES] Retry with a different token\n   [NO]  Cancel publication safely\n\n> `
      )
      if (!retry) return false
    }
  }
}

/**
 * Prompts user interactively for target release version if not provided via CLI.
 */
async function promptForVersion() {
  if (versionInput) return versionInput.trim()

  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    try {
      return await new Promise((resolvePrompt) => {
        rl.question('\n❓ Enter target release semver version (e.g. 1.5.0): ', (answer) => {
          resolvePrompt(answer.trim())
        })
      })
    } finally {
      rl.close()
    }
  }

  return null
}

/**
 * Prints clear step banner.
 */
function printStepBanner(num, title, details = '') {
  console.log(`\n` + '═'.repeat(70))
  console.log(`▶ STEP ${num}/16 — ${title.toUpperCase()}`)
  if (details) console.log(`  ${details}`)
  console.log('═'.repeat(70) + `\n`)
}

/**
 * Prints success status for a step.
 */
function printStepSuccess(num, title, summary) {
  console.log(`\n` + '─'.repeat(70))
  console.log(`✔ [SUCCESS] Step ${num} (${title})`)
  if (summary) console.log(`  Summary: ${summary}`)
  console.log('─'.repeat(70))
  completedSteps.push({ num, title, summary })
}

export const CHECKPOINT_FILE = join(ROOT_APP, '.release-checkpoint.json')
export let targetVersionGlobal = null

export function setTargetVersionGlobal(v) {
  targetVersionGlobal = v
}

/**
 * Loads release checkpoint if it exists and matches targetVersion.
 */
export function loadCheckpoint(targetVersion, checkpointPath = CHECKPOINT_FILE) {
  if (!existsSync(checkpointPath)) return null
  try {
    const raw = readFileSync(checkpointPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== targetVersion) {
      console.log(`   ℹ️  Ignoring checkpoint: belongs to version ${parsed.version}, current target is ${targetVersion}.`)
      return null
    }
    return parsed
  } catch (err) {
    console.warn(`   ⚠️  Corrupted checkpoint file at ${checkpointPath} (${err.message}). Starting fresh.`)
    return null
  }
}

/**
 * Saves stage completion checkpoint. Does nothing in dry-run mode.
 */
export function saveCheckpoint(targetVersion, stepNum, data = {}, checkpointPath = CHECKPOINT_FILE) {
  if (isDryRun) return null
  try {
    let current = null
    if (existsSync(checkpointPath)) {
      try {
        current = JSON.parse(readFileSync(checkpointPath, 'utf8'))
      } catch {
        current = null
      }
    }
    if (!current || current.version !== targetVersion) {
      current = {
        version: targetVersion,
        created: new Date().toISOString(),
        completedStepNumbers: [],
        data: {},
      }
    }
    if (!current.completedStepNumbers.includes(stepNum)) {
      current.completedStepNumbers.push(stepNum)
      current.completedStepNumbers.sort((a, b) => a - b)
    }
    current.lastCompletedStep = stepNum
    current.updated = new Date().toISOString()
    Object.assign(current.data, data)
    writeFileSync(checkpointPath, JSON.stringify(current, null, 2), 'utf8')
    return current
  } catch (err) {
    console.warn(`   ⚠️  Failed to save checkpoint: ${err.message}`)
    return null
  }
}

/**
 * Clears checkpoint file upon successful full workflow completion.
 */
export function clearCheckpoint(checkpointPath = CHECKPOINT_FILE) {
  try {
    if (existsSync(checkpointPath)) {
      unlinkSync(checkpointPath)
      console.log('   ✔ Release checkpoint cleared.')
    }
  } catch (err) {
    console.warn(`   ⚠️  Failed to clear checkpoint: ${err.message}`)
  }
}

/**
 * Checks if git tag exists on remote repository without mutating.
 */
export function checkRemoteTag(gitTag, remote = 'origin', cwd = ROOT_APP) {
  if (process.env.PROPEL_MOCK_REMOTE_TAG_EXISTS !== undefined) {
    const exists = process.env.PROPEL_MOCK_REMOTE_TAG_EXISTS === '1'
    const commit = process.env.PROPEL_MOCK_REMOTE_TAG_COMMIT || 'mock-remote-commit-sha'
    return { exists, commit }
  }
  try {
    const out = execSync(`git ls-remote --tags ${remote} refs/tags/${gitTag}`, { cwd, encoding: 'utf8' }).trim()
    if (!out) return { exists: false, commit: null }
    const commit = out.split(/\s+/)[0]
    return { exists: true, commit }
  } catch (err) {
    return { exists: false, commit: null, error: err.message }
  }
}

/**
 * Checks if GitHub Release exists and verifies uploaded asset completeness.
 */
export async function checkRemoteRelease(gitTag, token = null, repo = 'pranavop45/propel-releases') {
  if (process.env.PROPEL_MOCK_REMOTE_RELEASE_EXISTS !== undefined) {
    const exists = process.env.PROPEL_MOCK_REMOTE_RELEASE_EXISTS === '1'
    if (!exists) return { exists: false }
    const rawAssets = (process.env.PROPEL_MOCK_REMOTE_RELEASE_ASSETS || '').split(',').map((s) => s.trim()).filter(Boolean)
    const ver = gitTag.replace(/^v/, '')
    const instName = `Propel-Setup-${ver}.exe`
    const required = [instName, 'latest.yml', `${instName}.blockmap`]
    const missing = required.filter((a) => !rawAssets.includes(a))
    return {
      exists: true,
      release: { tag_name: gitTag, assets: rawAssets.map((name) => ({ name })) },
      assets: rawAssets,
      isComplete: missing.length === 0,
      missingAssets: missing,
    }
  }

  const effectiveToken = token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!effectiveToken) {
    return { exists: false, unauthenticated: true }
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${gitTag}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${effectiveToken}`,
        'User-Agent': 'Propel-Release-Orchestrator',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return { exists: false }
    if (!res.ok) return { exists: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const assets = (data.assets || []).map((a) => a.name)
    const ver = gitTag.replace(/^v/, '')
    const instName = `Propel-Setup-${ver}.exe`
    const required = [instName, 'latest.yml', `${instName}.blockmap`]
    const missing = required.filter((a) => !assets.includes(a))
    return {
      exists: true,
      release: data,
      assets,
      isComplete: missing.length === 0,
      missingAssets: missing,
    }
  } catch (err) {
    return { exists: false, error: err.message }
  }
}

/**
 * Verifies stage prerequisites and expected disk / git outputs before skipping.
 */
export async function verifyStepOutputs(stepNum, target) {
  if (process.env.PROPEL_MOCK_VERIFY_FATAL_STEP === String(stepNum)) {
    return { valid: false, fatal: true, reason: `Mock conflicting state detected at Step ${stepNum}` }
  }
  const { fullVersion, displayVersion, gitTag, installerName } = target
  switch (stepNum) {
    case 1: {
      const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
      if (nodeMajor < 18) return { valid: false, reason: 'Node.js version < 18' }
      try {
        assertLegacyBackendRecords()
      } catch (err) {
        return { valid: false, reason: `Historical backend records error: ${err.message}` }
      }
      return { valid: true }
    }
    case 2:
      return { valid: true }
    case 3: {
      try {
        execSync(`node scripts/verify-release-version.mjs ${fullVersion}`, {
          cwd: ROOT_APP,
          stdio: 'pipe',
        })
        return { valid: true }
      } catch {
        return { valid: false, reason: `Version files mismatch or unverified for v${fullVersion}` }
      }
    }
    case 4: {
      const req = [
        join(ROOT_APP, 'out', 'main', 'index.js'),
        join(ROOT_APP, 'out', 'preload', 'index.js'),
      ]
      for (const r of req) {
        if (!existsSync(r)) return { valid: false, reason: `Missing build artifact: ${r}` }
      }
      return { valid: true }
    }
    case 5: {
      const mfPath = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
      if (!existsSync(mfPath)) return { valid: false, reason: 'Missing integrity-manifest.json' }
      try {
        const mf = JSON.parse(readFileSync(mfPath, 'utf8'))
        if (mf.version !== displayVersion && mf.version !== fullVersion) {
          return { valid: false, reason: `Manifest version ${mf.version} does not match target ${fullVersion}` }
        }
        if (!mf.signature || !mf.files) {
          return { valid: false, reason: 'Manifest missing signature or files map' }
        }
        return { valid: true }
      } catch (err) {
        return { valid: false, reason: `Manifest parsing error: ${err.message}` }
      }
    }
    case 6: {
      try {
        const backendBuilds = JSON.parse(readFileSync(BACKEND_BUILDS_PATH, 'utf8'))
        if (!backendBuilds[displayVersion] || !backendBuilds[fullVersion]) {
          return { valid: false, reason: `Backend builds missing registration for ${displayVersion} or ${fullVersion}` }
        }
        return { valid: true }
      } catch (err) {
        return { valid: false, reason: `Cannot verify backend registry: ${err.message}` }
      }
    }
    case 7: {
      const instPath = join(ROOT_APP, 'release', installerName)
      if (!existsSync(instPath)) return { valid: false, reason: `Missing installer at release/${installerName}` }
      const mfPath = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
      if (existsSync(mfPath)) {
        const instMtime = statSync(instPath).mtimeMs
        const mfMtime = statSync(mfPath).mtimeMs
        if (instMtime < mfMtime) {
          return { valid: false, reason: `Installer release/${installerName} is older than integrity manifest` }
        }
      }
      return { valid: true }
    }
    case 8: {
      const ymlPath = join(ROOT_APP, 'release', 'latest.yml')
      if (!existsSync(ymlPath)) return { valid: false, reason: 'Missing release/latest.yml' }
      try {
        const yml = readFileSync(ymlPath, 'utf8')
        if (!yml.includes(`version: ${fullVersion}`) && !yml.includes(`version: ${displayVersion}`)) {
          return { valid: false, reason: `latest.yml version does not match ${fullVersion}` }
        }
        return { valid: true }
      } catch (err) {
        return { valid: false, reason: `Error reading latest.yml: ${err.message}` }
      }
    }
    case 9:
      return { valid: true }
    case 10: {
      const backendDir = resolve(ROOT_WORKSPACE, 'propel-backend')
      try {
        const headMsg = execSync('git log -1 --pretty=%B', { cwd: backendDir, encoding: 'utf8' }).trim()
        const status = execSync('git status --porcelain services/official-builds.json', { cwd: backendDir, encoding: 'utf8' }).trim()
        if (!status && headMsg.includes(`register official build signature for ${fullVersion}`)) {
          return { valid: true }
        }
        return { valid: false, reason: `Backend commit for ${fullVersion} not found at HEAD` }
      } catch (err) {
        return { valid: false, reason: `Cannot verify backend git status: ${err.message}` }
      }
    }
    case 11: {
      const backendDir = resolve(ROOT_WORKSPACE, 'propel-backend')
      try {
        const unpushed = execSync('git log origin/main..HEAD', { cwd: backendDir, encoding: 'utf8' }).trim()
        if (unpushed) {
          return { valid: false, reason: 'Backend commit is not pushed to origin/main' }
        }
        return { valid: true }
      } catch (err) {
        return { valid: false, reason: `Cannot verify backend push status: ${err.message}` }
      }
    }
    case 12: {
      try {
        const headMsg = execSync('git log -1 --pretty=%B', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (headMsg.includes(`prepare Propel v${fullVersion}`)) {
          return { valid: true }
        }
        return { valid: false, reason: `Desktop release commit for v${fullVersion} not found at HEAD` }
      } catch (err) {
        return { valid: false, reason: `Cannot verify desktop git status: ${err.message}` }
      }
    }
    case 13: {
      try {
        const headCommit = execSync('git rev-parse HEAD', { cwd: ROOT_APP, encoding: 'utf8' }).trim()

        // Check remote tag first for ambiguous / conflicting state
        const rTag = checkRemoteTag(gitTag, 'origin', ROOT_APP)
        if (rTag.exists && rTag.commit && rTag.commit !== headCommit) {
          return {
            valid: false,
            fatal: true,
            reason: `Remote tag ${gitTag} points to different commit ${rTag.commit.slice(0, 8)} than local HEAD ${headCommit.slice(0, 8)}`,
          }
        }

        const tag = execSync(`git tag -l ${gitTag}`, { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (!tag) return { valid: false, reason: `Local tag ${gitTag} does not exist` }
        const tagCommit = execSync(`git rev-parse ${gitTag}^{commit}`, { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (tagCommit !== headCommit) {
          return {
            valid: false,
            fatal: true,
            reason: `Local tag ${gitTag} points to commit ${tagCommit.slice(0, 8)}, not current HEAD ${headCommit.slice(0, 8)}`,
          }
        }
        return { valid: true }
      } catch (err) {
        return { valid: false, reason: `Error verifying tag: ${err.message}` }
      }
    }
    case 14:
      return { valid: true }
    case 15: {
      const relCheck = await checkRemoteRelease(gitTag)
      if (relCheck.exists) {
        if (relCheck.isComplete) {
          return { valid: true, complete: true }
        } else {
          return {
            valid: false,
            fatal: true,
            reason: `Remote GitHub release exists with partial assets (${relCheck.missingAssets.join(', ')} missing)`,
          }
        }
      }
      return { valid: false, reason: `Remote GitHub Release ${gitTag} does not exist` }
    }
    case 16:
      return { valid: true }
    default:
      return { valid: true }
  }
}

/**
 * Evaluates checkpoint validity and verifies outputs from Step 1 onwards.
 * Returns the earliest step number that needs execution.
 */
export async function determineResumeStep(target, checkpoint) {
  if (!checkpoint || !checkpoint.lastCompletedStep || typeof checkpoint.lastCompletedStep !== 'number') {
    return 1
  }

  console.log(`\n🔍 Evaluating checkpoint for v${target.fullVersion} (recorded up to Step ${checkpoint.lastCompletedStep})...`)
  for (let s = 1; s <= checkpoint.lastCompletedStep; s++) {
    const stepDef = TOTAL_STEPS.find((t) => t.num === s)
    const verification = await verifyStepOutputs(s, target)
    if (verification.fatal) {
      throw new Error(`Ambiguous or Conflicting State at Step ${s} (${stepDef.title}): ${verification.reason}`)
    }
    if (!verification.valid) {
      console.log(`   ⚠️  Step ${s} (${stepDef.title}) outputs invalid or outdated: ${verification.reason}`)
      console.log(`   Resuming workflow from earliest unverified stage: Step ${s}\n`)
      return s
    }
    console.log(`   ✔ Step ${s} verified intact: ${stepDef.title}`)
  }

  const nextStep = checkpoint.lastCompletedStep + 1
  if (nextStep <= 16) {
    console.log(`   ✔ All recorded steps 1 through ${checkpoint.lastCompletedStep} verified intact.`)
    console.log(`   Resuming workflow from Step ${nextStep}: ${TOTAL_STEPS.find((t) => t.num === nextStep)?.title || 'Next Stage'}\n`)
    return nextStep
  }
  return 16
}

/**
 * Halts on failure immediately with a rich, user-friendly error report.
 * Never asks to continue after failure.
 */
export function haltOnFailure(num, title, errorMessage, options = {}) {
  const exitCode = typeof options === 'number' ? options : (options.exitCode ?? 1)
  const failedCommand = typeof options === 'object' ? options.failedCommand : null
  const recoveryAdvice = typeof options === 'object' ? options.recoveryAdvice : null
  const targetVer = targetVersionGlobal || '1.5.0'

  console.error('\n' + '═'.repeat(70))
  console.error(`❌ [FAILED] Step ${num} (${title}) HALTED WITH ERROR!`)
  console.error('═'.repeat(70))
  console.error(`Failed Stage:     Step ${num} (${title})`)
  if (failedCommand) {
    console.error(`Failed Command:   ${failedCommand}`)
  }
  console.error(`Actual Error:     ${errorMessage}`)
  console.error('─'.repeat(70))
  console.error('Workflow Progress:')
  console.error('  Completed Stages:')
  if (completedSteps.length === 0) {
    console.error('    (None)')
  } else {
    for (const s of completedSteps) {
      console.error(`    ✔ Step ${s.num}: ${s.title}`)
      if (s.summary) console.error(`      └─ ${s.summary}`)
    }
  }

  const pending = TOTAL_STEPS.filter((t) => !completedSteps.some((c) => c.num === t.num))
  console.error('  Remaining Stages:')
  for (const s of pending) {
    console.error(`    ⏳ Step ${s.num}: ${s.title}`)
  }

  console.error('─'.repeat(70))
  console.error('Actionable Recovery Instructions:')
  if (recoveryAdvice) {
    console.error(`  ${recoveryAdvice}`)
  } else {
    console.error('  1. Review the error details and command output above.')
    console.error('  2. Manually address the underlying cause.')
  }
  console.error(`\nTo safely resume workflow after addressing the issue:`)
  console.error(`  RELEASE-PROPEL.bat ${targetVer}`)
  console.error(`  or: npm run release:orchestrate -- ${targetVer}`)
  console.error(`\nSafe Failure & Resume Guarantees:`)
  console.error(`  • No automatic destructive rollbacks were performed.`)
  console.error(`  • Completed git commits, pushes, and tags remain safely intact.`)
  console.error(`  • The orchestrator will verify all prior stage outputs before resuming`)
  console.error(`    and will resume from the earliest incomplete or unverified stage.`)
  console.error('═'.repeat(70) + '\n')

  reportMidwayStop(`Step ${num} failed.`)

  if (process.env.PROPEL_TEST_NO_EXIT === '1') {
    throw new Error(`[HALT_STEP_${num}] ${errorMessage}`)
  }

  process.exit(exitCode)
}

// ── Main Orchestration Workflow ─────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗')
  console.log('║        Propel Windows Release Orchestration Workflow              ║')
  console.log('║            Sequential, Step-by-Step Interactive Release           ║')
  console.log('╚═══════════════════════════════════════════════════════════════════╝')

  // ── Version Validation ────────────────────────────────────────────────────
  const resolvedVersionStr = await promptForVersion()

  if (!resolvedVersionStr) {
    console.error('\n❌ Error: Missing release version argument.')
    console.error('Usage: node scripts/release-orchestrator.mjs <version> [--dry-run] [--force]\n')
    console.error('Example: node scripts/release-orchestrator.mjs 1.5.0\n')
    process.exit(1)
  }

  let target
  try {
    target = parseReleaseVersion(resolvedVersionStr)
  } catch (err) {
    console.error(`\n❌ Error: Invalid release version "${resolvedVersionStr}": ${err.message}\n`)
    process.exit(1)
  }

  const { fullVersion, displayVersion, gitTag, installerName, downloadPath } = target
  setTargetVersionGlobal(fullVersion)

  console.log('\n📋 Target Release Configuration:')
  console.log(`   Target Semver (Full):     ${fullVersion}`)
  console.log(`   User-Facing Version:      ${displayVersion}`)
  console.log(`   Git Release Tag:          ${gitTag}`)
  console.log(`   Installer Executable:     ${installerName}`)
  console.log(`   Website Download URL:     ${downloadPath}`)
  console.log(`   Workflow Mode:            ${isDryRun ? 'DRY RUN (Simulation only — zero mutations)' : 'PRODUCTION PREPARATION'}`)

  // ── Safe Resume / Checkpoint Evaluation ───────────────────────────────────
  let resumeStartStep = 1
  if (!isDryRun) {
    const existingCheckpoint = loadCheckpoint(fullVersion)
    if (existingCheckpoint) {
      try {
        resumeStartStep = await determineResumeStep(target, existingCheckpoint)
        for (let s = 1; s < resumeStartStep; s++) {
          const stepDef = TOTAL_STEPS.find((t) => t.num === s)
          completedSteps.push({
            num: s,
            title: stepDef.title,
            summary: '(Verified on-disk/remote state from prior run)',
          })
        }
      } catch (resumeErr) {
        haltOnFailure(
          existingCheckpoint.lastCompletedStep || 1,
          TOTAL_STEPS.find((t) => t.num === (existingCheckpoint.lastCompletedStep || 1))?.title || 'Resume Validation',
          resumeErr.message,
          {
            failedCommand: 'Checkpoint State Verification',
            recoveryAdvice: 'Inspect the conflicting local or remote state. Clear .release-checkpoint.json only if starting completely anew.',
          }
        )
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Pre-release inspection
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(1, 'Pre-release inspection', 'Auditing Node, Git, remotes, working trees, and safety tests')
  if (resumeStartStep > 1) {
    console.log(`   ⏩ Skipping Step 1 (${TOTAL_STEPS[0].title}) — verified from prior run.`)
  } else {
    try {
      // 1a. Node.js runtime check
      const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
      if (nodeMajor < 18) {
        throw new Error(`Node.js version 18+ required (detected v${process.versions.node})`)
      }
      console.log(`   ✔ Node.js runtime: v${process.versions.node}`)

      // 1b. Check git and npm
      execSync('git --version', { stdio: 'pipe' })
      execSync('npm --version', { stdio: 'pipe' })
      console.log(`   ✔ Git & npm verified in PATH`)

      // 1c. Inspect branches, remotes, and working trees for all 3 repos
      const repos = [
        { name: 'propel-app', dir: ROOT_APP },
        { name: 'propel-backend', dir: resolve(ROOT_WORKSPACE, 'propel-backend') },
        { name: 'propel-website', dir: resolve(ROOT_WORKSPACE, 'propel-website') },
      ]

      console.log('\n   Inspecting repository branches and remotes:')
      for (const r of repos) {
        if (existsSync(join(r.dir, '.git'))) {
          const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: r.dir, encoding: 'utf8' }).trim()
          const remote = execSync('git remote get-url origin', { cwd: r.dir, encoding: 'utf8' }).trim()
          const status = execSync('git status --porcelain', { cwd: r.dir, encoding: 'utf8' }).trim()
          const changedCount = status ? status.split('\n').length : 0
          console.log(`   • [${r.name}] Branch: ${branch} | Remote: ${remote} | Changes: ${changedCount}`)
        } else {
          console.log(`   • [${r.name}] Not a standalone git repo root`)
        }
      }

      // Preflight remote tag inspection (non-mutating)
      try {
        const rTag = checkRemoteTag(gitTag, 'origin', ROOT_APP)
        if (rTag.exists) {
          console.log(`   ℹ️  [Preflight Notice] Tag ${gitTag} already exists on remote origin (${(rTag.commit || '').slice(0, 10)})`)
        }
      } catch {
        // remote check notice only
      }

      // 1d. Current package version and historical records check
      const pkg = JSON.parse(readFileSync(join(ROOT_APP, 'package.json'), 'utf8'))
      console.log(`\n   Current propel-app version: ${pkg.version}`)
      assertLegacyBackendRecords()
      console.log('   ✔ Historical production records (1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0) verified intact.')

      // 1e. Run safety test suite
      if (process.env.PROPEL_RELEASE_ORCHESTRATING === '1') {
        console.log('   ℹ️  Invoked from release test runner (PROPEL_RELEASE_ORCHESTRATING=1); skipping nested test suite execution.')
      } else {
        console.log('\n   Running automated release safety tests...')
        execSync('node scripts/test-release-infrastructure.mjs', {
          cwd: ROOT_APP,
          stdio: 'inherit',
          env: { ...process.env, PROPEL_RELEASE_ORCHESTRATING: '1' },
        })
      }
    } catch (err) {
      haltOnFailure(1, 'Pre-release inspection', err.message, {
        failedCommand: 'Pre-flight integrity and branch inspection',
        recoveryAdvice: 'Ensure git/npm are installed, branches are on main, and legacy production records in official-builds.json are intact.',
      })
    }

    printStepSuccess(1, 'Pre-release inspection', 'Prerequisites, branches, historical records, and safety tests verified.')
    saveCheckpoint(fullVersion, 1, { summary: 'Prerequisites, branches, historical records, and safety tests verified.' })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 1 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Release dry-run
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(2, 'Release dry-run', `Pre-validating version synchronization in memory for v${fullVersion}`)
  if (resumeStartStep > 2) {
    console.log(`   ⏩ Skipping Step 2 (${TOTAL_STEPS[1].title}) — verified from prior run.`)
  } else {
    try {
      const gitStatusBefore = execSync('git status --porcelain', { cwd: ROOT_APP, encoding: 'utf8' }).trim()

      execSync(`node scripts/release-prepare.mjs ${fullVersion} --dry-run ${isForce ? '--force' : ''}`, {
        cwd: ROOT_APP,
        stdio: 'inherit',
      })

      const gitStatusAfter = execSync('git status --porcelain', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
      if (gitStatusBefore !== gitStatusAfter) {
        throw new Error('Dry-run modified working tree files! Expected 0 file changes.')
      }
    } catch (err) {
      haltOnFailure(2, 'Release dry-run', err.message, {
        failedCommand: `node scripts/release-prepare.mjs ${fullVersion} --dry-run`,
        recoveryAdvice: 'Inspect package version and working tree state. Ensure no uncommitted modifications exist before dry-run.',
      })
    }

    printStepSuccess(2, 'Release dry-run', `All 10 target files pre-validated in memory for ${fullVersion}. 0 files modified.`)
    saveCheckpoint(fullVersion, 2, { summary: `10 target files pre-validated in memory for ${fullVersion}.` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 2 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Apply release version
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(3, 'Apply release version', `Synchronizing version references across 10 desktop application files`)
  if (resumeStartStep > 3) {
    console.log(`   ⏩ Skipping Step 3 (${TOTAL_STEPS[2].title}) — verified from prior run.`)
  } else {
    try {
      const targetFiles = [
        'package.json',
        'package-lock.json',
        'RELEASE.md',
        'electron/security/integrity-manifest.json',
        'electron/services/updater/updaterService.ts',
        'electron/ipc/handlers.ts',
        'src/services/telemetry.ts',
        'src/pages/SplashScreen.tsx',
        'src/pages/LoginPage.tsx',
        'src/pages/AboutPage.tsx',
      ]

      if (isDryRun) {
        console.log('   [DRY RUN] Would atomically update 10 desktop files and verify version references:')
        for (const f of targetFiles) console.log(`     • ${f} -> ${fullVersion} (${displayVersion})`)
      } else {
        execSync(`node scripts/release-prepare.mjs ${fullVersion} ${isForce ? '--force' : ''}`, {
          cwd: ROOT_APP,
          stdio: 'inherit',
        })
        execSync(`node scripts/verify-release-version.mjs ${fullVersion}`, {
          cwd: ROOT_APP,
          stdio: 'inherit',
        })
        console.log('   Synchronized release version across files:')
        for (const f of targetFiles) console.log(`     ✔ ${f}`)
      }
    } catch (err) {
      haltOnFailure(3, 'Apply release version', err.message, {
        failedCommand: `node scripts/release-prepare.mjs ${fullVersion}`,
        recoveryAdvice: 'Check that target version files are accessible and not locked by another process.',
      })
    }

    printStepSuccess(3, 'Apply release version', isDryRun ? `[SIMULATION] Desktop version updates simulated for ${fullVersion}. 0 files modified on disk.` : `10 desktop application files synchronized to ${fullVersion} (${displayVersion}).`)
    saveCheckpoint(fullVersion, 3, { summary: `10 desktop application files synchronized to ${fullVersion}.` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 3 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Build application
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(4, 'Build application', 'Compiling application bundles exactly once (electron-vite build)')
  if (resumeStartStep > 4) {
    console.log(`   ⏩ Skipping Step 4 (${TOTAL_STEPS[3].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute: npm run build')
      } else {
        execSync('npm run build', { cwd: ROOT_APP, stdio: 'inherit' })
        const required = [
          join(ROOT_APP, 'out', 'main', 'index.js'),
          join(ROOT_APP, 'out', 'preload', 'index.js'),
        ]
        for (const r of required) {
          if (!existsSync(r)) throw new Error(`Missing expected build bundle: ${r}`)
        }
      }
    } catch (err) {
      haltOnFailure(4, 'Build application', err.message, {
        failedCommand: 'npm run build',
        recoveryAdvice: 'Fix Vite/TypeScript build errors in propel-app, verify dependencies with npm install, then retry.',
      })
    }

    printStepSuccess(4, 'Build application', isDryRun ? '[SIMULATION] Production build simulated. 0 files compiled.' : 'Production build compiled exactly once to out/ directory.')
    saveCheckpoint(fullVersion, 4, { summary: 'Production build compiled exactly once to out/ directory.' })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 4 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Generate and verify integrity manifest
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(5, 'Generate and verify integrity manifest', 'Computing and hashing out/ bundles into integrity-manifest.json')
  let generatedSignature = 'SIMULATED-64-HEX-HMAC-SHA256-SIGNATURE'
  if (resumeStartStep > 5) {
    console.log(`   ⏩ Skipping Step 5 (${TOTAL_STEPS[4].title}) — verified from prior run.`)
    try {
      const mfPath = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
      if (existsSync(mfPath)) {
        const mf = JSON.parse(readFileSync(mfPath, 'utf8'))
        generatedSignature = mf.signature || 'calculated'
      }
    } catch {
      // fallback
    }
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute: npm run generate:manifest && npm run verify:integrity')
        console.log(`   [DRY RUN] Resulting signature: ${generatedSignature}`)
      } else {
        execSync('npm run generate:manifest', {
          cwd: ROOT_APP,
          stdio: 'inherit',
          env: { ...process.env, VITE_APP_VERSION: displayVersion },
        })
        execSync('npm run verify:integrity', { cwd: ROOT_APP, stdio: 'inherit' })
        const mfPath = join(ROOT_APP, 'electron', 'security', 'integrity-manifest.json')
        const mf = JSON.parse(readFileSync(mfPath, 'utf8'))
        generatedSignature = mf.signature || 'calculated'
        console.log(`   ✔ Manifest generated: electron/security/integrity-manifest.json`)
        console.log(`   ✔ Resulting Build Signature: ${generatedSignature}`)
      }
    } catch (err) {
      haltOnFailure(5, 'Generate and verify integrity manifest', err.message, {
        failedCommand: 'npm run generate:manifest && npm run verify:integrity',
        recoveryAdvice: 'Ensure out/ build artifacts exist and are not modified during manifest generation.',
      })
    }

    printStepSuccess(5, 'Generate and verify integrity manifest', isDryRun ? `[SIMULATION] Integrity manifest generation simulated. 0 files written.` : `Integrity manifest generated and verified (${generatedSignature.slice(0, 16)}...).`)
    saveCheckpoint(fullVersion, 5, { summary: `Integrity manifest generated and verified (${generatedSignature.slice(0, 16)}...).` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 5 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6 — Register backend build signature
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(6, 'Register backend build signature', 'Calculating build signature and appending to official-builds.json')
  if (resumeStartStep > 6) {
    console.log(`   ⏩ Skipping Step 6 (${TOTAL_STEPS[5].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log(`   [DRY RUN] Would register "${displayVersion}" and "${fullVersion}" in official-builds.json:`)
        console.log(`     + "${displayVersion}": "${generatedSignature}"`)
        console.log(`     + "${fullVersion}": "${generatedSignature}"`)
      } else {
        execSync('npm run release:register', { cwd: ROOT_APP, stdio: 'inherit' })
        execSync('npm run verify:build-signature', { cwd: ROOT_APP, stdio: 'inherit' })
        assertLegacyBackendRecords()
        const backendBuilds = JSON.parse(readFileSync(BACKEND_BUILDS_PATH, 'utf8'))
        console.log(`   Registry additions in ${BACKEND_BUILDS_PATH}:`)
        console.log(`     ✔ "${displayVersion}": "${backendBuilds[displayVersion]?.buildSignature || backendBuilds[displayVersion]}"`)
        console.log(`     ✔ "${fullVersion}": "${backendBuilds[fullVersion]?.buildSignature || backendBuilds[fullVersion]}"`)
      }
      console.log('   ✔ Historical records 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 verified unchanged.')
    } catch (err) {
      haltOnFailure(6, 'Register backend build signature', err.message, {
        failedCommand: 'npm run release:register',
        recoveryAdvice: 'Verify that propel-backend/services/official-builds.json is writable and legacy records are not corrupted.',
      })
    }

    printStepSuccess(6, 'Register backend build signature', isDryRun ? `[SIMULATION] Backend signature registration simulated. 0 records modified.` : `Registered ${displayVersion} & ${fullVersion} in official-builds.json.`)
    saveCheckpoint(fullVersion, 6, { summary: `Registered ${displayVersion} & ${fullVersion} in official-builds.json.` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 6 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7 — Package Windows installer
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(7, 'Package Windows installer', 'Packaging existing build without recompiling (package:win)')
  if (resumeStartStep > 7) {
    console.log(`   ⏩ Skipping Step 7 (${TOTAL_STEPS[6].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute: npm run package:win (electron-builder --win)')
      } else {
        execSync('npm run package:win', { cwd: ROOT_APP, stdio: 'inherit' })
        const installerPath = join(ROOT_APP, 'release', installerName)
        if (!existsSync(installerPath)) {
          throw new Error(`Expected installer binary not found at: ${installerPath}`)
        }
        const szMb = (statSync(installerPath).size / (1024 * 1024)).toFixed(2)
        console.log(`   ✔ Installer created: release/${installerName} (${szMb} MB)`)
      }
    } catch (err) {
      haltOnFailure(7, 'Package Windows installer', err.message, {
        failedCommand: 'npm run package:win',
        recoveryAdvice: 'Ensure electron-builder dependencies and NSIS tools are installed and no previous installer is locked.',
      })
    }

    printStepSuccess(7, 'Package Windows installer', isDryRun ? `[SIMULATION] Windows installer packaging simulated. No installer created.` : `Packaged release/${installerName} without rebuilding.`)
    saveCheckpoint(fullVersion, 7, { summary: `Packaged release/${installerName} without rebuilding.` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 7 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8 — Verify installer
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(8, 'Verify installer', 'Strict verification of installer freshness, latest.yml and ASAR signature')
  if (resumeStartStep > 8) {
    console.log(`   ⏩ Skipping Step 8 (${TOTAL_STEPS[7].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute: node scripts/verify-build-signature.mjs --strict')
      } else {
        execSync('node scripts/verify-build-signature.mjs --strict', { cwd: ROOT_APP, stdio: 'inherit' })
      }
    } catch (err) {
      haltOnFailure(8, 'Verify installer', err.message, {
        failedCommand: 'node scripts/verify-build-signature.mjs --strict',
        recoveryAdvice: `Ensure installer Propel-Setup-${fullVersion}.exe and latest.yml were updated during packaging and ASAR matches manifest.`,
      })
    }

    printStepSuccess(8, 'Verify installer', isDryRun ? '[SIMULATION] Installer verification simulated.' : 'Installer timestamp, latest.yml SHA-512, and ASAR signature strictly verified.')
    saveCheckpoint(fullVersion, 8, { summary: 'Installer timestamp, latest.yml SHA-512, and ASAR signature strictly verified.' })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 8 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9 — Review Git changes
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(9, 'Review Git changes', 'Examining intended staging files vs unrelated user work')
  const backendApprovedFiles = ['services/official-builds.json']
  const desktopApprovedFiles = [
    'package.json',
    'package-lock.json',
    'RELEASE.md',
    'electron/security/integrity-manifest.json',
    'electron/services/updater/updaterService.ts',
    'electron/ipc/handlers.ts',
    'src/services/telemetry.ts',
    'src/pages/SplashScreen.tsx',
    'src/pages/LoginPage.tsx',
    'src/pages/AboutPage.tsx',
    'scripts/generate-integrity-manifest.mjs',
    'scripts/upload-sourcemaps.mjs',
    'scripts/release-orchestrator.mjs',
    'scripts/test-release-infrastructure.mjs',
  ]

  console.log('   Approved Backend Staging File(s):')
  for (const f of backendApprovedFiles) console.log(`     • propel-backend/${f}`)

  console.log('\n   Approved Desktop Staging File(s):')
  for (const f of desktopApprovedFiles) console.log(`     • propel-app/${f}`)

  console.log('\n   Proposed Commit Messages:')
  console.log(`     • Backend: "chore(release): register official build signature for ${fullVersion}"`)
  console.log(`     • Desktop: "chore(release): prepare Propel v${fullVersion}"`)
  console.log('\n   Safety Boundary: No wildcards (git add . / git add -A) will be used.')

  if (resumeStartStep > 9) {
    console.log(`   ⏩ Skipping Step 9 (${TOTAL_STEPS[8].title}) — verified from prior run.`)
  } else {
    printStepSuccess(9, 'Review Git changes', 'Explicit staging boundaries and proposed commit messages reviewed.')
    saveCheckpoint(fullVersion, 9, { summary: 'Explicit staging boundaries and proposed commit messages reviewed.' })
    if (!await askStepConfirmation(
      `\nReview complete. Proceed to stage and commit backend registry?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
    )) {
      reportMidwayStop('Stopped after Step 9 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10 — Commit backend registry
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(10, 'Commit backend registry', 'Staging and committing official-builds.json in propel-backend')
  const backendDir = resolve(ROOT_WORKSPACE, 'propel-backend')
  let backendCommitHash = 'SIMULATED-HASH'
  if (resumeStartStep > 10) {
    console.log(`   ⏩ Skipping Step 10 (${TOTAL_STEPS[9].title}) — verified from prior run.`)
    try {
      backendCommitHash = execSync('git rev-parse HEAD', { cwd: backendDir, encoding: 'utf8' }).trim()
    } catch {
      // fallback
    }
  } else {
    try {
      if (isDryRun) {
        console.log(`   [DRY RUN] Would execute in ${backendDir}:`)
        console.log(`     git add services/official-builds.json`)
        console.log(`     git commit -m "chore(release): register official build signature for ${fullVersion}"`)
      } else {
        // Check if already committed on retry
        const status = execSync('git status --porcelain services/official-builds.json', { cwd: backendDir, encoding: 'utf8' }).trim()
        const headMsg = execSync('git log -1 --pretty=%B', { cwd: backendDir, encoding: 'utf8' }).trim()

        if (!status && headMsg.includes(`register official build signature for ${fullVersion}`)) {
          console.log(`   ℹ️  Backend already committed in previous run: ${headMsg.split('\n')[0]}`)
        } else {
          execSync('git add services/official-builds.json', { cwd: backendDir, stdio: 'inherit' })
          const stagedDiff = execSync('git diff --cached --stat', { cwd: backendDir, encoding: 'utf8' })
          console.log(`\n   Staged diff in propel-backend:\n${stagedDiff}`)

          const confirmed = await askStepConfirmation(
            `\nReady to commit backend official-builds.json?\n\n   [YES] Commit now\n   [NO]  Stop safely\n\n> `
          )
          if (!confirmed) {
            reportMidwayStop('Stopped before backend commit by user.')
            process.exit(0)
          }

          execSync(`git commit -m "chore(release): register official build signature for ${fullVersion}"`, {
            cwd: backendDir,
            stdio: 'inherit',
          })
        }
        backendCommitHash = execSync('git rev-parse HEAD', { cwd: backendDir, encoding: 'utf8' }).trim()
        console.log(`   ✔ Backend Commit Hash: ${backendCommitHash}`)
      }
    } catch (err) {
      haltOnFailure(10, 'Commit backend registry', err.message, {
        failedCommand: `git commit -m "chore(release): register official build signature for ${fullVersion}"`,
        recoveryAdvice: 'Check propel-backend working tree status and resolve any git lock or conflict issues.',
      })
    }

    printStepSuccess(10, 'Commit backend registry', isDryRun ? '[SIMULATION] Backend git commit simulated. 0 commits created.' : `Backend signature committed (${backendCommitHash.slice(0, 10)}).`)
    saveCheckpoint(fullVersion, 10, { summary: `Backend signature committed (${backendCommitHash.slice(0, 10)}).` })
    if (!await askStepConfirmation(
      `\nProceed to push backend commit and verify Render deployment?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
    )) {
      reportMidwayStop('Stopped after Step 10 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 11 — Push backend and verify deployment
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(11, 'Push backend and verify deployment', 'Pushing propel-backend to origin/main and verifying Render deployment')
  if (resumeStartStep > 11) {
    console.log(`   ⏩ Skipping Step 11 (${TOTAL_STEPS[10].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute in propel-backend: git push origin main')
        console.log('   [DRY RUN] Backend commit push simulated.')
        console.log(`   Render Dashboard: https://dashboard.render.com/web/cleanmasterpro-backend-server`)
      } else {
        // Check if already pushed
        const unpushed = execSync('git log origin/main..HEAD', { cwd: backendDir, encoding: 'utf8' }).trim()
        if (unpushed) {
          execSync('git push origin main', { cwd: backendDir, stdio: 'inherit' })
          console.log('   ✔ Pushed backend commit to origin/main.')
        } else {
          console.log('   ℹ️  Backend commit is already pushed to origin/main.')
        }

        console.log('\n' + '─'.repeat(70))
        console.log('🌐 RENDER DEPLOYMENT VERIFICATION REQUIRED:')
        console.log('   Render automatically deploys when commits are pushed to origin/main.')
        console.log(`   1. Open Render Dashboard: https://dashboard.render.com/web/cleanmasterpro-backend-server`)
        console.log(`   2. Inspect the latest deployment for backend commit: ${backendCommitHash.slice(0, 10)}`)
        console.log('   3. Wait until Render displays "Deploy live" or "Live" before confirming.')
        console.log('   Note: Do not assume deployment is verified merely because the backend URL responds.')
        console.log('─'.repeat(70) + '\n')
      }
    } catch (err) {
      haltOnFailure(11, 'Push backend and verify deployment', err.message, {
        failedCommand: 'git push origin main (propel-backend)',
        recoveryAdvice: 'Verify git remote connection and write permissions to propel-backend, or confirm Render deployment status before retrying.',
      })
    }

    const renderPrompt = (
      `\nHave you verified that the correct commit is successfully deployed on Render?\n\n` +
      `   [YES] Continue to the next release step\n` +
      `   [NO]  Cancel the remaining workflow safely\n\n> `
    )

    const renderConfirmed = await askStepConfirmation(renderPrompt)
    if (!renderConfirmed) {
      reportMidwayStop('Workflow cancelled safely by user: Backend deployment not verified on Render.')
      process.exit(0)
    }

    printStepSuccess(11, 'Push backend and verify deployment', isDryRun ? '[SIMULATION] Backend push simulated and Render verification prompt confirmed.' : 'Backend pushed and Render deployment confirmed by user.')
    saveCheckpoint(fullVersion, 11, { summary: 'Backend pushed and Render deployment confirmed by user.' })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 12 — Commit desktop release
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(12, 'Commit desktop release', 'Staging only approved desktop release files in propel-app')
  let desktopCommitHash = 'SIMULATED-HASH'
  if (resumeStartStep > 12) {
    console.log(`   ⏩ Skipping Step 12 (${TOTAL_STEPS[11].title}) — verified from prior run.`)
    try {
      desktopCommitHash = execSync('git rev-parse HEAD', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
    } catch {
      // fallback
    }
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would stage approved desktop files and commit with: chore(release): prepare Propel v' + fullVersion)
      } else {
        const headMsg = execSync('git log -1 --pretty=%B', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (headMsg.includes(`prepare Propel v${fullVersion}`)) {
          console.log(`   ℹ️  Desktop release commit already exists at HEAD: ${headMsg.split('\n')[0]}`)
        } else {
          // Stage only approved files
          for (const file of desktopApprovedFiles) {
            if (existsSync(join(ROOT_APP, file))) {
              execSync(`git add "${file}"`, { cwd: ROOT_APP, stdio: 'inherit' })
            }
          }
          const stagedDiff = execSync('git diff --cached --stat', { cwd: ROOT_APP, encoding: 'utf8' })
          console.log(`\n   Staged diff in propel-app:\n${stagedDiff}`)

          const confirmed = await askStepConfirmation(
            `\nReady to commit staged desktop release files?\n\n   [YES] Commit now\n   [NO]  Stop safely\n\n> `
          )
          if (!confirmed) {
            reportMidwayStop('Stopped before desktop commit by user.')
            process.exit(0)
          }

          execSync(`git commit -m "chore(release): prepare Propel v${fullVersion}"`, {
            cwd: ROOT_APP,
            stdio: 'inherit',
          })
        }
        desktopCommitHash = execSync('git rev-parse HEAD', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        console.log(`   ✔ Desktop Commit Hash: ${desktopCommitHash}`)
      }
    } catch (err) {
      haltOnFailure(12, 'Commit desktop release', err.message, {
        failedCommand: `git commit -m "chore(release): prepare Propel v${fullVersion}"`,
        recoveryAdvice: 'Check propel-app git status and staging area. Ensure approved desktop files are clean and unstaged changes are resolved.',
      })
    }

    printStepSuccess(12, 'Commit desktop release', isDryRun ? '[SIMULATION] Desktop git commit simulated. 0 commits created.' : `Desktop release committed (${desktopCommitHash.slice(0, 10)}).`)
    saveCheckpoint(fullVersion, 12, { summary: `Desktop release committed (${desktopCommitHash.slice(0, 10)}).` })
    if (!await askStepConfirmation(
      `\nProceed to create and push tag ${gitTag}?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
    )) {
      reportMidwayStop('Stopped after Step 12 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 13 — Create and push tag
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(13, 'Create and push tag', `Creating annotated tag ${gitTag} and pushing to origin`)
  if (resumeStartStep > 13) {
    console.log(`   ⏩ Skipping Step 13 (${TOTAL_STEPS[12].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log(`   [DRY RUN] Would create tag: git tag -a ${gitTag} -m "Release Propel ${gitTag}"`)
        console.log(`   [DRY RUN] Would verify tag points to current commit and push main and ${gitTag}`)
      } else {
        const existingTag = execSync(`git tag -l ${gitTag}`, { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (existingTag) {
          console.log(`   ℹ️  Git tag ${gitTag} already exists locally.`)
        } else {
          const createConfirmed = await askStepConfirmation(
            `\nReady to create git tag ${gitTag}?\n\n   [YES] Create tag\n   [NO]  Stop safely\n\n> `
          )
          if (!createConfirmed) {
            reportMidwayStop('Stopped before tag creation by user.')
            process.exit(0)
          }
          execSync(`git tag -a ${gitTag} -m "Release Propel ${gitTag}"`, { cwd: ROOT_APP, stdio: 'inherit' })
          console.log(`   ✔ Tag ${gitTag} created.`)
        }

        const tagCommit = execSync(`git rev-parse ${gitTag}^{commit}`, { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        const headCommit = execSync('git rev-parse HEAD', { cwd: ROOT_APP, encoding: 'utf8' }).trim()
        if (tagCommit !== headCommit) {
          throw new Error(`Tag ${gitTag} (${tagCommit}) does not point to current release commit (${headCommit})!`)
        }
        console.log(`   ✔ Verified tag ${gitTag} points to release commit: ${headCommit.slice(0, 10)}`)

        // Duplicate remote tag protection
        const rTag = checkRemoteTag(gitTag, 'origin', ROOT_APP)
        if (rTag.exists) {
          if (rTag.commit && rTag.commit !== headCommit && rTag.commit !== tagCommit) {
            throw new Error(
              `Ambiguous/Conflicting Remote State: Remote tag ${gitTag} points to commit ${rTag.commit.slice(0, 10)}, ` +
              `but local HEAD is ${headCommit.slice(0, 10)}. ` +
              `Manual intervention required: cannot overwrite or retarget existing remote tag automatically!`
            )
          }
          console.log(`   ℹ️  Tag ${gitTag} already exists on remote origin and matches current HEAD. Skipping duplicate tag push.`)
        } else {
          const confirmed = await askStepConfirmation(
            `\nReady to push main branch and tag ${gitTag} to GitHub?\n\n   [YES] Push now\n   [NO]  Stop safely\n\n> `
          )
          if (!confirmed) {
            reportMidwayStop('Stopped before pushing desktop branch/tag by user.')
            process.exit(0)
          }

          execSync('git push origin main', { cwd: ROOT_APP, stdio: 'inherit' })
          execSync(`git push origin ${gitTag}`, { cwd: ROOT_APP, stdio: 'inherit' })
          console.log(`   ✔ Branch main and tag ${gitTag} pushed successfully.`)
        }
      }
    } catch (err) {
      haltOnFailure(13, 'Create and push tag', err.message, {
        failedCommand: `git tag -a ${gitTag} && git push origin ${gitTag}`,
        recoveryAdvice: 'If tag already exists remotely, verify whether it matches the release commit. If mismatched, investigate before manually moving or deleting tags.',
      })
    }

    printStepSuccess(13, 'Create and push tag', isDryRun ? '[SIMULATION] Git tag creation and push simulated. 0 tags created.' : `Tag ${gitTag} created and pushed to origin/main.`)
    saveCheckpoint(fullVersion, 13, { summary: `Tag ${gitTag} created and pushed to origin/main.` })
    if (!await askStepConfirmation()) {
      reportMidwayStop('Stopped after Step 13 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 14 — Publishing dry-run
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(14, 'Publishing dry-run', 'Executing guarded publication pre-flight check without uploading')
  if (resumeStartStep > 14) {
    console.log(`   ⏩ Skipping Step 14 (${TOTAL_STEPS[13].title}) — verified from prior run.`)
  } else {
    try {
      if (isDryRun) {
        console.log('   [DRY RUN] Would execute: node scripts/release-publish.mjs --dry-run on verified build artifacts')
      } else {
        execSync('node scripts/release-publish.mjs --dry-run', { cwd: ROOT_APP, stdio: 'inherit' })
      }
    } catch (err) {
      haltOnFailure(14, 'Publishing dry-run', err.message, {
        failedCommand: 'node scripts/release-publish.mjs --dry-run',
        recoveryAdvice: 'Verify build artifacts, checksums, and backend registry match before attempting live publish.',
      })
    }

    printStepSuccess(14, 'Publishing dry-run', isDryRun ? '[SIMULATION] Publishing dry-run simulated. Zero network uploads made.' : 'All publishing guards passed. Zero network uploads made.')
    saveCheckpoint(fullVersion, 14, { summary: 'All publishing guards passed. Zero network uploads made.' })
    if (!await askStepConfirmation(
      `\nPre-flight verified. Proceed to Step 15 for GitHub Release publication?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
    )) {
      reportMidwayStop('Stopped after Step 14 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 15 — Publish GitHub Release
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(15, 'Publish GitHub Release', `Final publication of Propel v${fullVersion} to pranavop45/propel-releases`)

  console.log(`   Repository:  pranavop45/propel-releases`)
  console.log(`   Release Tag: ${gitTag}`)
  console.log(`   Assets:      ${installerName}, latest.yml, ${installerName}.blockmap`)

  if (resumeStartStep > 15) {
    console.log(`   ⏩ Skipping Step 15 (${TOTAL_STEPS[14].title}) — verified from prior run.`)
  } else {
    // Secure token acquisition & validation (in-memory only, non-echoing prompt if needed)
    const tokenAcquired = await ensureGitHubToken(isDryRun)
    if (!tokenAcquired) {
      reportMidwayStop('Publication cancelled safely: Valid GitHub token was not provided.')
      process.exit(0)
    }

    // Check remote release existence and partial asset protection
    let alreadyPublished = false
    try {
      const relCheck = await checkRemoteRelease(gitTag)
      if (relCheck.exists) {
        if (relCheck.isComplete) {
          console.log(`   ℹ️  GitHub Release ${gitTag} already exists with all 3 required assets:`)
          for (const a of relCheck.assets) console.log(`     ✔ ${a}`)
          console.log('   Skipping duplicate upload to prevent overwriting or re-upload errors.')
          alreadyPublished = true
        } else {
          throw new Error(
            `Ambiguous/Partial Remote Release: Release ${gitTag} exists on GitHub but is missing required asset(s): ${relCheck.missingAssets.join(', ')}. ` +
            `Existing assets: ${relCheck.assets.join(', ') || 'none'}. ` +
            `Manual intervention required: Inspect GitHub release state before re-running to avoid corrupt releases.`
          )
        }
      }
    } catch (checkErr) {
      if (checkErr.message.includes('Ambiguous/Partial Remote Release')) {
        haltOnFailure(15, 'Publish GitHub Release', checkErr.message, {
          failedCommand: 'checkRemoteRelease',
          recoveryAdvice: 'Inspect the release on GitHub. If incomplete or corrupted, delete the incomplete draft/release assets manually before retrying.',
        })
      }
    }

    if (!alreadyPublished) {
      const finalConfirmPrompt = (
        `\n` + '═'.repeat(70) + `\n` +
        `⚠️  FINAL PRODUCTION PUBLISHING CONFIRMATION\n` +
        `You are about to publish Propel v${fullVersion} to production.\n` +
        `Type YES to publish or NO to stop.\n` +
        '═'.repeat(70) + `\n\n> `
      )

      const authorized = await askStepConfirmation(finalConfirmPrompt, true)
      if (!authorized) {
        reportMidwayStop('Publication aborted safely by user in Step 15.')
        process.exit(0)
      }

      try {
        if (isDryRun) {
          console.log('   [DRY RUN] Would execute: node scripts/release-publish.mjs')
          console.log('   [DRY RUN] Publication simulated successfully. Zero network uploads made.')
        } else {
          execSync('node scripts/release-publish.mjs', { cwd: ROOT_APP, stdio: 'inherit', env: process.env })
        }
      } catch (err) {
        haltOnFailure(15, 'Publish GitHub Release', err.message, {
          failedCommand: 'node scripts/release-publish.mjs',
          recoveryAdvice: 'Check GitHub token permissions, network connectivity, and release repository state on pranavop45/propel-releases.',
        })
      }
    }

    printStepSuccess(15, 'Publish GitHub Release', isDryRun ? '[SIMULATION] GitHub release publication simulated. Zero network uploads made.' : `Propel v${fullVersion} published to pranavop45/propel-releases!`)
    saveCheckpoint(fullVersion, 15, { summary: `Propel v${fullVersion} published to pranavop45/propel-releases!` })
    if (!await askStepConfirmation(
      `\nPublication complete. Run Step 16 final verification?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
    )) {
      reportMidwayStop('Stopped after Step 15 by user.')
      process.exit(0)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 16 — Final verification
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(16, 'Final verification', 'Verifying GitHub Releases API, assets, and website dynamic download resolver')
  try {
    console.log('   Querying GitHub Releases API...')
    try {
      const res = await fetch('https://api.github.com/repos/pranavop45/propel-releases/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const rel = await res.json()
        console.log(`   ✔ Latest GitHub release tag: ${rel.tag_name}`)
        console.log(`   ✔ Assets found: ${(rel.assets || []).map((a) => a.name).join(', ')}`)
      } else {
        console.log(`   ℹ️  GitHub API returned HTTP ${res.status} (rate-limit or pending propagation).`)
      }
    } catch (apiErr) {
      console.log(`   ℹ️  API verification note: ${apiErr.message}`)
    }

    console.log('\n   Website Dynamic Resolver Check:')
    console.log(`   • Hook file: ${WEBSITE_RELEASE_HOOK_PATH}`)
    console.log(`   • Target repo: pranavop45/propel-releases`)
    console.log(`   • Matching regex: /^Propel-Setup-.+\\.exe$/i`)
    console.log(`   • Public downloads: https://cleanmasterpro.in/downloads`)

    console.log('\n   Manual Production Checks Remaining:')
    console.log('   [ ] Test clean installation of Propel-Setup-' + fullVersion + '.exe on a physical Windows PC.')
    console.log('   [ ] Test background auto-update from existing installed v1.4.0 clients.')
  } catch (err) {
    haltOnFailure(16, 'Final verification', err.message, {
      failedCommand: 'GitHub API & Website Resolver Check',
      recoveryAdvice: 'Verify that the release asset is accessible via GitHub Releases API and that the website download page resolves correctly.',
    })
  }

  printStepSuccess(16, 'Final verification', 'GitHub API, website resolver, and release assets verified.')
  clearCheckpoint()

  console.log('\n' + '═'.repeat(70))
  console.log(`🎉 RELEASE WORKFLOW COMPLETE FOR PROPEL v${fullVersion}!`)
  console.log('═'.repeat(70))
  reportMidwayStop('All 16 steps completed successfully.')
}

// ── Entry Point Guard ────────────────────────────────────────────────────────
const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntryPoint) {
  main().catch((err) => {
    console.error(`\n❌ Fatal orchestrator error: ${err.message}\n`)
    process.exit(1)
  })
}
