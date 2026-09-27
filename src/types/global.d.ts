import type { ElectronAPI } from '../../electron/preload'
import type { cleanerBridge }  from '../../electron/preload/cleanerBridge'
import type { memoryBridge }   from '../../electron/preload/memoryBridge'
import type { entitlementsBridge }  from '../../electron/preload/entitlementsBridge'
import type { updaterBridge }      from '../../electron/preload/updaterBridge'
import type { maintenanceBridge }  from '../../electron/preload/maintenanceBridge'

import type { aiBridge }            from '../../electron/preload/aiBridge'
import type systemCheckBridge       from '../../electron/preload/systemCheckBridge'
import type permissionsBridge       from '../../electron/preload/permissionsBridge'
import type { exclusionsBridge }    from '../../electron/preload/exclusionsBridge'

declare global {
  interface Window {
    api: ElectronAPI
    electronAPI: ElectronAPI
    propel: {
      system:       ElectronAPI['system']
      cleaner:      typeof cleanerBridge
      memory:       typeof memoryBridge
      entitlements:      typeof entitlementsBridge
      updater:      typeof updaterBridge
      maintenance:  typeof maintenanceBridge

      ai:           typeof aiBridge
      systemCheck:  typeof systemCheckBridge
      permissions:  typeof permissionsBridge
      exclusions:   typeof exclusionsBridge
      overlay:      any
    }
    // Dev-only telemetry test suite — undefined in production builds
    __cmTelemetryTest?: {
      testMessage:      () => void
      rendererCrash:    () => string
      unhandledPromise: () => void
      ipcFailure:       () => void
      hardTest:         () => string
      getStatus:        () => { initialized: boolean; enabled: boolean; dsn: string; env: string }
    }
  }
}

export {}
