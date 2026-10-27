import { ipcMain } from 'electron'
import { fetchEntitlements } from '../../services/auth/entitlementService'
import type { EntitlementResult } from '../../services/auth/entitlementService'
import fs from 'fs/promises'
import { getCachedEntitlement, bumpAuthEpoch, type EvaluatedEntitlement } from '../../services/auth/entitlementCache'
import { clearLocalAuthFilesAt, type ClearLocalAuthResult } from '../../services/auth/localAuthState'
import { getEntitlementFilePath, getLicenseFilePath, getDeviceIdFilePath } from '../../utils/userData'

export function setupEntitlementIPC(): void {
  ipcMain.handle('propel:entitlements:fetch', async (_event, accessToken: string): Promise<EntitlementResult> => {
    return fetchEntitlements(accessToken)
  })

  ipcMain.handle('propel:entitlements:getCached', async (): Promise<EvaluatedEntitlement> => {
    return getCachedEntitlement()
  })

  // Logout / no valid session: remove every on-disk trace of the account's
  // login state. Takes no arguments (nothing to validate); idempotent.
  ipcMain.handle('propel:auth:clear-local-session', async (): Promise<ClearLocalAuthResult> => {
    bumpAuthEpoch() // drop any entitlement write still in flight
    return clearLocalAuthFilesAt(
      {
        entitlement: getEntitlementFilePath(),
        license: getLicenseFilePath(),
        deviceId: getDeviceIdFilePath(),
      },
      fs,
    )
  })
}
