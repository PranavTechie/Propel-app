import { getHardwareInfo } from '../electron/services/system-check/hardwareService'
import { getGpuReport } from '../electron/services/system-check/gpuService'
import { getDiskHealth } from '../electron/services/system-check/diskHealthService'
import { getThermalInfo } from '../electron/services/system-check/thermalService'
import { getNetworkInfo } from '../electron/services/system-check/networkService'
import { getSecurityStatus } from '../electron/services/system-check/securityService'
import { getBatteryInfo } from '../electron/services/system-check/batteryService'
import { getOptimizationReport } from '../electron/services/system-check/optimizationService'
import { computeHealthScore } from '../electron/services/system-check/healthScoreService'

async function runAudit() {
  console.log('Starting Deep Forensic Audit - Runtime Validation')
  const start = Date.now()

  try {
    const si = require('systeminformation')
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

    const end = Date.now()
    
    console.log('\n--- EXECUTION TIME ---')
    console.log(`${end - start} ms`)

    console.log('\n--- HEALTH SCORE ---')
    console.log(JSON.stringify(healthScore, null, 2))
    
    console.log('\n--- ERRORS / MISSING ---')
    if (hw.status === 'rejected') console.log('Hardware Error:', hw.reason)
    if (gpu.status === 'rejected') console.log('GPU Error:', gpu.reason)
    if (disk.status === 'rejected') console.log('Disk Error:', disk.reason)
    if (thermal.status === 'rejected') console.log('Thermal Error:', thermal.reason)
    if (network.status === 'rejected') console.log('Network Error:', network.reason)
    if (security.status === 'rejected') console.log('Security Error:', security.reason)
    if (battery.status === 'rejected') console.log('Battery Error:', battery.reason)
    if (opt.status === 'rejected') console.log('Optimization Error:', opt.reason)

    console.log('\n--- CATEGORY SNIPPETS ---')
    console.log('Hardware CPU:', hardware?.cpu)
    console.log('GPU Gaming Ready:', gpuData?.gamingReadyEstimate)
    console.log('Disk Reclaimable Bytes:', diskData?.totalReclaimableBytes)
    console.log('Thermal Max Temp:', thermalData?.maxTemp)
    console.log('Network Latency:', networkData?.latencyMs)
    console.log('Security Issues:', securityData?.issues)
    console.log('Battery Status:', batteryData?.status)
    console.log('Optimization Critical Count:', optimizationData?.criticalCount)

  } catch (err) {
    console.error('Fatal Audit Error', err)
  }
}

runAudit()
