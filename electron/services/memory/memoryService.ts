import si from 'systeminformation'
import { exec } from 'child_process'
import * as os from 'os'

let _lastCached = 0
let _lastCachedTime = 0

export interface MemoryDetails {
  total: number
  used: number
  free: number
  active: number
  available: number
  cached: number
  swapTotal: number
  swapUsed: number
  swapFree: number
  pressurePercent: number
  cachedPercent: number
  availablePercent: number
}

export async function getMemoryDetails(): Promise<MemoryDetails> {
  const mem = await si.mem()
  const total = mem.total || 1

  // 60-second polling interval (only runs when MemoryPage is active & polling)
  if (os.platform() === 'win32' && mem.buffcache === 0) {
    const now = Date.now()
    if (now - _lastCachedTime > 60000) {
      _lastCachedTime = now
      exec(
        `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory | Select-Object StandbyCacheCoreBytes,StandbyCacheNormalPriorityBytes,StandbyCacheReserveBytes,CacheBytes | ConvertTo-Json"`,
        { windowsHide: true },
        (err, stdout) => {
          if (!err && stdout) {
            try {
              const data = JSON.parse(stdout)
              _lastCached =
                (data.StandbyCacheCoreBytes || 0) +
                (data.StandbyCacheNormalPriorityBytes || 0) +
                (data.StandbyCacheReserveBytes || 0) +
                (data.CacheBytes || 0)
            } catch (e) {}
          }
        }
      )
    }
    mem.buffcache = _lastCached
  }

  return {
    total: mem.total,
    used: mem.used,
    free: mem.free,
    active: mem.active,
    available: mem.available,
    cached: mem.buffcache,
    swapTotal: mem.swaptotal,
    swapUsed: mem.swapused,
    swapFree: mem.swapfree,
    pressurePercent: Math.round((mem.used / total) * 100),
    cachedPercent: Math.round((mem.buffcache / total) * 100),
    availablePercent: Math.round((mem.available / total) * 100),
  }
}
