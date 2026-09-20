import { getHardwareInfo, type HardwareInfo } from './hardwareService'
import { getGpuReport, type GpuReport } from './gpuService'
import { getDiskHealth, type DiskHealthReport } from './diskHealthService'
import { getThermalInfo, type ThermalInfo } from './thermalService'
import { getNetworkInfo, type NetworkInfo } from './networkService'
import { getSecurityStatus, type SecurityStatus } from './securityService'
import { getBatteryInfo, type BatteryInfo } from './batteryService'
import { getOptimizationReport, type OptimizationReport } from './optimizationService'

export interface SubsystemHealthData {
  hardware?: HardwareInfo | null
  gpu?: GpuReport | null
  disk?: DiskHealthReport | null
  thermal?: ThermalInfo | null
  network?: NetworkInfo | null
  security?: SecurityStatus | null
  battery?: BatteryInfo | null
  optimization?: OptimizationReport | null
}

export interface HealthScoreBreakdown {
  overall: number
  cpu: number
  memory: number
  thermal: number
  disk: number
  security: number
  gpu: number
  network: number
  battery: number
  optimization: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label: string
  criticalIssues: string[]
}

type AllData = Awaited<ReturnType<typeof computeHealthScore>> extends { breakdown: infer B } ? B : never

function grade(score: number): HealthScoreBreakdown['grade'] {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

function gradeLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 45) return 'Poor'
  return 'Critical'
}

export async function computeHealthScore(
  preloadedData?: SubsystemHealthData,
): Promise<{ breakdown: HealthScoreBreakdown }> {
  let hwData: HardwareInfo | null
  let gpuData: GpuReport | null
  let diskData: DiskHealthReport | null
  let thermalData: ThermalInfo | null
  let networkData: NetworkInfo | null
  let secData: SecurityStatus | null
  let batData: BatteryInfo | null
  let optData: OptimizationReport | null

  if (preloadedData) {
    hwData = preloadedData.hardware ?? null
    gpuData = preloadedData.gpu ?? null
    diskData = preloadedData.disk ?? null
    thermalData = preloadedData.thermal ?? null
    networkData = preloadedData.network ?? null
    secData = preloadedData.security ?? null
    batData = preloadedData.battery ?? null
    optData = preloadedData.optimization ?? null
  } else {
    const [hw, gpu, disk, thermal, network, security, battery, opt] = await Promise.allSettled([
      getHardwareInfo(),
      getGpuReport(),
      getDiskHealth(),
      getThermalInfo(),
      getNetworkInfo(),
      getSecurityStatus(),
      getBatteryInfo(),
      getOptimizationReport(),
    ])

    hwData = hw.status === 'fulfilled' ? hw.value : null
    gpuData = gpu.status === 'fulfilled' ? gpu.value : null
    diskData = disk.status === 'fulfilled' ? disk.value : null
    thermalData = thermal.status === 'fulfilled' ? thermal.value : null
    networkData = network.status === 'fulfilled' ? network.value : null
    secData = security.status === 'fulfilled' ? security.value : null
    batData = battery.status === 'fulfilled' ? battery.value : null
    optData = opt.status === 'fulfilled' ? opt.value : null
  }

  const criticalIssues: string[] = []

  // ── CPU score ──────────────────────────────────────────────────────────
  let cpuScore = 90
  if (hwData) {
    const loadPct = hwData.cpu.load
    if (loadPct > 80) { cpuScore = 40; criticalIssues.push('CPU under heavy sustained load') }
    else if (loadPct > 50) cpuScore = 65
  }

  // ── Memory score ──────────────────────────────────────────────────────
  let memScore = 90
  if (hwData) {
    const used = hwData.ram.pressurePercent
    if (used > 85) { memScore = 35; criticalIssues.push(`RAM usage critically high (${used}%)`) }
    else if (used > 70) memScore = 60
    else if (used > 55) memScore = 75
  }

  // ── Thermal score ─────────────────────────────────────────────────────
  const thermalScore = thermalData?.thermalScore ?? 80
  if (thermalData && thermalData.status === 'critical') {
    criticalIssues.push(`CPU temperature critical (${thermalData.cpuTemp}°C)`)
  }

  // ── Disk score ────────────────────────────────────────────────────────
  let diskScore = 85
  if (diskData) {
    if (diskData.criticalWarnings.length > 0) {
      diskScore = 40
      diskData.criticalWarnings.forEach(w => criticalIssues.push(w))
    } else {
      const worstDrive = diskData.drives.reduce((a, b) => a.healthPercent < b.healthPercent ? a : b, { healthPercent: 100 } as any)
      diskScore = worstDrive.healthPercent ?? 80
    }
  }

  // ── Security score ────────────────────────────────────────────────────
  const securityScore = secData?.securityScore ?? 70
  if (secData) {
    secData.issues.forEach(i => criticalIssues.push(i))
  }

  // ── GPU score ─────────────────────────────────────────────────────────
  let gpuScore = 80
  if (gpuData) {
    if (gpuData.driverStatus === 'outdated') { gpuScore = 60 }
  }

  // ── Network score ─────────────────────────────────────────────────────
  const networkScore = networkData?.qualityScore ?? 80
  if (networkData && networkData.latencyMs < 0) {
    criticalIssues.push('No internet connectivity detected')
  }

  // ── Battery score ─────────────────────────────────────────────────────
  let batteryScore = 90
  if (batData && batData.hasBattery) {
    batteryScore = batData.healthPercent ?? 80
    if ((batData.healthPercent ?? 100) < 60) {
      criticalIssues.push(`Battery health poor (${batData.healthPercent}%)`)
    }
  }

  // ── Optimization score ────────────────────────────────────────────────
  const optimizationScore = optData?.optimizationScore ?? 80

  // ── Weighted overall ──────────────────────────────────────────────────
  // Weights total 100:
  //   security 22, thermal 18, memory 15, cpu 12, disk 10, gpu 8, optimization 7, network 5, battery 3
  const overall = Math.round(
    cpuScore * 0.12 +
    memScore * 0.15 +
    thermalScore * 0.18 +
    diskScore * 0.10 +
    securityScore * 0.22 +
    gpuScore * 0.08 +
    networkScore * 0.05 +
    batteryScore * 0.03 +
    optimizationScore * 0.07,
  )

  return {
    breakdown: {
      overall: Math.max(0, Math.min(100, overall)),
      cpu: cpuScore,
      memory: memScore,
      thermal: thermalScore,
      disk: diskScore,
      security: securityScore,
      gpu: gpuScore,
      network: networkScore,
      battery: batteryScore,
      optimization: optimizationScore,
      grade: grade(overall),
      label: gradeLabel(overall),
      criticalIssues: [...new Set(criticalIssues)],
    },
  }
}
