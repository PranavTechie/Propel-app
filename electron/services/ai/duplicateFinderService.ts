import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import { shell } from 'electron'

// ── State for verified scan results ─────────────────────────────────────────
let lastScanResult: DuplicateScanResult | null = null

export function getLastScanResult(): DuplicateScanResult | null {
  return lastScanResult
}

export function setLastScanResultForTesting(result: DuplicateScanResult | null): void {
  lastScanResult = result
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface DuplicateFile {
  path: string
  size: number
  name: string
  extension: string
  isOriginal: boolean
}

export interface DuplicateGroup {
  hash: string
  size: number
  count: number
  totalWasted: number
  files: DuplicateFile[]
  category: DuplicateCategory
}

export type DuplicateCategory = 'images' | 'videos' | 'documents' | 'archives' | 'installers' | 'other'

export interface DuplicateScanResult {
  groups: DuplicateGroup[]
  totalFiles: number
  totalDuplicates: number
  totalWastedBytes: number
  scannedBytes: number
  scannedFiles: number
  durationMs: number
  scannedAt: number
}

export type DuplicateScanProgress = {
  phase: 'scanning' | 'hashing' | 'grouping' | 'done'
  scannedFiles: number
  hashedFiles: number
  totalFiles: number
  currentPath: string
  duplicatesFound: number
}

export type ProgressCallback = (progress: DuplicateScanProgress) => void

// ── Category detection ──────────────────────────────────────────────────────
const CATEGORY_EXTS: Record<DuplicateCategory, string[]> = {
  images:     ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.heic', '.svg', '.ico'],
  videos:     ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'],
  documents:  ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.csv'],
  archives:   ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.cab'],
  installers: ['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.iso'],
  other:      [],
}

function getCategory(ext: string): DuplicateCategory {
  const lower = ext.toLowerCase()
  for (const [cat, exts] of Object.entries(CATEGORY_EXTS) as [DuplicateCategory, string[]][]) {
    if (cat !== 'other' && exts.includes(lower)) return cat
  }
  return 'other'
}

// All target extensions for scanning
const ALL_EXTS = new Set([
  ...CATEGORY_EXTS.images,
  ...CATEGORY_EXTS.videos,
  ...CATEGORY_EXTS.documents,
  ...CATEGORY_EXTS.archives,
  ...CATEGORY_EXTS.installers,
])

// ── Default scan roots ──────────────────────────────────────────────────────
function getDefaultScanRoots(): string[] {
  const home = os.homedir()
  const candidates = [
    path.join(home, 'Documents'),
    path.join(home, 'Pictures'),
    path.join(home, 'Videos'),
    path.join(home, 'Music'),
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
  ]
  return candidates.filter(d => fs.existsSync(d))
}

// ── Protected folders (always excluded) ──────────────────────────────────────
const PROTECTED_PATHS = [
  'windows', 'program files', 'programdata', 'system32',
  'syswow64', '$recycle.bin', 'appdata\\local\\temp',
]

function isProtected(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return PROTECTED_PATHS.some(p => lower.includes(p))
}

// ── File collection ────────────────────────────────────────────────────────
async function collectFiles(
  roots: string[],
  excludedPaths: string[],
  onProgress: (count: number, currentPath: string) => void,
): Promise<Array<{ path: string; size: number; ext: string }>> {
  const results: Array<{ path: string; size: number; ext: string }> = []
  const excluded = excludedPaths.map(p => p.toLowerCase())

  async function walk(dir: string): Promise<void> {
    if (isProtected(dir)) return
    if (excluded.some(ex => dir.toLowerCase().startsWith(ex))) return

    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch { return }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!isProtected(full)) await walk(full)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ALL_EXTS.has(ext)) {
          try {
            const { size } = await fs.promises.stat(full)
            if (size > 1024) { // skip files < 1KB (unlikely duplicates worth caring about)
              results.push({ path: full, size, ext })
              if (results.length % 100 === 0) onProgress(results.length, full)
            }
          } catch { /* skip locked */ }
        }
      }
    }
  }

  for (const root of roots) {
    await walk(root)
  }

  return results
}

// ── File hashing ───────────────────────────────────────────────────────────
// Hash first 64KB + file size for speed, then full hash for candidates
async function quickHash(filePath: string, size: number): Promise<string> {
  let fd: fs.promises.FileHandle | null = null
  try {
    const CHUNK = 65536 // 64 KB
    fd = await fs.promises.open(filePath, 'r')
    const buf = Buffer.alloc(Math.min(CHUNK, size))
    await fd.read(buf, 0, buf.length, 0)
    const hash = crypto.createHash('md5')
    hash.update(buf)
    hash.update(`:size:${size}`)
    return hash.digest('hex')
  } catch {
    return `error_${Math.random()}`
  } finally {
    if (fd) await fd.close().catch(() => {})
  }
}

async function fullHash(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', () => resolve(`error_${Math.random()}`))
  })
}

// ── Main scan function ──────────────────────────────────────────────────────
export async function scanForDuplicates(
  scanRoots: string[] | null,
  excludedPaths: string[],
  onProgress: ProgressCallback,
): Promise<DuplicateScanResult> {
  const startTime = Date.now()
  const roots = scanRoots ?? getDefaultScanRoots()

  onProgress({ phase: 'scanning', scannedFiles: 0, hashedFiles: 0, totalFiles: 0, currentPath: '', duplicatesFound: 0 })

  // Step 1: Collect candidate files
  let collectedCount = 0
  const files = await collectFiles(roots, excludedPaths, (count, currentPath) => {
    collectedCount = count
    onProgress({ phase: 'scanning', scannedFiles: count, hashedFiles: 0, totalFiles: count, currentPath, duplicatesFound: 0 })
  })

  const totalFiles = files.length

  onProgress({ phase: 'hashing', scannedFiles: totalFiles, hashedFiles: 0, totalFiles, currentPath: '', duplicatesFound: 0 })

  // Step 2: Quick-hash to find candidates (group by size first)
  const sizeGroups = new Map<number, typeof files>()
  for (const f of files) {
    const group = sizeGroups.get(f.size) ?? []
    group.push(f)
    sizeGroups.set(f.size, group)
  }

  // Only consider files with matching sizes (necessary for duplicates)
  const candidates = [...sizeGroups.values()].filter(g => g.length > 1).flat()

  // Step 3: Quick hash candidates
  const quickHashGroups = new Map<string, typeof files>()
  let hashedCount = 0
  for (const f of candidates) {
    const qh = await quickHash(f.path, f.size)
    const group = quickHashGroups.get(qh) ?? []
    group.push(f)
    quickHashGroups.set(qh, group)
    hashedCount++
    if (hashedCount % 20 === 0) {
      onProgress({ phase: 'hashing', scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: f.path, duplicatesFound: 0 })
    }
  }

  // Step 4: Full hash only groups that still have multiple candidates
  onProgress({ phase: 'grouping', scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: '', duplicatesFound: 0 })

  const finalGroups = new Map<string, typeof files>()
  for (const [, group] of quickHashGroups) {
    if (group.length < 2) continue
    for (const f of group) {
      const fh = await fullHash(f.path)
      const fg = finalGroups.get(fh) ?? []
      fg.push(f)
      finalGroups.set(fh, fg)
    }
  }

  // Step 5: Build result
  const duplicateGroups: DuplicateGroup[] = []
  let totalDuplicates = 0
  let totalWastedBytes = 0
  let scannedBytes = 0

  for (const [hash, group] of finalGroups) {
    if (group.length < 2) continue

    // Sort by path length (shortest = most likely original)
    group.sort((a, b) => a.path.length - b.path.length)

    const size = group[0].size
    const wasted = size * (group.length - 1)
    totalWastedBytes += wasted
    totalDuplicates += group.length - 1
    scannedBytes += size * group.length

    const duplicateFiles: DuplicateFile[] = group.map((f, i) => ({
      path: f.path,
      size: f.size,
      name: path.basename(f.path),
      extension: f.ext,
      isOriginal: i === 0,
    }))

    duplicateGroups.push({
      hash,
      size,
      count: group.length,
      totalWasted: wasted,
      files: duplicateFiles,
      category: getCategory(group[0].ext),
    })
  }

  // Sort by wasted space desc
  duplicateGroups.sort((a, b) => b.totalWasted - a.totalWasted)

  onProgress({ phase: 'done', scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: '', duplicatesFound: totalDuplicates })

  const scanResult: DuplicateScanResult = {
    groups: duplicateGroups,
    totalFiles,
    totalDuplicates,
    totalWastedBytes,
    scannedBytes,
    scannedFiles: totalFiles,
    durationMs: Date.now() - startTime,
    scannedAt: Date.now(),
  }

  lastScanResult = scanResult
  return scanResult
}

// ── Delete selected duplicate files ───────────────────────────────────────
export interface DeleteDuplicatesResult {
  deletedCount: number
  freedBytes: number
  errors: number
}

export async function deleteSelectedDuplicates(
  filePaths: string[],
): Promise<DeleteDuplicatesResult> {
  let deletedCount = 0
  let freedBytes = 0
  let errors = 0

  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { deletedCount: 0, freedBytes: 0, errors: 0 }
  }

  // Ensure there is a verified prior duplicate scan result
  if (!lastScanResult || !lastScanResult.groups || lastScanResult.groups.length === 0) {
    return { deletedCount: 0, freedBytes: 0, errors: filePaths.length }
  }

  const requestedNormSet = new Set(
    filePaths.map(p => path.normalize(p).toLowerCase())
  )

  const approvedToDelete: string[] = []
  const processedInScan = new Set<string>()

  // Validate per group and enforce GROUP PRESERVATION
  for (const group of lastScanResult.groups) {
    const requestedInGroup: DuplicateFile[] = []
    const notRequestedInGroup: DuplicateFile[] = []

    for (const file of group.files) {
      const norm = path.normalize(file.path).toLowerCase()
      if (requestedNormSet.has(norm)) {
        requestedInGroup.push(file)
        processedInScan.add(norm)
      } else {
        notRequestedInGroup.push(file)
      }
    }

    if (requestedInGroup.length === 0) continue

    // If the caller requested all files in this group (no files left unrequested),
    // we MUST preserve at least one copy in the group.
    if (notRequestedInGroup.length === 0) {
      // Prioritize preserving the original file, or the first one in the list
      const originalIdx = requestedInGroup.findIndex(f => f.isOriginal)
      const preserveIdx = originalIdx >= 0 ? originalIdx : 0
      requestedInGroup.splice(preserveIdx, 1)
      errors++ // user attempted to delete all copies; preserved copy is rejected
    }

    for (const f of requestedInGroup) {
      approvedToDelete.push(f.path)
    }
  }

  // Any requested path that was NOT part of any duplicate group in the last scan is rejected
  for (const p of filePaths) {
    const norm = path.normalize(p).toLowerCase()
    if (!processedInScan.has(norm)) {
      errors++
    }
  }

  const successfullyTrashed = new Set<string>()

  for (const filePath of approvedToDelete) {
    // Safety: never delete protected system paths
    if (isProtected(filePath)) {
      errors++
      continue
    }

    try {
      let stat: fs.Stats
      try {
        stat = await fs.promises.stat(filePath)
      } catch {
        errors++
        continue
      }
      // Send to Windows Recycle Bin via Electron shell.trashItem (do NOT permanently unlink)
      await shell.trashItem(filePath)
      freedBytes += stat.size
      deletedCount++
      successfullyTrashed.add(path.normalize(filePath).toLowerCase())
    } catch {
      errors++
    }
  }

  // Update in-memory lastScanResult so deleted files are removed from active groups
  if (successfullyTrashed.size > 0 && lastScanResult) {
    for (const group of lastScanResult.groups) {
      group.files = group.files.filter(
        f => !successfullyTrashed.has(path.normalize(f.path).toLowerCase())
      )
    }
    lastScanResult.groups = lastScanResult.groups.filter(g => g.files.length > 1)
  }

  return { deletedCount, freedBytes, errors }
}
