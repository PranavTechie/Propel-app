import { ipcRenderer } from 'electron'
import type { ExclusionsConfig, ExclusionType } from '../services/cleaner/exclusionsService'

export const exclusionsBridge = {
  load: (): Promise<ExclusionsConfig> =>
    ipcRenderer.invoke('exclusions:load'),

  add: (
    type: ExclusionType,
    value: string,
    label: string,
  ): Promise<{ success: boolean; duplicate: boolean; config: ExclusionsConfig }> =>
    ipcRenderer.invoke('exclusions:add', type, value, label),

  remove: (id: string): Promise<ExclusionsConfig> =>
    ipcRenderer.invoke('exclusions:remove', id),

  clear: (): Promise<ExclusionsConfig> =>
    ipcRenderer.invoke('exclusions:clear'),
}
