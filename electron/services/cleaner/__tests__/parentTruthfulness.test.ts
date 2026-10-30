import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveTruthfulResults, type BatchDeleteResult } from '../cleanupService'
import { sanitizeErrorMessage, countErrorsByKind } from '../cleanerLogger'

describe('Parent-Side Truthfulness Tests', () => {
  it('correctly resolves truth on disk when result data is missing or incomplete', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propel-truth-test-'))
    const fDeleted = path.join(dir, 'already-gone.tmp')
    const fStillExists = path.join(dir, 'still-here.tmp')

    // Create only the file that still exists; fDeleted is not created (or already removed)
    fs.writeFileSync(fStillExists, 'content remains')

    const files = [
      { path: fDeleted, size: 100 },
      { path: fStillExists, size: 200 },
    ]

    // Simulate an incomplete result list where neither file has an entry (e.g. unreadable/corrupted output.json)
    const incompleteResults: BatchDeleteResult[] = []

    const resolved = await resolveTruthfulResults(files, incompleteResults, 'Worker did not return data')

    assert.strictEqual(resolved.length, 2)

    const rDeleted = resolved.find(r => r.path.toLowerCase() === fDeleted.toLowerCase())
    assert.ok(rDeleted, 'Should have result for fDeleted')
    assert.strictEqual(rDeleted.ok, true, 'File that no longer exists must be marked truthfully as removed (ok=true)')

    const rStillExists = resolved.find(r => r.path.toLowerCase() === fStillExists.toLowerCase())
    assert.ok(rStillExists, 'Should have result for fStillExists')
    assert.strictEqual(rStillExists.ok, false, 'File that still exists on disk must be marked as failed (ok=false)')
    assert.strictEqual(rStillExists.kind, 'unknown', 'Missing result data for existing file must use kind unknown')
    assert.strictEqual(rStillExists.reason, 'Worker did not return data')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('preserves existing results from worker when present', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'propel-truth-pres-'))
    const f1 = path.join(dir, 'f1.tmp')
    const f2 = path.join(dir, 'f2.tmp')

    fs.writeFileSync(f1, '1')
    fs.writeFileSync(f2, '2')

    const files = [
      { path: f1, size: 10 },
      { path: f2, size: 20 },
    ]

    const workerResults: BatchDeleteResult[] = [
      { path: f1, ok: true },
      { path: f2, ok: false, kind: 'locked', reason: 'File locked by test' },
    ]

    const resolved = await resolveTruthfulResults(files, workerResults)

    assert.strictEqual(resolved[0].ok, true)
    assert.strictEqual(resolved[1].ok, false)
    assert.strictEqual(resolved[1].kind, 'locked')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('sanitizeErrorMessage strips Windows drive paths, UNC paths, and usernames', () => {
    const user = process.env.USERNAME || 'testuser'
    const raw = `Access denied to C:\\Users\\${user}\\AppData\\Local\\Temp\\junk.tmp when running for ${user}`
    const sanitized = sanitizeErrorMessage(raw)

    assert.strictEqual(sanitized.includes(user), false, 'Username must be stripped')
    assert.strictEqual(sanitized.includes('C:\\Users'), false, 'Path must be stripped')
    assert.ok(sanitized.includes('<path>'), 'Should contain <path>')
    assert.ok(sanitized.includes('<user>'), 'Should contain <user>')

    const uncRaw = 'Cannot open \\\\fileserver\\shared\\log.txt'
    const uncSanitized = sanitizeErrorMessage(uncRaw)
    assert.strictEqual(uncSanitized.includes('\\\\fileserver'), false)
    assert.ok(uncSanitized.includes('<path>'))
  })

  it('countErrorsByKind categorizes all failure kinds accurately', () => {
    const errors = [
      { kind: 'locked', reason: 'in use' },
      { kind: 'locked', reason: 'locked' },
      { kind: 'permission-denied', reason: 'access denied' },
      { kind: 'missing', reason: 'not found' },
      { kind: 'rejected', reason: 'security check' },
      { kind: 'other', reason: 'unknown error' },
    ]

    const counts = countErrorsByKind(errors, 1)

    assert.strictEqual(counts.locked, 2)
    assert.strictEqual(counts['permission-denied'], 1)
    assert.strictEqual(counts.missing, 1)
    assert.strictEqual(counts['validation-rejected'], 1)
    assert.strictEqual(counts['result-unreadable'], 1)
    assert.strictEqual(counts.other, 1)
  })
})
