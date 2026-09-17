import { ipcMain } from 'electron'
import axios from 'axios'
import { getSystemStats } from '../native/system'

const VERSION_URL = 'https://raw.githubusercontent.com/propel/updates/main/version.json'
const APP_VERSION = '3.2.0'

export function setupIPC(): void {
  ipcMain.handle('system:get-stats', async () => {
    return await getSystemStats()
  })

  ipcMain.handle('system:get-version', () => APP_VERSION)

  ipcMain.handle('update:check', async () => {
    try {
      const res = await axios.get(VERSION_URL, { timeout: 8000 })
      const latest: string = res.data?.latest_version ?? APP_VERSION
      const hasUpdate = compareVersions(latest, APP_VERSION) > 0
      return {
        hasUpdate,
        latest_version: latest,
        current_version: APP_VERSION,
        download_url: res.data?.download_url ?? null,
        release_notes: res.data?.release_notes ?? null,
      }
    } catch {
      return { hasUpdate: false, current_version: APP_VERSION }
    }
  })
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
