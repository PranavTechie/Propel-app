import si from 'systeminformation'

export interface DiskHealthEntry {
  name: string
  type: string
  size: number
  temperature: number | null
  smartStatus: string
  healthPercent: number
  usedPercent: number
  freeBytes: number
  totalBytes: number
  usedBytes: number
  warnings: string[]
}

export interface DiskHealthReport {
  drives: DiskHealthEntry[]
  totalReclaimableBytes: number
  overallHealthy: boolean
  criticalWarnings: string[]
}

// Map SMART status to a health percent estimate
function smartToHealth(status: string): number {
  const s = (status ?? '').toLowerCase()
  if (s === 'ok' || s === 'good') return 95
  if (s.includes('unknown')) return 70
  if (s.includes('caution') || s.includes('warning')) return 45
  if (s.includes('bad') || s.includes('failing') || s.includes('error')) return 10
  return 70
}

export async function getDiskHealth(): Promise<DiskHealthReport> {
  const [diskLayout, fsSize, diskTempData] = await Promise.all([
    si.diskLayout(),
    si.fsSize(),
    si.disksIO().catch(() => null),
  ])

  const drives: DiskHealthEntry[] = []
  const criticalWarnings: string[] = []
  let totalReclaimableBytes = 0

  for (const disk of diskLayout) {
    const warnings: string[] = []

    // Find matching filesystem
    const fs = fsSize.find(f => f.fs && (f.fs.includes(disk.name.replace('/dev/', '')) || f.mount === 'C:' || f.mount === '/'))
    const totalBytes = disk.size
    const usedBytes = fs ? fs.used : 0
    const freeBytes = fs ? fs.available : 0
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0

    const healthPercent = smartToHealth(disk.smartStatus ?? '')
    const temp = typeof disk.temperature === 'number' && disk.temperature > 0 ? disk.temperature : null

    // Warnings
    if (usedPercent > 90) {
      warnings.push('Less than 10% free space — critically low')
      criticalWarnings.push(`${disk.name}: Storage critically low (${usedPercent}% used)`)
    } else if (usedPercent > 80) {
      warnings.push('Low disk space (>80% used)')
    }

    if (temp && temp > 55) {
      warnings.push(`High disk temperature: ${temp}°C`)
      if (temp > 60) criticalWarnings.push(`${disk.name}: Disk temperature critical (${temp}°C)`)
    }

    if (healthPercent < 50) {
      warnings.push('SMART status indicates drive health issues')
      criticalWarnings.push(`${disk.name}: SMART warning — consider backup`)
    }

    // Reclaimable: rough estimate 5% of used space as junk (conservative)
    if (usedBytes > 0) totalReclaimableBytes += Math.round(usedBytes * 0.05)

    drives.push({
      name: disk.name,
      type: disk.type ?? 'Unknown',
      size: disk.size,
      temperature: temp,
      smartStatus: disk.smartStatus ?? 'Unknown',
      healthPercent,
      usedPercent,
      freeBytes,
      totalBytes,
      usedBytes,
      warnings,
    })
  }

  // Fill in per-partition data if diskLayout didn't provide FS info
  for (const fs of fsSize) {
    if (!drives.some(d => d.totalBytes === fs.size || fs.mount === 'C:' || fs.mount === '/')) {
      drives.push({
        name: fs.fs,
        type: 'Unknown',
        size: fs.size,
        temperature: null,
        smartStatus: 'Unknown',
        healthPercent: 70,
        usedPercent: Math.round((fs.used / Math.max(1, fs.size)) * 100),
        freeBytes: fs.available,
        totalBytes: fs.size,
        usedBytes: fs.used,
        warnings: [],
      })
    }
  }

  return {
    drives,
    totalReclaimableBytes,
    overallHealthy: criticalWarnings.length === 0,
    criticalWarnings,
  }
}
