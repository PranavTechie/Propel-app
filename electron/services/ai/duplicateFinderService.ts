import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'

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

  function walkSync(dir: string): void {
    if (isProtected(dir)) return
    if (excluded.some(ex => dir.toLowerCase().startsWith(ex))) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { return }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!isProtected(full)) walkSync(full)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ALL_EXTS.has(ext)) {
          try {
            const { size } = fs.statSync(full)
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
    walkSync(root)
  }

  return results
}

// ── File hashing ───────────────────────────────────────────────────────────
// Hash first 64KB + file size for speed, then full hash for candidates
function quickHash(filePath: string, size: number): string {
  try {
    const CHUNK = 65536 // 64 KB
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(Math.min(CHUNK, size))
    fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    const hash = crypto.createHash('md5')
    hash.update(buf)
    hash.update(`:size:${size}`)
    return hash.digest('hex')
  } catch {
    return `error_${Math.random()}`
  }
}

function fullHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  } catch {
    return `error_${Math.random()}`
  }
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
    const qh = quickHash(f.path, f.size)
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
      const fh = fullHash(f.path)
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

  return {
    groups: duplicateGroups,
    totalFiles,
    totalDuplicates,
    totalWastedBytes,
    scannedBytes,
    scannedFiles: totalFiles,
    durationMs: Date.now() - startTime,
    scannedAt: Date.now(),
  }
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

  // Safety: never delete files that are protected
  const safeToDelete = filePaths.filter(p => !isProtected(p))

  for (const filePath of safeToDelete) {
    try {
      const stat = fs.statSync(filePath)
      fs.unlinkSync(filePath)
      freedBytes += stat.size
      deletedCount++
    } catch {
      errors++
    }
  }

  return { deletedCount, freedBytes, errors }
}
