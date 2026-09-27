import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const RECYCLE_CATEGORY_ID = 'recycle-bin'

export interface RecycleBinInfo {
  size: number
  fileCount: number
}

export async function getRecycleBinInfo(): Promise<RecycleBinInfo> {
  try {
    const [sizeResult, countResult] = await Promise.all([
      execAsync(
        `powershell -NoProfile -NonInteractive -Command "(New-Object -ComObject Shell.Application).Namespace(0xA).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum"`,
        { timeout: 10000 },
      ),
      execAsync(
        `powershell -NoProfile -NonInteractive -Command "(New-Object -ComObject Shell.Application).Namespace(0xA).Items().Count"`,
        { timeout: 10000 },
      ),
    ])

    const size = parseInt(sizeResult.stdout.trim(), 10) || 0
    const fileCount = parseInt(countResult.stdout.trim(), 10) || 0
    return { size, fileCount }
  } catch {
    return { size: 0, fileCount: 0 }
  }
}

export async function emptyRecycleBin(): Promise<{ freed: number; removed: number; errors: number; errorDetails?: { path: string; reason: string }[] }> {
  try {
    const info = await getRecycleBinInfo()
    await execAsync(
      'powershell -NoProfile -NonInteractive -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"',
      { timeout: 30000 },
    )
    return { freed: info.size, removed: info.fileCount, errors: 0, errorDetails: [] }
  } catch (err: any) {
    return { freed: 0, removed: 0, errors: 1, errorDetails: [{ path: 'Recycle Bin', reason: err?.message || 'Failed to empty recycle bin' }] }
  }
}
