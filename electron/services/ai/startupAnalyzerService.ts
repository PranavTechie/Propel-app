import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

/**
 * PowerShell expression that yields `value`. The value travels as base64 (only
 * [A-Za-z0-9+/=]) inside a single-quoted literal and is decoded by the script,
 * so names and paths can never break out of the string or inject commands.
 * Every name or path placed into a script in this file must go through this.
 */
export function psDecode(value: string): string {
  const b64 = Buffer.from(String(value), 'utf8').toString('base64')
  return `([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')))`
}

const RUN_APPROVED_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
const RUN32_APPROVED_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'
const FOLDER_APPROVED_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'

// ── Types ──────────────────────────────────────────────────────────────────
export type StartupImpact = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export interface StartupEntry {
  id: string
  name: string
  displayName: string
  command: string
  location: 'HKCU_Run' | 'HKLM_Run' | 'StartupFolder_User' | 'StartupFolder_All'
  enabled: boolean
  impact: StartupImpact
  impactLabel: string
  estimatedDelaySec: number
  recommendation: string
  publisher: string
  /** Windows system item (under %SystemRoot%, Windows Defender/Security, SecurityHealth...). Never toggled. */
  isProtected: boolean
}

export interface StartupAnalysis {
  entries: StartupEntry[]
  bootScore: number
  totalEstimatedDelaySec: number
  highImpactCount: number
  analyzedAt: number
}

// ── Heuristic impact estimation ─────────────────────────────────────────────
// Based on command path patterns — larger apps generally have more startup cost
function estimateImpact(name: string, command: string): { impact: StartupImpact; delaySec: number; label: string } {
  const lower = (name + command).toLowerCase()

  // High impact — known heavy launchers
  const critical = ['steam', 'epicgameslauncher', 'battle.net', 'origin', 'ea_desktop', 'ubisoft']
  const high = ['teams', 'zoom', 'slack', 'discord', 'skype', 'spotify', 'dropbox', 'onedrive', 'googledrivefs', 'backup', 'antivirus', 'mcafee', 'avast', 'norton', 'kaspersky']
  const medium = ['chrome', 'edge', 'firefox', 'office', 'outlook', 'word', 'excel', 'itunes', 'adobe', 'acrobat']

  if (critical.some(p => lower.includes(p))) return { impact: 'critical', delaySec: 8, label: 'Critical Impact' }
  if (high.some(p => lower.includes(p))) return { impact: 'high', delaySec: 4, label: 'High Impact' }
  if (medium.some(p => lower.includes(p))) return { impact: 'medium', delaySec: 2, label: 'Medium Impact' }

  return { impact: 'low', delaySec: 0.5, label: 'Low Impact' }
}

function getRecommendation(impact: StartupImpact, name: string): string {
  if (impact === 'critical') return `"${name}" significantly delays startup. Disable if not needed immediately on login.`
  if (impact === 'high') return `"${name}" adds notable startup time. Disable if you don't need it on every login.`
  if (impact === 'medium') return `"${name}" has moderate startup impact. Safe to disable and launch manually.`
  return `"${name}" has minimal startup impact. Low priority to disable.`
}

function extractPublisher(command: string): string {
  const lower = command.toLowerCase()
  if (lower.includes('steam')) return 'Valve Corporation'
  if (lower.includes('discord')) return 'Discord Inc.'
  if (lower.includes('teams')) return 'Microsoft Corporation'
  if (lower.includes('spotify')) return 'Spotify AB'
  if (lower.includes('slack')) return 'Salesforce'
  if (lower.includes('zoom')) return 'Zoom Video Communications'
  if (lower.includes('dropbox')) return 'Dropbox Inc.'
  if (lower.includes('onedrive')) return 'Microsoft Corporation'
  if (lower.includes('chrome')) return 'Google LLC'
  if (lower.includes('microsoft') || lower.includes('\\office\\')) return 'Microsoft Corporation'
  return 'Unknown Publisher'
}

// ── Protected (Windows system) entries ─────────────────────────────────────
export interface ProtectionContext {
  env: Record<string, string | undefined>
  /** Canonical long path when the file exists (expands 8.3 names), else null. */
  realpath?: (p: string) => string | null
}

const PROTECTED_NAMES = new Set(['securityhealth', 'securityhealthsystray'])
const PROTECTED_NAME_PREFIX = 'windowsdefender'
const PROTECTED_FOLDERS = new Set(['windows defender', 'windows security'])

function nativeRealpath(p: string): string | null {
  try {
    return fs.realpathSync.native(p)
  } catch {
    return null
  }
}

const DEFAULT_PROTECTION_CONTEXT: ProtectionContext = { env: process.env, realpath: nativeRealpath }

function envLookup(env: ProtectionContext['env']): Map<string, string> {
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') map.set(k.toLowerCase(), v)
  return map
}

/** Expands %VAR% (case-insensitive); unknown variables are left as they are. */
export function expandEnvVars(value: string, env: ProtectionContext['env']): string {
  const vars = envLookup(env)
  return value.replace(/%([^%\\/:*?"<>|\s]+)%/g, (m, k: string) => vars.get(k.toLowerCase()) ?? m)
}

/** The program path at the start of a Run command (quoted, or unquoted with spaces). */
export function extractExecutablePath(command: string): string {
  const c = command.trim()
  if (c.startsWith('"')) {
    const end = c.indexOf('"', 1)
    return (end > 0 ? c.slice(1, end) : c.slice(1)).trim()
  }
  const m = /^(.+?\.(?:exe|com|bat|cmd|lnk|dll|scr))(?=[\s,]|$)/i.exec(c)
  return m ? m[1] : (c.split(/\s+/)[0] ?? '')
}

/** Lower-case absolute path without trailing separator, or '' when not an absolute drive/UNC path. */
function canonicalWinPath(p: string, systemRoot: string, realpath?: ProtectionContext['realpath']): string {
  let s = p.trim().replace(/\//g, '\\').replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, '')
  if (/^\\systemroot(\\|$)/i.test(s)) s = systemRoot + s.slice('\\SystemRoot'.length)
  if (!/^[a-z]:\\/i.test(s) && !/^\\\\[^\\]/.test(s)) return ''
  s = path.win32.resolve(s)
  const real = realpath?.(s)
  if (real) s = path.win32.resolve(real.replace(/^\\\\\?\\/, ''))
  return s.replace(/\\+$/, '').toLowerCase()
}

/** SecurityHealth, SecurityHealthSystray, WindowsDefender* (case and spacing ignored). */
export function isProtectedStartupName(name: string): boolean {
  const n = String(name ?? '').toLowerCase().replace(/\s+/g, '')
  return PROTECTED_NAMES.has(n) || n.startsWith(PROTECTED_NAME_PREFIX)
}

/** True when the command's program lives under %SystemRoot% or a Windows Defender/Security folder. */
export function isProtectedStartupPath(command: string, ctx: ProtectionContext = DEFAULT_PROTECTION_CONTEXT): boolean {
  if (typeof command !== 'string' || !command.trim()) return false
  const vars = envLookup(ctx.env)
  const rawRoot = expandEnvVars(vars.get('systemroot') ?? vars.get('windir') ?? 'C:\\Windows', ctx.env)
  const root = canonicalWinPath(rawRoot, 'C:\\Windows', ctx.realpath) || 'c:\\windows'

  const exe = extractExecutablePath(expandEnvVars(command, ctx.env))
  let target = canonicalWinPath(exe, root, ctx.realpath)
  // Bare program name ("ctfmon.exe"): Windows finds it in System32 / SystemRoot.
  if (!target && exe && !/[\\/:]/.test(exe) && ctx.realpath) {
    for (const dir of [path.win32.join(root, 'System32'), root]) {
      const hit = ctx.realpath(path.win32.join(dir, exe))
      if (hit) { target = canonicalWinPath(hit, root, ctx.realpath); break }
    }
  }
  if (!target) return false
  if (target === root || target.startsWith(root + '\\')) return true
  return target.split('\\').some(seg => PROTECTED_FOLDERS.has(seg.replace(/\s+/g, ' ').trim()))
}

export function isProtectedStartupEntry(
  name: string,
  command: string,
  ctx: ProtectionContext = DEFAULT_PROTECTION_CONTEXT,
): boolean {
  return isProtectedStartupName(name) || isProtectedStartupPath(command, ctx)
}

/** Target of a startup-folder shortcut (Electron shell API, main process only), else null. */
function readShortcutTarget(lnkPath: string): string | null {
  if (!/\.lnk(\.disabled)?$/i.test(lnkPath)) return null
  try {
    // Lazy require: keeps this module importable by plain-Node unit tests.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { shell } = require('electron') as typeof import('electron')
    return shell?.readShortcutLink?.(lnkPath)?.target || null
  } catch {
    return null
  }
}

// ── Read registry startup entries ──────────────────────────────────────────
export function buildRegistryReadScript(hive: 'HKCU' | 'HKLM', location: 'HKCU_Run' | 'HKLM_Run'): string {
  const regKey = `${hive}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
  const approvedKey = `${hive}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${location === 'HKCU_Run' ? 'Run' : 'Run32'}`

  return `
$runKey = ${psDecode(regKey)}
$approvedKey = ${psDecode(approvedKey)}
try {
  $props = Get-ItemProperty -Path $runKey -ErrorAction Stop
  $approvedProps = $null
  if (Test-Path $approvedKey) {
    $approvedProps = Get-ItemProperty -Path $approvedKey -ErrorAction SilentlyContinue
  }
  $props.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS' } | ForEach-Object {
    $isEnabled = $true
    if ($approvedProps -and $null -ne $approvedProps.($_.Name) -and $approvedProps.($_.Name).Length -ge 1) {
      if ($approvedProps.($_.Name)[0] -eq 3) { $isEnabled = $false }
    }
    "$($_.Name)|||$($_.Value)|||$isEnabled"
  }
} catch { }
`.trim()
}

async function getRegistryStartupEntries(
  hive: 'HKCU' | 'HKLM',
  location: 'HKCU_Run' | 'HKLM_Run',
): Promise<StartupEntry[]> {
  const script = buildRegistryReadScript(hive, location)

  try {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { timeout: 10000 },
    )
    return stdout
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.includes('|||'))
      .map(line => {
        const parts = line.split('|||')
        const name = parts[0].trim()
        const command = parts[1].trim()
        const isEnabled = parts[2].trim() === 'True'
        const { impact, delaySec, label } = estimateImpact(name, command)
        const id = `${location}_${name}`
        return {
          id,
          name,
          displayName: name,
          command,
          location,
          enabled: isEnabled, // Fix 3: Read actual enabled/disabled state
          impact,
          impactLabel: label,
          estimatedDelaySec: delaySec,
          recommendation: getRecommendation(impact, name),
          publisher: extractPublisher(command),
          isProtected: isProtectedStartupEntry(name, command),
        } satisfies StartupEntry
      })
  } catch {
    return []
  }
}

// ── Read startup folder entries ─────────────────────────────────────────────
async function getStartupFolderEntries(folderPath: string, location: StartupEntry['location']): Promise<StartupEntry[]> {
  const entries: StartupEntry[] = []
  try {
    try {
      await fs.promises.access(folderPath)
    } catch {
      return []
    }
    const files = await fs.promises.readdir(folderPath)
    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      // Fix 4: Filter out non-application files (.lnk, .exe, and .disabled only)
      if (ext !== '.lnk' && ext !== '.exe' && ext !== '.disabled') continue
      if (file.toLowerCase() === 'desktop.ini' || file.toLowerCase() === 'thumbs.db') continue

      const isEnabled = ext !== '.disabled' // Fix 3: Determine state from extension
      const actualFileName = isEnabled ? file : file.replace(/\.disabled$/i, '')
      const name = path.basename(actualFileName, path.extname(actualFileName))
      const command = path.join(folderPath, file)
      const { impact, delaySec, label } = estimateImpact(name, command)
      entries.push({
        id: `${location}_${name}`,
        name,
        displayName: name,
        command,
        location,
        enabled: isEnabled,
        impact,
        impactLabel: label,
        estimatedDelaySec: delaySec,
        recommendation: getRecommendation(impact, name),
        publisher: extractPublisher(command),
        isProtected: isProtectedStartupEntry(name, command) || isProtectedStartupPath(readShortcutTarget(command) ?? ''),
      })
    }
  } catch { /* skip */ }
  return entries
}

type StartupFolderLocation = 'StartupFolder_User' | 'StartupFolder_All'

/** The only two folders the Startup Manager may rename files in. */
function getStartupFolders(): Record<StartupFolderLocation, string> {
  const appDataRoaming = process.env.APPDATA ?? os.homedir()
  const programData = process.env.ProgramData ?? 'C:\\ProgramData'
  return {
    StartupFolder_User: path.join(appDataRoaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
    StartupFolder_All: path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
  }
}

// ── Main analysis function ──────────────────────────────────────────────────
export async function analyzeStartup(): Promise<StartupAnalysis> {
  const [hkcuEntries, hklmEntries] = await Promise.all([
    getRegistryStartupEntries('HKCU', 'HKCU_Run'),
    getRegistryStartupEntries('HKLM', 'HKLM_Run'),
  ])

  const folders = getStartupFolders()
  const [userFolderEntries, allFolderEntries] = await Promise.all([
    getStartupFolderEntries(folders.StartupFolder_User, 'StartupFolder_User'),
    getStartupFolderEntries(folders.StartupFolder_All, 'StartupFolder_All')
  ])

  const entries = [...hkcuEntries, ...hklmEntries, ...userFolderEntries, ...allFolderEntries]

  // Sort by impact severity
  const impactOrder: Record<StartupImpact, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 }
  entries.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])

  const totalEstimatedDelaySec = entries.reduce((acc, e) => acc + e.estimatedDelaySec, 0)
  const highImpactCount = entries.filter(e => e.impact === 'critical' || e.impact === 'high').length

  // Boot score: more delays = lower score
  const bootScore = Math.max(0, Math.round(100 - Math.min(100, totalEstimatedDelaySec * 2.5)))

  return { entries, bootScore, totalEstimatedDelaySec, highImpactCount, analyzedAt: Date.now() }
}

// ── Enable/Disable startup entry ───────────────────────────────────────────
const ADMIN_CHECK_SCRIPT = `
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error "RequiresAdmin"
  exit 1
}
`

/** Registry Run entry: enable (write value + mark approved) or disable (StartupApproved = 3). */
export function buildRegistrySetScript(entry: StartupEntry, enabled: boolean, requiresAdmin: boolean): string {
  const hivePrefix = entry.location === 'HKCU_Run' ? 'HKCU' : 'HKLM'
  const regKey = `${hivePrefix}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
  const hiveApproved = entry.location === 'HKCU_Run' ? RUN_APPROVED_HIVE : RUN32_APPROVED_HIVE

  return `
${requiresAdmin ? ADMIN_CHECK_SCRIPT : ''}
$name = ${psDecode(entry.name)}
$cmd = ${psDecode(entry.command)}
$runKey = ${psDecode(regKey)}
$approvedHive = ${psDecode(hiveApproved)}
$runApprovedHive = ${psDecode(RUN_APPROVED_HIVE)}

if (${enabled ? '$true' : '$false'}) {
  Set-ItemProperty -Path $runKey -Name $name -Value $cmd -ErrorAction Stop
  $hives = @($approvedHive, $runApprovedHive)
  foreach ($h in $hives) {
    if (Test-Path $h) {
      $prop = (Get-ItemProperty -Path $h -Name $name -ErrorAction SilentlyContinue).$name
      if ($null -ne $prop -and $prop.Length -ge 1) {
        $prop[0] = 2
        Set-ItemProperty -Path $h -Name $name -Value $prop -Type Binary -ErrorAction SilentlyContinue
      }
    }
  }
} else {
  if (-not (Test-Path $approvedHive)) { New-Item -Path $approvedHive -Force | Out-Null }
  $val = [byte[]]::new(12)
  $val[0] = 3
  Set-ItemProperty -Path $approvedHive -Name $name -Value $val -Type Binary -ErrorAction Stop
}
`.trim()
}

/** Startup folder entry enabled: clear the "disabled" flag for any of its known value names. */
export function buildFolderEnableScript(entryName: string, baseName: string): string {
  return `
$hive = ${psDecode(FOLDER_APPROVED_HIVE)}
$entryName = ${psDecode(entryName)}
$baseName = ${psDecode(baseName)}
if (Test-Path $hive) {
  $names = @($entryName, $baseName, ($baseName + '.lnk'))
  foreach ($n in $names) {
    $prop = (Get-ItemProperty -Path $hive -Name $n -ErrorAction SilentlyContinue).$n
    if ($null -ne $prop -and $prop.Length -ge 1) {
      $prop[0] = 2
      Set-ItemProperty -Path $hive -Name $n -Value $prop -Type Binary -ErrorAction SilentlyContinue
    }
  }
}
`.trim()
}

/** Startup folder entry disabled: write StartupApproved = 3 for its file name. */
export function buildFolderDisableScript(baseName: string): string {
  return `
$hive = ${psDecode(FOLDER_APPROVED_HIVE)}
$baseName = ${psDecode(baseName)}
if (-not (Test-Path $hive)) { New-Item -Path $hive -Force | Out-Null }
$val = [byte[]]::new(12)
$val[0] = 3
Set-ItemProperty -Path $hive -Name $baseName -Value $val -Type Binary -ErrorAction SilentlyContinue
`.trim()
}

function runEncodedPowerShell(script: string, timeout = 8000) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout })
}

// ── Validation of the renderer's entry ─────────────────────────────────────
const STARTUP_LOCATIONS: readonly StartupEntry['location'][] = ['HKCU_Run', 'HKLM_Run', 'StartupFolder_User', 'StartupFolder_All']
const MAX_ENTRY_NAME_LENGTH = 260
const CONTROL_CHARS = /[\x00-\x1f\x7f]/
const DISABLED_SUFFIX = /\.disabled$/i

/** What the main process takes from the renderer: which entry, never what to write. */
export interface StartupToggleRequest {
  location: StartupEntry['location']
  name: string
  /** Startup folder only: lower-case file name without ".disabled". */
  fileKey?: string
}

/**
 * Lower-case file name of a startup folder item without ".disabled", or null when
 * it is not a .lnk/.exe file name (separators, "..", other extensions).
 */
export function startupFileKey(filePath: string): string | null {
  if (typeof filePath !== 'string' || !filePath || CONTROL_CHARS.test(filePath)) return null
  const base = path.win32.basename(filePath).replace(DISABLED_SUFFIX, '')
  if (!base || base.startsWith('.')) return null
  const ext = path.win32.extname(base).toLowerCase()
  if (ext !== '.lnk' && ext !== '.exe') return null
  return base.toLowerCase()
}

/** Validates the entry sent over IPC. Returns null for anything malformed. */
export function parseStartupToggleRequest(entry: unknown): StartupToggleRequest | null {
  if (!entry || typeof entry !== 'object') return null
  const { location, name, command } = entry as Record<string, unknown>
  if (typeof location !== 'string' || !STARTUP_LOCATIONS.includes(location as StartupEntry['location'])) return null
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_ENTRY_NAME_LENGTH || CONTROL_CHARS.test(name)) return null
  const loc = location as StartupEntry['location']
  if (loc === 'HKCU_Run' || loc === 'HKLM_Run') return { location: loc, name }
  const fileKey = typeof command === 'string' ? startupFileKey(command) : null
  if (!fileKey) return null
  return { location: loc, name, fileKey }
}

/**
 * The single entry from a fresh system scan that matches the request, or null.
 * The command/path used afterwards comes from this scanned entry, never from the renderer.
 */
export function matchScannedEntry(request: StartupToggleRequest, scanned: StartupEntry[]): StartupEntry | null {
  const matches = scanned.filter(e =>
    e.location === request.location &&
    e.name === request.name &&
    (request.fileKey === undefined || startupFileKey(e.command) === request.fileKey),
  )
  return matches.length === 1 ? matches[0] : null
}

/** True only for a .lnk/.exe (optionally .disabled) file directly inside `folder`. */
export function isDirectStartupFolderFile(folder: string, filePath: string): boolean {
  const w = path.win32
  if (typeof filePath !== 'string' || !w.isAbsolute(filePath) || CONTROL_CHARS.test(filePath)) return false
  const resolved = w.resolve(filePath)
  if (w.dirname(resolved).toLowerCase() !== w.resolve(folder).toLowerCase()) return false
  return startupFileKey(resolved) !== null
}

function readStartupLocation(location: StartupEntry['location']): Promise<StartupEntry[]> {
  if (location === 'HKCU_Run') return getRegistryStartupEntries('HKCU', 'HKCU_Run')
  if (location === 'HKLM_Run') return getRegistryStartupEntries('HKLM', 'HKLM_Run')
  return getStartupFolderEntries(getStartupFolders()[location], location)
}

export type StartupToggleCode = 'PROTECTED_ENTRY' | 'REQUIRES_ADMIN' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'FAILED'
export type StartupToggleResult = { ok: true } | { ok: false; code: StartupToggleCode }

/**
 * Decides which scanned entry a renderer request may change. Pure apart from `readLocation`.
 * Protection comes from the main-process scan; whatever the renderer claims is ignored.
 */
export async function resolveToggleTarget(
  rawEntry: unknown,
  enabled: unknown,
  readLocation: (location: StartupEntry['location']) => Promise<StartupEntry[]>,
): Promise<{ ok: true; entry: StartupEntry } | { ok: false; code: StartupToggleCode }> {
  if (typeof enabled !== 'boolean') return { ok: false, code: 'INVALID_REQUEST' }
  const request = parseStartupToggleRequest(rawEntry)
  if (!request) return { ok: false, code: 'INVALID_REQUEST' }
  // Refuse protected names before touching the system at all.
  if (isProtectedStartupName(request.name)) return { ok: false, code: 'PROTECTED_ENTRY' }
  const entry = matchScannedEntry(request, await readLocation(request.location))
  if (!entry) return { ok: false, code: 'NOT_FOUND' }
  if (entry.isProtected || isProtectedStartupEntry(entry.name, entry.command)) {
    return { ok: false, code: 'PROTECTED_ENTRY' }
  }
  return { ok: true, entry }
}

export async function setStartupEntryEnabled(rawEntry: unknown, enabled: unknown): Promise<StartupToggleResult> {
  const target = await resolveToggleTarget(rawEntry, enabled, readStartupLocation)
  if (!target.ok) {
    console.warn('[startup] Refused toggle:', target.code)
    return target
  }
  const entry = target.entry
  const turnOn = enabled as boolean

  // Check admin rights if modifying HKLM or All-Users
  const requiresAdmin = entry.location === 'HKLM_Run' || entry.location === 'StartupFolder_All'

  if (entry.location === 'HKCU_Run' || entry.location === 'HKLM_Run') {
    try {
      await runEncodedPowerShell(buildRegistrySetScript(entry, turnOn, requiresAdmin))
      return { ok: true }
    } catch (err: any) {
      if (err?.stderr && String(err.stderr).includes('RequiresAdmin')) return { ok: false, code: 'REQUIRES_ADMIN' }
      return { ok: false, code: 'FAILED' }
    }
  }

  const folder = getStartupFolders()[entry.location]
  const baseName = path.basename(entry.command).replace(DISABLED_SUFFIX, '')
  const normal = entry.command.replace(DISABLED_SUFFIX, '')
  const disabled = normal + '.disabled'
  if (!isDirectStartupFolderFile(folder, normal) || !isDirectStartupFolderFile(folder, disabled)) {
    console.warn('[startup] Refused toggle: path outside the startup folder')
    return { ok: false, code: 'INVALID_REQUEST' }
  }

  // Admin check for all users folder
  if (requiresAdmin) {
    try {
      await runEncodedPowerShell(ADMIN_CHECK_SCRIPT)
    } catch (err: any) {
      if (err?.stderr && String(err.stderr).includes('RequiresAdmin')) return { ok: false, code: 'REQUIRES_ADMIN' }
      return { ok: false, code: 'FAILED' }
    }
  }

  try {
    if (turnOn) {
      if (fs.existsSync(disabled)) fs.renameSync(disabled, normal)
      await runEncodedPowerShell(buildFolderEnableScript(entry.name, baseName)).catch(() => {})
    } else {
      if (fs.existsSync(normal)) fs.renameSync(normal, disabled)
      await runEncodedPowerShell(buildFolderDisableScript(baseName)).catch(() => {})
    }
    return { ok: true }
  } catch {
    // permission denied
    return { ok: false, code: 'FAILED' }
  }
}

