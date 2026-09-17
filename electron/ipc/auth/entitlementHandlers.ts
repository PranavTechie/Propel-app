import { ipcMain } from 'electron'
import { fetchEntitlements } from '../../services/auth/entitlementService'
import type { EntitlementResult } from '../../services/auth/entitlementService'

export function setupEntitlementIPC(): void {
  ipcMain.handle('propel:entitlements:fetch', async (_event, accessToken: string): Promise<EntitlementResult> => {
    return fetchEntitlements(accessToken)
  })
}
