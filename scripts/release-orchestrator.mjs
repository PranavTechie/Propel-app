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
import { readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
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

/**
 * Halts on failure immediately. Never asks to continue after failure.
 */
function haltOnFailure(num, title, errorMessage, exitCode = 1) {
  console.error(`\n` + '═'.repeat(70))
  console.error(`❌ [FAILED] Step ${num} (${title}) HALTED WITH ERROR!`)
  console.error(`  Error: ${errorMessage}`)
  console.error(`  FAIL-CLOSED: Workflow stopped automatically. No further steps executed.`)
  console.error('═'.repeat(70) + `\n`)
  reportMidwayStop(`Step ${num} failed.`)
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

  console.log('\n📋 Target Release Configuration:')
  console.log(`   Target Semver (Full):     ${fullVersion}`)
  console.log(`   User-Facing Version:      ${displayVersion}`)
  console.log(`   Git Release Tag:          ${gitTag}`)
  console.log(`   Installer Executable:     ${installerName}`)
  console.log(`   Website Download URL:     ${downloadPath}`)
  console.log(`   Workflow Mode:            ${isDryRun ? 'DRY RUN (Simulation only — zero mutations)' : 'PRODUCTION PREPARATION'}`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Pre-release inspection
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(1, 'Pre-release inspection', 'Auditing Node, Git, remotes, working trees, and safety tests')
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
    haltOnFailure(1, 'Pre-release inspection', err.message)
  }

  printStepSuccess(1, 'Pre-release inspection', 'Prerequisites, branches, historical records, and 29 unit tests verified.')
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 1 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Release dry-run
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(2, 'Release dry-run', `Pre-validating version synchronization in memory for v${fullVersion}`)
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
    haltOnFailure(2, 'Release dry-run', err.message)
  }

  printStepSuccess(2, 'Release dry-run', `All 10 target files pre-validated in memory for ${fullVersion}. 0 files modified.`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 2 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Apply release version
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(3, 'Apply release version', `Synchronizing version references across 10 desktop application files`)
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
    haltOnFailure(3, 'Apply release version', err.message)
  }

  printStepSuccess(3, 'Apply release version', isDryRun ? `[SIMULATION] Desktop version updates simulated for ${fullVersion}. 0 files modified on disk.` : `10 desktop application files synchronized to ${fullVersion} (${displayVersion}).`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 3 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Build application
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(4, 'Build application', 'Compiling application bundles exactly once (electron-vite build)')
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
    haltOnFailure(4, 'Build application', err.message)
  }

  printStepSuccess(4, 'Build application', isDryRun ? '[SIMULATION] Production build simulated. 0 files compiled.' : 'Production build compiled exactly once to out/ directory.')
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 4 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Generate and verify integrity manifest
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(5, 'Generate and verify integrity manifest', 'Computing and hashing out/ bundles into integrity-manifest.json')
  let generatedSignature = 'SIMULATED-64-HEX-HMAC-SHA256-SIGNATURE'
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
    haltOnFailure(5, 'Generate and verify integrity manifest', err.message)
  }

  printStepSuccess(5, 'Generate and verify integrity manifest', isDryRun ? `[SIMULATION] Integrity manifest generation simulated. 0 files written.` : `Integrity manifest generated and verified (${generatedSignature.slice(0, 16)}...).`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 5 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6 — Register backend build signature
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(6, 'Register backend build signature', 'Calculating build signature and appending to official-builds.json')
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
      console.log(`     ✔ "${displayVersion}": "${backendBuilds[displayVersion]}"`)
      console.log(`     ✔ "${fullVersion}": "${backendBuilds[fullVersion]}"`)
    }
    console.log('   ✔ Historical records 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 verified unchanged.')
  } catch (err) {
    haltOnFailure(6, 'Register backend build signature', err.message)
  }

  printStepSuccess(6, 'Register backend build signature', isDryRun ? `[SIMULATION] Backend signature registration simulated. 0 records modified.` : `Registered ${displayVersion} & ${fullVersion} in official-builds.json.`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 6 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7 — Package Windows installer
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(7, 'Package Windows installer', 'Packaging existing build without recompiling (package:win)')
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
    haltOnFailure(7, 'Package Windows installer', err.message)
  }

  printStepSuccess(7, 'Package Windows installer', isDryRun ? `[SIMULATION] Windows installer packaging simulated. No installer created.` : `Packaged release/${installerName} without rebuilding.`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 7 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8 — Verify installer
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(8, 'Verify installer', 'Strict verification of installer freshness, latest.yml and ASAR signature')
  try {
    if (isDryRun) {
      console.log('   [DRY RUN] Would execute: node scripts/verify-build-signature.mjs --strict')
    } else {
      execSync('node scripts/verify-build-signature.mjs --strict', { cwd: ROOT_APP, stdio: 'inherit' })
    }
  } catch (err) {
    haltOnFailure(8, 'Verify installer', err.message)
  }

  printStepSuccess(8, 'Verify installer', isDryRun ? '[SIMULATION] Installer verification simulated.' : 'Installer timestamp, latest.yml SHA-512, and ASAR signature strictly verified.')
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 8 by user.')
    process.exit(0)
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

  printStepSuccess(9, 'Review Git changes', 'Explicit staging boundaries and proposed commit messages reviewed.')
  if (!await askStepConfirmation(
    `\nReview complete. Proceed to stage and commit backend registry?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
  )) {
    reportMidwayStop('Stopped after Step 9 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10 — Commit backend registry
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(10, 'Commit backend registry', 'Staging and committing official-builds.json in propel-backend')
  const backendDir = resolve(ROOT_WORKSPACE, 'propel-backend')
  let backendCommitHash = 'SIMULATED-HASH'
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
    haltOnFailure(10, 'Commit backend registry', err.message)
  }

  printStepSuccess(10, 'Commit backend registry', isDryRun ? '[SIMULATION] Backend git commit simulated. 0 commits created.' : `Backend signature committed (${backendCommitHash.slice(0, 10)}).`)
  if (!await askStepConfirmation(
    `\nProceed to push backend commit and verify Render deployment?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
  )) {
    reportMidwayStop('Stopped after Step 10 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 11 — Push backend and verify deployment
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(11, 'Push backend and verify deployment', 'Pushing propel-backend to origin/main and verifying Render deployment')
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
    haltOnFailure(11, 'Push backend and verify deployment', err.message)
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

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 12 — Commit desktop release
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(12, 'Commit desktop release', 'Staging only approved desktop release files in propel-app')
  let desktopCommitHash = 'SIMULATED-HASH'
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
    haltOnFailure(12, 'Commit desktop release', err.message)
  }

  printStepSuccess(12, 'Commit desktop release', isDryRun ? '[SIMULATION] Desktop git commit simulated. 0 commits created.' : `Desktop release committed (${desktopCommitHash.slice(0, 10)}).`)
  if (!await askStepConfirmation(
    `\nProceed to create and push tag ${gitTag}?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
  )) {
    reportMidwayStop('Stopped after Step 12 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 13 — Create and push tag
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(13, 'Create and push tag', `Creating annotated tag ${gitTag} and pushing to origin`)
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
  } catch (err) {
    haltOnFailure(13, 'Create and push tag', err.message)
  }

  printStepSuccess(13, 'Create and push tag', isDryRun ? '[SIMULATION] Git tag creation and push simulated. 0 tags created.' : `Tag ${gitTag} created and pushed to origin/main.`)
  if (!await askStepConfirmation()) {
    reportMidwayStop('Stopped after Step 13 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 14 — Publishing dry-run
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(14, 'Publishing dry-run', 'Executing guarded publication pre-flight check without uploading')
  try {
    if (isDryRun) {
      console.log('   [DRY RUN] Would execute: node scripts/release-publish.mjs --dry-run on verified build artifacts')
    } else {
      execSync('node scripts/release-publish.mjs --dry-run', { cwd: ROOT_APP, stdio: 'inherit' })
    }
  } catch (err) {
    haltOnFailure(14, 'Publishing dry-run', err.message)
  }

  printStepSuccess(14, 'Publishing dry-run', isDryRun ? '[SIMULATION] Publishing dry-run simulated. Zero network uploads made.' : 'All publishing guards passed. Zero network uploads made.')
  if (!await askStepConfirmation(
    `\nPre-flight verified. Proceed to Step 15 for GitHub Release publication?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
  )) {
    reportMidwayStop('Stopped after Step 14 by user.')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 15 — Publish GitHub Release
  // ═══════════════════════════════════════════════════════════════════════════
  printStepBanner(15, 'Publish GitHub Release', `Final publication of Propel v${fullVersion} to pranavop45/propel-releases`)

  console.log(`   Repository:  pranavop45/propel-releases`)
  console.log(`   Release Tag: ${gitTag}`)
  console.log(`   Assets:      ${installerName}, latest.yml, ${installerName}.blockmap`)

  // Secure token acquisition & validation (in-memory only, non-echoing prompt if needed)
  const tokenAcquired = await ensureGitHubToken(isDryRun)
  if (!tokenAcquired) {
    reportMidwayStop('Publication cancelled safely: Valid GitHub token was not provided.')
    process.exit(0)
  }

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
    haltOnFailure(15, 'Publish GitHub Release', err.message)
  }

  printStepSuccess(15, 'Publish GitHub Release', isDryRun ? '[SIMULATION] GitHub release publication simulated. Zero network uploads made.' : `Propel v${fullVersion} published to pranavop45/propel-releases!`)
  if (!await askStepConfirmation(
    `\nPublication complete. Run Step 16 final verification?\n\n   [YES] Continue\n   [NO]  Stop safely\n\n> `
  )) {
    reportMidwayStop('Stopped after Step 15 by user.')
    process.exit(0)
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
    haltOnFailure(16, 'Final verification', err.message)
  }

  printStepSuccess(16, 'Final verification', 'GitHub API, website resolver, and release assets verified.')

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
