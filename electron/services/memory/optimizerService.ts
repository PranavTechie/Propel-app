import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

export interface OptimizeProgressInfo {
  step: string
  processed: number
  total: number
}

export type OptimizeProgressCallback = (info: OptimizeProgressInfo) => void

export interface OptimizationResult {
  recoveredBytes: number
  processesOptimized: number
  durationMs: number
  optimizedProcesses: string[]
}

// Uses EmptyWorkingSet (psapi.dll) — same API used by Process Hacker, RAMMap.
// Safe: only trims inactive pages, no processes are killed.
// Requires no admin on user-owned processes.
const OPTIMIZE_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PropelMem {
    [DllImport("psapi.dll", SetLastError=true)]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);
}
"@

$SKIP = @("System","Idle","smss","csrss","wininit","winlogon","lsass","services","svchost","dwm","audiodg","Registry","MsMpEng","spoolsv")
$results = @()
$procs = Get-Process | Where-Object {
    try {
        !$_.HasExited -and $_.WorkingSet64 -gt 10MB -and $SKIP -notcontains $_.Name
    } catch { $false }
}
$before = (Get-CimInstance -ClassName Win32_OperatingSystem).FreePhysicalMemory
foreach ($p in $procs) {
    try {
        [PropelMem]::EmptyWorkingSet($p.Handle) | Out-Null
        $results += $p.Name
    } catch {}
}
Start-Sleep -Milliseconds 800
$after = (Get-CimInstance -ClassName Win32_OperatingSystem).FreePhysicalMemory
$freed = [Math]::Max(0, ($after - $before)) * 1024
"$freed|$($results.Count)|$(($results | Select-Object -Unique) -join ',')"
`

export async function runSafeOptimization(
  onProgress: OptimizeProgressCallback,
): Promise<OptimizationResult> {
  const startTime = Date.now()
  const tmpFile = path.join(os.tmpdir(), `propel_opt_${Date.now()}.ps1`)

  onProgress({ step: 'Optimizing memory…', processed: 0, total: 1 })

  try {
    await fs.writeFile(tmpFile, OPTIMIZE_SCRIPT, 'utf8')

    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 60000 },
    )

    const parts = stdout.trim().split('|')
    const recoveredBytes = parseInt(parts[0] ?? '0', 10) || 0
    const count = parseInt(parts[1] ?? '0', 10) || 0
    const names = (parts[2] ?? '').split(',').filter(Boolean)

    await fs.unlink(tmpFile).catch(() => {})

    onProgress({ step: 'Complete', processed: 1, total: 1 })

    return {
      recoveredBytes,
      processesOptimized: count,
      durationMs: Date.now() - startTime,
      optimizedProcesses: names.slice(0, 20),
    }
  } catch {
    await fs.unlink(tmpFile).catch(() => {})
    onProgress({ step: 'Complete', processed: 1, total: 1 })
    return {
      recoveredBytes: 0,
      processesOptimized: 0,
      durationMs: Date.now() - startTime,
      optimizedProcesses: [],
    }
  }
}
