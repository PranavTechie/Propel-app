/**
 * test_logout_persistence.cjs
 *
 * Runs the REAL logout/startup code (transpiled on the fly with the project's
 * TypeScript compiler, no copies):
 *   src/services/auth/authLifecycle.ts      (startup rule + single logout)
 *   electron/services/auth/localAuthState.ts (on-disk auth state clearing)
 * against a mocked localStorage and real temp files.
 *
 * (a) after logout every persisted key/file is cleared
 * (b) startup with a cached entitlement but no session -> Login
 * (c) startup with a valid session still works
 * (d) offline startup with a valid session keeps the saved plan
 * (e) logout with backend failure still logs out locally + queues device release
 */
const assert = require('assert')
const fs = require('fs')
const fsp = require('fs/promises')
const os = require('os')
const path = require('path')
const ts = require('typescript')

function loadTs(relPath) {
  const file = path.join(__dirname, '..', relPath)
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const m = { exports: {} }
  new Function('module', 'exports', 'require', out)(m, m.exports, require)
  return m.exports
}

const life = loadTs('src/services/auth/authLifecycle.ts')
const disk = loadTs('electron/services/auth/localAuthState.ts')

class MemoryStorage {
  constructor(init = {}) { this.map = new Map(Object.entries(init)) }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
}

const SB_KEY = 'sb-xhimgqlewibpbilpfteb-auth-token'
const SESSION = { access_token: 'access-redacted', refresh_token: 'refresh-redacted', user: { email: 'u@example.com' } }

async function makeEnv() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'propel-logout-'))
  const paths = {
    entitlement: path.join(dir, 'propel_entitlement.json'),
    license: path.join(dir, 'propel_license.json'),
    deviceId: path.join(dir, 'propel_device_id.json'),
  }
  await fsp.writeFile(paths.entitlement, JSON.stringify({ plan: 'PRO', trial_active: true, fetchedAt: Date.now() }))
  await fsp.writeFile(paths.license, JSON.stringify({ key: 'license-redacted' }))
  await fsp.writeFile(paths.deviceId, JSON.stringify({ device_id: 'dev-123', registered_at: '2026-10-01T00:00:00Z' }))
  const storage = new MemoryStorage({
    [SB_KEY]: JSON.stringify(SESSION),
    [`${SB_KEY}-code-verifier`]: 'verifier-redacted',
    'propel-settings': '{"state":{"themeId":"dark"},"version":3}',
    'propel.ui.sidebarCollapsed': '1',
  })
  const memory = { session: SESSION, plan: 'PRO', phase: 'main' }
  return { dir, paths, storage, memory }
}

function depsFor(env, overrides = {}) {
  return {
    getAccessToken: () => env.memory.session?.access_token ?? null,
    getDeviceId: async () => 'dev-123',
    releaseDevice: async () => true,
    queueDeviceRelease: (id) =>
      env.storage.setItem(life.PENDING_DEVICE_RELEASE_KEY, JSON.stringify({ device_id: id })),
    signOutLocal: async () => env.storage.removeItem(SB_KEY),
    removeStoredSessions: () => life.removeStoredSessionKeys(env.storage),
    clearMainAuthFiles: () => disk.clearLocalAuthFilesAt(env.paths, fsp),
    resetMemory: () => { env.memory.session = null; env.memory.plan = 'FREE' },
    goToLogin: () => { env.memory.phase = 'login' },
    ...overrides,
  }
}

const exists = (p) => fs.existsSync(p)
const pass = (m) => console.log(`[PASS] ${m}`)

async function run() {
  console.log('--- STARTING LOGOUT PERSISTENCE TESTS ---')

  // ── (a) logout clears every persisted key/file ──────────────────────────
  {
    const env = await makeEnv()
    const logout = life.createLogout(depsFor(env))
    const res = await logout({ reason: 'user' })
    assert.strictEqual(res.released, true)
    assert.strictEqual(res.filesCleared, true)
    assert.strictEqual(env.storage.getItem(SB_KEY), null, 'supabase session key removed')
    assert.strictEqual(env.storage.getItem(`${SB_KEY}-code-verifier`), null, 'supabase verifier key removed')
    assert.strictEqual(life.readStoredSession(env.storage), null, 'no stored session left')
    assert.strictEqual(exists(env.paths.entitlement), false, 'propel_entitlement.json removed')
    assert.strictEqual(exists(env.paths.license), false, 'propel_license.json removed')
    const dev = JSON.parse(await fsp.readFile(env.paths.deviceId, 'utf8'))
    assert.strictEqual(dev.device_id, 'dev-123', 'stable device_id kept')
    assert.strictEqual('registered_at' in dev, false, 'device registration cleared')
    assert.strictEqual(env.memory.session, null, 'in-memory session reset')
    assert.strictEqual(env.memory.plan, 'FREE', 'in-memory plan reset')
    assert.strictEqual(env.memory.phase, 'login', 'login screen shown')
    assert.strictEqual(env.storage.getItem('propel-settings') !== null, true, 'device prefs (theme) kept')
    assert.strictEqual(env.storage.getItem(life.PENDING_DEVICE_RELEASE_KEY), null, 'nothing queued when release worked')
    pass('(a) logout clears session keys, cached entitlement, license file, device registration and memory')

    // Idempotent: concurrent calls share one run; a repeat call is harmless.
    let releases = 0
    const env2 = await makeEnv()
    const logout2 = life.createLogout(depsFor(env2, { releaseDevice: async () => { releases++; return true } }))
    const [r1, r2] = await Promise.all([logout2(), logout2()])
    assert.strictEqual(r1, r2, 'concurrent logouts share one run')
    assert.strictEqual(releases, 1, 'backend called once for concurrent logouts')
    await logout2()
    assert.strictEqual(exists(env2.paths.entitlement), false)
    pass('(a) logout is idempotent (concurrent + repeated calls)')

    // Startup after logout sees nothing that looks logged in.
    const after = life.decideStartup({
      session: null,
      storedSession: life.readStoredSession(env.storage),
      online: false,
      sessionErrorIsNetwork: true,
      cached: null,
    })
    assert.strictEqual(after.kind, 'login', 'restart after logout (even offline) shows Login')
    pass('(a) restart after logout -> Login, also offline')
  }

  // ── (b) cached entitlement but no session -> Login ──────────────────────
  {
    const cached = { plan: 'PRO', isFallback: false }
    for (const online of [true, false]) {
      const d = life.decideStartup({ session: null, storedSession: null, online, sessionErrorIsNetwork: !online, cached })
      assert.strictEqual(d.kind, 'login', `no session + cached PRO (${online ? 'online' : 'offline'}) -> login`)
    }
    // Stored session but refresh rejected by the server while ONLINE (revoked) -> login.
    const revoked = life.decideStartup({
      session: null,
      storedSession: SESSION,
      online: true,
      sessionErrorIsNetwork: false,
      cached,
    })
    assert.strictEqual(revoked.kind, 'login', 'revoked/expired session online -> login (no loop)')
    pass('(b) cached plan without a session never logs in (online, offline, revoked)')
  }

  // ── (c) valid session still works ──────────────────────────────────────
  {
    const d = life.decideStartup({
      session: SESSION,
      storedSession: SESSION,
      online: true,
      sessionErrorIsNetwork: false,
      cached: { plan: 'PRO', isFallback: false },
    })
    assert.strictEqual(d.kind, 'main-online')
    pass('(c) startup with a valid session -> app (online entitlement fetch)')
  }

  // ── (d) offline with a valid session keeps the saved plan ──────────────
  {
    const live = life.decideStartup({
      session: SESSION,
      storedSession: SESSION,
      online: false,
      sessionErrorIsNetwork: false,
      cached: { plan: 'PRO', isFallback: false },
    })
    assert.deepStrictEqual(live, { kind: 'main-offline', useCachedPlan: true, restoredFromStorage: false })
    // Access token expired while offline: the persisted session keeps grace.
    const expired = life.decideStartup({
      session: null,
      storedSession: SESSION,
      online: false,
      sessionErrorIsNetwork: true,
      cached: { plan: 'PRO', isFallback: false },
    })
    assert.deepStrictEqual(expired, { kind: 'main-offline', useCachedPlan: true, restoredFromStorage: true })
    const noCache = life.decideStartup({
      session: SESSION,
      storedSession: SESSION,
      online: false,
      sessionErrorIsNetwork: false,
      cached: { isFallback: true },
    })
    assert.strictEqual(noCache.kind, 'main-offline')
    assert.strictEqual(noCache.useCachedPlan, false, 'no cache -> FREE offline, still logged in')
    pass('(d) offline startup with a valid (or offline-expired) session keeps the saved plan')
  }

  // ── (e) backend failure: local logout + queued device release ──────────
  {
    const env = await makeEnv()
    const logout = life.createLogout(
      depsFor(env, {
        releaseDevice: async () => { throw new Error('network down') },
        signOutLocal: async () => { throw new Error('supabase failed') },
      }),
    )
    const res = await logout({ reason: 'user' })
    assert.strictEqual(res.released, false)
    assert.strictEqual(res.queued, true)
    assert.deepStrictEqual(
      JSON.parse(env.storage.getItem(life.PENDING_DEVICE_RELEASE_KEY)),
      { device_id: 'dev-123' },
      'device release queued for retry',
    )
    assert.strictEqual(env.storage.getItem(SB_KEY), null, 'tokens removed even though signOut threw')
    assert.strictEqual(exists(env.paths.entitlement), false, 'cached entitlement removed')
    assert.strictEqual(exists(env.paths.license), false, 'license file removed')
    assert.strictEqual(env.memory.phase, 'login', 'login screen shown')

    const env2 = await makeEnv()
    const res2 = await life.createLogout(depsFor(env2, { releaseDevice: async () => false }))()
    assert.strictEqual(res2.queued, true, 'non-2xx backend response also queues the release')
    pass('(e) backend/signOut failure still logs out locally and queues the device release')
  }

  console.log('\n--- ALL LOGOUT PERSISTENCE TESTS PASSED ---')
}

run().catch((err) => {
  console.error('[FAIL]', err && err.message ? err.message : err)
  process.exit(1)
})
