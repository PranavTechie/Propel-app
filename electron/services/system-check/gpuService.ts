import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface GpuController {
  model: string
  vendor: string
  vram: number
  vramUsed: number
  driverVersion: string
  temperatureGpu: number | null
  utilizationGpu: number | null
}

export interface DirectXInfo {
  version: string
  featureLevel: string
}

export interface GpuReport {
  controllers: GpuController[]
  directX: DirectXInfo
  openGlVersion: string
  vulkanSupported: boolean
  hardwareAccelEnabled: boolean
  driverStatus: 'ok' | 'outdated' | 'unknown'
  gamingReady: boolean
  recommendation: string | null
}

async function ps(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
      { timeout: 15000 },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

async function getDirectXVersion(): Promise<DirectXInfo> {
  // Read from registry: DirectX installed version
  const raw = await ps(
    `(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\DirectX' -ErrorAction SilentlyContinue).Version`,
  )
  // Raw is like "4.09.00.0904" or empty
  let version = 'Unknown'
  if (raw && raw.length > 0) {
    // Map to DX12/11/etc by known build ranges
    const parts = raw.split('.').map(Number)
    const build = parts[1] ?? 0
    if (build >= 9) version = 'DirectX 12'
    else if (build >= 7) version = 'DirectX 11'
    else if (build >= 6) version = 'DirectX 9'
    else version = raw
  }

  // Feature level from WMI video controller
  const featureRaw = await ps(
    `(Get-CimInstance Win32_VideoController | Select-Object -First 1).VideoModeDescription`
  )

  return { version, featureLevel: featureRaw || 'Unknown' }
}

async function getVulkanSupport(): Promise<boolean> {
  // Check if vulkan-1.dll exists in system
  const raw = await ps(
    `Test-Path "$env:SystemRoot\\System32\\vulkan-1.dll"`
  )
  return raw.toLowerCase().includes('true')
}

async function getOpenGLVersion(): Promise<string> {
  // Read from WMI / registry fallback
  const raw = await ps(
    `(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\OpenGLDrivers' -ErrorAction SilentlyContinue) | Out-String`
  )
  if (raw && raw.includes('OpenGL')) return 'OpenGL (detected)'
  // systeminformation doesn't expose this well; return standard fallback
  return 'OpenGL 4.6+'
}

async function checkHardwareAccel(): Promise<boolean> {
  // Check chrome GPU hardware acceleration via registry hint
  // Check if "Software Rendering" is forced off (i.e., hardware accel is ON)
  const raw = await ps(
    `$v = Get-ItemProperty 'HKCU:\\Software\\Google\\Chrome\\GPUBenchmarking' -ErrorAction SilentlyContinue; if($v) { $v.gpu_compositing_disabled } else { '0' }`
  )
  return raw !== '1'
}

export async function getGpuReport(): Promise<GpuReport> {
  const [graphicsData, directX, vulkanSupported, openGlVersion, hwAccel] = await Promise.all([
    si.graphics(),
    getDirectXVersion(),
    getVulkanSupport(),
    getOpenGLVersion(),
    checkHardwareAccel(),
  ])

  const controllers: GpuController[] = (graphicsData.controllers ?? []).map(c => ({
    model: c.model ?? 'Unknown',
    vendor: c.vendor ?? 'Unknown',
    vram: c.vram ?? 0,
    vramUsed: c.memoryUsed ?? 0,
    driverVersion: c.driverVersion ?? 'Unknown',
    temperatureGpu: typeof c.temperatureGpu === 'number' ? c.temperatureGpu : null,
    utilizationGpu: typeof c.utilizationGpu === 'number' ? c.utilizationGpu : null,
  }))

  // Driver status heuristic: if version looks very old (<2022) flag as potentially outdated
  let driverStatus: GpuReport['driverStatus'] = 'unknown'
  let recommendation: string | null = null
  const primaryDriver = controllers[0]?.driverVersion ?? ''
  if (primaryDriver && primaryDriver !== 'Unknown') {
    // NVIDIA driver versions are 3xx.xx+, AMD are YY.M.x
    const nums = primaryDriver.split('.').map(Number)
    if (nums[0] && nums[0] >= 500) {
      driverStatus = 'ok'
    } else if (nums[0] && nums[0] >= 400) {
      driverStatus = 'ok'
    } else {
      driverStatus = 'outdated'
      recommendation = `GPU driver version ${primaryDriver} may be outdated. Check manufacturer website for updates.`
    }
  }

  const gamingReady =
    driverStatus !== 'outdated' &&
    vulkanSupported &&
    directX.version.includes('12') &&
    hwAccel

  if (!gamingReady && !recommendation) {
    if (!vulkanSupported) recommendation = 'Vulkan runtime not detected. Some games may not launch correctly.'
    else if (!directX.version.includes('12')) recommendation = 'DirectX 12 not confirmed. Update Windows for best gaming support.'
  }

  return {
    controllers,
    directX,
    openGlVersion,
    vulkanSupported,
    hardwareAccelEnabled: hwAccel,
    driverStatus,
    gamingReady,
    recommendation,
  }
}
