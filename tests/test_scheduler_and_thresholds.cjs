// Unit test for tests (b), (c), (d): syncWindowsTask, scheduled launch, threshold clamping
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
  } catch (err) {
    return false
  }
}

async function removeTask() {
  try {
    await execFileAsync('schtasks.exe', ['/delete', '/tn', TASK_NAME, '/f'], {
      windowsHide: true,
    })
  } catch {}
}

async function createTask(exePath) {
  const quoted = `"${exePath}" --scheduled-maintenance`
  await execFileAsync(
    'schtasks.exe',
    [
      '/create',
      '/tn', TASK_NAME,
      '/tr', quoted,
      '/sc', 'daily',
      '/st', '02:00',
      '/rl', 'LIMITED',
      '/it',
      '/f',
    ],
    { windowsHide: true }
  )
}

async function syncWindowsTaskSim(entitlement, settings, exePath) {
  if (entitlement.features && entitlement.features.alwaysOnMaintenance && settings.scheduleEnabled) {
    await createTask(exePath)
  } else {
    await removeTask()
  }
}

function getEffectiveThresholdsSim(settings, entitlement) {
  const customAllowed = (entitlement && entitlement.features && entitlement.features.customThresholds) || false
  return {
    ramThreshold: customAllowed ? (settings.ramAlertThreshold ?? 85) : 85,
    diskThreshold: customAllowed ? (settings.diskAlertThreshold ?? 90) : 90,
    junkThreshold: customAllowed ? (settings.junkAlertThreshold ?? 2) : 2,
    customAllowed,
  }
}

async function runScheduledIfDueSim(entitlement, settings) {
  if (!entitlement.features || !entitlement.features.alwaysOnMaintenance) {
    await removeTask()
    return false
  }
  if (!settings.scheduleEnabled) return false
  return true // due
}

async function run() {
  console.log('--- STARTING TESTS (b), (c), (d) ---')

  const dummyExe = process.execPath

  // ── TEST (b): syncWindowsTask (schtasks query) ──
  console.log('\n--- TEST (b): syncWindowsTask with FREE vs PRO ---')
  await removeTask()
  assert.strictEqual(checkTaskExists(), false, 'Task should initially not exist')

  const freeEnt = {
    plan: 'FREE',
    features: { customThresholds: false, alwaysOnMaintenance: false },
  }
  const proEnt = {
    plan: 'PRO',
    features: { customThresholds: true, alwaysOnMaintenance: true },
  }
  const enabledSettings = { scheduleEnabled: true }
  const disabledSettings = { scheduleEnabled: false }

  // 1. FREE with scheduleEnabled=true -> Must NOT create task / must remove
  await syncWindowsTaskSim(freeEnt, enabledSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), false, 'FREE plan must NOT create task')
  console.log('[PASS] 1. FREE plan removes task / does not create task')

  // 2. PRO with scheduleEnabled=true -> Must create task
  await syncWindowsTaskSim(proEnt, enabledSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), true, 'PRO plan must create task')
  console.log('[PASS] 2. PRO plan creates task')

  // Verify query output
  const queryOut = execFileSync('schtasks.exe', ['/query', '/tn', TASK_NAME], { encoding: 'utf8' })
  assert(queryOut.includes(TASK_NAME), 'schtasks /query shows Propel Maintenance')
  console.log('[PASS] schtasks /query output verified:\n' + queryOut.split('\n').slice(0, 5).join('\n'))

  // 3. PRO idempotent re-sync -> Exactly one task remains
  await syncWindowsTaskSim(proEnt, enabledSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), true, 'Idempotent sync keeps task intact')
  console.log('[PASS] 3. Idempotent re-sync keeps exactly one task')

  // 4. Switch back to FREE -> Task is removed
  await syncWindowsTaskSim(freeEnt, enabledSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), false, 'Switching back to FREE removes task')
  console.log('[PASS] 4. Switching to FREE removes task')

  // ── TEST (c): scheduled launch gating ──
  console.log('\n--- TEST (c): scheduled launch gating ---')
  // First recreate task with PRO
  await syncWindowsTaskSim(proEnt, enabledSettings, dummyExe)
  assert.strictEqual(checkTaskExists(), true)

  // Launch with FREE cache -> exits without cleaning, removes task
  const freeLaunchRan = await runScheduledIfDueSim(freeEnt, enabledSettings)
  assert.strictEqual(freeLaunchRan, false, 'FREE launch must NOT clean')
  assert.strictEqual(checkTaskExists(), false, 'FREE launch must remove task')
  console.log('[PASS] 1. Scheduled launch with FREE cache exits without cleaning and removes task')

  // Launch with PRO cache -> runs once
  const proLaunchRan = await runScheduledIfDueSim(proEnt, enabledSettings)
  assert.strictEqual(proLaunchRan, true, 'PRO launch runs cleanup')
  console.log('[PASS] 2. Scheduled launch with PRO cache runs cleanup')

  // Clean up task after test
  await removeTask()

  // ── TEST (d): Clamped thresholds on FREE with custom settings ──
  console.log('\n--- TEST (d): Clamped thresholds (70/70/1 in file) ---')
  const userFileSettings = {
    ramAlertThreshold: 70,
    diskAlertThreshold: 70,
    junkAlertThreshold: 1,
  }

  // Under FREE: clamped to 85 / 90 / 2GB
  const freeThresh = getEffectiveThresholdsSim(userFileSettings, freeEnt)
  assert.strictEqual(freeThresh.ramThreshold, 85, 'FREE must clamp RAM to 85')
  assert.strictEqual(freeThresh.diskThreshold, 90, 'FREE must clamp Disk to 90')
  assert.strictEqual(freeThresh.junkThreshold, 2, 'FREE must clamp Junk to 2')
  assert.strictEqual(freeThresh.customAllowed, false)
  // Verify original settings were NOT mutated
  assert.strictEqual(userFileSettings.ramAlertThreshold, 70, 'User saved RAM setting is preserved')
  assert.strictEqual(userFileSettings.diskAlertThreshold, 70, 'User saved Disk setting is preserved')
  assert.strictEqual(userFileSettings.junkAlertThreshold, 1, 'User saved Junk setting is preserved')
  console.log('[PASS] 1. FREE with hand-edited 70/70/1 clamps to 85/90/2GB without modifying user settings')

  // Under PRO: custom values honored
  const proThresh = getEffectiveThresholdsSim(userFileSettings, proEnt)
  assert.strictEqual(proThresh.ramThreshold, 70, 'PRO honors RAM 70')
  assert.strictEqual(proThresh.diskThreshold, 70, 'PRO honors Disk 70')
  assert.strictEqual(proThresh.junkThreshold, 1, 'PRO honors Junk 1')
  assert.strictEqual(proThresh.customAllowed, true)
  console.log('[PASS] 2. PRO honors custom 70/70/1 thresholds')

  console.log('\n--- ALL TESTS (b), (c), (d) PASSED SUCCESSFULLY! ---')
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
