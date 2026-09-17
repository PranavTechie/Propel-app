import { ipcMain } from 'electron'
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
      const [hw, gpu, disk, thermal, network, security, battery, opt, health] = await Promise.allSettled([
        getHardwareInfo(),
        getGpuReport(),
        getDiskHealth(),
        getThermalInfo(),
        getNetworkInfo(),
        getSecurityStatus(),
        getBatteryInfo(),
        getOptimizationReport(),
        computeHealthScore(),
      ])
      return {
        ok: true,
        data: {
          hardware: hw.status === 'fulfilled' ? hw.value : null,
          gpu: gpu.status === 'fulfilled' ? gpu.value : null,
          disk: disk.status === 'fulfilled' ? disk.value : null,
          thermal: thermal.status === 'fulfilled' ? thermal.value : null,
          network: network.status === 'fulfilled' ? network.value : null,
          security: security.status === 'fulfilled' ? security.value : null,
          battery: battery.status === 'fulfilled' ? battery.value : null,
          optimization: opt.status === 'fulfilled' ? opt.value : null,
          healthScore: health.status === 'fulfilled' ? health.value : null,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  })
}
