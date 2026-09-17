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
  const script = `
try {
  $props = Get-ItemProperty -Path '${regKey}' -ErrorAction Stop
  $props.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS' } | ForEach-Object {
    "$($_.Name)|||$($_.Value)"
  }
} catch { }
`.trim()

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`,
      { timeout: 10000 },
    )
    return stdout
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.includes('|||'))
      .map(line => {
        const sep = line.indexOf('|||')
        const name = line.substring(0, sep).trim()
        const command = line.substring(sep + 3).trim()
        const { impact, delaySec, label } = estimateImpact(name, command)
        const id = `${location}_${name}`
        return {
          id,
          name,
          displayName: name,
          command,
          location,
          enabled: true,
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
function getStartupFolderEntries(folderPath: string, location: StartupEntry['location']): StartupEntry[] {
  const entries: StartupEntry[] = []
  try {
    if (!fs.existsSync(folderPath)) return []
    const files = fs.readdirSync(folderPath)
    for (const file of files) {
      const name = path.basename(file, path.extname(file))
      const command = path.join(folderPath, file)
      const { impact, delaySec, label } = estimateImpact(name, command)
      entries.push({
        id: `${location}_${name}`,
        name,
        displayName: name,
        command,
        location,
        enabled: true,
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

  const userFolderEntries = getStartupFolderEntries(userStartupFolder, 'StartupFolder_User')
  const allFolderEntries = getStartupFolderEntries(allUsersStartupFolder, 'StartupFolder_All')

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

  if (entry.location === 'HKCU_Run' || entry.location === 'HKLM_Run') {
    const hivePrefix = entry.location === 'HKCU_Run' ? 'HKCU' : 'HKLM'
    const regKey = `${hivePrefix}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`

    if (enabled) {
      // Re-add entry (we need the command — only possible if we stored it)
      const script = `Set-ItemProperty -Path '${regKey}' -Name '${entry.name}' -Value '${entry.command.replace(/'/g, "''")}' -ErrorAction Stop`
      try {
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${script}"`, { timeout: 8000 })
        return true
      } catch { return false }
    } else {
      // Disable via StartupApproved (keeps the entry but disables it — same as Task Manager)
      // The disable bytes: first byte 03 = disabled, 02 = enabled
      const hiveApproved = entry.location === 'HKCU_Run' ? DISABLED_HIVE : DISABLED_HIVE_32
      const disableScript = `
if (-not (Test-Path '${hiveApproved}')) { New-Item -Path '${hiveApproved}' -Force | Out-Null }
$val = New-Object byte[] 12
$val[0] = 3  # disabled flag
Set-ItemProperty -Path '${hiveApproved}' -Name '${entry.name}' -Value $val -Type Binary -ErrorAction Stop
`.trim()
      try {
        await execAsync(
          `powershell -NoProfile -NonInteractive -Command "${disableScript.replace(/\r?\n/g, ' ')}"`,
          { timeout: 8000 },
        )
        return true
      } catch { return false }
    }
  }

  // For startup folder entries — rename .lnk to .lnk.disabled
  if (entry.location === 'StartupFolder_User' || entry.location === 'StartupFolder_All') {
    try {
      if (enabled) {
        const disabled = entry.command + '.disabled'
        if (fs.existsSync(disabled)) {
          fs.renameSync(disabled, entry.command)
          return true
        }
      } else {
        if (fs.existsSync(entry.command)) {
          fs.renameSync(entry.command, entry.command + '.disabled')
          return true
        }
      }
    } catch { /* permission denied */ }
  }

  return false
}
