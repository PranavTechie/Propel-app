/**
 * scannerHandlers.ts
 * Extracted scanner IPC helpers used by cleanerHandlers.
 * Responsible for running category scans and streaming progress events back to the renderer.
 *
 * IPC throttle: coalesces per-file progress into at most 1 event per 60ms
 * to keep the renderer thread free.
 */

import type { IpcMainInvokeEvent } from 'electron'
import type { ScannedFile, ScanProgressCallback } from '../../services/cleaner/scannerService'
import { MAX_FILES_PER_CAT } from '../../services/cleaner/scannerService'
import type { CategoryDef } from './cleanerHandlers'

export interface CategoryScanResult {
  id: string
  totalSize: number
  fileCount: number
  files: ScannedFile[]
  /** True when file collection was halted by MAX_FILES_PER_CAT — actual space may be larger */
  isCapped: boolean
}

const IPC_THROTTLE_MS = 60  // max one progress ping per 60 ms per category

export async function runCategoryScan(
  def: CategoryDef,
  scanner: (cb: ScanProgressCallback) => Promise<ScannedFile[]>,
  event: IpcMainInvokeEvent,
): Promise<CategoryScanResult> {
  let totalSize  = 0
  let fileCount  = 0
  let lastPath   = ''
  let lastEmitTs = 0
  let pending: ReturnType<typeof setTimeout> | null = null

  const safeSend = (data: object) => {
    try { event.sender.send('cleaner:scan-progress', data) } catch { /* window closed */ }
  }

  const flushFileFound = () => {
    pending = null
    lastEmitTs = Date.now()
    safeSend({ type: 'file-found', categoryId: def.id, currentPath: lastPath, totalSize, fileCount })
  }

  const emitProgress: ScanProgressCallback = info => {
    totalSize += info.sizeFound
    fileCount += info.filesFound
    lastPath   = info.currentPath
    if (pending) clearTimeout(pending)
    if (Date.now() - lastEmitTs >= IPC_THROTTLE_MS) {
      flushFileFound()
    } else {
      pending = setTimeout(flushFileFound, IPC_THROTTLE_MS)
    }
  }

  safeSend({ type: 'category-start', categoryId: def.id, categoryName: def.name })

  const files = await scanner(emitProgress)

  // Flush any pending throttled update
  if (pending) { clearTimeout(pending); pending = null }

  safeSend({
    type: 'category-done',
    id: def.id,
    name: def.name,
    description: def.description,
    totalSize,
    fileCount,
    isSafe: def.isSafe,
    isCapped: fileCount >= MAX_FILES_PER_CAT,
  })

  return { id: def.id, totalSize, fileCount, files, isCapped: fileCount >= MAX_FILES_PER_CAT }
}
