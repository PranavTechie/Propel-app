import si from 'systeminformation'

export interface ProcessMemInfo {
  pid: number
  name: string
  memBytes: number
  memPercent: number
  cpuPercent: number
}

export async function getTopMemoryProcesses(limit = 12): Promise<ProcessMemInfo[]> {
  const [data, mem] = await Promise.all([si.processes(), si.mem()])
  const totalRam = mem.total || 1

  return data.list
    .filter(p => p.mem > 0)
    .sort((a, b) => b.mem - a.mem)
    .slice(0, limit)
    .map(p => ({
      pid: p.pid,
      name: p.name,
      memBytes: Math.round((p.mem / 100) * totalRam),
      memPercent: Math.round(p.mem * 10) / 10,
      cpuPercent: Math.round(p.cpu * 10) / 10,
    }))
}
