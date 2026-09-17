import { ipcMain } from 'electron'
import { openOverlay, closeOverlay, isOverlayOpen } from '../../services/overlay/overlayService'

export function setupOverlayIPC(preloadPath: string): void {
  ipcMain.handle('propel:overlay:open',   () => { openOverlay(preloadPath); return true })
  ipcMain.handle('propel:overlay:close',  () => { closeOverlay();           return true })
  ipcMain.handle('propel:overlay:isOpen', () => isOverlayOpen())
}
