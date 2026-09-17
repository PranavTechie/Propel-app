import fs from 'fs/promises'
import path from 'path'
import { Stats } from 'fs'

export interface ScannedFile {
  path: string
  size: number
}

export interface ScanProgressInfo {
  categoryId: string
  currentPath: string
  filesFound: number
  sizeFound: number
}

export type ScanProgressCallback = (info: ScanProgressInfo) => void

// ── Concurrency controls ──────────────────────────────────────────────────
const MAX_DEPTH          = 4       // Don't recurse deeper than this
const MAX_FILES_PER_CAT  = 5_000  // Stop collecting once we hit this per category
const DIR_TIMEOUT_MS     = 5_000  // Skip any dir that takes longer than this
const STAT_CONCURRENCY   = 24     // Parallel stat() calls per directory
const DIR_CONCURRENCY    = 6      // Parallel sub-directory traversals

// ── Lightweight concurrency limiter (no extra dependency) ─────────────────
async function pLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: (T | undefined)[] = new Array(tasks.length)
  let idx = 0
  const worker = async () => {
    while (true) {
      const i = idx++
      if (i >= tasks.length) break
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results as T[]
}

async function statSafe(filePath: string): Promise<Stats | null> {
  try { return await fs.stat(filePath) } catch { return null }
}

async function readdirSafe(dirPath: string): Promise<import('fs').Dirent[]> {
  try {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), DIR_TIMEOUT_MS),
    )
    return await Promise.race([
      fs.readdir(dirPath, { withFileTypes: true }) as Promise<import('fs').Dirent[]>,
      timer,
    ])
  } catch {
    return []
  }
}

// Shared counter threaded through recursion so we can stop early globally
interface Counter { count: number }

export async function scanDirectory(
  dirPath: string,
  categoryId: string,
  onProgress: ScanProgressCallback,
  maxDepth = MAX_DEPTH,
  depth = 0,
  counter: Counter = { count: 0 },
): Promise<ScannedFile[]> {
  if (depth > maxDepth || counter.count >= MAX_FILES_PER_CAT) return []

  const entries = await readdirSafe(dirPath)
  if (entries.length === 0) return []

  const filePaths: string[] = []
  const subDirs:   string[] = []

  for (const entry of entries) {
    if (counter.count >= MAX_FILES_PER_CAT) break
    const full = path.join(dirPath, String(entry.name))
    if (entry.isFile()) filePaths.push(full)
    else if (entry.isDirectory() && !entry.isSymbolicLink()) subDirs.push(full)
  }

  // Stat all files in this dir concurrently
  const collected: ScannedFile[] = []
  await pLimit(
    filePaths.map(fp => async () => {
      if (counter.count >= MAX_FILES_PER_CAT) return
      const stat = await statSafe(fp)
      if (stat && stat.size > 0) {
        collected.push({ path: fp, size: stat.size })
        counter.count++
        onProgress({ categoryId, currentPath: fp, filesFound: 1, sizeFound: stat.size })
      }
    }),
    STAT_CONCURRENCY,
  )

  // Recurse sub-directories concurrently
  if (subDirs.length > 0 && counter.count < MAX_FILES_PER_CAT) {
    const subResults = await pLimit(
      subDirs.map(d => () => scanDirectory(d, categoryId, onProgress, maxDepth, depth + 1, counter)),
      DIR_CONCURRENCY,
    )
    for (const sub of subResults) for (const f of sub) collected.push(f)
  }

  return collected
}

export async function scanDirectories(
  dirs: string[],
  categoryId: string,
  onProgress: ScanProgressCallback,
  maxDepth = MAX_DEPTH,
): Promise<ScannedFile[]> {
  const counter: Counter = { count: 0 }
  const all: ScannedFile[] = []
  await pLimit(
    dirs.map(dir => async () => {
      const stat = await statSafe(dir)
      if (!stat?.isDirectory()) return
      const files = await scanDirectory(dir, categoryId, onProgress, maxDepth, 0, counter)
      for (const f of files) all.push(f)
    }),
    4,
  )
  return all
}

export async function scanFiles(
  filePaths: string[],
  categoryId: string,
  onProgress: ScanProgressCallback,
): Promise<ScannedFile[]> {
  const result: ScannedFile[] = []
  await pLimit(
    filePaths.map(fp => async () => {
      const stat = await statSafe(fp)
      if (stat && stat.isFile() && stat.size > 0) {
        result.push({ path: fp, size: stat.size })
        onProgress({ categoryId, currentPath: fp, filesFound: 1, sizeFound: stat.size })
      }
    }),
    STAT_CONCURRENCY,
  )
  return result
}
