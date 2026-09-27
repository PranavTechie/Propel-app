import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

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

// ── Read registry startup entries ──────────────────────────────────────────
async function getRegistryStartupEntries(
  hive: 'HKCU' | 'HKLM',
  location: 'HKCU_Run' | 'HKLM_Run',
): Promise<StartupEntry[]> {
  const regKey = `${hive}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
  const approvedKey = `${hive}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${location === 'HKCU_Run' ? 'Run' : 'Run32'}`
  
  const script = `
$runKey = '${regKey}'
$approvedKey = '${approvedKey}'
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
      })
    }
  } catch { /* skip */ }
  return entries
}

// ── Main analysis function ──────────────────────────────────────────────────
export async function analyzeStartup(): Promise<StartupAnalysis> {
  const [hkcuEntries, hklmEntries] = await Promise.all([
    getRegistryStartupEntries('HKCU', 'HKCU_Run'),
    getRegistryStartupEntries('HKLM', 'HKLM_Run'),
  ])

  const appDataRoaming = process.env.APPDATA ?? os.homedir()
  const programData = process.env.ProgramData ?? 'C:\\ProgramData'

  const userStartupFolder = path.join(appDataRoaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
  const allUsersStartupFolder = path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')

  const [userFolderEntries, allFolderEntries] = await Promise.all([
    getStartupFolderEntries(userStartupFolder, 'StartupFolder_User'),
    getStartupFolderEntries(allUsersStartupFolder, 'StartupFolder_All')
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
export async function setStartupEntryEnabled(entry: StartupEntry, enabled: boolean): Promise<boolean> {
  const DISABLED_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
  const DISABLED_HIVE_32 = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'
  const DISABLED_FOLDER_HIVE = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'

  const b64Name = Buffer.from(entry.name).toString('base64')
  const b64Command = Buffer.from(entry.command).toString('base64')

  // Check admin rights if modifying HKLM or All-Users
  const requiresAdmin = entry.location === 'HKLM_Run' || entry.location === 'StartupFolder_All'
  const adminCheckScript = requiresAdmin ? `
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error "RequiresAdmin"
  exit 1
}
` : ''

  if (entry.location === 'HKCU_Run' || entry.location === 'HKLM_Run') {
    const hivePrefix = entry.location === 'HKCU_Run' ? 'HKCU' : 'HKLM'
    const regKey = `${hivePrefix}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
    const hiveApproved = entry.location === 'HKCU_Run' ? DISABLED_HIVE : DISABLED_HIVE_32

    const script = `
${adminCheckScript}
$name = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Name}'))
$cmd = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Command}'))

if (${enabled ? '$true' : '$false'}) {
  Set-ItemProperty -Path '${regKey}' -Name $name -Value $cmd -ErrorAction Stop
  $hives = @('${hiveApproved}', '${DISABLED_HIVE}')
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
  if (-not (Test-Path '${hiveApproved}')) { New-Item -Path '${hiveApproved}' -Force | Out-Null }
  $val = [byte[]]::new(12)
  $val[0] = 3
  Set-ItemProperty -Path '${hiveApproved}' -Name $name -Value $val -Type Binary -ErrorAction Stop
}
`.trim()

    try {
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(
        `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
        { timeout: 8000 },
      )
      return true
    } catch (err: any) {
      if (err.stderr && err.stderr.includes('RequiresAdmin')) {
        throw new Error('RequiresAdmin') // Fix 5: Throw explicit error for UI
      }
      return false
    }
  }

  if (entry.location === 'StartupFolder_User' || entry.location === 'StartupFolder_All') {
    const baseName = path.basename(entry.command).replace(/\.disabled$/i, '')
    
    // Admin check for all users folder
    if (requiresAdmin) {
      try {
        const encoded = Buffer.from(adminCheckScript, 'utf16le').toString('base64')
        await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 8000 })
      } catch (err: any) {
        if (err.stderr && err.stderr.includes('RequiresAdmin')) {
          throw new Error('RequiresAdmin')
        }
        return false
      }
    }

    try {
      if (enabled) {
        const disabled = entry.command.endsWith('.disabled') ? entry.command : entry.command + '.disabled'
        const normal = entry.command.endsWith('.disabled') ? entry.command.slice(0, -9) : entry.command
        if (fs.existsSync(disabled)) {
          fs.renameSync(disabled, normal)
        }

        const script = `
if (Test-Path '${DISABLED_FOLDER_HIVE}') {
  $names = @('${entry.name}', '${baseName}', '${baseName}.lnk')
  foreach ($n in $names) {
    $prop = (Get-ItemProperty -Path '${DISABLED_FOLDER_HIVE}' -Name $n -ErrorAction SilentlyContinue).$n
    if ($null -ne $prop -and $prop.Length -ge 1) {
      $prop[0] = 2
      Set-ItemProperty -Path '${DISABLED_FOLDER_HIVE}' -Name $n -Value $prop -Type Binary -ErrorAction SilentlyContinue
    }
  }
}
`.trim()
        const encoded = Buffer.from(script, 'utf16le').toString('base64')
        await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 8000 }).catch(() => {})
        return true
      } else {
        const normal = entry.command.endsWith('.disabled') ? entry.command.slice(0, -9) : entry.command
        const disabled = normal + '.disabled'
        if (fs.existsSync(normal)) {
          fs.renameSync(normal, disabled)
        }

        const script = `
if (-not (Test-Path '${DISABLED_FOLDER_HIVE}')) { New-Item -Path '${DISABLED_FOLDER_HIVE}' -Force | Out-Null }
$val = [byte[]]::new(12)
$val[0] = 3
Set-ItemProperty -Path '${DISABLED_FOLDER_HIVE}' -Name '${baseName}' -Value $val -Type Binary -ErrorAction SilentlyContinue
`.trim()
        const encoded = Buffer.from(script, 'utf16le').toString('base64')
        await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 8000 }).catch(() => {})
        return true
      }
    } catch { /* permission denied */ }
  }

  return false
}
