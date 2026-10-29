import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ScannedFile } from './scannerService'
import { appendCleanerLog } from './cleanerLogger'

const execFileAsync = promisify(execFile)

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
  permissionDenied: ScannedFile[]
  locked: { path: string; reason: string }[]
  missing: { path: string; reason: string }[]
}

export type CleanupFailureKind =
  | 'permission-denied'
  | 'locked'
  | 'missing'
  | 'cancelled'
  | 'rejected'
  | 'timeout'
  | 'other'

export interface BatchDeleteResult {
  path: string
  ok: boolean
  kind?: CleanupFailureKind
  reason?: string
}

export function classifyFailure(error: unknown): CleanupFailureKind {
  const value = error as { code?: string; message?: string }
  const code = value?.code?.toUpperCase()
  const message = (value?.message ?? '').toLowerCase()
  if (code === 'ENOENT' || message.includes('cannot find') || message.includes('does not exist')) return 'missing'
  if (code === 'EBUSY' || message.includes('being used') || message.includes('in use') || message.includes('locked')) return 'locked'
  if (code === 'EACCES' || code === 'EPERM' || message.includes('access is denied') || message.includes('permission')) return 'permission-denied'
  return 'other'
}

// ── Chunk helpers ─────────────────────────────────────────────────────────
export const CHUNK_SIZE = 300

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ── Admin Allowlist Roots in Node.js for validation & testing ─────────────
export function getAdminAllowlistRoots(systemRoot?: string): string[] {
  const sysRoot = systemRoot || process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
  return [
    path.resolve(path.join(sysRoot, 'Logs', 'CBS')).toLowerCase(),
    path.resolve(path.join(sysRoot, 'Logs', 'DISM')).toLowerCase(),
    path.resolve(path.join(sysRoot, 'Temp')).toLowerCase(),
    path.resolve(path.join(sysRoot, 'SoftwareDistribution', 'Download')).toLowerCase(),
    path.resolve(path.join(sysRoot, 'SoftwareDistribution', 'DeliveryOptimization')).toLowerCase(),
    path.resolve(path.join(sysRoot, 'Prefetch')).toLowerCase(),
  ]
}

export function isPathInAdminAllowlist(filePath: string, systemRoot?: string): boolean {
  if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) return false
  if (filePath.startsWith('\\\\')) return false // Reject UNC paths

  const sysRoot = systemRoot || process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
  const sysDrive = path.parse(sysRoot).root.replace(/[\\/]$/, '').toLowerCase()

  try {
    const resolved = path.resolve(filePath)
    const fileDrive = path.parse(resolved).root.replace(/[\\/]$/, '').toLowerCase()
    if (fileDrive !== sysDrive) return false

    const norm = resolved.toLowerCase()
    const allowedRoots = getAdminAllowlistRoots(sysRoot)

    for (const root of allowedRoots) {
      if (norm === root || norm.startsWith(root + path.sep)) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

// ── Unelevated worker script ──────────────────────────────────────────────
function getUnelevatedScript(): string {
  return [
    'param([string]$InputPath, [string]$OutputPath)',
    '$items = @(Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)',
    '$results = @()',
    'foreach ($item in $items) {',
    '  $p = [string]$item.path',
    '  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {',
    '    $results += [pscustomobject]@{ path=$p; ok=$false; kind="missing"; reason="File not found" }',
    '    continue',
    '  }',
    '  try {',
    '    Remove-Item -LiteralPath $p -Force -ErrorAction Stop',
    '    $results += [pscustomobject]@{ path=$p; ok=$true }',
    '  } catch {',
    '    $msg = $_.Exception.Message',
    '    $kind = if ($msg -match "denied|permission|access") { "permission-denied" } elseif ($msg -match "use|lock|busy") { "locked" } else { "other" }',
    '    $results += [pscustomobject]@{ path=$p; ok=$false; kind=$kind; reason=$msg }',
    '  }',
    '}',
    '$results | ConvertTo-Json -Compress | Set-Content -LiteralPath $OutputPath -Encoding UTF8',
  ].join('\r\n')
}

// ── Elevated script builder (Embedded -EncodedCommand, NO temp .ps1) ──────
export function buildElevatedScript(opts: {
  inputPath: string
  outputPath: string
  progressPath: string
  cancelPath: string
  startedPath: string
  maxRuntimeSec: number
}): string {
  const esc = (s: string) => s.replace(/'/g, "''")
  return [
    `$InputPath   = '${esc(opts.inputPath)}'`,
    `$OutputPath  = '${esc(opts.outputPath)}'`,
    `$ProgressPath= '${esc(opts.progressPath)}'`,
    `$CancelPath  = '${esc(opts.cancelPath)}'`,
    `$StartedPath = '${esc(opts.startedPath)}'`,
    `$MaxSec      = ${opts.maxRuntimeSec}`,
    `try { [System.IO.File]::WriteAllText($StartedPath, '1') } catch {}`,
    `$sysRoot = if ($env:SystemRoot) { $env:SystemRoot } elseif ($env:WINDIR) { $env:WINDIR } else { 'C:\\Windows' }`,
    `$sysDrive = [System.IO.Path]::GetPathRoot($sysRoot).TrimEnd('\\')`,
    `$allowedRoots = @(`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'Logs\\CBS')),`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'Logs\\DISM')),`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'Temp')),`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'SoftwareDistribution\\Download')),`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'SoftwareDistribution\\DeliveryOptimization')),`,
    `  [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($sysRoot, 'Prefetch'))`,
    `)`,
    `function Test-AdminAllowed {`,
    `  param([string]$p)`,
    `  if ([string]::IsNullOrWhiteSpace($p)) { return $false }`,
    `  if ($p.StartsWith('\\\\')) { return $false }`,
    `  try {`,
    `    $full = [System.IO.Path]::GetFullPath($p)`,
    `    $drive = [System.IO.Path]::GetPathRoot($full).TrimEnd('\\')`,
    `    if ($drive.ToLower() -ne $sysDrive.ToLower()) { return $false }`,
    `    $under = $false`,
    `    foreach ($root in $allowedRoots) {`,
    `      if ($full.ToLower() -eq $root.ToLower() -or $full.ToLower().StartsWith($root.ToLower() + '\\')) {`,
    `        $under = $true; break`,
    `      }`,
    `    }`,
    `    if (-not $under) { return $false }`,
    `    $check = $full`,
    `    while ($check -and $check.Length -gt 3) {`,
    `      $info = [System.IO.FileInfo]::new($check)`,
    `      if ($info.Exists -and ($info.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { return $false }`,
    `      $di = [System.IO.DirectoryInfo]::new($check)`,
    `      if ($di.Exists -and ($di.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { return $false }`,
    `      $check = [System.IO.Path]::GetDirectoryName($check)`,
    `    }`,
    `    return $true`,
    `  } catch { return $false }`,
    `}`,
    `$items = @()`,
    `try { $items = @(Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json) } catch { }`,
    `if ($items.Count -gt 5000) { $items = $items[0..4999] }`,
    `$results = @()`,
    `$start   = [System.DateTime]::UtcNow`,
    `$i       = 0`,
    `$total   = $items.Count`,
    `foreach ($item in $items) {`,
    `  if ([System.IO.File]::Exists($CancelPath)) {`,
    `    $results += [pscustomobject]@{ path=[string]$item.path; ok=$false; kind='cancelled'; reason='Cancelled' }`,
    `    $i++; continue`,
    `  }`,
    `  if (([System.DateTime]::UtcNow - $start).TotalSeconds -gt $MaxSec) {`,
    `    $results += [pscustomobject]@{ path=[string]$item.path; ok=$false; kind='timeout'; reason='Max runtime exceeded' }`,
    `    $i++; continue`,
    `  }`,
    `  $p = [string]$item.path`,
    `  if (-not (Test-AdminAllowed $p)) {`,
    `    $results += [pscustomobject]@{ path=$p; ok=$false; kind='rejected'; reason='Path failed security check' }`,
    `    $i++`,
    `    if ($i % 50 -eq 0) { try { [System.IO.File]::WriteAllText($ProgressPath, ('{"processed":' + $i + ',"total":' + $total + '}')) } catch {} }`,
    `    continue`,
    `  }`,
    `  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {`,
    `    $results += [pscustomobject]@{ path=$p; ok=$false; kind='missing'; reason='File not found' }`,
    `  } else {`,
    `    try {`,
    `      Remove-Item -LiteralPath $p -Force -ErrorAction Stop`,
    `      $results += [pscustomobject]@{ path=$p; ok=$true }`,
    `    } catch {`,
    `      $msg = $_.Exception.Message`,
    `      $results += [pscustomobject]@{ path=$p; ok=$false; kind='other'; reason=$msg }`,
    `    }`,
    `  }`,
    `  $i++`,
    `  if ($i % 50 -eq 0) { try { [System.IO.File]::WriteAllText($ProgressPath, ('{"processed":' + $i + ',"total":' + $total + '}')) } catch {} }`,
    `}`,
    `try { [System.IO.File]::WriteAllText($ProgressPath, ('{"processed":' + $total + ',"total":' + $total + ',"done":true}')) } catch {}`,
    `$json = $results | ConvertTo-Json -Compress -Depth 3`,
    `if (-not $json) { $json = '[]' }`,
    `[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.Encoding]::UTF8)`,
  ].join('\r\n')
}

export function encodePS1(script: string): string {
  const buf = Buffer.from(script, 'utf16le')
  return buf.toString('base64')
}

// ── Unelevated chunk deletion ─────────────────────────────────────────────
async function runUnelevatedChunk(files: ScannedFile[]): Promise<BatchDeleteResult[]> {
  if (files.length === 0) return []
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'propel-clean-'))
  const inputPath = path.join(dir, 'input.json')
  const outputPath = path.join(dir, 'output.json')
  const scriptPath = path.join(dir, 'delete.ps1')

  await fs.writeFile(inputPath, JSON.stringify(files.map(f => ({ path: f.path }))), 'utf8')
  await fs.writeFile(scriptPath, getUnelevatedScript(), 'utf8')

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, inputPath, outputPath],
      { windowsHide: true, timeout: 60_000 },
    )
    const raw = await fs.readFile(outputPath, 'utf8')
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as BatchDeleteResult | BatchDeleteResult[]
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Batch deletion failed'
    appendCleanerLog(`[UNELEVATED CHUNK ERROR] count=${files.length} err=${reason}`)
    return files.map(f => ({ path: f.path, ok: false, kind: classifyFailure(error), reason }))
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// ── Elevated execution with progress file polling & timeouts ──────────────
export interface ElevatedBatchOptions {
  onProgress?: (processed: number, total: number) => void
  uacTimeoutMs?: number
  noProgressTimeoutMs?: number
}

export interface ElevatedBatchOutcome {
  results: BatchDeleteResult[]
  outcome: 'completed' | 'uac-timeout' | 'no-progress-timeout' | 'cancelled' | 'error'
  message: string
}

export async function runElevatedBatch(
  files: ScannedFile[],
  opts: ElevatedBatchOptions = {},
): Promise<ElevatedBatchOutcome> {
  if (files.length === 0) {
    return { results: [], outcome: 'completed', message: 'No files to process' }
  }

  const {
    uacTimeoutMs = 60_000,
    noProgressTimeoutMs = 45_000,
    onProgress,
  } = opts

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'propel-adm-'))
  const inputPath = path.join(dir, 'input.json')
  const outputPath = path.join(dir, 'output.json')
  const progressPath = path.join(dir, 'progress.json')
  const cancelPath = path.join(dir, 'cancel')
  const startedPath = path.join(dir, 'started')

  await fs.writeFile(inputPath, JSON.stringify(files.map(f => ({ path: f.path }))), 'utf8')

  const script = buildElevatedScript({
    inputPath,
    outputPath,
    progressPath,
    cancelPath,
    startedPath,
    maxRuntimeSec: 300,
  })
  const encoded = encodePS1(script)

  const outerCommand = `$p=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'; exit $p.ExitCode`

  appendCleanerLog(`[ELEVATED SPAWN] fileCount=${files.length}`)

  const psPromise = execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', outerCommand],
    { windowsHide: true },
  )

  // 1. Wait for started marker (UAC consent detection)
  let started = false
  const deadline = Date.now() + uacTimeoutMs
  while (Date.now() < deadline) {
    try {
      await fs.access(startedPath)
      started = true
      break
    } catch {
      // not yet created
    }
    await new Promise(r => setTimeout(r, 400))
  }

  if (!started) {
    appendCleanerLog(`[ELEVATED UAC TIMEOUT] consent not granted within ${Math.round(uacTimeoutMs / 1000)}s`)
    await fs.writeFile(cancelPath, '1', 'utf8').catch(() => {})
    void psPromise.catch(() => {})
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return {
      results: files.map(f => ({
        path: f.path,
        ok: false,
        kind: 'timeout' as CleanupFailureKind,
        reason: 'Administrator permission was not granted within timeout',
      })),
      outcome: 'uac-timeout',
      message: `Administrator permission was not granted within ${Math.round(uacTimeoutMs / 1000)} seconds. Files were skipped.`,
    }
  }

  appendCleanerLog(`[ELEVATED STARTED] UAC granted, polling progress...`)

  // 2. Poll progress and watch for no-progress timeout
  let lastProgress = Date.now()
  let lastProcessed = 0
  let isDone = false

  const pollInterval = setInterval(async () => {
    if (isDone) return
    try {
      const raw = await fs.readFile(progressPath, 'utf8')
      const p = JSON.parse(raw) as { processed: number; total: number; done?: boolean }
      if (typeof p.processed === 'number' && p.processed !== lastProcessed) {
        lastProcessed = p.processed
        lastProgress = Date.now()
        onProgress?.(p.processed, p.total || files.length)
      }
    } catch {
      // file might be mid-write or not created yet
    }
  }, 1000)

  let timedOut = false
  const noProgressChecker = new Promise<void>(resolve => {
    const check = () => {
      if (isDone) return resolve()
      if (Date.now() - lastProgress > noProgressTimeoutMs) {
        timedOut = true
        return resolve()
      }
      setTimeout(check, 1500)
    }
    setTimeout(check, 2000)
  })

  await Promise.race([
    psPromise.then(() => { isDone = true }).catch(err => {
      isDone = true
      appendCleanerLog(`[ELEVATED PROCESS ERROR] err=${err?.message}`)
    }),
    noProgressChecker,
  ])

  isDone = true
  clearInterval(pollInterval)

  if (timedOut) {
    appendCleanerLog(`[ELEVATED NO-PROGRESS TIMEOUT] stalled for ${Math.round(noProgressTimeoutMs / 1000)}s`)
    await fs.writeFile(cancelPath, '1', 'utf8').catch(() => {})
    const results = await readOutputJson(outputPath, files)
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return {
      results,
      outcome: 'no-progress-timeout',
      message: `Cleaning stalled for ${Math.round(noProgressTimeoutMs / 1000)} seconds. Partial results returned.`,
    }
  }

  appendCleanerLog(`[ELEVATED FINISHED] reading results`)
  const results = await readOutputJson(outputPath, files)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})

  return {
    results,
    outcome: 'completed',
    message: 'Elevated cleaning completed',
  }
}

async function readOutputJson(outputPath: string, files: ScannedFile[]): Promise<BatchDeleteResult[]> {
  try {
    const raw = await fs.readFile(outputPath, 'utf8')
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as BatchDeleteResult | BatchDeleteResult[]
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return files.map(file => {
      const match = list.find(r => r.path.toLowerCase() === file.path.toLowerCase())
      return match || { path: file.path, ok: false, kind: 'other', reason: 'No result recorded' }
    })
  } catch {
    return files.map(f => ({
      path: f.path,
      ok: false,
      kind: 'other',
      reason: 'Elevated process did not return deletion results',
    }))
  }
}

// ── Public: clean files (unelevated, chunked) ─────────────────────────────
export async function cleanFiles(
  files: ScannedFile[],
  onProgress: CleanProgressCallback,
  _safeMode = true,
): Promise<CleanupStats> {
  let freed = 0, removed = 0, errors = 0
  const errorDetails: { path: string; reason: string }[] = []
  const permissionDenied: ScannedFile[] = []
  const locked: { path: string; reason: string }[] = []
  const missing: { path: string; reason: string }[] = []
  const total = files.length
  let current = 0

  const chunks = chunkArray(files, CHUNK_SIZE)
  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c]
    const results = await runUnelevatedChunk(chunk)
    for (const file of chunk) {
      const result = results.find(r => r.path.toLowerCase() === file.path.toLowerCase())
        ?? { path: file.path, ok: false, kind: 'other' as CleanupFailureKind, reason: 'No result' }
      current++
      if (result.ok) {
        freed += file.size
        removed++
      } else {
        const kind = result.kind ?? classifyFailure({ message: result.reason })
        const reason = result.reason ?? 'Unknown error'
        errors++
        errorDetails.push({ path: file.path, reason })
        if (kind === 'permission-denied') permissionDenied.push(file)
        if (kind === 'locked') locked.push({ path: file.path, reason })
        if (kind === 'missing') missing.push({ path: file.path, reason })
      }
      onProgress({ current, total, currentFile: file.path, freed })
    }
  }

  return { freed, removed, errors, errorDetails, permissionDenied, locked, missing }
}

// ── Public: clean admin files (elevated) ──────────────────────────────────
export async function cleanPermissionDeniedBatch(
  files: ScannedFile[],
  opts?: ElevatedBatchOptions,
): Promise<CleanupStats> {
  const outcome = await runElevatedBatch(files, opts)
  let freed = 0, removed = 0
  const errorDetails: { path: string; reason: string }[] = []
  const permissionDenied: ScannedFile[] = []
  const locked: { path: string; reason: string }[] = []
  const missing: { path: string; reason: string }[] = []

  for (const file of files) {
    const result = outcome.results.find(r => r.path.toLowerCase() === file.path.toLowerCase())
    if (result?.ok) {
      freed += file.size
      removed++
      continue
    }
    const kind = result?.kind ?? 'other'
    const reason = result?.reason ?? outcome.message
    if (kind === 'missing') continue
    errorDetails.push({ path: file.path, reason })
    if (kind === 'permission-denied') permissionDenied.push(file)
    if (kind === 'locked') locked.push({ path: file.path, reason })
  }

  return {
    freed,
    removed,
    errors: errorDetails.length,
    errorDetails,
    permissionDenied,
    locked,
    missing,
  }
}

export async function removeEmptyDirs(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath)
    if (entries.length === 0) await fs.rmdir(dirPath)
  } catch {
    // ignore
  }
}
