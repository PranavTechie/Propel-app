import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  sanitizeDeviceName,
  DEVICE_NAME_MAX_LENGTH,
  DEFAULT_DEVICE_NAME,
  OPTIMIZE_DRIVE_TIMEOUT_MS,
  normalizeDriveLetter,
  buildOptimizeVolumeArgs,
  describeOptimizeResult,
} from '../systemHelpers'

describe('optimizeDrive helpers', () => {
  it('builds Optimize-Volume args without forcing -Defrag or -ReTrim', () => {
    const args = buildOptimizeVolumeArgs('C')
    assert.deepStrictEqual(args, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Optimize-Volume -DriveLetter C -ErrorAction Stop',
    ])
    const joined = args.join(' ')
    assert.ok(!/-Defrag\b/i.test(joined), 'no -Defrag')
    assert.ok(!/-ReTrim\b/i.test(joined), 'no -ReTrim')
  })

  it('refuses anything that is not a single upper-case letter', () => {
    for (const bad of ['', 'CD', 'c', 'C;', 'C -Defrag', '1']) {
      assert.throws(() => buildOptimizeVolumeArgs(bad), /Invalid drive letter/, bad)
    }
  })

  it('normalizes drive letter input and rejects injection attempts', () => {
    assert.strictEqual(normalizeDriveLetter(undefined), 'C')
    assert.strictEqual(normalizeDriveLetter('c'), 'C')
    assert.strictEqual(normalizeDriveLetter('D:'), 'D')
    assert.strictEqual(normalizeDriveLetter('E:\\'), 'E')
    for (const bad of ['C:D', 'CD', 'C; Remove-Item x', '', '1', 5, null, {}]) {
      assert.strictEqual(normalizeDriveLetter(bad as unknown), null, String(bad))
    }
  })

  it('uses a 10-minute timeout', () => {
    assert.strictEqual(OPTIMIZE_DRIVE_TIMEOUT_MS, 600000)
  })

  it('returns clear messages and never the raw error', () => {
    const ok = describeOptimizeResult('C', null)
    assert.strictEqual(ok.success, true)
    assert.match(ok.message!, /Drive C: optimized/)

    const timedOut = describeOptimizeResult('C', { killed: true, signal: 'SIGTERM' })
    assert.strictEqual(timedOut.success, false)
    assert.match(timedOut.error!, /longer than 10 minutes/)

    const failed = describeOptimizeResult('D', { code: 1 })
    assert.strictEqual(failed.success, false)
    assert.match(failed.error!, /Could not optimize drive D:/)
    assert.ok(!/Command failed|powershell/i.test(failed.error!))
  })
})

describe('sanitizeDeviceName', () => {
  it('keeps a normal hostname', () => {
    assert.strictEqual(sanitizeDeviceName('DESKTOP-AB12CD'), 'DESKTOP-AB12CD')
  })

  it('caps the name at 100 characters', () => {
    const out = sanitizeDeviceName('x'.repeat(250))
    assert.strictEqual(out.length, DEVICE_NAME_MAX_LENGTH)
  })

  it('removes control characters and trims', () => {
    assert.strictEqual(sanitizeDeviceName('  PC\u0000-\u001fONE\u007f\n '), 'PC-ONE')
  })

  it('falls back for empty, blank or missing names', () => {
    assert.strictEqual(sanitizeDeviceName(''), DEFAULT_DEVICE_NAME)
    assert.strictEqual(sanitizeDeviceName('   '), DEFAULT_DEVICE_NAME)
    assert.strictEqual(sanitizeDeviceName(undefined), DEFAULT_DEVICE_NAME)
    assert.strictEqual(sanitizeDeviceName(null), DEFAULT_DEVICE_NAME)
  })
})
