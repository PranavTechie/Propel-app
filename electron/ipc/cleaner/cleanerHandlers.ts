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
import { cleanFiles, cleanPermissionDeniedBatch, isPathInAdminAllowlist } from '../../services/cleaner/cleanupService'
import { createReport, type CleanupReport } from '../../services/cleaner/cleanupReport'
import type { ScannedFile } from '../../services/cleaner/scannerService'
import { loadSettings } from '../../services/maintenance/automationStore'
import { isProtectedPath } from '../../services/cleaner/pathGuard'
import { appendCleanerLog, sanitizeErrorMessage } from '../../services/cleaner/cleanerLogger'

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

// System categories that require administrator elevation
export const ADMIN_CATEGORY_IDS = new Set([
  'windows-logs',
  'win-update-cache',
  'prefetch',
  'delivery-opt',
])

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
        skipped.push({ path: file.path, reason: 'File is no longer a regular file or is a link' })
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
      if (!isPathInAdminAllowlist(file.path)) {
        skipped.push({ path: file.path, reason: 'Path is outside cleaner admin allowlist' })
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
  isCapped: boolean
}

function computeSkippedByReason(
  errors: { path: string; reason: string; kind?: string }[],
  adminRequiredSkipped = 0,
): { locked: number; permission: number; missing: number; other: number } {
  const counts = { locked: 0, permission: adminRequiredSkipped, missing: 0, other: 0 }
  for (const err of errors) {
    const k = err.kind || ''
    const r = (err.reason || '').toLowerCase()
    if (k === 'locked' || r.includes('in use') || r.includes('being used') || r.includes('locked')) counts.locked++
    else if (k === 'permission-denied' || r.includes('permission') || r.includes('denied') || r.includes('access')) counts.permission++
    else if (k === 'missing' || r.includes('not found') || r.includes('missing')) counts.missing++
    else counts.other++
  }
  return counts
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

    const exclusions = await loadExclusions()
    const excEntries = exclusions.entries

    const runScanFiltered = async (
      id: string,
      scanner: Parameters<typeof runScan>[1],
    ): Promise<void> => {
      if (isCategoryExcluded(id, excEntries)) {
        scanCache.set(id, [])
        return
      }
      const summary = await runScan(id, scanner)

      const raw      = scanCache.get(id) ?? []
      const filtered = excEntries.length > 0 ? raw.filter(f => !isFileExcluded(f.path, excEntries)) : raw
      scanCache.set(id, filtered)

      const filteredSize    = filtered.reduce((a, f) => a + f.size, 0)
      const filteredSummary = { ...summary, totalSize: filteredSize, fileCount: filtered.length }
      results.push(filteredSummary)
    }

    await Promise.allSettled([
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

      // Partition files upfront into user-owned vs admin-required categories
      const userFiles: ScannedFile[] = []
      const adminFiles: ScannedFile[] = []

      for (const id of categoryIds) {
        if (id === 'recycle-bin') continue
        const files = scanCache.get(id) ?? []
        if (ADMIN_CATEGORY_IDS.has(id)) {
          adminFiles.push(...files)
        } else {
          userFiles.push(...files)
        }
      }

      const totalFiles = userFiles.length + adminFiles.length
      const allErrors: { path: string; reason: string }[] = []

      appendCleanerLog(
        `[CLEAN START] categories=${categoryIds.length} userFiles=${userFiles.length} adminFiles=${adminFiles.length} total=${totalFiles}`
      )

      // 1. Clean user-owned files via unelevated pass
      if (userFiles.length > 0) {
        const settings = await loadSettings()
        const stats = await cleanFiles(userFiles, info => {
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
        const countsStr = `locked=${stats.countsByKind.locked} permission-denied=${stats.countsByKind['permission-denied']} missing=${stats.countsByKind.missing} validation-rejected=${stats.countsByKind['validation-rejected']} result-unreadable=${stats.countsByKind['result-unreadable']} other=${stats.countsByKind.other}`
        const firstErrSanitized = stats.firstError ? ` firstError="${sanitizeErrorMessage(stats.firstError)}"` : ''
        appendCleanerLog(
          `[UNELEVATED PASS] removed=${stats.removed} errors=${stats.errors} freed=${stats.freed} resultParsed=${stats.resultParsed} ${countsStr}${firstErrSanitized}`
        )
      }

      // 2. Empty recycle bin if selected
      if (categoryIds.includes('recycle-bin')) {
        emit({
          type: 'file-cleaned',
          current: userFiles.length + 1,
          total: totalFiles + 1,
          currentFile: 'Recycle Bin',
          freed: totalFreed,
        })
        const recycleStats = await emptyRecycleBin()
        totalFreed += recycleStats.freed
        totalRemoved += recycleStats.removed
        totalErrors += recycleStats.errors
        if (recycleStats.errorDetails) allErrors.push(...recycleStats.errorDetails)
        appendCleanerLog(`[RECYCLE BIN] removed=${recycleStats.removed} freed=${recycleStats.freed}`)
      }

      // 3. Admin batch preparation
      let permissionBatchToken: string | undefined
      let permissionDeniedCount = 0
      if (adminFiles.length > 0) {
        const validation = await validatePermissionBatch(adminFiles)
        appendCleanerLog(`[ADMIN VALIDATION] eligible=${validation.eligible.length} skipped=${validation.skipped.length}`)
        if (validation.eligible.length > 0) {
          permissionBatchToken = `clean_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          permissionBatches.set(permissionBatchToken, { files: validation.eligible, categories: categoryIds })
          permissionDeniedCount = validation.eligible.length
        }
        totalErrors += validation.skipped.length
        allErrors.push(...validation.skipped)
      }

      for (const id of categoryIds) scanCache.delete(id)

      const report = createReport({
        timestamp: Date.now(),
        totalFreed,
        filesRemoved: totalRemoved,
        errors: totalErrors,
        errorDetails: allErrors,
        filesSkipped: 0,
        skippedByReason: computeSkippedByReason(allErrors, 0),
        permissionDeniedCount,
        permissionBatchToken,
        permissionDeniedPaths: adminFiles.map(file => file.path),
        durationMs: Date.now() - startTime,
        categories: categoryIds,
      })

      emit({ type: 'clean-complete', report })
      appendCleanerLog(`[CLEAN FINISHED] freed=${totalFreed} removed=${totalRemoved} errors=${totalErrors} adminPending=${permissionDeniedCount}`)
      return report
    },
  )

  // ── Elevated Admin Clean ───────────────────────────────────────────────
  ipcMain.handle('cleaner:clean-admin', async (event: IpcMainInvokeEvent, token: string): Promise<CleanupReport> => {
    const pending = permissionBatches.get(token)
    if (!pending) {
      appendCleanerLog(`[CLEAN ADMIN] Error: token ${token} expired or missing`)
      throw new Error('Permission batch is no longer available')
    }
    permissionBatches.delete(token)

    const startTime = Date.now()
    const emit = (data: object) => {
      try { event.sender.send('cleaner:clean-progress', data) } catch { /* window closed */ }
    }

    emit({ type: 'waiting-for-uac' })
    appendCleanerLog(`[CLEAN ADMIN START] files=${pending.files.length}`)

    // Pre-validate once more
    const validation = await validatePermissionBatch(pending.files)
    const stats = await cleanPermissionDeniedBatch(validation.eligible, {
      uacTimeoutMs: 60_000,
      noProgressTimeoutMs: 45_000,
      onProgress: (processed, total) => {
        emit({
          type: 'file-cleaned',
          current: processed,
          total,
          currentFile: 'System cleanup (admin)...',
          freed: 0,
        })
      },
    })

    const validationErrors = validation.skipped
    const errorDetails = [...validationErrors, ...stats.errorDetails]
    const skippedCount = validationErrors.length + stats.permissionDenied.length

    const countsStr = `locked=${stats.countsByKind.locked} permission-denied=${stats.countsByKind['permission-denied']} missing=${stats.countsByKind.missing} validation-rejected=${stats.countsByKind['validation-rejected']} result-unreadable=${stats.countsByKind['result-unreadable']} other=${stats.countsByKind.other}`
    const firstErrSanitized = stats.firstError ? ` firstError="${sanitizeErrorMessage(stats.firstError)}"` : ''
    appendCleanerLog(
      `[CLEAN ADMIN FINISHED] freed=${stats.freed} removed=${stats.removed} errors=${errorDetails.length} skipped=${skippedCount} resultParsed=${stats.resultParsed} ${countsStr}${firstErrSanitized}`
    )

    const report = createReport({
      timestamp: Date.now(),
      totalFreed: stats.freed,
      filesRemoved: stats.removed,
      errors: errorDetails.length,
      errorDetails,
      filesSkipped: skippedCount,
      adminRequiredSkipped: stats.permissionDenied.length,
      skippedByReason: computeSkippedByReason(errorDetails, stats.permissionDenied.length),
      permissionDeniedPaths: validation.eligible.map(file => file.path),
      durationMs: Date.now() - startTime,
      categories: pending.categories,
    })

    emit({ type: 'clean-complete', report })
    return report
  })

  ipcMain.handle('cleaner:discard-admin-batch', async (_event, token: string): Promise<void> => {
    permissionBatches.delete(token)
    appendCleanerLog(`[ADMIN BATCH DISCARDED] token=${token}`)
  })

  // ── Recycle bin info only ─────────────────────────────────────────────
  ipcMain.handle('cleaner:recycle-info', async () => {
    return getRecycleBinInfo()
  })
}
