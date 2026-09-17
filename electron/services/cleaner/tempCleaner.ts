import os from 'os'
import path from 'path'
import type { ScannedFile, ScanProgressCallback } from './scannerService'
import { scanDirectories } from './scannerService'

export const TEMP_CATEGORY_ID = 'temp-files'

function getTempDirs(): string[] {
  const dirs: string[] = []
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  const localAppData = process.env.LOCALAPPDATA ?? ''

  if (temp) dirs.push(temp)
  if (localAppData) {
    const localTemp = path.join(localAppData, 'Temp')
    if (localTemp !== temp) dirs.push(localTemp)
  }

  return [...new Set(dirs)]
}

export async function scanTempFiles(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  return scanDirectories(getTempDirs(), TEMP_CATEGORY_ID, onProgress, 3)
}
