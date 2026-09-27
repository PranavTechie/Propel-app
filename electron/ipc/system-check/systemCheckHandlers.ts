import { ipcMain } from 'electron'
import si from 'systeminformation'
import { getHardwareInfo } from '../../services/system-check/hardwareService'
import { getGpuReport } from '../../services/system-check/gpuService'
import { getDiskHealth } from '../../services/system-check/diskHealthService'
import { getThermalInfo } from '../../services/system-check/thermalService'
import { getNetworkInfo } from '../../services/system-check/networkService'
import { getSecurityStatus } from '../../services/system-check/securityService'
import { getBatteryInfo } from '../../services/system-check/batteryService'
import { getOptimizationReport } from '../../services/system-check/optimizationService'
import { computeHealthScore } from '../../services/system-check/healthScoreService'

export function setupSystemCheckIPC(): void {
  ipcMain.handle('systemcheck:get-hardware', async () => {
    try {
      return { ok: true, data: await getHardwareInfo() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-gpu', async () => {
    try {
      return { ok: true, data: await getGpuReport() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-disk', async () => {
    try {
      return { ok: true, data: await getDiskHealth() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-thermal', async () => {
    try {
      return { ok: true, data: await getThermalInfo() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-network', async () => {
    try {
      return { ok: true, data: await getNetworkInfo() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-security', async () => {
    try {
      return { ok: true, data: await getSecurityStatus() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-battery', async () => {
    try {
      return { ok: true, data: await getBatteryInfo() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-optimization', async () => {
    try {
      return { ok: true, data: await getOptimizationReport() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:get-health-score', async () => {
    try {
      return { ok: true, data: await computeHealthScore() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('systemcheck:run-full', async () => {
    try {
      // FIX 2: Pre-fetch shared systeminformation queries
      const [mem, currentLoad, graphics] = await Promise.all([
        si.mem().catch(() => undefined),
        si.currentLoad().catch(() => undefined),
        si.graphics().catch(() => undefined),
      ])
      const sharedData = { mem, currentLoad, graphics }

      const [hw, gpu, disk, thermal, network, security, battery, opt] = await Promise.allSettled([
        getHardwareInfo(sharedData),
        getGpuReport(sharedData),
        getDiskHealth(),
        getThermalInfo(sharedData),
        getNetworkInfo(),
        getSecurityStatus(),
        getBatteryInfo(),
        getOptimizationReport(sharedData),
      ])

      const hardware = hw.status === 'fulfilled' ? hw.value : null
      const gpuData = gpu.status === 'fulfilled' ? gpu.value : null
      const diskData = disk.status === 'fulfilled' ? disk.value : null
      const thermalData = thermal.status === 'fulfilled' ? thermal.value : null
      const networkData = network.status === 'fulfilled' ? network.value : null
      const securityData = security.status === 'fulfilled' ? security.value : null
      const batteryData = battery.status === 'fulfilled' ? battery.value : null
      const optimizationData = opt.status === 'fulfilled' ? opt.value : null

      const healthScore = await computeHealthScore({
        hardware,
        gpu: gpuData,
        disk: diskData,
        thermal: thermalData,
        network: networkData,
        security: securityData,
        battery: batteryData,
        optimization: optimizationData,
      })

      return {
        ok: true,
        data: {
          hardware,
          gpu: gpuData,
          disk: diskData,
          thermal: thermalData,
          network: networkData,
          security: securityData,
          battery: batteryData,
          optimization: optimizationData,
          healthScore,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })
}
