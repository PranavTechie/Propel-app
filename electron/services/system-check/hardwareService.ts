import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface CpuInfo {
  model: string
  cores: number
  threads: number
  speed: number
  maxSpeed: number
  load: number
  manufacturer: string
}

export interface RamInfo {
  total: number
  used: number
  free: number
  pressurePercent: number
  slots: Array<{ size: number; speed: number; type: string; bank: string }>
  speed: number
  type: string
}

export interface MotherboardInfo {
  manufacturer: string
  model: string
  version: string
  biosVersion: string
  biosDate: string
  biosVendor: string
}

export interface StorageDriveInfo {
  name: string
  type: 'SSD' | 'HDD' | 'NVMe' | 'Unknown'
  vendor: string
  size: number
  temperature: number | null
  smartStatus: string
  interfaceType: string
}

export interface DisplayInfo {
  manufacturer: string
  model: string
  resolutionX: number
  resolutionY: number
  refreshRate: number
  connection: string
}

export interface OsInfo {
  platform: string
  distro: string
  release: string
  build: string
  arch: string
  hostname: string
}

export interface HardwareInfo {
  cpu: CpuInfo
  ram: RamInfo
  motherboard: MotherboardInfo
  storage: StorageDriveInfo[]
  displays: DisplayInfo[]
  os: OsInfo
}

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

import { SharedSystemInfo } from './optimizationService'

export async function getHardwareInfo(sharedData?: SharedSystemInfo): Promise<HardwareInfo> {
  const [cpuData, cpuLoad, memData, memLayout, system, bios, diskData, graphics, osData] =
    await Promise.all([
      si.cpu(),
      sharedData?.currentLoad ? Promise.resolve(sharedData.currentLoad) : si.currentLoad(),
      sharedData?.mem ? Promise.resolve(sharedData.mem) : si.mem(),
      si.memLayout(),
      si.system(),
      si.bios(),
      si.diskLayout(),
      sharedData?.graphics ? Promise.resolve(sharedData.graphics) : si.graphics(),
      si.osInfo(),
    ])

  // CPU
  const cpu: CpuInfo = {
    model: cpuData.brand,
    manufacturer: cpuData.manufacturer,
    cores: cpuData.physicalCores,
    threads: cpuData.cores,
    speed: Math.round(cpuData.speed * 10) / 10,
    maxSpeed: Math.round(cpuData.speedMax * 10) / 10,
    load: Math.round(cpuLoad.currentLoad),
  }

  // RAM
  const totalRam = memData.total || 1
  const ramSlots = memLayout.map(s => ({
    size: s.size,
    speed: s.clockSpeed ?? 0,
    type: s.type ?? 'Unknown',
    bank: s.bank ?? '',
  }))
  const avgSpeed = ramSlots.length > 0 ? Math.round(ramSlots.reduce((a, s) => a + s.speed, 0) / ramSlots.length) : 0
  const ramType = ramSlots[0]?.type ?? 'Unknown'
  const ram: RamInfo = {
    total: memData.total,
    used: memData.used,
    free: memData.available,
    pressurePercent: Math.round((memData.used / totalRam) * 100),
    slots: ramSlots,
    speed: avgSpeed,
    type: ramType,
  }

  // Motherboard
  const motherboard: MotherboardInfo = {
    manufacturer: system.manufacturer,
    model: system.model,
    version: system.version ?? '',
    biosVersion: bios.version ?? '',
    biosDate: bios.releaseDate ?? '',
    biosVendor: bios.vendor ?? '',
  }

  // Storage
  const diskTempsRaw = await ps(`
Get-Disk | Select-Object FriendlyName, @{N='Temp';E={ try { (Get-StorageReliabilityCounter -Disk $_ -ErrorAction Stop).Temperature } catch { 0 } }} | ConvertTo-Json -Compress
`)
  let diskTempMap: Record<string, number> = {}
  try {
    const parsed = JSON.parse(diskTempsRaw)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    for (const d of arr) {
      if (d?.FriendlyName) diskTempMap[d.FriendlyName] = d.Temp ?? 0
    }
  } catch { /* skip */ }

  const storage: StorageDriveInfo[] = diskData.map(d => {
    const type: StorageDriveInfo['type'] =
      d.type === 'NVMe' ? 'NVMe'
        : d.type === 'SSD' ? 'SSD'
        : d.type === 'HD' ? 'HDD'
        : 'Unknown'
    const temp = diskTempMap[d.name] ?? null
    return {
      name: d.name,
      type,
      vendor: d.vendor ?? 'Unknown',
      size: d.size,
      temperature: temp && temp > 0 ? temp : null,
      smartStatus: d.smartStatus ?? 'Unknown',
      interfaceType: d.interfaceType ?? '',
    }
  })

  // Displays
  const displays: DisplayInfo[] = (graphics?.displays ?? []).map((d: any) => ({
    manufacturer: d.vendor ?? 'Unknown',
    model: d.model ?? 'Unknown',
    resolutionX: d.currentResX ?? 0,
    resolutionY: d.currentResY ?? 0,
    refreshRate: d.currentRefreshRate ?? 0,
    connection: d.connection ?? '',
  }))

  // OS
  const osInfo: OsInfo = {
    platform: osData.platform,
    distro: osData.distro,
    release: osData.release,
    build: osData.build ?? '',
    arch: osData.arch,
    hostname: osData.hostname,
  }

  return { cpu, ram, motherboard, storage, displays, os: osInfo }
}
