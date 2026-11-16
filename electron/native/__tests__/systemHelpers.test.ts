import { describe, it } from 'node:test'
import assert from 'node:assert'
import { sanitizeDeviceName, DEVICE_NAME_MAX_LENGTH, DEFAULT_DEVICE_NAME } from '../systemHelpers'

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
