import si from 'systeminformation'

export interface ThermalInfo {
  cpuTemp: number | null
  gpuTemp: number | null
  maxTemp: number | null
  allTemps: Array<{ label: string; temp: number }>
  throttling: boolean
  status: 'cool' | 'warm' | 'hot' | 'critical'
  statusLabel: string
  thermalScore: number
  recommendation: string | null
}

function classifyTemp(cpuTemp: number | null): ThermalInfo['status'] {
  if (cpuTemp === null) return 'cool'
  if (cpuTemp < 50) return 'cool'
  if (cpuTemp < 70) return 'warm'
  if (cpuTemp < 85) return 'hot'
  return 'critical'
}

function thermalScore(cpuTemp: number | null, gpuTemp: number | null): number {
  const cpu = cpuTemp ?? 40
  const gpu = gpuTemp ?? 40
  const maxT = Math.max(cpu, gpu)
  if (maxT < 45) return 100
  if (maxT < 60) return Math.round(100 - ((maxT - 45) / 15) * 20)  // 100→80
  if (maxT < 75) return Math.round(80 - ((maxT - 60) / 15) * 35)   // 80→45
  if (maxT < 90) return Math.round(45 - ((maxT - 75) / 15) * 40)   // 45→5
  return 5
}

import { SharedSystemInfo } from './optimizationService'

export async function getThermalInfo(sharedData?: SharedSystemInfo): Promise<ThermalInfo> {
  const [cpuTempData, graphics] = await Promise.all([
    si.cpuTemperature().catch(() => ({ main: null, cores: [], max: null })),
    sharedData?.graphics ? Promise.resolve(sharedData.graphics).catch(() => ({ controllers: [] })) : si.graphics().catch(() => ({ controllers: [] })),
  ])

  const cpuTemp =
    typeof cpuTempData.main === 'number' && cpuTempData.main > 0
      ? Math.round(cpuTempData.main)
      : null

  const gpuTemp =
    graphics.controllers?.[0]?.temperatureGpu != null &&
    (graphics.controllers[0].temperatureGpu as number) > 0
      ? Math.round(graphics.controllers[0].temperatureGpu as number)
      : null

  const allTemps: ThermalInfo['allTemps'] = []
  if (cpuTemp !== null) allTemps.push({ label: 'CPU', temp: cpuTemp })
  if (gpuTemp !== null) allTemps.push({ label: 'GPU', temp: gpuTemp })
  ;(cpuTempData.cores ?? []).forEach((t, i) => {
    if (typeof t === 'number' && t > 0) allTemps.push({ label: `Core ${i + 1}`, temp: Math.round(t) })
  })

  const maxTemp = allTemps.length > 0 ? Math.max(...allTemps.map(t => t.temp)) : null
  const status = classifyTemp(cpuTemp ?? gpuTemp)
  const statusLabels: Record<ThermalInfo['status'], string> = {
    cool: 'Cool',
    warm: 'Warm',
    hot: 'Hot',
    critical: 'Critical',
  }

  let recommendation: string | null = null
  if (status === 'critical') {
    recommendation = 'CPU temperature is critically high. Check cooling, dust filters, and thermal paste.'
  } else if (status === 'hot') {
    recommendation = 'Temperatures are elevated. Ensure adequate airflow and clean dust from vents.'
  }

  // Throttling: if CPU temp > 90 it's very likely throttling (conservative heuristic)
  const throttling = (cpuTemp ?? 0) > 90

  return {
    cpuTemp,
    gpuTemp,
    maxTemp,
    allTemps,
    throttling,
    status,
    statusLabel: statusLabels[status],
    thermalScore: thermalScore(cpuTemp, gpuTemp),
    recommendation,
  }
}
