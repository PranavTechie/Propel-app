import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  isProtectedStartupName,
  isProtectedStartupPath,
  isProtectedStartupEntry,
  extractExecutablePath,
  expandEnvVars,
  resolveToggleTarget,
  type ProtectionContext,
  type StartupEntry,
} from '../startupAnalyzerService'

const ENV = {
  SystemRoot: 'C:\\WINDOWS',
  windir: 'C:\\WINDOWS',
  ProgramFiles: 'C:\\Program Files',
  ProgramData: 'C:\\ProgramData',
  LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
}

/** Fake filesystem: short (8.3) or existing paths -> canonical long path. */
const LONG_PATHS: Record<string, string> = {
  'c:\\progra~1\\window~1\\msascuil.exe': 'C:\\Program Files\\Windows Defender\\MSASCuiL.exe',
  'c:\\windows\\system32\\ctfmon.exe': 'C:\\Windows\\System32\\ctfmon.exe',
  'c:\\win~1': 'C:\\Windows',
  'c:\\win~1\\system32\\x.exe': 'C:\\Windows\\System32\\x.exe',
}
const CTX: ProtectionContext = { env: ENV, realpath: (p) => LONG_PATHS[p.toLowerCase()] ?? null }

function entry(
  location: StartupEntry['location'],
  name: string,
  command: string,
  isProtected = false,
): StartupEntry {
  return {
    id: `${location}_${name}`, name, displayName: name, command, location, enabled: true,
    impact: 'low', impactLabel: 'Low', estimatedDelaySec: 0, recommendation: '', publisher: '', isProtected,
  }
}

describe('protected by name', () => {
  it('matches SecurityHealth, SecurityHealthSystray and WindowsDefender* in any case or spacing', () => {
    for (const n of [
      'SecurityHealth', 'securityhealth', 'SECURITYHEALTH', ' Security Health ', 'Security\tHealth',
      'SecurityHealthSystray', 'securityHealthSysTray', 'Security Health Systray',
      'WindowsDefender', 'Windows Defender', 'windowsdefenderUI', 'WINDOWS DEFENDER notify',
    ]) {
      assert.strictEqual(isProtectedStartupName(n), true, n)
    }
  })

  it('does not match look-alikes or normal apps', () => {
    for (const n of ['SecurityHealthy', 'MySecurityHealth', 'MyWindowsDefenderTool', 'Defender', 'Discord', 'OneDrive', '']) {
      assert.strictEqual(isProtectedStartupName(n), false, n)
    }
  })
})

describe('protected by path', () => {
  it('protects programs under %SystemRoot% in any spelling', () => {
    for (const cmd of [
      '%windir%\\system32\\SecurityHealthSystray.exe',
      '%SYSTEMROOT%\\System32\\rundll32.exe shell32.dll,Control_RunDLL',
      '"C:\\Windows\\System32\\ctfmon.exe" /n',
      'c:/windows/system32/x.exe',
      'C:\\WINDOWS\\explorer.exe',
      '\\SystemRoot\\System32\\x.exe',
      '\\??\\C:\\Windows\\System32\\x.exe',
      'C:\\Program Files\\..\\Windows\\System32\\x.exe',
    ]) {
      assert.strictEqual(isProtectedStartupPath(cmd, CTX), true, cmd)
    }
  })

  it('protects programs in Windows Defender / Windows Security folders, quoted or not', () => {
    for (const cmd of [
      'C:\\Program Files\\Windows Defender\\MSASCuiL.exe',
      '"%ProgramFiles%\\Windows Security\\SecHealthUI.exe" -a',
      '%ProgramData%\\Microsoft\\windows defender\\Platform\\4.18\\MsMpEng.exe',
      'C:\\Program Files\\Windows  Defender\\x.exe',
    ]) {
      assert.strictEqual(isProtectedStartupPath(cmd, CTX), true, cmd)
    }
  })

  it('resolves 8.3 short names and bare System32 program names', () => {
    assert.strictEqual(isProtectedStartupPath('C:\\PROGRA~1\\WINDOW~1\\MSASCuiL.exe', CTX), true)
    assert.strictEqual(isProtectedStartupPath('ctfmon.exe', CTX), true)
    const shortRoot: ProtectionContext = { env: { SystemRoot: 'C:\\WIN~1' }, realpath: CTX.realpath }
    assert.strictEqual(isProtectedStartupPath('C:\\Windows\\System32\\x.exe', shortRoot), true)
    assert.strictEqual(isProtectedStartupPath('C:\\WIN~1\\System32\\x.exe', shortRoot), true)
  })

  it('leaves normal user programs and Windows look-alike folders toggleable', () => {
    for (const cmd of [
      '"C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe',
      '%LOCALAPPDATA%\\Microsoft\\OneDrive\\OneDrive.exe /background',
      'C:\\Program Files\\Spotify\\Spotify.exe',
      'C:\\Windows.old\\System32\\x.exe',
      'C:\\WindowsApps\\x.exe',
      'D:\\Windows\\x.exe',
      'unknown.exe',
      '',
    ]) {
      assert.strictEqual(isProtectedStartupPath(cmd, CTX), false, cmd)
    }
  })

  it('combines name and path checks', () => {
    assert.strictEqual(isProtectedStartupEntry('SecurityHealth', 'C:\\Users\\me\\x.exe', CTX), true)
    assert.strictEqual(isProtectedStartupEntry('Foo', 'C:\\Windows\\foo.exe', CTX), true)
    assert.strictEqual(isProtectedStartupEntry('Discord', 'C:\\Users\\me\\Discord.exe', CTX), false)
  })

  it('parses commands and env vars', () => {
    assert.strictEqual(extractExecutablePath('"C:\\A B\\c.exe" -x'), 'C:\\A B\\c.exe')
    assert.strictEqual(extractExecutablePath('C:\\A B\\c.exe -x "y"'), 'C:\\A B\\c.exe')
    assert.strictEqual(expandEnvVars('%WINDIR%\\x %Nope%', ENV), 'C:\\WINDOWS\\x %Nope%')
  })
})

describe('resolveToggleTarget (main-process refusal)', () => {
  const scanned = [
    entry('HKLM_Run', 'SecurityHealth', '%windir%\\system32\\SecurityHealthSystray.exe', true),
    entry('HKCU_Run', 'Ctf', 'C:\\Windows\\System32\\ctfmon.exe', true),
    entry('HKCU_Run', 'SysNoFlag', 'C:\\Windows\\System32\\x.exe', false),
    entry('HKCU_Run', 'Discord', '"C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe'),
  ]
  const reader = (calls: string[]) => async (location: StartupEntry['location']) => {
    calls.push(location)
    return scanned.filter(e => e.location === location)
  }

  it('refuses a protected name without reading the system', async () => {
    const calls: string[] = []
    const res = await resolveToggleTarget(
      { ...entry('HKLM_Run', 'securityhealth', 'C:\\Users\\me\\fake.exe'), isProtected: false },
      false,
      reader(calls),
    )
    assert.deepStrictEqual(res, { ok: false, code: 'PROTECTED_ENTRY' })
    assert.deepStrictEqual(calls, [])
  })

  it('refuses when the scan marks the entry protected, whatever the renderer claims', async () => {
    const res = await resolveToggleTarget(
      { ...entry('HKCU_Run', 'Ctf', 'C:\\Users\\me\\innocent.exe'), isProtected: false },
      false,
      reader([]),
    )
    assert.deepStrictEqual(res, { ok: false, code: 'PROTECTED_ENTRY' })
  })

  it('re-checks the scanned command even if the protected flag is missing', async () => {
    const res = await resolveToggleTarget(entry('HKCU_Run', 'SysNoFlag', 'x'), true, reader([]))
    assert.deepStrictEqual(res, { ok: false, code: 'PROTECTED_ENTRY' })
  })

  it('lets a normal user item through, using the scanned entry', async () => {
    const res = await resolveToggleTarget(entry('HKCU_Run', 'Discord', 'C:\\evil.exe'), false, reader([]))
    assert.strictEqual(res.ok, true)
    if (res.ok) {
      assert.strictEqual(res.entry, scanned[3])
      assert.strictEqual(res.entry.isProtected, false)
    }
  })

  it('returns clear codes for bad or unknown requests', async () => {
    assert.deepStrictEqual(await resolveToggleTarget(entry('HKCU_Run', 'Discord', 'x'), 'yes', reader([])), { ok: false, code: 'INVALID_REQUEST' })
    assert.deepStrictEqual(await resolveToggleTarget({ location: 'Nope', name: 'x' }, true, reader([])), { ok: false, code: 'INVALID_REQUEST' })
    assert.deepStrictEqual(await resolveToggleTarget(entry('HKCU_Run', 'Ghost', 'x'), true, reader([])), { ok: false, code: 'NOT_FOUND' })
  })
})
