import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// ── Types ──────────────────────────────────────────────────────────────────
export interface DetectedGame {
  pid: number
  name: string
  displayName: string
  cpuPercent: number
  memPercent: number
  memBytes: number
}

export interface GameModeStatus {
  active: boolean
  detectedGame: DetectedGame | null
  ramFreedBytes: number
  processesAffected: number
  actionsApplied: string[]
  powerPlanSet: boolean
}

export interface GameDetectionResult {
  detected: boolean
  games: DetectedGame[]
}

// ── Known game process patterns ──────────────────────────────────────────
const GAME_PATTERNS = [
  // Game launchers / games
  'steam', 'epicgameslauncher', 'gog', 'battlenet', 'battle.net', 'origin', 'ea_desktop',
  // Common game engine executables & generic game markers
  'ue4', 'ue5', 'unity', 'unreal',
  // High-resource processes (CPU or GPU-heavy) that are likely games
  // These are detected dynamically by cpu usage threshold
]

// Process names that are definitely NOT games
const EXCLUDE_PATTERNS = [
  'system', 'idle', 'smss', 'csrss', 'wininit', 'winlogon', 'lsass', 'services',
  'svchost', 'dwm', 'audiodg', 'registry', 'msmpsvc', 'msmpeng', 'antimalware',
  'explorer', 'taskmgr', 'cmd', 'powershell', 'pwsh', 'node', 'python',
  'code', 'devenv', 'chrome', 'firefox', 'msedge', 'opera', 'brave', 'vivaldi',
  'slack', 'discord', 'teams', 'zoom', 'spotify', 'vlc', 'obs',
]

let _gameModeActive = false
let _powerPlanGuid: string | null = null

// ── Get original power plan GUID ──────────────────────────────────────────
async function getCurrentPowerPlan(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('powercfg /getactivescheme', { timeout: 5000 })
    const match = stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ── Detect running games ───────────────────────────────────────────────────
export async function detectGames(): Promise<GameDetectionResult> {
  const [processData, memData] = await Promise.all([si.processes(), si.mem()])
  const totalRam = memData.total || 1

  const games: DetectedGame[] = []

  for (const p of processData.list) {
    const nameLower = p.name.toLowerCase().replace('.exe', '')

    // Skip known non-game processes
    if (EXCLUDE_PATTERNS.some(ex => nameLower.includes(ex))) continue

    // Check if it's a known game launcher/pattern
    const isKnownGame = GAME_PATTERNS.some(gp => nameLower.includes(gp))

    // Also detect by high CPU usage (>10% sustained) from non-system processes
    // and significant memory footprint (>200MB)
    const isHighResourceApp =
      p.cpu > 10 &&
      p.mem > 1 && // mem is a percentage
      !EXCLUDE_PATTERNS.some(ex => nameLower.includes(ex))

    if (isKnownGame || isHighResourceApp) {
      const memBytes = Math.round((p.mem / 100) * totalRam)
      games.push({
        pid: p.pid,
        name: p.name,
        displayName: p.name.replace(/\.exe$/i, ''),
        cpuPercent: Math.round(p.cpu * 10) / 10,
        memPercent: Math.round(p.mem * 10) / 10,
        memBytes,
      })
    }
  }

  // Sort by CPU usage desc, take top 3
  games.sort((a, b) => b.cpuPercent - a.cpuPercent)
  const topGames = games.slice(0, 3)

  return { detected: topGames.length > 0, games: topGames }
}

// ── Enable Game Mode ────────────────────────────────────────────────────────
export async function enableGameMode(): Promise<GameModeStatus> {
  if (_gameModeActive) {
    const det = await detectGames()
    return {
      active: true,
      detectedGame: det.games[0] ?? null,
      ramFreedBytes: 0,
      processesAffected: 0,
      actionsApplied: ['Game Mode already active'],
      powerPlanSet: !!_powerPlanGuid,
    }
  }

  const actionsApplied: string[] = []
  let ramFreedBytes = 0
  let processesAffected = 0
  let powerPlanSet = false

  // Save current power plan
  _powerPlanGuid = await getCurrentPowerPlan()

  // 1. Switch to High Performance power plan
  try {
    await execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', { timeout: 8000 })
    actionsApplied.push('Switched to High Performance power plan')
    powerPlanSet = true
  } catch {
    // Might not exist — try creating it or use Balanced
    try {
      await execAsync('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', { timeout: 8000 })
      actionsApplied.push('Applied Balanced power plan (High Performance unavailable)')
      powerPlanSet = true
    } catch { /* non-critical */ }
  }

  // 2. Lower background process priorities & trim RAM
  try {
    const GAME_MODE_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CMGameMode {
    [DllImport("psapi.dll", SetLastError=true)]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);
}
"@
$SKIP = @("System","Idle","smss","csrss","wininit","winlogon","lsass","services","svchost","dwm","audiodg","Registry","MsMpEng")
$count = 0; $freed = 0
$before = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
Get-Process | Where-Object {
    try {
        !$_.HasExited -and $_.MainWindowHandle -eq 0 -and
        $_.PriorityClass -notin @('Idle','BelowNormal') -and
        $SKIP -notcontains $_.Name
    } catch { $false }
} | ForEach-Object {
    try { $_.PriorityClass = 'BelowNormal'; [CMGameMode]::EmptyWorkingSet($_.Handle) | Out-Null; $count++ } catch {}
}
Start-Sleep -Milliseconds 500
$after = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
$freed = [Math]::Max(0, ($after - $before)) * 1024
"$freed|$count"
`.trim()
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${GAME_MODE_SCRIPT.replace(/\r?\n/g, ' ')}"`,
      { timeout: 25000 },
    )
    const parts = stdout.trim().split('|')
    ramFreedBytes = parseInt(parts[0] ?? '0', 10) || 0
    processesAffected = parseInt(parts[1] ?? '0', 10) || 0
    if (processesAffected > 0) {
      actionsApplied.push(`Reduced ${processesAffected} background processes priority`)
      actionsApplied.push(`Freed ~${Math.round(ramFreedBytes / 1024 / 1024)} MB RAM`)
    }
  } catch { /* non-critical */ }

  _gameModeActive = true

  const det = await detectGames()

  return {
    active: true,
    detectedGame: det.games[0] ?? null,
    ramFreedBytes,
    processesAffected,
    actionsApplied,
    powerPlanSet,
  }
}

// ── Disable Game Mode ───────────────────────────────────────────────────────
export async function disableGameMode(): Promise<GameModeStatus> {
  const actionsApplied: string[] = []
  let processesAffected = 0

  // Restore original power plan
  if (_powerPlanGuid) {
    try {
      await execAsync(`powercfg /setactive ${_powerPlanGuid}`, { timeout: 8000 })
      actionsApplied.push('Restored original power plan')
    } catch { /* non-critical */ }
    _powerPlanGuid = null
  }

  // Restore process priorities
  try {
    const RESTORE_SCRIPT = `
$count = 0
Get-Process | Where-Object {
    try { !$_.HasExited -and $_.PriorityClass -eq 'BelowNormal' } catch { $false }
} | ForEach-Object {
    try { $_.PriorityClass = 'Normal'; $count++ } catch {}
}
$count`.trim()
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${RESTORE_SCRIPT.replace(/\r?\n/g, ' ')}"`,
      { timeout: 15000 },
    )
    processesAffected = parseInt(stdout.trim(), 10) || 0
    if (processesAffected > 0) actionsApplied.push(`Restored ${processesAffected} process priorities to Normal`)
  } catch { /* non-critical */ }

  _gameModeActive = false

  return {
    active: false,
    detectedGame: null,
    ramFreedBytes: 0,
    processesAffected,
    actionsApplied,
    powerPlanSet: false,
  }
}

export function getGameModeState(): boolean {
  return _gameModeActive
}
