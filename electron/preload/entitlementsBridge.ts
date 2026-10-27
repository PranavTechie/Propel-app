import { ipcRenderer } from 'electron'
import type { EntitlementResult } from '../services/auth/entitlementService'
import type { EvaluatedEntitlement } from '../services/auth/entitlementCache'
import type { ClearLocalAuthResult } from '../services/auth/localAuthState'

export const entitlementsBridge = {
  fetch: (accessToken: string): Promise<EntitlementResult> =>
    ipcRenderer.invoke('propel:entitlements:fetch', accessToken),
  getCached: (): Promise<EvaluatedEntitlement> =>
    ipcRenderer.invoke('propel:entitlements:getCached'),
  // Logout: clears cached entitlement, license file and device registration.
  clearLocalSession: (): Promise<ClearLocalAuthResult> =>
    ipcRenderer.invoke('propel:auth:clear-local-session'),
}
