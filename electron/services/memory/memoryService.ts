import si from 'systeminformation'

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
