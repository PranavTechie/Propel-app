import { ipcMain } from 'electron'
import {
  loadExclusions,
  saveExclusions,
  buildEntry,
  isDuplicate,
  removeEntry,
} from '../../services/cleaner/exclusionsService'
import type { ExclusionEntry, ExclusionType } from '../../services/cleaner/exclusionsService'

export function setupExclusionsIPC(): void {
  ipcMain.handle('exclusions:load', async () => {
    return loadExclusions()
  })

  ipcMain.handle(
    'exclusions:add',
    async (_event, type: ExclusionType, value: string, label: string) => {
      const config = await loadExclusions()
      if (isDuplicate(config, type, value)) {
        return { success: false, duplicate: true, config }
      }
      const entry: ExclusionEntry = buildEntry({ type, value, label })
      const updated = { ...config, entries: [...config.entries, entry] }
      await saveExclusions(updated)
      return { success: true, duplicate: false, config: updated }
    },
  )

  ipcMain.handle('exclusions:remove', async (_event, id: string) => {
    const config = await loadExclusions()
    const updated = removeEntry(config, id)
    await saveExclusions(updated)
    return updated
  })

  ipcMain.handle('exclusions:clear', async () => {
    const empty = { version: 1 as const, entries: [] }
    await saveExclusions(empty)
    return empty
  })
}
