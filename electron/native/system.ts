import { execSync } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import si from 'systeminformation'

export function getDeviceUUID(): { device_id: string; registered_at?: string } {
  const userData = process.env.APPDATA ?? os.homedir()
  const storePath = path.join(userData, 'propel_device_id.json')
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed.device_id) return { device_id: parsed.device_id, registered_at: parsed.registered_at }
  } catch {
    // not found or invalid
  }
  const newId = crypto.randomUUID()
  try {
    fs.writeFileSync(storePath, JSON.stringify({ device_id: newId, created_at: new Date().toISOString() }))
  } catch {
    // ignore
  }
  return { device_id: newId }
}

export function markDeviceRegistered(): void {
  const userData = process.env.APPDATA ?? os.homedir()
  const storePath = path.join(userData, 'propel_device_id.json')
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed.registered_at) {
      parsed.registered_at = new Date().toISOString()
      fs.writeFileSync(storePath, JSON.stringify(parsed))
    }
  } catch {
    // ignore
  }
}

export function clearDeviceRegistration(): void {
  const userData = process.env.APPDATA ?? os.homedir()
  const storePath = path.join(userData, 'propel_device_id.json')
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed.registered_at) {
      delete parsed.registered_at
      fs.writeFileSync(storePath, JSON.stringify(parsed))
    }
  } catch {
    // ignore
  }
}

export interface SystemStats {
  cpu: number
  ram: { used: number; total: number; free: number; percent: number }
  disk: { used: number; total: number; free: number; percent: number }
  network: { download: number; upload: number }
  uptime: number
  processes: number
  cpuModel: string
  cpuCores: number
  cpuSpeed: number
}

let _lastNetRx = 0
let _lastNetTx = 0
let _lastNetTime = 0

export async function getSystemStats(): Promise<SystemStats> {
  const [cpuLoad, mem, diskData, netStats, processes, cpuInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.processes(),
    si.cpu(),
  ])

  const systemDrive = diskData.find(d => d.mount === 'C:' || d.mount === '/') ?? diskData[0]

  const now = Date.now()
  let download = 0
  let upload = 0
  if (_lastNetTime > 0 && netStats.length > 0) {
    const elapsed = (now - _lastNetTime) / 1000
    const totalRx = netStats.reduce((a, n) => a + n.rx_bytes, 0)
    const totalTx = netStats.reduce((a, n) => a + n.tx_bytes, 0)
    download = Math.max(0, ((totalRx - _lastNetRx) * 8) / elapsed / 1_000_000)
    upload = Math.max(0, ((totalTx - _lastNetTx) * 8) / elapsed / 1_000_000)
    _lastNetRx = totalRx
    _lastNetTx = totalTx
  } else if (netStats.length > 0) {
    _lastNetRx = netStats.reduce((a, n) => a + n.rx_bytes, 0)
    _lastNetTx = netStats.reduce((a, n) => a + n.tx_bytes, 0)
  }
  _lastNetTime = now

  return {
    cpu: Math.round(cpuLoad.currentLoad),
    ram: {
      used: mem.used,
      total: mem.total,
      free: mem.free,
      percent: Math.round((mem.used / mem.total) * 100),
    },
    disk: {
      used: systemDrive?.used ?? 0,
      total: systemDrive?.size ?? 0,
      free: (systemDrive?.size ?? 0) - (systemDrive?.used ?? 0),
      percent: Math.round(systemDrive?.use ?? 0),
    },
    network: { download: parseFloat(download.toFixed(2)), upload: parseFloat(upload.toFixed(2)) },
    uptime: Math.floor(os.uptime()),
    processes: processes.all,
    cpuModel: `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
    cpuCores: cpuInfo.physicalCores,
    cpuSpeed: cpuInfo.speed,
  }
}

function wmicQuery(args: string[]): string {
  try {
    const result = execSync(`wmic ${args.join(' ')}`, {
      timeout: 5000,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const lines = result.split('\n').map(l => l.trim()).filter(Boolean)
    const val = lines[1] ?? ''
    if (val && !val.toLowerCase().includes('deprecated')) return val
  } catch {
    // WMIC failed or is deprecated/removed on Windows 11 24H2
  }

  // Fallback to Get-CimInstance for exact same WMI property without stderr noise
  try {
    let psCmd = ''
    if (args[0] === 'baseboard') {
      psCmd = '(Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue).SerialNumber'
    } else if (args[0] === 'diskdrive') {
      psCmd = '(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object -First 1).SerialNumber'
    } else if (args[0] === 'cpu') {
      psCmd = '(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).ProcessorId'
    }
    if (psCmd) {
      const psResult = execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
        timeout: 5000,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return psResult.trim()
    }
  } catch {
    // Return empty string to allow getHWID fallback to take effect
  }

  return ''
}

export async function isAdmin(): Promise<boolean> {
  try {
    const result = execSync(
      'powershell -NoProfile -NonInteractive -Command "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"',
      { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return result.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

export async function optimizeDrive(
  driveLetter: string = 'C',
): Promise<{ success: boolean; message?: string; error?: string }> {
  const elevated = await isAdmin()
  if (!elevated) {
    return {
      success: false,
      error: 'This action requires Administrator privileges. Please restart Propel as Administrator.',
    }
  }

  const cleanLetter = driveLetter.replace(/[^a-zA-Z]/g, '') || 'C'
  try {
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Optimize-Volume -DriveLetter ${cleanLetter} -Defrag"`,
      { timeout: 30000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return {
      success: true,
      message: `Drive ${cleanLetter}: optimization completed successfully.`,
    }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message ?? 'Drive optimization failed.',
    }
  }
}

export function getHWID(): string {
  try {
    let board = wmicQuery(['baseboard', 'get', 'SerialNumber'])
    let disk = wmicQuery(['diskdrive', 'get', 'SerialNumber'])
    let cpu = wmicQuery(['cpu', 'get', 'ProcessorId'])

    const isGeneric = (s: string) =>
      !s ||
      s.toLowerCase().includes('o.e.m') ||
      s.toLowerCase().includes('default') ||
      s.toLowerCase().includes('to be filled') ||
      s.toLowerCase().includes('none') ||
      s === '0'

    if (isGeneric(board)) board = os.hostname()
    if (isGeneric(disk)) disk = os.arch()
    if (isGeneric(cpu)) cpu = os.cpus()[0]?.model ?? 'unknown'

    const raw = `${board}|${disk}|${cpu}`
    return crypto.createHash('sha256').update(raw).digest('hex')
  } catch {
    const fallback = `${os.hostname()}|${os.platform()}|${os.arch()}`
    return crypto.createHash('sha256').update(fallback).digest('hex')
  }
}

export function getFingerprint(): string {
  try {
    const data = [
      os.platform(),
      os.version(),
      os.arch(),
      os.cpus()[0]?.model ?? '',
      os.userInfo().username,
      String(os.totalmem()),
    ].join('|')
    return crypto.createHash('sha256').update(data).digest('hex')
  } catch {
    return 'unknown'
  }
}


export function getLicenseStorePath(): string {
  const userData = process.env.APPDATA ?? os.homedir()
  return path.join(userData, 'propel_license.json')
}

export function saveLicenseKey(key: string): void {
  fs.writeFileSync(getLicenseStorePath(), JSON.stringify({ key, saved_at: new Date().toISOString() }))
}

export function loadLicenseKey(): string | null {
  try {
    const raw = fs.readFileSync(getLicenseStorePath(), 'utf8')
    return JSON.parse(raw).key ?? null
  } catch {
    return null
  }
}

export function clearLicenseKey(): void {
  try {
    fs.unlinkSync(getLicenseStorePath())
  } catch {
    // already gone
  }
}
