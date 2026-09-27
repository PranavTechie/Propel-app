import si from 'systeminformation'
import { loadSettings } from '../maintenance/automationStore'

// Import existing validated services
import { runSafeOptimization } from '../memory/optimizerService'
import { analyzeStartup } from './startupAnalyzerService'
import { scanTempFiles } from '../cleaner/tempCleaner'
import { cleanFiles } from '../cleaner/cleanupService'

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

// ── Scoring helpers ────────────────────────────────────────────────────────
function scoreFromPercent(pct: number): number {
  if (pct < 40) return 100
  if (pct < 60) return Math.round(100 - ((pct - 40) / 20) * 30)
  if (pct < 80) return Math.round(70 - ((pct - 60) / 20) * 30)
  return Math.round(40 - ((pct - 80) / 20) * 40)
}

// ── Main analysis ──────────────────────────────────────────────────────────
export async function runSmartBoostAnalysis(): Promise<SmartBoostAnalysis> {
  const [cpuData, memData, diskData, processData, startupAnalysis] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.processes(),
    analyzeStartup()
  ])

  const cpuLoad = Math.round(cpuData.currentLoad)
  const totalRam = memData.total
  const freeRam = memData.available
  const ramPressure = Math.round((memData.used / totalRam) * 100)

  const mainDisk = diskData.find(d => d.mount === 'C:' || d.mount === '/') ?? diskData[0]
  const totalDisk = mainDisk?.size ?? 0
  const freeDisk = mainDisk?.available ?? 0
  const diskUsage = mainDisk ? Math.round(((mainDisk.used) / mainDisk.size) * 100) : 0

  // Temp junk using Cleaner service (Async)
  const tempFiles = await scanTempFiles(() => {})
  const tempJunkBytes = tempFiles.reduce((acc, f) => acc + f.size, 0)

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

  // Startup app count from existing startup service
  const startupAppCount = startupAnalysis.entries.length

  const uptimeSeconds = Math.round(si.time().uptime)

  const cpuScore = scoreFromPercent(cpuLoad)
  const ramScore = scoreFromPercent(ramPressure)
  const diskScore = scoreFromPercent(diskUsage)
  const startupScore = startupAppCount > 20 ? 40 : startupAppCount > 10 ? 65 : 85
  const backgroundScore = backgroundProcessCount > 150 ? 50 : backgroundProcessCount > 80 ? 70 : 90
  const overall = Math.round((cpuScore * 0.25 + ramScore * 0.30 + diskScore * 0.20 + startupScore * 0.15 + backgroundScore * 0.10))

  const health: HealthScore = { overall, cpu: cpuScore, ram: ramScore, disk: diskScore, startup: startupScore, background: backgroundScore }

  const recommendations: Recommendation[] = []

  if (ramPressure > 75) {
    recommendations.push({
      id: 'high_ram',
      priority: ramPressure > 88 ? 'critical' : 'high',
      title: 'High RAM Pressure Detected',
      detail: `${ramPressure}% RAM in use. Reclaiming inactive working sets can free memory.`,
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
      detail: `${backgroundProcessCount} low-activity background processes detected.`,
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

  // Step 1: Clean temp files using existing Cleaner service
  onProgress('Removing temporary junk files…', 20)
  try {
    const settings = await loadSettings()
    const safeMode = settings.safeCleaningMode
    const tempFiles = await scanTempFiles(() => {})
    const stats = await cleanFiles(tempFiles, () => {}, safeMode)
    storageFreedBytes = stats.freed
    if (storageFreedBytes > 0) {
      actionsApplied.push(`Cleared ${Math.round(storageFreedBytes / 1024 / 1024)} MB of temp files`)
    } else if (stats.errors > 0) {
       actionsApplied.push(`Temp file cleanup encountered ${stats.errors} errors`)
    }
  } catch {
      actionsApplied.push(`Failed to clean temp files`)
  }

  onProgress('Trimming inactive RAM working sets…', 45)

  // Step 2: Memory optimization using existing Memory service
  try {
    const result = await runSafeOptimization(() => {})
    ramFreedBytes = result.recoveredBytes
    processesOptimized = result.processesOptimized
    if (ramFreedBytes > 0 || processesOptimized > 0) {
      actionsApplied.push(`Freed ${Math.round(ramFreedBytes / 1024 / 1024)} MB RAM from ${processesOptimized} processes`)
    }
  } catch { 
     actionsApplied.push(`Failed to optimize memory`)
  }

  onProgress('Finalizing optimization…', 90)

  return {
    ramFreedBytes,
    storageFreedBytes,
    processesOptimized,
    actionsApplied,
    durationMs: Date.now() - startTime,
  }
}
