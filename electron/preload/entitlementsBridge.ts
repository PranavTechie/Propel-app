import { ipcRenderer } from 'electron'
import type { EntitlementResult } from '../services/auth/entitlementService'
import type { EvaluatedEntitlement } from '../services/auth/entitlementCache'

export const entitlementsBridge = {
  fetch: (accessToken: string): Promise<EntitlementResult> =>
    ipcRenderer.invoke('propel:entitlements:fetch', accessToken),
  getCached: (): Promise<EvaluatedEntitlement> =>
    ipcRenderer.invoke('propel:entitlements:getCached'),
}
