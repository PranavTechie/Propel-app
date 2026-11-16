import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Plans are one-time payments with fixed terms and never auto-renew.
 * Fails if any app source (src/ + electron/) claims otherwise.
 * Accurate negations ("no auto-renewal", "does not renew") are allowed.
 */

const ROOT = path.resolve(__dirname, '..', '..')
const DIRS = ['src', 'electron']
const SELF = path.resolve(__filename)

const FORBIDDEN: RegExp[] = [
  /cancel\s*any\s*time/i,
  /\brenews\b/i,
  /\bauto[- ]?renews\b/i,
  /\b(will|plan|subscription)\s+(automatically\s+)?renew\b/i,
  /\bsubscription\s+will\b/i,
  /\brecurring\s+(billing|payments?|charges?|subscription)\b/i,
  /\bbilled\s+(monthly|yearly|annually|every)\b/i,
  /\bcancel\s+(your\s+|the\s+|a\s+)?(plan|subscription)\b/i,
]

const ALLOWED: RegExp[] = [/\bno\s+(auto[- ]?renewal|recurring)\b/i, /\b(do|does|will)\s+not\s+(auto[- ]?)?renew\b/i]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(tsx?|jsx?|html|json)$/.test(entry.name) && path.resolve(full) !== SELF) out.push(full)
  }
  return out
}

describe('billing copy', () => {
  it('no "cancel anytime" / renews / recurring-billing claims in src/ or electron/', () => {
    const hits: string[] = []
    for (const d of DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (ALLOWED.some((re) => re.test(line))) return
          if (FORBIDDEN.some((re) => re.test(line))) {
            hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`)
          }
        })
      }
    }
    assert.deepStrictEqual(hits, [], 'forbidden billing claims:\n' + hits.join('\n'))
  })

  it('the patterns catch real claims and allow accurate negations', () => {
    const flagged = (s: string) => !ALLOWED.some((re) => re.test(s)) && FORBIDDEN.some((re) => re.test(s))
    for (const bad of ['Cancel anytime', 'Your plan renews on May 1', 'Subscription will renew', 'Billed monthly', 'Cancel your subscription']) {
      assert.ok(flagged(bad), bad)
    }
    for (const ok of ['One-time payment, no auto-renewal', 'Plans do not renew automatically', 'Recurring 4-hour update check', 'Cancel']) {
      assert.ok(!flagged(ok), ok)
    }
  })
})
