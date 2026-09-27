import path from 'path'
import fs from 'fs/promises'
import type { ScannedFile, ScanProgressCallback } from './scannerService'
import { scanDirectories, scanFiles } from './scannerService'

export const GPU_CATEGORY_ID = 'gpu-cache'
export const THUMBNAIL_CATEGORY_ID = 'thumbnail-cache'
export const CRASH_CATEGORY_ID = 'crash-dumps'
export const LOGS_CATEGORY_ID = 'windows-logs'

function localAppData(): string {
  return process.env.LOCALAPPDATA ?? ''
}

// ── GPU / Shader Cache ─────────────────────────────────────────────────────

export async function scanGPUCache(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const la = localAppData()
  const dirs = [
    path.join(la, 'D3DSCache'),
    path.join(la, 'NVIDIA', 'DXCache'),
    path.join(la, 'NVIDIA', 'GLCache'),
    path.join(la, 'AMD', 'DXCache'),
    path.join(la, 'Intel', 'ShaderCache'),
    path.join(la, 'nvidia', 'ComputeCache'),
  ]
  return scanDirectories(dirs, GPU_CATEGORY_ID, onProgress, 3)
}

// ── Thumbnail Cache ───────────────────────────────────────────────────────

export async function scanThumbnailCache(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const explorerDir = path.join(localAppData(), 'Microsoft', 'Windows', 'Explorer')
  const thumbFiles: string[] = []

  try {
    const entries = await fs.readdir(explorerDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && String(entry.name).startsWith('thumbcache_')) {
        thumbFiles.push(path.join(explorerDir, String(entry.name)))
      }
    }
  } catch {
    // Explorer dir not accessible
  }

  return scanFiles(thumbFiles, THUMBNAIL_CATEGORY_ID, onProgress)
}

// ── Crash Dumps ───────────────────────────────────────────────────────────

export async function scanCrashDumps(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const la = localAppData()
  const appData = process.env.APPDATA ?? ''
  const dirs = [
    path.join(la, 'CrashDumps'),
    path.join(appData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
    path.join(appData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
    path.join(la, 'Microsoft', 'Windows', 'WER'),
  ]
  return scanDirectories(dirs, CRASH_CATEGORY_ID, onProgress, 3)
}

// ── Windows Log Files ─────────────────────────────────────────────────────

export async function scanWindowsLogs(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const winDir = process.env.WINDIR ?? 'C:\\Windows'
  const la = localAppData()
  const dirs = [
    path.join(winDir, 'Logs', 'CBS'),
    path.join(winDir, 'Logs', 'DISM'),
    path.join(winDir, 'Temp'),
    path.join(la, 'Microsoft', 'Windows', 'IECompatCache'),
    path.join(la, 'Microsoft', 'Windows', 'INetCache', 'IE'),
  ]
  const allFiles = await scanDirectories(dirs, LOGS_CATEGORY_ID, onProgress, 2)
  return allFiles.filter(f => /\.(log|txt|etl|tmp)$/i.test(f.path))
}

// ── Windows Update Download Cache ─────────────────────────────────────────

export const WIN_UPDATE_CATEGORY_ID = 'win-update-cache'

export async function scanWindowsUpdateCache(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const winDir = process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows'
  const dirs = [
    path.join(winDir, 'SoftwareDistribution', 'Download'),
  ]
  return scanDirectories(dirs, WIN_UPDATE_CATEGORY_ID, onProgress, 4)
}

// ── Windows Prefetch ──────────────────────────────────────────────────────

export const PREFETCH_CATEGORY_ID = 'prefetch'

export async function scanPrefetch(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const winDir = process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows'
  const dirs = [path.join(winDir, 'Prefetch')]
  const allFiles = await scanDirectories(dirs, PREFETCH_CATEGORY_ID, onProgress, 1)
  // Only .pf files are prefetch data — avoid sweeping up anything else if Windows ever
  // puts non-prefetch items in this folder.
  return allFiles.filter(f => /\.pf$/i.test(f.path))
}

// ── Delivery Optimization Cache ───────────────────────────────────────────

export const DELIVERY_OPT_CATEGORY_ID = 'delivery-opt'

export async function scanDeliveryOptimization(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const winDir = process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows'
  const dirs = [
    path.join(winDir, 'SoftwareDistribution', 'DeliveryOptimization'),
  ]
  return scanDirectories(dirs, DELIVERY_OPT_CATEGORY_ID, onProgress, 4)
}
