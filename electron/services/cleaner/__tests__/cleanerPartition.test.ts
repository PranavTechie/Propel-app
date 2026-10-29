import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  chunkArray,
  encodePS1,
  isPathInAdminAllowlist,
  buildElevatedScript,
} from '../cleanupService'
import { ADMIN_CATEGORY_IDS } from '../../../ipc/cleaner/cleanerHandlers'

describe('Cleaner Security & Partition Logic Tests', () => {
  const fakeSysRoot = 'C:\\Windows'

  it('chunkArray partitions arrays correctly', () => {
    const list = Array.from({ length: 750 }, (_, i) => i)
    const chunks = chunkArray(list, 300)
    assert.strictEqual(chunks.length, 3)
    assert.strictEqual(chunks[0].length, 300)
    assert.strictEqual(chunks[1].length, 300)
    assert.strictEqual(chunks[2].length, 150)
  })

  it('encodePS1 produces valid base64 UTF-16LE', () => {
    const script = 'Write-Output "Test"'
    const encoded = encodePS1(script)
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le')
    assert.strictEqual(decoded, script)
  })

  it('ADMIN_CATEGORY_IDS contains only system categories', () => {
    assert.ok(ADMIN_CATEGORY_IDS.has('windows-logs'))
    assert.ok(ADMIN_CATEGORY_IDS.has('win-update-cache'))
    assert.ok(ADMIN_CATEGORY_IDS.has('prefetch'))
    assert.ok(ADMIN_CATEGORY_IDS.has('delivery-opt'))
    assert.ok(!ADMIN_CATEGORY_IDS.has('temp-files'))
    assert.ok(!ADMIN_CATEGORY_IDS.has('browser-cache'))
    assert.ok(!ADMIN_CATEGORY_IDS.has('recycle-bin'))
  })

  it('isPathInAdminAllowlist accepts exact valid paths under admin roots', () => {
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\Prefetch\\NOTEPAD.EXE-12345.pf', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\SoftwareDistribution\\Download\\somefile.bin', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\SoftwareDistribution\\DeliveryOptimization\\cache.dat', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\Logs\\CBS\\CBS.log', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\Logs\\DISM\\dism.log', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\Windows\\Temp\\tempfile.tmp', fakeSysRoot))
  })

  it('isPathInAdminAllowlist handles case insensitivity', () => {
    assert.ok(isPathInAdminAllowlist('c:\\windows\\prefetch\\notepad.pf', fakeSysRoot))
    assert.ok(isPathInAdminAllowlist('C:\\WINDOWS\\LOGS\\CBS\\CBS.LOG', fakeSysRoot))
  })

  it('isPathInAdminAllowlist rejects empty, null or whitespace paths', () => {
    assert.strictEqual(isPathInAdminAllowlist('', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('   ', fakeSysRoot), false)
    // @ts-expect-error testing invalid type
    assert.strictEqual(isPathInAdminAllowlist(null, fakeSysRoot), false)
  })

  it('isPathInAdminAllowlist rejects UNC paths', () => {
    assert.strictEqual(isPathInAdminAllowlist('\\\\server\\share\\Windows\\Prefetch\\test.pf', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('\\\\127.0.0.1\\c$\\Windows\\Temp\\test.tmp', fakeSysRoot), false)
  })

  it('isPathInAdminAllowlist rejects other drives', () => {
    assert.strictEqual(isPathInAdminAllowlist('D:\\Windows\\Prefetch\\test.pf', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('E:\\SoftwareDistribution\\Download\\file.bin', fakeSysRoot), false)
  })

  it('isPathInAdminAllowlist rejects path traversal attempts', () => {
    assert.strictEqual(isPathInAdminAllowlist('C:\\Windows\\Prefetch\\..\\System32\\cmd.exe', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('C:\\Windows\\Temp\\..\\..\\Windows\\System32\\drivers\\etc\\hosts', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('C:\\Windows\\Logs\\CBS\\..\\..\\explorer.exe', fakeSysRoot), false)
  })

  it('isPathInAdminAllowlist rejects user-owned paths', () => {
    assert.strictEqual(isPathInAdminAllowlist('C:\\Users\\John\\AppData\\Local\\Temp\\junk.tmp', fakeSysRoot), false)
    assert.strictEqual(isPathInAdminAllowlist('C:\\Program Files\\App\\cache.dat', fakeSysRoot), false)
  })

  it('buildElevatedScript embeds configuration options and includes security checks', () => {
    const script = buildElevatedScript({
      inputPath: 'C:\\temp\\in.json',
      outputPath: 'C:\\temp\\out.json',
      progressPrefix: 'C:\\temp\\prog',
      cancelPath: 'C:\\temp\\cancel',
      startedPath: 'C:\\temp\\started',
      maxRuntimeSec: 120,
    })

    assert.ok(script.includes('$InputPath     ='))
    assert.ok(script.includes('$StartedPath   ='))
    assert.ok(script.includes('Test-AdminAllowed'))
    assert.ok(script.includes('ReparsePoint'))
    assert.ok(script.includes('Remove-Item -LiteralPath $p -Force'))
    assert.ok(script.includes('$MaxSec        = 120'))
    assert.ok(script.includes('$items.Count -gt 5000'))
  })
})
