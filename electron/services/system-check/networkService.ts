import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface NetworkInfo {
  activeAdapter: string
  type: string
  localIP: string
  publicIP: string
  macAddress: string
  speed: number
  downloadSpeedMbps: number
  uploadSpeedMbps: number
  latencyMs: number
  dnsResponseMs: number
  wifiSignal: number | null
  wifiSSID: string | null
  qualityScore: number
  issues: string[]
}

async function ps(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
      { timeout: 10000 },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

async function measureLatency(): Promise<number> {
  try {
    const { stdout } = await execAsync('ping -n 4 8.8.8.8', { timeout: 12000 })
    const match = stdout.match(/Average\s*=\s*(\d+)ms/i)
    if (match) return parseInt(match[1], 10)
    // fallback parse for non-English Windows
    const match2 = stdout.match(/(\d+)ms/g)
    if (match2) return parseInt(match2[match2.length - 1], 10)
  } catch { /* ignore */ }
  return -1
}

async function measureDnsResponse(): Promise<number> {
  const start = Date.now()
  try {
    await execAsync('nslookup google.com 8.8.8.8', { timeout: 8000 })
    return Date.now() - start
  } catch {
    return -1
  }
}

async function getPublicIP(): Promise<string> {
  try {
    const { stdout } = await execAsync('curl -s --max-time 5 https://api.ipify.org', { timeout: 8000 })
    return stdout.trim() || 'Unavailable'
  } catch {
    return 'Unavailable'
  }
}

async function getWifiInfo(): Promise<{ signal: number | null; ssid: string | null }> {
  const raw = await ps(
    `(netsh wlan show interfaces 2>$null) -join '\\n'`,
  )
  if (!raw) return { signal: null, ssid: null }

  const ssidMatch = raw.match(/SSID\s*:\s*(.+)/i)
  const signalMatch = raw.match(/Signal\s*:\s*(\d+)/i)

  return {
    ssid: ssidMatch ? ssidMatch[1].trim() : null,
    signal: signalMatch ? parseInt(signalMatch[1], 10) : null,
  }
}

function networkQualityScore(
  latency: number,
  download: number,
  upload: number,
  wifiSignal: number | null,
): number {
  let score = 100

  if (latency < 0) score -= 30
  else if (latency > 150) score -= 25
  else if (latency > 80) score -= 15
  else if (latency > 40) score -= 5

  if (download < 5) score -= 20
  else if (download < 25) score -= 10

  if (wifiSignal !== null && wifiSignal < 50) score -= 15
  else if (wifiSignal !== null && wifiSignal < 30) score -= 30

  return Math.max(0, Math.min(100, score))
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const [netInterfaces, netStats, publicIP, wifiInfo, latency, dnsMs] = await Promise.all([
    si.networkInterfaces(),
    si.networkStats(),
    getPublicIP(),
    getWifiInfo(),
    measureLatency(),
    measureDnsResponse(),
  ])

  // Pick primary adapter (first non-loopback with IP)
  const ifaces = Array.isArray(netInterfaces) ? netInterfaces : [netInterfaces]
  const primary = ifaces.find(i => !i.internal && i.ip4 && i.ip4 !== '127.0.0.1') ?? ifaces[0]

  // Net stats for primary adapter
  const stat = Array.isArray(netStats) ? netStats.find(s => s.iface === primary?.iface) ?? netStats[0] : netStats

  const downloadSpeedMbps = stat ? Math.round((stat.rx_sec ?? 0) / 125000 * 10) / 10 : 0
  const uploadSpeedMbps = stat ? Math.round((stat.tx_sec ?? 0) / 125000 * 10) / 10 : 0

  const issues: string[] = []
  if (latency > 150) issues.push('High latency detected (>150ms)')
  if (latency < 0) issues.push('Cannot reach internet (ping failed)')
  if (wifiInfo.signal !== null && wifiInfo.signal < 50) issues.push(`Weak WiFi signal (${wifiInfo.signal}%)`)
  if (dnsMs > 500) issues.push('Slow DNS response (>500ms)')

  const qualityScore = networkQualityScore(latency, downloadSpeedMbps, uploadSpeedMbps, wifiInfo.signal)

  return {
    activeAdapter: primary?.iface ?? 'Unknown',
    type: primary?.type ?? 'Unknown',
    localIP: primary?.ip4 ?? 'Unknown',
    publicIP,
    macAddress: primary?.mac ?? 'Unknown',
    speed: primary?.speed ?? 0,
    downloadSpeedMbps,
    uploadSpeedMbps,
    latencyMs: latency,
    dnsResponseMs: dnsMs,
    wifiSignal: wifiInfo.signal,
    wifiSSID: wifiInfo.ssid,
    qualityScore,
    issues,
  }
}
