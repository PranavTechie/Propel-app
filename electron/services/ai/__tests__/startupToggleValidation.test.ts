import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseStartupToggleRequest,
  matchScannedEntry,
  isDirectStartupFolderFile,
  startupFileKey,
  type StartupEntry,
} from '../startupAnalyzerService'

const USER_FOLDER = 'C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'

function entry(location: StartupEntry['location'], name: string, command: string): StartupEntry {
  return {
    id: `${location}_${name}`, name, displayName: name, command, location, enabled: true,
    impact: 'low', impactLabel: 'Low', estimatedDelaySec: 0, recommendation: '', publisher: '',
  }
}

describe('parseStartupToggleRequest', () => {
  it('accepts a registry entry and keeps only location and name', () => {
    const req = parseStartupToggleRequest(entry('HKCU_Run', 'Discord', 'C:\\evil.exe'))
    assert.deepStrictEqual(req, { location: 'HKCU_Run', name: 'Discord' })
  })

  it('accepts a startup folder entry with a .lnk/.exe file, with or without .disabled', () => {
    assert.deepStrictEqual(
      parseStartupToggleRequest(entry('StartupFolder_User', 'App', `${USER_FOLDER}\\App.lnk.disabled`)),
      { location: 'StartupFolder_User', name: 'App', fileKey: 'app.lnk' },
    )
    assert.strictEqual(
      parseStartupToggleRequest(entry('StartupFolder_All', 'Tool', 'D:\\x\\Tool.EXE'))?.fileKey,
      'tool.exe',
    )
  })

  it('rejects malformed input', () => {
    const bad: unknown[] = [
      null, undefined, 'HKCU_Run', 42, [],
      { location: 'HKCU_RunOnce', name: 'x', command: 'y' },
      { location: 'HKCU_Run', name: '' },
      { location: 'HKCU_Run', name: '   ' },
      { location: 'HKCU_Run', name: 'a\u0000b' },
      { location: 'HKCU_Run', name: 'x'.repeat(261) },
      { location: 'HKCU_Run', name: 5 },
      { location: 'StartupFolder_User', name: 'App' },
      { location: 'StartupFolder_User', name: 'App', command: 'C:\\Windows\\System32\\drivers\\etc\\hosts' },
      { location: 'StartupFolder_User', name: 'App', command: `${USER_FOLDER}\\notes.txt.disabled` },
      { location: 'StartupFolder_User', name: 'App', command: `${USER_FOLDER}\\..` },
    ]
    for (const b of bad) assert.strictEqual(parseStartupToggleRequest(b), null, JSON.stringify(b))
  })
})

describe('startupFileKey', () => {
  it('normalizes the file name', () => {
    assert.strictEqual(startupFileKey(`${USER_FOLDER}\\Foo.LNK`), 'foo.lnk')
    assert.strictEqual(startupFileKey(`${USER_FOLDER}\\Foo.lnk.DISABLED`), 'foo.lnk')
    assert.strictEqual(startupFileKey('Foo.exe'), 'foo.exe')
  })

  it('rejects other file types and odd names', () => {
    for (const bad of ['', 'foo.bat', 'foo.ps1', 'foo', '.lnk', 'C:\\dir\\', 'a\u0007.lnk']) {
      assert.strictEqual(startupFileKey(bad), null, bad)
    }
  })
})

describe('matchScannedEntry', () => {
  const scanned = [
    entry('HKCU_Run', 'Discord', '"C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe'),
    entry('HKLM_Run', 'Discord', 'C:\\Program Files\\Discord\\x.exe'),
    entry('StartupFolder_User', 'App', `${USER_FOLDER}\\App.lnk.disabled`),
    entry('StartupFolder_User', 'Dup', `${USER_FOLDER}\\Dup.lnk`),
    entry('StartupFolder_User', 'Dup', `${USER_FOLDER}\\Dup.exe`),
  ]

  it('returns the scanned entry, so the command comes from the system, not the renderer', () => {
    const req = parseStartupToggleRequest(entry('HKCU_Run', 'Discord', 'C:\\evil.exe'))!
    const found = matchScannedEntry(req, scanned)
    assert.strictEqual(found, scanned[0])
    assert.ok(!found!.command.includes('evil'))
  })

  it('matches a folder entry even when the renderer still has the pre-toggle path', () => {
    const req = parseStartupToggleRequest(entry('StartupFolder_User', 'App', `${USER_FOLDER}\\App.lnk`))!
    assert.strictEqual(matchScannedEntry(req, scanned), scanned[2])
  })

  it('tells same-named folder items apart by file name', () => {
    const req = parseStartupToggleRequest(entry('StartupFolder_User', 'Dup', `${USER_FOLDER}\\Dup.exe`))!
    assert.strictEqual(matchScannedEntry(req, scanned), scanned[4])
  })

  it('refuses entries that are not in the scan or point at a file outside it', () => {
    const missing = parseStartupToggleRequest(entry('HKCU_Run', 'NotThere', 'x'))!
    assert.strictEqual(matchScannedEntry(missing, scanned), null)
    const wrongLocation = parseStartupToggleRequest(entry('StartupFolder_All', 'App', `${USER_FOLDER}\\App.lnk`))!
    assert.strictEqual(matchScannedEntry(wrongLocation, scanned), null)
    const otherFile = parseStartupToggleRequest(entry('StartupFolder_User', 'App', 'C:\\Windows\\App.exe'))!
    assert.strictEqual(matchScannedEntry(otherFile, scanned), null)
  })
})

describe('isDirectStartupFolderFile', () => {
  it('allows .lnk/.exe files directly inside the folder (case-insensitive)', () => {
    assert.ok(isDirectStartupFolderFile(USER_FOLDER, `${USER_FOLDER}\\App.lnk`))
    assert.ok(isDirectStartupFolderFile(USER_FOLDER, `${USER_FOLDER}\\App.lnk.disabled`))
    assert.ok(isDirectStartupFolderFile(USER_FOLDER + '\\', `${USER_FOLDER.toLowerCase()}\\app.exe`))
  })

  it('refuses paths outside the folder, traversal, subfolders and other file types', () => {
    const bad = [
      'C:\\Windows\\System32\\cmd.exe',
      `${USER_FOLDER}\\..\\evil.lnk`,
      `${USER_FOLDER}\\sub\\App.lnk`,
      `${USER_FOLDER}\\desktop.ini`,
      `${USER_FOLDER}\\script.bat.disabled`,
      'App.lnk',
      `${USER_FOLDER}Evil\\App.lnk`,
    ]
    for (const b of bad) assert.strictEqual(isDirectStartupFolderFile(USER_FOLDER, b), false, b)
  })
})
