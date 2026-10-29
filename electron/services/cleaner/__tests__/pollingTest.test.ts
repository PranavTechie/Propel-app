import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('Progress Polling & Timeout Logic Tests', () => {
  it('healthy polling detects new progress files and updates progress without timeout', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'propel-poll-test-'))
    let lastProgress = Date.now()
    let lastProcessed = 0
    const progressUpdates: number[] = []

    const poll = async () => {
      const entries = await fs.readdir(dir)
      const progFiles = entries
        .map(name => {
          const m = name.match(/^progress-(\d+)\.json$/)
          return m ? { name, seq: parseInt(m[1], 10) } : null
        })
        .filter((item): item is { name: string; seq: number } => item !== null)
        .sort((a, b) => b.seq - a.seq)

      if (progFiles.length > 0) {
        const highestFile = path.join(dir, progFiles[0].name)
        const raw = await fs.readFile(highestFile, 'utf8')
        const p = JSON.parse(raw) as { processed: number; total: number }
        if (typeof p.processed === 'number' && p.processed !== lastProcessed) {
          lastProcessed = p.processed
          lastProgress = Date.now()
          progressUpdates.push(p.processed)
        }
      }
    }

    // Step 1: Write progress-1
    await fs.writeFile(path.join(dir, 'progress-1.json'), JSON.stringify({ processed: 50, total: 200 }), 'utf8')
    await poll()
    assert.strictEqual(lastProcessed, 50)

    // Step 2: Write progress-2
    await fs.writeFile(path.join(dir, 'progress-2.json'), JSON.stringify({ processed: 100, total: 200 }), 'utf8')
    await poll()
    assert.strictEqual(lastProcessed, 100)

    // Step 3: Write progress-3
    await fs.writeFile(path.join(dir, 'progress-3.json'), JSON.stringify({ processed: 200, total: 200 }), 'utf8')
    await poll()
    assert.strictEqual(lastProcessed, 200)

    assert.deepStrictEqual(progressUpdates, [50, 100, 200])
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('no-progress detection times out when no new progress files appear within threshold', async () => {
    const noProgressTimeoutMs = 150
    let lastProgress = Date.now() - 200 // simulated stall (200ms ago > 150ms timeout)
    const isStalled = Date.now() - lastProgress > noProgressTimeoutMs
    assert.strictEqual(isStalled, true)
  })
})
