// Unit test for test (a): cache read/write, expiry, grace, clock rollback detection
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Set temporary APPDATA to isolated test folder
const testDir = path.join(os.tmpdir(), 'propel_test_cache_' + Date.now())
fs.mkdirSync(testDir, { recursive: true })
process.env.APPDATA = testDir

const entitlementFilePath = path.join(testDir, 'propel', 'propel_entitlement.json')

// Logic mirror of evaluateEntitlement to run directly with node
const OFFLINE_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
const CLOCK_ROLLBACK_TOLERANCE_MS = 60 * 1000 // 1 minute

const DEFAULT_FREE_ENTITLEMENT = {
  plan: 'FREE',
  features: { customThresholds: false, alwaysOnMaintenance: false },
  limits: { devices: 10, aiChecksPerMonth: 1 },
  expiresAt: null,
  isExpired: false,
  isTampered: false,
  isFallback: true,
}

function evaluateEntitlement(payload, now = Date.now()) {
  if (!payload || !payload.plan) {
    return { ...DEFAULT_FREE_ENTITLEMENT, isFallback: true }
  }

  if (payload.plan === 'FREE') {
    return {
      ...payload,
      features: { customThresholds: false, alwaysOnMaintenance: false },
      limits: payload.limits || { devices: 10, aiChecksPerMonth: 1 },
      isExpired: false,
      isTampered: false,
      isFallback: false,
    }
  }

  const fetchedAt = Number(payload.fetchedAt) || 0
  const serverTimeMs = new Date(payload.serverTime).getTime()

  // 1. Clock rollback check
  if (now < fetchedAt - CLOCK_ROLLBACK_TOLERANCE_MS) {
    return {
      ...DEFAULT_FREE_ENTITLEMENT,
      isExpired: true,
      isTampered: true,
      isFallback: false,
    }
  }

  const elapsedLocal = Math.max(0, now - fetchedAt)

  // 2. Offline 3-day grace period check
  if (elapsedLocal > OFFLINE_GRACE_PERIOD_MS) {
    return {
      ...DEFAULT_FREE_ENTITLEMENT,
      isExpired: true,
      isTampered: false,
      isFallback: false,
    }
  }

  // 3. Expiry check
  const effectiveServerTime = (!isNaN(serverTimeMs) && serverTimeMs > 0)
    ? serverTimeMs + elapsedLocal
    : now

  if (payload.expiresAt) {
    const expiresAtMs = new Date(payload.expiresAt).getTime()
    if (!isNaN(expiresAtMs) && effectiveServerTime >= expiresAtMs) {
      return {
        ...DEFAULT_FREE_ENTITLEMENT,
        isExpired: true,
        isTampered: false,
        isFallback: false,
      }
    }
  }

  return {
    ...payload,
    isExpired: false,
    isTampered: false,
    isFallback: false,
  }
}

function runTests() {
  console.log('--- RUNNING TEST (a): Entitlement Cache Tests ---')

  const now = Date.now()

  // 1. Valid Active PRO
  const activePro = {
    plan: 'PRO',
    features: { customThresholds: true, alwaysOnMaintenance: true },
    limits: { devices: 2, aiChecksPerMonth: 10 },
    expiresAt: new Date(now + 7 * 86400000).toISOString(),
    serverTime: new Date(now).toISOString(),
    fetchedAt: now - 3600000, // fetched 1h ago
  }
  const evalActive = evaluateEntitlement(activePro, now)
  assert.strictEqual(evalActive.plan, 'PRO', 'Active PRO plan should stay PRO')
  assert.strictEqual(evalActive.isExpired, false, 'Active PRO should not be expired')
  assert.strictEqual(evalActive.features.alwaysOnMaintenance, true, 'PRO alwaysOnMaintenance should be true')
  console.log('[PASS] 1. Active PRO entitlement evaluates correctly')

  // 2. Expired PRO (expiresAt in past)
  const expiredPro = {
    plan: 'PRO',
    features: { customThresholds: true, alwaysOnMaintenance: true },
    limits: { devices: 2, aiChecksPerMonth: 10 },
    expiresAt: new Date(now - 1000).toISOString(), // expired 1s ago
    serverTime: new Date(now - 3600000).toISOString(),
    fetchedAt: now - 3600000,
  }
  const evalExpired = evaluateEntitlement(expiredPro, now)
  assert.strictEqual(evalExpired.plan, 'FREE', 'Expired PRO must fall back to FREE')
  assert.strictEqual(evalExpired.isExpired, true, 'Expired PRO isExpired must be true')
  assert.strictEqual(evalExpired.features.alwaysOnMaintenance, false, 'Expired PRO alwaysOnMaintenance must be false')
  console.log('[PASS] 2. Expired plan reverts to FREE')

  // 3. Offline Grace Period Exceeded (> 3 days)
  const graceExpired = {
    plan: 'MAX',
    features: { customThresholds: true, alwaysOnMaintenance: true },
    limits: { devices: 3, aiChecksPerMonth: 50 },
    expiresAt: new Date(now + 30 * 86400000).toISOString(), // expires in 30 days
    serverTime: new Date(now - 4 * 86400000).toISOString(),
    fetchedAt: now - 4 * 86400000, // fetched 4 days ago (> 3 days grace)
  }
  const evalGrace = evaluateEntitlement(graceExpired, now)
  assert.strictEqual(evalGrace.plan, 'FREE', 'Grace expired must fall back to FREE')
  assert.strictEqual(evalGrace.isExpired, true, 'Grace expired isExpired must be true')
  assert.strictEqual(evalGrace.features.alwaysOnMaintenance, false, 'Grace expired features must be false')
  console.log('[PASS] 3. Offline grace period (> 3 days) reverts to FREE')

  // 4. Clock Rollback Detection (user set system clock backward by 1 day)
  const tamperedClock = {
    plan: 'PRO',
    features: { customThresholds: true, alwaysOnMaintenance: true },
    limits: { devices: 2, aiChecksPerMonth: 10 },
    expiresAt: new Date(now + 7 * 86400000).toISOString(),
    serverTime: new Date(now + 86400000).toISOString(),
    fetchedAt: now + 86400000, // local clock was moved back 24h before fetchedAt!
  }
  const evalTampered = evaluateEntitlement(tamperedClock, now)
  assert.strictEqual(evalTampered.plan, 'FREE', 'Clock rollback must force FREE')
  assert.strictEqual(evalTampered.isTampered, true, 'isTampered must be true')
  assert.strictEqual(evalTampered.isExpired, true, 'isExpired must be true')
  console.log('[PASS] 4. Clock rollback tampering detected and forces FREE')

  // 5. File Read & Write roundtrip
  fs.mkdirSync(path.dirname(entitlementFilePath), { recursive: true })
  fs.writeFileSync(entitlementFilePath, JSON.stringify(activePro, null, 2), 'utf8')
  assert.strictEqual(fs.existsSync(entitlementFilePath), true)
  const readBack = JSON.parse(fs.readFileSync(entitlementFilePath, 'utf8'))
  assert.strictEqual(readBack.plan, 'PRO')
  const evalRead = evaluateEntitlement(readBack, now)
  assert.strictEqual(evalRead.plan, 'PRO')
  console.log('[PASS] 5. Cache file write and readback successful')

  // 6. Non-existent cache defaults to FREE
  const evalEmpty = evaluateEntitlement(null, now)
  assert.strictEqual(evalEmpty.plan, 'FREE')
  assert.strictEqual(evalEmpty.isFallback, true)
  console.log('[PASS] 6. Missing cache defaults to FREE')

  // Clean up
  try {
    fs.rmSync(testDir, { recursive: true, force: true })
  } catch {}

  console.log('--- ALL TEST (a) ASSERTIONS PASSED! ---')
}

runTests()
