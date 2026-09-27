import fs from 'fs/promises'
import { shell } from 'electron'
import type { ScannedFile } from './scannerService'

export interface CleanProgressInfo {
  current: number
  total: number
  currentFile: string
  freed: number
}

export type CleanProgressCallback = (info: CleanProgressInfo) => void

export interface CleanupStats {
  freed: number
  removed: number
  errors: number
  errorDetails: { path: string; reason: string }[]
}

async function trashFile(filePath: string): Promise<void> {
  await shell.trashItem(filePath)
}

export async function cleanFiles(
  files: ScannedFile[],
  onProgress: CleanProgressCallback,
  safeMode = true,
): Promise<CleanupStats> {
  let freed = 0
  let removed = 0
  let errors = 0
  const errorDetails: { path: string; reason: string }[] = []
  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]
    try {
      if (safeMode) {
        await trashFile(file.path)
      } else {
        await fs.unlink(file.path)
      }
      freed += file.size
      removed++
    } catch (err: any) {
      errors++
      errorDetails.push({ path: file.path, reason: err?.message || 'Unknown error' })
    }
    onProgress({ current: i + 1, total, currentFile: file.path, freed })
  }

  return { freed, removed, errors, errorDetails }
}

export async function removeEmptyDirs(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath)
    if (entries.length === 0) {
      await fs.rmdir(dirPath)
    }
  } catch {
    // ignore
  }
}
