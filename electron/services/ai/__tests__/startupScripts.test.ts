import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  psDecode,
  buildRegistryReadScript,
  buildRegistrySetScript,
  buildFolderEnableScript,
  buildFolderDisableScript,
  type StartupEntry,
} from '../startupAnalyzerService'

const B64_LITERAL = /FromBase64String\('([^']*)'\)/g

/** All values the script decodes from base64, in order. */
function decodedValues(script: string): string[] {
  return [...script.matchAll(B64_LITERAL)].map((m) => {
    assert.match(m[1], /^[A-Za-z0-9+/=]*$/, 'base64 literal must only contain base64 characters')
    return Buffer.from(m[1], 'base64').toString('utf8')
  })
}

/** Single-quoted literals that remain once the base64 literals are removed. */
function otherQuotedLiterals(script: string): string[] {
  return [...script.replace(B64_LITERAL, 'FromBase64String(B64)').matchAll(/'([^']*)'/g)].map((m) => m[1])
}

const EVIL_NAME = `a'; Remove-Item -Recurse -Force C:\\; 'b`
const EVIL_BASE = `x$(Start-Process calc)'.lnk`
const FOLDER_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'

function entry(location: StartupEntry['location'], name: string, command: string): StartupEntry {
  return {
    id: `${location}_${name}`, name, displayName: name, command, location, enabled: true,
    impact: 'low', impactLabel: 'Low', estimatedDelaySec: 0, recommendation: '', publisher: '',
  }
}

describe('startupAnalyzerService PowerShell scripts', () => {
  it('psDecode round-trips quotes, $ and non-ASCII text', () => {
    const value = `O'Brien $env:USERNAME "x" ü 日本`
    assert.deepStrictEqual(decodedValues(psDecode(value)), [value])
  })

  it('StartupFolder enable: names travel only as base64', () => {
    const script = buildFolderEnableScript(EVIL_NAME, EVIL_BASE)
    assert.ok(!script.includes(EVIL_NAME), 'raw entry.name must not appear')
    assert.ok(!script.includes(EVIL_BASE), 'raw baseName must not appear')
    assert.deepStrictEqual(decodedValues(script), [FOLDER_HIVE, EVIL_NAME, EVIL_BASE])
    assert.deepStrictEqual(otherQuotedLiterals(script), ['.lnk'])
  })

  it('StartupFolder disable: baseName travels only as base64', () => {
    const script = buildFolderDisableScript(EVIL_BASE)
    assert.ok(!script.includes(EVIL_BASE))
    assert.deepStrictEqual(decodedValues(script), [FOLDER_HIVE, EVIL_BASE])
    assert.deepStrictEqual(otherQuotedLiterals(script), [])
  })

  it('registry set: name, command and key paths travel only as base64', () => {
    const cmd = `"C:\\Program Files\\App\\app.exe" --x '$(evil)'`
    for (const enabled of [true, false]) {
      const script = buildRegistrySetScript(entry('HKLM_Run', EVIL_NAME, cmd), enabled, true)
      assert.ok(!script.includes(EVIL_NAME))
      assert.ok(!script.includes(cmd))
      assert.deepStrictEqual(decodedValues(script), [
        EVIL_NAME,
        cmd,
        'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32',
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
      ])
      assert.deepStrictEqual(otherQuotedLiterals(script), [])
      assert.ok(script.includes('RequiresAdmin'), 'admin check included when required')
    }
  })

  it('registry read: key paths travel only as base64', () => {
    const script = buildRegistryReadScript('HKCU', 'HKCU_Run')
    assert.deepStrictEqual(decodedValues(script), [
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
    ])
    // Only fixed PowerShell constants remain quoted; no data.
    assert.deepStrictEqual(otherQuotedLiterals(script), ['NoteProperty', '^PS'])
  })
})
