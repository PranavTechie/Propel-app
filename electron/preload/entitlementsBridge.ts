import { ipcRenderer } from 'electron'
import type { EntitlementResult } from '../services/auth/entitlementService'

export const entitlementsBridge = {
  fetch: (accessToken: string): Promise<EntitlementResult> =>
    ipcRenderer.invoke('propel:entitlements:fetch', accessToken),
}
