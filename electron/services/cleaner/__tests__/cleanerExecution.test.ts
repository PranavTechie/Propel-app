import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { cleanFiles } from '../cleanupService'

describe('cleanFiles Real Execution Tests', () => {
  it('successfully deletes multiple files and accurately calculates freed bytes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propel-test-clean-'))
    const f1 = path.join(dir, 'test1.tmp')
    const f2 = path.join(dir, 'test2.tmp')
    const f3 = path.join(dir, 'test3.tmp')

    const buf1 = Buffer.alloc(1024, 'a')
    const buf2 = Buffer.alloc(2048, 'b')
    const buf3 = Buffer.alloc(4096, 'c')

    fs.writeFileSync(f1, buf1)
    fs.writeFileSync(f2, buf2)
    fs.writeFileSync(f3, buf3)

    const files = [
      { path: f1, size: 1024 },
      { path: f2, size: 2048 },
      { path: f3, size: 4096 },
    ]

    const progressUpdates: number[] = []
    const stats = await cleanFiles(files, (info) => {
      progressUpdates.push(info.freed)
    })

    assert.strictEqual(stats.removed, 3)
    assert.strictEqual(stats.freed, 7168)
    assert.strictEqual(stats.errors, 0)
    assert.strictEqual(fs.existsSync(f1), false)
    assert.strictEqual(fs.existsSync(f2), false)
    assert.strictEqual(fs.existsSync(f3), false)
    assert.strictEqual(progressUpdates.length, 3)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('handles a mix of normal, missing, and locked files correctly', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propel-test-mix-'))
    const fNormal = path.join(dir, 'normal.tmp')
    const fMissing = path.join(dir, 'missing.tmp')
    const fLocked = path.join(dir, 'locked.tmp')

    fs.writeFileSync(fNormal, Buffer.alloc(512, 'x'))
    fs.writeFileSync(fLocked, Buffer.alloc(512, 'y'))

    // Lock fLocked using powershell exclusive lock
    const locker = spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$s = [System.IO.File]::Open('${fLocked.replace(/'/g, "''")}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None); Start-Sleep -Seconds 6; $s.Close()`
    ])

    await new Promise(r => setTimeout(r, 1200))

    const files = [
      { path: fNormal, size: 512 },
      { path: fMissing, size: 512 },
      { path: fLocked, size: 512 },
    ]

    const stats = await cleanFiles(files, () => {})

    locker.kill()
    await new Promise(r => setTimeout(r, 600))

    assert.strictEqual(stats.removed, 1)
    assert.strictEqual(stats.freed, 512)
    assert.strictEqual(stats.missing.length, 1)
    assert.strictEqual(stats.missing[0].path.toLowerCase(), fMissing.toLowerCase())
    assert.strictEqual(fs.existsSync(fNormal), false)
    assert.strictEqual(fs.existsSync(fLocked), true)

    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // If OS hasn't fully released handle yet, ignore
    }
  })

  it('exercises real 600-file chunking plus locked and missing files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propel-test-600-'))
    const fileCount = 600
    const fileSizeBytes = 10
    const files: { path: string; size: number }[] = []

    for (let i = 0; i < fileCount; i++) {
      const fp = path.join(dir, `chunkfile-${i}.tmp`)
      fs.writeFileSync(fp, Buffer.alloc(fileSizeBytes, 0x41))
      files.push({ path: fp, size: fileSizeBytes })
    }

    const fLocked = path.join(dir, 'locked-600.tmp')
    fs.writeFileSync(fLocked, Buffer.alloc(100, 0x4c))
    const locker = spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$s = [System.IO.File]::Open('${fLocked.replace(/'/g, "''")}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None); Start-Sleep -Seconds 8; $s.Close()`
    ])
    await new Promise(r => setTimeout(r, 1200))
    files.push({ path: fLocked, size: 100 })

    const fMissing = path.join(dir, 'missing-600.tmp')
    files.push({ path: fMissing, size: 50 })

    const stats = await cleanFiles(files, () => {})

    locker.kill()
    await new Promise(r => setTimeout(r, 600))

    assert.strictEqual(stats.removed, fileCount, `Exactly ${fileCount} files must be removed across chunks`)
    assert.strictEqual(stats.freed, fileCount * fileSizeBytes, `Freed bytes must equal ${fileCount * fileSizeBytes}`)
    assert.strictEqual(stats.errors, 2, 'Must have exactly 2 errors (locked and missing)')
    assert.strictEqual(stats.resultParsed, true, 'Result file must be parsed successfully across all chunks')
    assert.strictEqual(stats.countsByKind.locked, 1, 'Exactly 1 locked file')
    assert.strictEqual(stats.countsByKind.missing, 1, 'Exactly 1 missing file')
    assert.strictEqual(stats.countsByKind['permission-denied'], 0)
    assert.strictEqual(stats.countsByKind['result-unreadable'], 0)
    assert.ok(stats.firstError, 'First error message must be present')

    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // Ignore if handle still held by OS
    }
  })
})
