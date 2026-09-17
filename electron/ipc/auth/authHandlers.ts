import { ipcMain } from 'electron'
import { exchangeAuthCode } from '../../services/auth/authService'
import type { ExchangeResult } from '../../services/auth/authService'

export function setupAuthHandlersIPC(): void {
  ipcMain.handle('propel:auth:exchange', async (_event, code: string): Promise<ExchangeResult> => {
    console.log('[AUTH IPC] exchange invoked')
    console.log(`[AUTH IPC] code received: ${!!code}`)
    console.log('[AUTH IPC] calling backend')
    return exchangeAuthCode(code)
  })
}
