import si from 'systeminformation'

export interface BatteryInfo {
  hasBattery: boolean
  percent: number
  isCharging: boolean
  cycleCount: number | null
  designCapacity: number | null
  currentCapacity: number | null
  healthPercent: number | null
  timeRemaining: number | null
  voltage: number | null
  wearLevel: number | null
  status: 'healthy' | 'degraded' | 'poor' | 'unknown'
  recommendation: string | null
}

export async function getBatteryInfo(): Promise<BatteryInfo> {
  try {
    const bat = await si.battery()

    if (!bat.hasBattery) {
      return {
        hasBattery: false,
        percent: 0,
        isCharging: false,
        cycleCount: null,
        designCapacity: null,
        currentCapacity: null,
        healthPercent: null,
        timeRemaining: null,
        voltage: null,
        wearLevel: null,
        status: 'unknown',
        recommendation: null,
      }
    }

    const designCap = bat.designedCapacity ?? null
    const currentCap = bat.maxCapacity ?? null
    const healthPercent =
      designCap && currentCap && designCap > 0
        ? Math.round((currentCap / designCap) * 100)
        : null
    const wearLevel =
      healthPercent !== null ? Math.max(0, 100 - healthPercent) : null

    let status: BatteryInfo['status'] = 'unknown'
    let recommendation: string | null = null
    if (healthPercent !== null) {
      if (healthPercent >= 80) status = 'healthy'
      else if (healthPercent >= 60) {
        status = 'degraded'
        recommendation = `Battery health is ${healthPercent}%. Consider reducing charge cycles.`
      } else {
        status = 'poor'
        recommendation = `Battery health is critically low (${healthPercent}%). Battery replacement recommended.`
      }
    }

    return {
      hasBattery: true,
      percent: bat.percent ?? 0,
      isCharging: bat.isCharging ?? false,
      cycleCount: bat.cycleCount ?? null,
      designCapacity: designCap,
      currentCapacity: currentCap,
      healthPercent,
      timeRemaining: bat.timeRemaining ?? null,
      voltage: bat.voltage ?? null,
      wearLevel,
      status,
      recommendation,
    }
  } catch {
    return {
      hasBattery: false,
      percent: 0,
      isCharging: false,
      cycleCount: null,
      designCapacity: null,
      currentCapacity: null,
      healthPercent: null,
      timeRemaining: null,
      voltage: null,
      wearLevel: null,
      status: 'unknown',
      recommendation: null,
    }
  }
}
