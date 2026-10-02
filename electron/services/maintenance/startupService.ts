import { app } from 'electron'

const LOGIN_ITEM_NAME = 'Propel'

export function setStartupEnabled(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--hidden']
    })
  } catch { /* non-fatal — may fail in sandboxed environments */ }
}

export function getStartupEnabled(): boolean {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch { return false }
}
