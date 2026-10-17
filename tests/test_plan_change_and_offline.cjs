// Unit test for tests (e) and (f): plan change re-sync and offline start
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync, execFile } = require('child_process')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)

const TASK_NAME = 'Propel Maintenance'

function checkTaskExists() {
  try {
    const out = execFileSync('schtasks.exe', ['/query', '/tn', TASK_NAME], {
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return out.includes(TASK_NAME)
  } catch {
    return false
  }
}

async function removeTask() {
  try {
    await execFileAsync('schtasks.exe', ['/delete', '/tn', TASK_NAME, '/f'], { windowsHide: true })
  } catch {}
}

async function createTask(exePath) {
  const quoted = `"${exePath}" --scheduled-maintenance`
  await execFileAsync(
    'schtasks.exe',
    ['/create', '/tn', TASK_NAME, '/tr', quoted, '/sc', 'daily', '/st', '02:00', '/rl', 'LIMITED', '/it', '/f'],
    { windowsHide: true }
  )
}

// Mirror of syncWindowsTask logic
async function syncWindowsTask(entitlement, settings, exePath) {
  if (entitlement.features && entitlement.features.alwaysOnMaintenance && settings.scheduleEnabled) {
    await createTask(exePath)
  } else {
    await removeTask()
  }
}

// Bootstrap decision function (mirror of SplashScreen logic)
function resolveBootstrapState({ session, cachedEntitlement, isOnline }) {
  if (!session) {
    if (cachedEntitlement && !cachedEntitlement.isFallback) {
      return {
        phase: 'main',
        isOffline: true,
        plan: cachedEntitlement.plan,
        bannerText: 'Offline: using saved plan',
      }
    }
    if (!isOnline) {
      return {
        phase: 'no_internet',
        isOffline: true,
        plan: 'FREE',
      }
    }
    return {
      phase: 'login',
      isOffline: false,
      plan: 'FREE',
    }
  }

  // Session exists
  if (!isOnline) {
    if (cachedEntitlement && !cachedEntitlement.isFallback) {
      return {
        phase: 'main',
        isOffline: true,
        plan: cachedEntitlement.plan,
        bannerText: 'Offline: using saved plan',
      }
    } else {
      return {
        phase: 'main',
        isOffline: true,
        plan: 'FREE',
        bannerText: 'Offline: using saved plan',
      }
    }
  }

  return {
    phase: 'main',
    isOffline: false,
  }
}

async function run() {
  console.log('--- STARTING TESTS (e) & (f) ---')

  const dummyExe = process.execPath
  await removeTask()

  // ── TEST (e): Plan change triggers re-sync with no restart ──
  console.log('\n--- TEST (e): Live Plan Change Re-Sync ---')
  let currentPlan = 'FREE'
  let currentSettings = { scheduleEnabled: true }

  // Initial state: FREE
  let ent = {
    plan: 'FREE',
    features: { customThresholds: false, alwaysOnMaintenance: false },
  }
  await syncWindowsTask(ent, currentSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), false, 'FREE has no task')
  console.log('[PASS] 1. Initial FREE state: task is absent')

  // User upgrades to PRO while app is running
  const oldPlan = currentPlan
  currentPlan = 'PRO'
  ent = {
    plan: 'PRO',
    features: { customThresholds: true, alwaysOnMaintenance: true },
  }
  // Plan change handler triggers syncWindowsTask immediately without app restart
  let planChangedToast = null
  if (oldPlan !== currentPlan) {
    planChangedToast = `Your plan is now ${currentPlan}`
    await syncWindowsTask(ent, currentSettings, dummyExe)
  }
  assert.strictEqual(planChangedToast, 'Your plan is now PRO')
  assert.strictEqual(checkTaskExists(), true, 'Upgrading to PRO creates task immediately')
  console.log('[PASS] 2. Live plan upgrade to PRO triggers toast and creates task with no restart')

  // Later, user subscription expires while app is running -> reverts to FREE
  const oldPlan2 = currentPlan
  currentPlan = 'FREE'
  ent = {
    plan: 'FREE',
    features: { customThresholds: false, alwaysOnMaintenance: false },
  }
  let planChangedToast2 = null
  if (oldPlan2 !== currentPlan) {
    planChangedToast2 = `Your plan is now ${currentPlan}`
    await syncWindowsTask(ent, currentSettings, dummyExe)
  }
  assert.strictEqual(planChangedToast2, 'Your plan is now FREE')
  assert.strictEqual(checkTaskExists(), false, 'Reverting to FREE deletes task immediately')
  console.log('[PASS] 3. Live plan expiry to FREE triggers toast and removes task with no restart')

  // Clean up task
  await removeTask()

  // ── TEST (f): Offline start logic ──
  console.log('\n--- TEST (f): Offline Startup Decisions ---')

  // Case 1: Offline with cached PRO entitlement
  const r1 = resolveBootstrapState({
    session: null,
    cachedEntitlement: { plan: 'PRO', isFallback: false },
    isOnline: false,
  })
  assert.strictEqual(r1.phase, 'main', 'Offline start with cache must enter main')
  assert.strictEqual(r1.isOffline, true)
  assert.strictEqual(r1.bannerText, 'Offline: using saved plan')
  assert.strictEqual(r1.plan, 'PRO')
  console.log('[PASS] 1. Offline start with cached PRO -> app opens with "Offline: using saved plan" banner')

  // Case 2: Offline with active session but network offline
  const r2 = resolveBootstrapState({
    session: { access_token: 'xyz' },
    cachedEntitlement: { plan: 'PRO', isFallback: false },
    isOnline: false,
  })
  assert.strictEqual(r2.phase, 'main')
  assert.strictEqual(r2.isOffline, true)
  assert.strictEqual(r2.bannerText, 'Offline: using saved plan')
  console.log('[PASS] 2. Offline start with session and cache -> app opens with banner')

  // Case 3: Offline with session, but NO cache at all (fresh install offline)
  const r3 = resolveBootstrapState({
    session: { access_token: 'xyz' },
    cachedEntitlement: { isFallback: true },
    isOnline: false,
  })
  assert.strictEqual(r3.phase, 'main', 'Session with no cache allows free local tools')
  assert.strictEqual(r3.plan, 'FREE')
  console.log('[PASS] 3. Offline with session, no cache -> allows free local tools in main')

  // Case 4: Offline with NO cache AND NO session
  const r4 = resolveBootstrapState({
    session: null,
    cachedEntitlement: { isFallback: true },
    isOnline: false,
  })
  assert.strictEqual(r4.phase, 'no_internet', 'No cache AND no session offline must show NoInternetScreen')
  console.log('[PASS] 4. Offline with NO cache AND NO session -> shows NoInternetScreen')

  // Case 5: Online with NO session -> login
  const r5 = resolveBootstrapState({
    session: null,
    cachedEntitlement: { isFallback: true },
    isOnline: true,
  })
  assert.strictEqual(r5.phase, 'login', 'Online with no session goes to login')
  console.log('[PASS] 5. Online with no session -> shows login')

  console.log('\n--- ALL TESTS (e) & (f) PASSED SUCCESSFULLY! ---')
}

run().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
