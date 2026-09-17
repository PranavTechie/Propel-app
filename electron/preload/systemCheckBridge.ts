import { ipcRenderer } from 'electron'

const systemCheckBridge = {
  getHardware: () => ipcRenderer.invoke('systemcheck:get-hardware'),
  getGpu: () => ipcRenderer.invoke('systemcheck:get-gpu'),
  getDisk: () => ipcRenderer.invoke('systemcheck:get-disk'),
  getThermal: () => ipcRenderer.invoke('systemcheck:get-thermal'),
  getNetwork: () => ipcRenderer.invoke('systemcheck:get-network'),
  getSecurity: () => ipcRenderer.invoke('systemcheck:get-security'),
  getBattery: () => ipcRenderer.invoke('systemcheck:get-battery'),
  getOptimization: () => ipcRenderer.invoke('systemcheck:get-optimization'),
  getHealthScore: () => ipcRenderer.invoke('systemcheck:get-health-score'),
  runFull: () => ipcRenderer.invoke('systemcheck:run-full'),
}

export default systemCheckBridge
