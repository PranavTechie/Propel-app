import { ipcMain, IpcMainInvokeEvent } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { runCategoryScan } from './scannerHandlers'
import { loadExclusions, isCategoryExcluded, isFileExcluded } from '../../services/cleaner/exclusionsService'
import { scanTempFiles } from '../../services/cleaner/tempCleaner'
import { scanBrowserCache } from '../../services/cleaner/browserCleaner'
import {
  scanGPUCache,
  scanThumbnailCache,
  scanCrashDumps,
  scanWindowsLogs,
  scanWindowsUpdateCache,
  scanPrefetch,
  scanDeliveryOptimization,
} from '../../services/cleaner/cacheCleaner'
import { getRecycleBinInfo, emptyRecycleBin } from '../../services/cleaner/recycleCleaner'
import { cleanFiles, cleanPermissionDeniedBatch } from '../../services/cleaner/cleanupService'
import { createReport, type CleanupReport } from '../../services/cleaner/cleanupReport'
import type { ScannedFile } from '../../services/cleaner/scannerService'
import { loadSettings } from '../../services/maintenance/automationStore'
import { isProtectedPath } from '../../services/cleaner/pathGuard'

// ── Category definitions ───────────────────────────────────────────────────

export interface CategoryDef {
  id: string
  name: string
  description: string
  isSafe: boolean
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { id: 'temp-files',       name: 'Temporary Files',         description: 'System & app temp files',                             isSafe: true },
  { id: 'browser-cache',    name: 'Browser Cache',           description: 'Chrome, Edge, Brave, Opera, Vivaldi, Arc & Firefox',   isSafe: true },
  { id: 'recycle-bin',      name: 'Recycle Bin',             description: 'Files awaiting permanent deletion',                    isSafe: true },
  { id: 'thumbnail-cache',  name: 'Thumbnail Cache',         description: 'Windows file preview database',                        isSafe: true },
  { id: 'gpu-cache',        name: 'GPU Shader Cache',        description: 'DirectX, NVIDIA & OpenGL cache',                       isSafe: true },
  { id: 'crash-dumps',      name: 'Crash Dumps',             description: 'App crash reports & error logs',                       isSafe: true },
  { id: 'windows-logs',     name: 'Windows Log Files',       description: 'Old system event & error logs',                        isSafe: true },
  { id: 'win-update-cache', name: 'Windows Update Cache',    description: 'Downloaded update packages (can be re-downloaded)',    isSafe: true },
  { id: 'prefetch',         name: 'Prefetch Files',          description: 'App launch cache — apps relearn on next run',          isSafe: true },
  { id: 'delivery-opt',     name: 'Delivery Optimization',   description: 'Windows peer-to-peer update distribution cache',       isSafe: true },
]

// ── In-memory scan cache (keeps file paths server-side) ───────────────────

const scanCache = new Map<string, ScannedFile[]>()
const permissionBatches = new Map<string, { files: ScannedFile[]; categories: string[] }>()

async function validatePermissionBatch(files: ScannedFile[]): Promise<{
  eligible: ScannedFile[]
  skipped: { path: string; reason: string }[]
}> {
  const eligible: ScannedFile[] = []
  const skipped: { path: string; reason: string }[] = []
  for (const file of files) {
    try {
      const stat = await fs.lstat(file.path)
      if (!stat.isFile() || stat.isSymbolicLink()) {
        skipped.push({ path: file.path, reason: 'File is no longer a regular file' })
        continue
      }
      const resolved = await fs.realpath(file.path)
      if (path.resolve(resolved).toLowerCase() !== path.resolve(file.path).toLowerCase()) {
        skipped.push({ path: file.path, reason: 'File resolves through a link or reparse point' })
        continue
      }
      if (isProtectedPath(file.path)) {
        skipped.push({ path: file.path, reason: 'Path is protected by Cleaner safety rules' })
        continue
      }
      eligible.push(file)
    } catch {
      skipped.push({ path: file.path, reason: 'File is no longer available' })
    }
  }
  return { eligible, skipped }
}

export interface CategorySummary {
  id: string
  name: string
  description: string
  totalSize: number
  fileCount: number
  isSafe: boolean
  /** True when the scan hit the MAX_FILES_PER_CAT cap — actual space may be larger */
  isCapped: boolean
}

// ── Setup ─────────────────────────────────────────────────────────────────

export function setupCleanerIPC(): void {
  // ── Scan ──────────────────────────────────────────────────────────────
  ipcMain.handle('cleaner:scan', async (event: IpcMainInvokeEvent) => {
    scanCache.clear()

    const results: CategorySummary[] = []

    const emit = (data: object) => {
      try { event.sender.send('cleaner:scan-progress', data) } catch { /* window closed */ }
    }

    // Helper to run a scan using extracted scannerHandlers module
    const runScan = async (
      id: string,
      scanner: Parameters<typeof runCategoryScan>[1],
    ): Promise<CategorySummary> => {
      const def = CATEGORY_DEFS.find(d => d.id === id)!
      const result = await runCategoryScan(def, scanner, event)
      scanCache.set(id, result.files)
      return {
        id,
        name: def.name,
        description: def.description,
        totalSize: result.totalSize,
        fileCount: result.fileCount,
        isSafe: def.isSafe,
        isCapped: result.isCapped,
      }
    }

    // Load exclusions once — run concurrently with nothing yet
    const exclusions = await loadExclusions()
    const excEntries = exclusions.entries

    // Helper that respects exclusions, filters files, and correctly pushes to results
    const runScanFiltered = async (
      id: string,
      scanner: Parameters<typeof runScan>[1],
    ): Promise<void> => {
      if (isCategoryExcluded(id, excEntries)) {
        scanCache.set(id, [])
        return
      }
      const summary = await runScan(id, scanner)

      // Apply file/folder/extension exclusions to the collected file list
      const raw      = scanCache.get(id) ?? []
      const filtered = excEntries.length > 0 ? raw.filter(f => !isFileExcluded(f.path, excEntries)) : raw
      scanCache.set(id, filtered)

      // Patch summary sizes to reflect filtered list and push to results
      const filteredSize    = filtered.reduce((a, f) => a + f.size, 0)
      const filteredSummary = { ...summary, totalSize: filteredSize, fileCount: filtered.length }
      results.push(filteredSummary)
    }

    // ── Stage 1: fast / independent categories + recycle bin — all in parallel ──
    // recycle-bin uses PowerShell (independent I/O); thumbnail/gpu/crash/logs/new categories are small dirs
    await Promise.allSettled([
      // Recycle bin (PowerShell, independent from file scan)
      (async () => {
        if (!isCategoryExcluded('recycle-bin', excEntries)) {
          const recycleInfo = await getRecycleBinInfo()
          scanCache.set('recycle-bin', [])
          const recycleSummary: CategorySummary = {
            id: 'recycle-bin',
            name: 'Recycle Bin',
            description: 'Files awaiting permanent deletion',
            totalSize: recycleInfo.size,
            fileCount: recycleInfo.fileCount,
            isSafe: true,
            isCapped: false,
          }
          emit({ type: 'category-done', ...recycleSummary })
          results.push(recycleSummary)
        }
      })(),
      runScanFiltered('thumbnail-cache',  scanThumbnailCache),
      runScanFiltered('gpu-cache',        scanGPUCache),
      runScanFiltered('crash-dumps',      scanCrashDumps),
      runScanFiltered('windows-logs',     scanWindowsLogs),
      runScanFiltered('win-update-cache', scanWindowsUpdateCache),
      runScanFiltered('prefetch',         scanPrefetch),
      runScanFiltered('delivery-opt',     scanDeliveryOptimization),
    ])

    // ── Stage 2: heavy disk-I/O categories — run sequentially to avoid thrashing
    // (internal scanner already uses parallelism within each category)
    await runScanFiltered('temp-files',    scanTempFiles)
    await runScanFiltered('browser-cache', scanBrowserCache)

    emit({ type: 'scan-complete', categories: results })
    return results
  })

  // ── Clean ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'cleaner:clean',
    async (event: IpcMainInvokeEvent, categoryIds: string[]): Promise<CleanupReport> => {
      const startTime = Date.now()
      let totalFreed = 0
      let totalRemoved = 0
      let totalErrors = 0

      const emit = (data: object) => {
        try { event.sender.send('cleaner:clean-progress', data) } catch { /* window closed */ }
      }

      // Collect all files from selected categories
      const allFiles: ScannedFile[] = []
      for (const id of categoryIds) {
        if (id === 'recycle-bin') continue // handled separately
        const files = scanCache.get(id) ?? []
        allFiles.push(...files)
      }

      const totalFiles = allFiles.length
      const allErrors: { path: string; reason: string }[] = []
      let permissionFiles: ScannedFile[] = []

      // Clean regular files
      if (allFiles.length > 0) {
        const settings = await loadSettings()
        const stats = await cleanFiles(allFiles, info => {
          emit({
            type: 'file-cleaned',
            current: info.current,
            total: totalFiles + (categoryIds.includes('recycle-bin') ? 1 : 0),
            currentFile: info.currentFile,
            freed: totalFreed + info.freed,
          })
        }, settings.safeCleaningMode)
        totalFreed += stats.freed
        totalRemoved += stats.removed
        totalErrors += stats.errors
        if (stats.errorDetails) allErrors.push(...stats.errorDetails)
        permissionFiles = stats.permissionDenied
      }

      // Empty recycle bin if selected
      if (categoryIds.includes('recycle-bin')) {
        emit({ type: 'file-cleaned', current: totalFiles + 1, total: totalFiles + 1, currentFile: 'Recycle Bin', freed: totalFreed })
        const recycleStats = await emptyRecycleBin()
        totalFreed += recycleStats.freed
        totalRemoved += recycleStats.removed
        totalErrors += recycleStats.errors
        if (recycleStats.errorDetails) allErrors.push(...recycleStats.errorDetails)
      }

      let permissionBatchToken: string | undefined
      let permissionDeniedCount = 0
      if (allFiles.length > 0) {
        if (permissionFiles.length > 0) {
          permissionBatchToken = `clean_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          permissionBatches.set(permissionBatchToken, { files: permissionFiles, categories: categoryIds })
          permissionDeniedCount = permissionFiles.length
        }
      }

      // Clear cache for cleaned categories
      for (const id of categoryIds) scanCache.delete(id)

      const report = createReport({
        timestamp: Date.now(),
        totalFreed,
        filesRemoved: totalRemoved,
        errors: totalErrors,
        errorDetails: allErrors,
        filesSkipped: 0,
        permissionDeniedCount,
        permissionBatchToken,
        permissionDeniedPaths: permissionFiles.map(file => file.path),
        durationMs: Date.now() - startTime,
        categories: categoryIds,
      })

      emit({ type: 'clean-complete', report })
      return report
    },
  )

  ipcMain.handle('cleaner:clean-admin', async (_event, token: string): Promise<CleanupReport> => {
    const pending = permissionBatches.get(token)
    if (!pending) throw new Error('Permission batch is no longer available')
    permissionBatches.delete(token)
    const startTime = Date.now()
    const validation = await validatePermissionBatch(pending.files)
    const stats = await cleanPermissionDeniedBatch(validation.eligible)
    const validationErrors = validation.skipped
    const errorDetails = [...validationErrors, ...stats.errorDetails]
    return createReport({
      timestamp: Date.now(),
      totalFreed: stats.freed,
      filesRemoved: stats.removed,
      errors: errorDetails.length,
      errorDetails,
      filesSkipped: errorDetails.length,
      adminRequiredSkipped: stats.permissionDenied.length,
      permissionDeniedPaths: validation.eligible.map(file => file.path),
      durationMs: Date.now() - startTime,
      categories: pending.categories,
    })
  })

  ipcMain.handle('cleaner:discard-admin-batch', async (_event, token: string): Promise<void> => {
    permissionBatches.delete(token)
  })

  // ── Recycle bin info only ─────────────────────────────────────────────
  ipcMain.handle('cleaner:recycle-info', async () => {
    return getRecycleBinInfo()
  })
}
