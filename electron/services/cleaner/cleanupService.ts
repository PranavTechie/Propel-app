import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ScannedFile } from './scannerService'

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

export type CleanupFailureKind = 'permission-denied' | 'locked' | 'missing' | 'other'

export interface BatchDeleteResult {
  path: string
  ok: boolean
  kind?: CleanupFailureKind
  reason?: string
}

function classifyFailure(error: unknown): CleanupFailureKind {
  const value = error as { code?: string; message?: string }
  const code = value?.code?.toUpperCase()
  const message = (value?.message ?? '').toLowerCase()
  if (code === 'ENOENT' || message.includes('cannot find') || message.includes('does not exist')) return 'missing'
  if (code === 'EBUSY' || message.includes('being used') || message.includes('in use') || message.includes('locked')) return 'locked'
  if (code === 'EACCES' || code === 'EPERM' || message.includes('access is denied') || message.includes('permission')) return 'permission-denied'
  return 'other'
}

function getWorkerScript(): string {
  return [
    'param([string]$InputPath, [string]$OutputPath)',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class PropelFileOperation {',
    '  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
    '  public struct SHFILEOPSTRUCT { public IntPtr hwnd; public uint wFunc; public string pFrom; public string pTo; public ushort fFlags; public IntPtr fAnyOperationsAborted; public IntPtr hNameMappings; public string lpszProgressTitle; }',
    '  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int SHFileOperation(ref SHFILEOPSTRUCT operation);',
    '  public const uint FO_DELETE = 3; public const ushort FOF_SILENT = 4; public const ushort FOF_NOCONFIRMATION = 16; public const ushort FOF_ALLOWUNDO = 64; public const ushort FOF_NOERRORUI = 1024;',
    '}',
    '"@',
    '$items = @(Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)',
    '$results = @()',
    '$before = @{}',
    'foreach ($item in $items) { $before[[string]$item.path] = Test-Path -LiteralPath ([string]$item.path) -PathType Leaf }',
    '$operation = New-Object PropelFileOperation+SHFILEOPSTRUCT',
    '$operation.wFunc = [PropelFileOperation]::FO_DELETE',
    '$operation.pFrom = (($items | ForEach-Object { [string]$_.path }) -join ([char]0)) + [char]0 + [char]0',
    '$operation.fFlags = [PropelFileOperation]::FOF_SILENT -bor [PropelFileOperation]::FOF_NOCONFIRMATION -bor [PropelFileOperation]::FOF_ALLOWUNDO -bor [PropelFileOperation]::FOF_NOERRORUI',
    '$code = [PropelFileOperation]::SHFileOperation([ref]$operation)',
    'foreach ($item in $items) {',
    '  $itemPath = [string]$item.path',
    '  $existsAfter = Test-Path -LiteralPath $itemPath -PathType Leaf',
    '  if (-not $before[$itemPath]) { $results += [pscustomobject]@{ path = $itemPath; ok = $false; kind = "missing"; reason = "File was already missing" } }',
    '  elseif (-not $existsAfter) { $results += [pscustomobject]@{ path = $itemPath; ok = $true } }',
    '  else { $kind = if ($code -eq 5) { "permission-denied" } elseif ($code -eq 32) { "locked" } else { "other" }; $results += [pscustomobject]@{ path = $itemPath; ok = $false; kind = $kind; reason = "SHFileOperation error $code" } }',
    '}',
    '$results | ConvertTo-Json -Compress | Set-Content -LiteralPath $OutputPath -Encoding UTF8',
  ].join('\r\n')
}

async function runBatchDelete(files: ScannedFile[], elevated: boolean): Promise<BatchDeleteResult[]> {
  if (files.length === 0) return []
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'propel-cleaner-'))
  const inputPath = path.join(directory, 'input.json')
  const outputPath = path.join(directory, 'output.json')
  const scriptPath = path.join(directory, 'delete.ps1')
  await fs.writeFile(inputPath, JSON.stringify(files.map(file => ({ path: file.path }))), 'utf8')
  await fs.writeFile(scriptPath, getWorkerScript(), 'utf8')
  try {
    if (elevated) {
      const args = [scriptPath, inputPath, outputPath].map(value => `'${value.replace(/'/g, "''")}'`).join(',')
      const command = `$p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',${args}); exit $p.ExitCode`
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
    } else {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, inputPath, outputPath], { windowsHide: true })
    }
    const output = await fs.readFile(outputPath, 'utf8')
    const parsed = JSON.parse(output.replace(/^\uFEFF/, '')) as BatchDeleteResult | BatchDeleteResult[]
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Batch deletion failed'
    return files.map(file => ({ path: file.path, ok: false, kind: classifyFailure(error), reason }))
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
  }
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
  const permissionDenied: ScannedFile[] = []
  const locked: { path: string; reason: string }[] = []
  const missing: { path: string; reason: string }[] = []
  const total = files.length
  const results = safeMode
    ? await runBatchDelete(files, false)
    : await Promise.all(files.map(async file => {
        try {
          await fs.unlink(file.path)
          return { path: file.path, ok: true }
        } catch (error) {
          return { path: file.path, ok: false, kind: classifyFailure(error), reason: error instanceof Error ? error.message : 'Unknown error' }
        }
      }))

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const result = results[i] ?? { path: file.path, ok: false, kind: 'other' as const, reason: 'No deletion result' }
    if (result.ok) {
      freed += file.size
      removed++
    } else {
      const kind = result.kind ?? classifyFailure({ message: result.reason })
      const reason = result.reason || 'Unknown error'
      errors++
      errorDetails.push({ path: file.path, reason })
      if (kind === 'permission-denied') permissionDenied.push(file)
      if (kind === 'locked') locked.push({ path: file.path, reason })
      if (kind === 'missing') missing.push({ path: file.path, reason })
    }
    onProgress({ current: i + 1, total, currentFile: file.path, freed })
  }

  return { freed, removed, errors, errorDetails, permissionDenied, locked, missing }
}

export async function cleanPermissionDeniedBatch(files: ScannedFile[]): Promise<CleanupStats> {
  const results = await runBatchDelete(files, true)
  let freed = 0
  let removed = 0
  const errorDetails: { path: string; reason: string }[] = []
  const permissionDenied: ScannedFile[] = []
  const locked: { path: string; reason: string }[] = []
  const missing: { path: string; reason: string }[] = []
  for (const file of files) {
    const result = results.find(item => item.path === file.path)
    if (result?.ok) {
      freed += file.size
      removed++
      continue
    }
    const reason = result?.reason || 'Unknown error'
    const kind = result?.kind ?? classifyFailure({ message: reason })
    if (kind === 'missing') {
      // The file was already removed between the normal pass and elevation.
      continue
    }
    errorDetails.push({ path: file.path, reason })
    if (kind === 'permission-denied') permissionDenied.push(file)
    if (kind === 'locked') locked.push({ path: file.path, reason })
  }
  return { freed, removed, errors: errorDetails.length, errorDetails, permissionDenied, locked, missing }
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
