import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { shell } from 'electron'
import { loadSettings } from '../maintenance/automationStore'

const execAsync = promisify(exec)

// ── Types ──────────────────────────────────────────────────────────────────
export interface SystemHealthData {
  cpuLoad: number
  ramPressure: number
  diskUsage: number
  tempJunkBytes: number
  startupAppCount: number
  browserMemoryBytes: number
  backgroundProcessCount: number
  uptimeSeconds: number
  totalRam: number
  freeRam: number
  totalDisk: number
  freeDisk: number
}

export interface HealthScore {
  overall: number
  cpu: number
  ram: number
  disk: number
  startup: number
  background: number
}

export interface Recommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  reclaimableBytes?: number
  action: 'optimize_ram' | 'clean_temp' | 'startup' | 'background' | 'disk'
}

export interface SmartBoostAnalysis {
  health: HealthScore
  systemData: SystemHealthData
  recommendations: Recommendation[]
  reclaimableRam: number
  reclaimableStorage: number
  analyzedAt: number
}

export interface SmartBoostResult {
  ramFreedBytes: number
  storageFreedBytes: number
  processesOptimized: number
  actionsApplied: string[]
  durationMs: number
}

// ── Temp directory helpers ──────────────────────────────────────────────────
function getTempDirs(): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const winDir = process.env.WINDIR ?? 'C:\\Windows'
  const temp = process.env.TEMP ?? os.tmpdir()
  return [
    temp,
    path.join(localAppData, 'Temp'),
    path.join(winDir, 'Temp'),
    path.join(localAppData, 'Microsoft', 'Windows', 'INetCache'),
  ].filter(d => d.length > 3)
}

function getDirSize(dirPath: string): number {
  let total = 0
  try {
    if (!fs.existsSync(dirPath)) return 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dirPath, e.name)
      try {
        if (e.isDirectory()) {
          total += getDirSize(full)
        } else {
          total += fs.statSync(full).size
        }
      } catch { /* skip locked */ }
    }
  } catch { /* skip unreadable */ }
  return total
}

async function cleanDirSafe(dirPath: string, safeMode: boolean): Promise<number> {
  let freed = 0
  try {
    if (!fs.existsSync(dirPath)) return 0
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name)
      try {
        const size = entry.isDirectory() ? 0 : fs.statSync(full).size
        if (entry.isDirectory()) {
          if (safeMode) {
            freed += await cleanDirSafe(full, safeMode)
          } else {
            fs.rmSync(full, { recursive: true, force: true })
            freed += size
          }
        } else {
          if (safeMode) {
            await shell.trashItem(full)
          } else {
            fs.unlinkSync(full)
          }
          freed += size
        }
      } catch { /* locked / permission denied — skip */ }
    }
  } catch { /* unreadable — skip */ }
  return freed
}

// ── Scoring helpers ────────────────────────────────────────────────────────
function scoreFromPercent(pct: number): number {
  // Higher usage = lower score
  if (pct < 40) return 100
  if (pct < 60) return Math.round(100 - ((pct - 40) / 20) * 30)   // 100→70
  if (pct < 80) return Math.round(70 - ((pct - 60) / 20) * 30)    // 70→40
  return Math.round(40 - ((pct - 80) / 20) * 40)                   // 40→0
}

// ── Main analysis ──────────────────────────────────────────────────────────
export async function runSmartBoostAnalysis(): Promise<SmartBoostAnalysis> {
  const [cpuData, memData, diskData, processData] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.processes(),
  ])

  // CPU
  const cpuLoad = Math.round(cpuData.currentLoad)

  // RAM
  const totalRam = memData.total
  const freeRam = memData.available
  const ramPressure = Math.round((memData.used / totalRam) * 100)

  // Disk (aggregate)
  const mainDisk = diskData.find(d => d.mount === 'C:' || d.mount === '/') ?? diskData[0]
  const totalDisk = mainDisk?.size ?? 0
  const freeDisk = mainDisk?.available ?? 0
  const diskUsage = mainDisk ? Math.round(((mainDisk.used) / mainDisk.size) * 100) : 0

  // Temp junk
  const tempDirs = getTempDirs()
  const tempJunkBytes = tempDirs.reduce((acc, d) => acc + getDirSize(d), 0)

  // Browser processes memory
  const BROWSER_NAMES = ['chrome', 'firefox', 'msedge', 'opera', 'brave', 'vivaldi', 'iexplore']
  let browserMemoryBytes = 0
  let backgroundProcessCount = 0
  const SYSTEM_SKIP = ['system', 'idle', 'smss', 'csrss', 'wininit', 'winlogon', 'lsass', 'services', 'svchost', 'dwm']

  for (const p of processData.list) {
    const name = p.name.toLowerCase().replace('.exe', '')
    if (BROWSER_NAMES.some(b => name.includes(b))) {
      browserMemoryBytes += Math.round((p.mem / 100) * totalRam)
    }
    if (!SYSTEM_SKIP.some(s => name.includes(s)) && p.cpu < 0.1) {
      backgroundProcessCount++
    }
  }

  // Startup app count via PowerShell
  let startupAppCount = 0
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "` +
      `$r1 = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue; ` +
      `$r2 = Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue; ` +
      `$c = 0; if($r1){$c += ($r1.PSObject.Properties | Where-Object {$_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS'}).Count}; ` +
      `if($r2){$c += ($r2.PSObject.Properties | Where-Object {$_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS'}).Count}; ` +
      `Write-Output $c"`,
      { timeout: 10000 },
    )
    startupAppCount = parseInt(stdout.trim(), 10) || 0
  } catch { /* non-critical */ }

  // Uptime
  const uptimeSeconds = Math.round(si.time().uptime)

  // ── Health scores ──────────────────────────────────────────────────────
  const cpuScore = scoreFromPercent(cpuLoad)
  const ramScore = scoreFromPercent(ramPressure)
  const diskScore = scoreFromPercent(diskUsage)
  const startupScore = startupAppCount > 20 ? 40 : startupAppCount > 10 ? 65 : 85
  const backgroundScore = backgroundProcessCount > 150 ? 50 : backgroundProcessCount > 80 ? 70 : 90
  const overall = Math.round((cpuScore * 0.25 + ramScore * 0.30 + diskScore * 0.20 + startupScore * 0.15 + backgroundScore * 0.10))

  const health: HealthScore = { overall, cpu: cpuScore, ram: ramScore, disk: diskScore, startup: startupScore, background: backgroundScore }

  // ── Recommendations ──────────────────────────────────────────────────
  const recommendations: Recommendation[] = []

  if (ramPressure > 75) {
    recommendations.push({
      id: 'high_ram',
      priority: ramPressure > 88 ? 'critical' : 'high',
      title: 'High RAM Pressure Detected',
      detail: `${ramPressure}% RAM in use. Reclaiming inactive working sets can free ${Math.round(freeRam * 0.15 / 1024 / 1024)} MB.`,
      reclaimableBytes: Math.round(freeRam * 0.15),
      action: 'optimize_ram',
    })
  }

  if (tempJunkBytes > 100 * 1024 * 1024) {
    recommendations.push({
      id: 'temp_junk',
      priority: tempJunkBytes > 500 * 1024 * 1024 ? 'high' : 'medium',
      title: 'Junk Files Accumulation',
      detail: `${Math.round(tempJunkBytes / 1024 / 1024)} MB of temp junk found. Safe to remove.`,
      reclaimableBytes: tempJunkBytes,
      action: 'clean_temp',
    })
  }

  if (startupAppCount > 10) {
    recommendations.push({
      id: 'startup_load',
      priority: startupAppCount > 20 ? 'high' : 'medium',
      title: 'Heavy Startup Load',
      detail: `${startupAppCount} apps launch at startup, slowing boot time. Review in Startup Analyzer.`,
      action: 'startup',
    })
  }

  if (backgroundProcessCount > 100) {
    recommendations.push({
      id: 'background_procs',
      priority: 'medium',
      title: 'Many Background Processes',
      detail: `${backgroundProcessCount} low-activity background processes detected. Reducing their priority frees CPU time.`,
      action: 'background',
    })
  }

  if (diskUsage > 85) {
    recommendations.push({
      id: 'disk_usage',
      priority: 'high',
      title: 'Low Disk Space',
      detail: `Only ${Math.round(freeDisk / 1024 / 1024 / 1024)} GB free on system drive. Consider running Duplicate Finder.`,
      action: 'disk',
    })
  }

  if (browserMemoryBytes > 500 * 1024 * 1024) {
    recommendations.push({
      id: 'browser_mem',
      priority: 'medium',
      title: 'Browser Memory Usage High',
      detail: `Browsers consuming ${Math.round(browserMemoryBytes / 1024 / 1024)} MB. Closing unused tabs helps.`,
      reclaimableBytes: Math.round(browserMemoryBytes * 0.3),
      action: 'optimize_ram',
    })
  }

  const reclaimableRam = recommendations.reduce((a, r) => a + (r.reclaimableBytes && r.action === 'optimize_ram' ? r.reclaimableBytes : 0), 0)
  const reclaimableStorage = recommendations.reduce((a, r) => a + (r.reclaimableBytes && r.action === 'clean_temp' ? r.reclaimableBytes : 0), 0)

  const systemData: SystemHealthData = {
    cpuLoad, ramPressure, diskUsage, tempJunkBytes,
    startupAppCount, browserMemoryBytes, backgroundProcessCount,
    uptimeSeconds, totalRam, freeRam, totalDisk, freeDisk,
  }

  return { health, systemData, recommendations, reclaimableRam, reclaimableStorage, analyzedAt: Date.now() }
}

// ── Safe optimization run ──────────────────────────────────────────────────
export async function runSmartBoostOptimize(
  onProgress: (step: string, pct: number) => void,
): Promise<SmartBoostResult> {
  const startTime = Date.now()
  const actionsApplied: string[] = []
  let ramFreedBytes = 0
  let storageFreedBytes = 0
  let processesOptimized = 0

  onProgress('Analyzing system state…', 5)

  // Step 1: Clean temp files
  onProgress('Removing temporary junk files…', 20)
  try {
    const settings = loadSettings()
    const safeMode = settings.safeCleaningMode
    const tempDirs = getTempDirs()
    for (const d of tempDirs) {
      storageFreedBytes += await cleanDirSafe(d, safeMode)
    }
    actionsApplied.push(`Cleared ${Math.round(storageFreedBytes / 1024 / 1024)} MB of temp files`)
  } catch { /* non-critical */ }

  onProgress('Trimming inactive RAM working sets…', 45)

  // Step 2: Memory optimization via EmptyWorkingSet
  try {
    const MEM_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CMAIBoost {
    [DllImport("psapi.dll", SetLastError=true)]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);
}
"@
$SKIP = @("System","Idle","smss","csrss","wininit","winlogon","lsass","services","svchost","dwm","audiodg","Registry","MsMpEng")
$procs = Get-Process | Where-Object {
    try { !$_.HasExited -and $_.WorkingSet64 -gt 5MB -and $SKIP -notcontains $_.Name } catch { $false }
}
$before = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
$count = 0
foreach ($p in $procs) {
    try { [CMAIBoost]::EmptyWorkingSet($p.Handle) | Out-Null; $count++ } catch {}
}
Start-Sleep -Milliseconds 500
$after = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
$freed = [Math]::Max(0, ($after - $before)) * 1024
"$freed|$count"
`.trim()

    const tmpFile = path.join(os.tmpdir(), `cm_ai_boost_${Date.now()}.ps1`)
    fs.writeFileSync(tmpFile, MEM_SCRIPT, 'utf8')

    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 30000 },
    )
    try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }

    const parts = stdout.trim().split('|')
    ramFreedBytes = parseInt(parts[0] ?? '0', 10) || 0
    processesOptimized = parseInt(parts[1] ?? '0', 10) || 0
    actionsApplied.push(`Freed ${Math.round(ramFreedBytes / 1024 / 1024)} MB RAM from ${processesOptimized} processes`)
  } catch { /* non-critical */ }

  onProgress('Lowering background process priority…', 70)

  // Step 3: Lower background process priority
  try {
    const PRIO_SCRIPT = `
$count = 0
Get-Process | Where-Object {
    try {
        !$_.HasExited -and $_.MainWindowHandle -eq 0 -and
        $_.PriorityClass -notin @('Idle','BelowNormal') -and
        $_.Name -notmatch "^(System|Idle|smss|csrss|wininit|winlogon|lsass|services|svchost|dwm|audiodg|MsMpEng)$"
    } catch { $false }
} | ForEach-Object {
    try { $_.PriorityClass = 'BelowNormal'; $count++ } catch {}
}
$count
`.trim()
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${PRIO_SCRIPT.replace(/\r?\n/g, ' ')}"`,
      { timeout: 15000 },
    )
    const affected = parseInt(stdout.trim(), 10) || 0
    if (affected > 0) actionsApplied.push(`Lowered priority on ${affected} background processes`)
  } catch { /* non-critical */ }

  onProgress('Finalizing optimization…', 90)

  return {
    ramFreedBytes,
    storageFreedBytes,
    processesOptimized,
    actionsApplied,
    durationMs: Date.now() - startTime,
  }
}
