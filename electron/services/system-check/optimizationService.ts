import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

async function ps(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${cmd.replace(/\r?\n/g, ' ')}"`,
      { timeout: 12000 },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

export type OptimizationSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface OptimizationFinding {
  id: string
  category: string
  title: string
  detail: string
  severity: OptimizationSeverity
  fixAvailable: boolean
  fixLabel?: string
}

export interface OptimizationReport {
  findings: OptimizationFinding[]
  optimizationScore: number
  criticalCount: number
  highCount: number
}

export interface SharedSystemInfo {
  mem?: si.Systeminformation.MemData
  currentLoad?: si.Systeminformation.CurrentLoadData
  graphics?: si.Systeminformation.GraphicsData
}

async function getTempDirSize(): Promise<number> {
  const dirs = [
    process.env.TEMP ?? os.tmpdir(),
    path.join(process.env.LOCALAPPDATA ?? '', 'Temp'),
    path.join(process.env.WINDIR ?? 'C:\\Windows', 'Temp'),
  ]
  let total = 0
  
  async function sizeDir(d: string) {
    try {
      if (!fs.existsSync(d)) return
      const entries = await fs.promises.readdir(d, { withFileTypes: true })
      for (const e of entries) {
        const full = path.join(d, e.name)
        try {
          if (e.isFile()) {
            const stat = await fs.promises.stat(full)
            total += stat.size
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  
  await Promise.allSettled(dirs.map(sizeDir))
  return total
}

export async function getOptimizationReport(sharedData?: SharedSystemInfo): Promise<OptimizationReport> {
  const findings: OptimizationFinding[] = []

  const [mem, cpuLoad, processes] = await Promise.all([
    sharedData?.mem ? Promise.resolve(sharedData.mem) : si.mem(),
    sharedData?.currentLoad ? Promise.resolve(sharedData.currentLoad) : si.currentLoad(),
    si.processes(),
  ])

  // ── RAM pressure ───────────────────────────────────────────────────────
  const ramPct = Math.round((mem.used / mem.total) * 100)
  if (ramPct > 85) {
    findings.push({
      id: 'ram_pressure',
      category: 'Memory',
      title: 'Critical RAM Pressure',
      detail: `${ramPct}% RAM in use. System is likely paging heavily to disk.`,
      severity: 'critical',
      fixAvailable: true,
      fixLabel: 'Optimize RAM',
    })
  } else if (ramPct > 70) {
    findings.push({
      id: 'ram_moderate',
      category: 'Memory',
      title: 'High RAM Usage',
      detail: `${ramPct}% RAM in use. Performance may be impacted.`,
      severity: 'high',
      fixAvailable: true,
    })
  }

  // ── CPU idle usage ──────────────────────────────────────────────────────
  if (cpuLoad.currentLoad > 30) {
    findings.push({
      id: 'cpu_idle_high',
      category: 'CPU',
      title: 'High Idle CPU Usage',
      detail: `CPU is at ${Math.round(cpuLoad.currentLoad)}% while no heavy workload is expected. Background processes may be consuming resources.`,
      severity: cpuLoad.currentLoad > 50 ? 'high' : 'medium',
      fixAvailable: false,
    })
  }

  // ── Temp junk ──────────────────────────────────────────────────────────
  const junkBytes = await getTempDirSize()
  if (junkBytes > 500 * 1024 * 1024) {
    findings.push({
      id: 'temp_junk',
      category: 'Storage',
      title: 'Large Temp File Accumulation',
      detail: `${Math.round(junkBytes / 1024 / 1024)} MB of temporary junk files detected.`,
      severity: junkBytes > 2 * 1024 * 1024 * 1024 ? 'high' : 'medium',
      fixAvailable: true,
      fixLabel: 'Run Cleaner',
    })
  }

  // ── Background processes ────────────────────────────────────────────────
  const SYSTEM_SKIP = ['system', 'idle', 'smss', 'csrss', 'wininit', 'winlogon', 'lsass', 'services', 'svchost', 'dwm']
  const bgCount = processes.list.filter(p => {
    const name = p.name.toLowerCase().replace('.exe', '')
    return !SYSTEM_SKIP.some(s => name.includes(s)) && p.cpu < 0.1
  }).length

  if (bgCount > 120) {
    findings.push({
      id: 'bg_processes',
      category: 'Processes',
      title: 'Excessive Background Processes',
      detail: `${bgCount} idle background processes detected. Reducing their priority frees CPU scheduling.`,
      severity: 'medium',
      fixAvailable: false,
    })
  }

  // ── Power plan ─────────────────────────────────────────────────────────
  const powerPlanRaw = await ps(`powercfg /getactivescheme`)
  if (powerPlanRaw.toLowerCase().includes('power saver') || powerPlanRaw.toLowerCase().includes('378')) {
    findings.push({
      id: 'power_plan',
      category: 'Performance',
      title: 'Power Saver Plan Active',
      detail: 'Power Saver mode limits CPU performance. Switch to Balanced or High Performance for better speed.',
      severity: 'high',
      fixAvailable: false,
    })
  }

  // ── Virtual memory ─────────────────────────────────────────────────────
  const vmRaw = await ps(`(Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue).CurrentUsage`)
  if (vmRaw) {
    const vmUsageMB = parseInt(vmRaw, 10)
    if (vmUsageMB > 2048) {
      findings.push({
        id: 'virtual_memory',
        category: 'Memory',
        title: 'High Virtual Memory Usage',
        detail: `${vmUsageMB} MB of pagefile in use. System is swapping — adding RAM would help.`,
        severity: 'high',
        fixAvailable: false,
      })
    }
  }

  // ── Game Mode ─────────────────────────────────────────────────────────
  const gameModeRaw = await ps(
    `(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\GameBar' -ErrorAction SilentlyContinue).AutoGameModeEnabled`
  )
  if (gameModeRaw === '0') {
    findings.push({
      id: 'game_mode_off',
      category: 'Gaming',
      title: 'Windows Game Mode Disabled',
      detail: 'Enabling Game Mode can improve gaming performance.',
      severity: 'low',
      fixAvailable: false,
    })
  }

  // ── GPU Scheduling ─────────────────────────────────────────────────────
  const gpuSchedRaw = await ps(
    `(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -ErrorAction SilentlyContinue).HwSchMode`
  )
  if (gpuSchedRaw === '' || gpuSchedRaw === '0') {
    findings.push({
      id: 'gpu_scheduling',
      category: 'GPU',
      title: 'Hardware-Accelerated GPU Scheduling Disabled',
      detail: 'HAGS can reduce latency in games when enabled on supported GPUs (NVIDIA 10xx+, AMD 5000+).',
      severity: 'low',
      fixAvailable: false,
    })
  }

  // ── Storage Sense ─────────────────────────────────────────────────────
  const storageSenseRaw = await ps(
    `(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy' -ErrorAction SilentlyContinue).'01'`
  )
  if (storageSenseRaw !== '1') {
    findings.push({
      id: 'storage_sense',
      category: 'Storage',
      title: 'Storage Sense Not Configured',
      detail: 'Storage Sense automatically removes junk. Enable it in Windows Settings > Storage.',
      severity: 'low',
      fixAvailable: false,
    })
  }

  // ── TRIM on SSDs ──────────────────────────────────────────────────────
  const trimRaw = await ps(
    `(fsutil behavior query disabledeletenotify) -join ' '`
  )
  if (trimRaw.includes('1')) {
    findings.push({
      id: 'trim_disabled',
      category: 'Storage',
      title: 'SSD TRIM Disabled',
      detail: 'TRIM improves SSD performance over time. It appears to be disabled on at least one drive.',
      severity: 'medium',
      fixAvailable: false,
    })
  }

  // ── Pending restart ────────────────────────────────────────────────────
  const restartRaw = await ps(
    `Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending'`
  )
  if (restartRaw.toLowerCase() === 'true') {
    findings.push({
      id: 'pending_restart',
      category: 'Windows',
      title: 'System Restart Pending',
      detail: 'A restart is required to complete updates or system changes.',
      severity: 'medium',
      fixAvailable: false,
    })
  }

  // ── Score ──────────────────────────────────────────────────────────────
  const severityWeights: Record<OptimizationSeverity, number> = { critical: 25, high: 15, medium: 8, low: 3 }
  const deduction = findings.reduce((acc, f) => acc + severityWeights[f.severity], 0)
  const optimizationScore = Math.max(0, 100 - deduction)

  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length

  return { findings, optimizationScore, criticalCount, highCount }
}
