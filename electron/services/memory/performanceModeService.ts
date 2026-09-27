import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

const execAsync = promisify(exec)

export interface PerformanceModeResult {
  enabled: boolean
  processesAffected: number
}

function getStatePath() {
  const userData = app?.getPath ? app.getPath('userData') : process.cwd()
  return path.join(userData, 'performance_mode_state.json')
}

// Lower priority of background processes (no visible window) to BelowNormal.
// This gives foreground apps (games/workloads) more CPU scheduling time.
const ENABLE_SCRIPT = `
$results = @();
Get-Process | Where-Object {
    try {
        (!$_.HasExited) -and ($_.MainWindowHandle -eq 0) -and ($_.PriorityClass -ne 'Idle') -and ($_.PriorityClass -ne 'BelowNormal') -and ($_.Name -notmatch '^(System|Idle|smss|csrss|wininit|winlogon|lsass|services|svchost|dwm)$')
    } catch { $false }
} | ForEach-Object {
    try { 
        $original = $_.PriorityClass.ToString();
        $_.PriorityClass = 'BelowNormal';
        $results += @{ Id = $_.Id; OriginalClass = $original };
    } catch {}
};
$results | ConvertTo-Json -Compress;
`

const DISABLE_SCRIPT_TEMPLATE = `
$ErrorActionPreference = 'Stop';
$path = '@STATE_PATH@';
if (-not (Test-Path $path)) { return "0" }
$json = Get-Content -Path $path -Raw;
if ([string]::IsNullOrWhiteSpace($json) -or $json -eq '[]') { return "0" }
$count = 0;
$tracked = $json | ConvertFrom-Json;
foreach ($item in $tracked) {
    $p = Get-Process -Id $item.Id -ErrorAction SilentlyContinue;
    if ($null -ne $p -and !$p.HasExited) {
        $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::Parse([System.Diagnostics.ProcessPriorityClass], $item.OriginalClass);
        $count++;
    }
}
$count;
`

export async function setPerformanceMode(enabled: boolean): Promise<PerformanceModeResult> {
  const statePath = getStatePath()

  if (enabled) {
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${ENABLE_SCRIPT.replace(/\r?\n/g, ' ')}"`,
        { timeout: 15000 },
      )
      
      const output = stdout.trim()
      let trackedPids: Array<{Id: number, OriginalClass: string}> = []
      if (output && output !== '[]' && output !== '') {
         const parsed = JSON.parse(output)
         trackedPids = Array.isArray(parsed) ? parsed : [parsed]
      }
      
      await fs.writeFile(statePath, JSON.stringify(trackedPids), 'utf8')
      
      return { enabled: true, processesAffected: trackedPids.length }
    } catch (err) {
      console.error('[PerformanceMode] Failed to enable:', err)
      return { enabled: false, processesAffected: 0 }
    }
  } else {
    try {
      let stateData = '[]'
      try {
        stateData = await fs.readFile(statePath, 'utf8')
      } catch {
        return { enabled: false, processesAffected: 0 }
      }
      
      const script = DISABLE_SCRIPT_TEMPLATE.replace('@STATE_PATH@', statePath.replace(/'/g, "''"))
      
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`,
        { timeout: 15000 },
      )
      
      const affected = parseInt(stdout.trim(), 10) || 0
      await fs.unlink(statePath).catch(() => {})
      
      return { enabled: false, processesAffected: affected }
    } catch (err) {
      console.error('[PerformanceMode] Failed to disable:', err)
      return { enabled: false, processesAffected: 0 }
    }
  }
}

export async function recoverPerformanceModeState(): Promise<void> {
  const statePath = getStatePath()
  try {
    const stateData = await fs.readFile(statePath, 'utf8')
    console.log('[PerformanceMode Cleanup] Recovering orphaned process priorities...')
    const script = DISABLE_SCRIPT_TEMPLATE.replace('@STATE_PATH@', statePath.replace(/'/g, "''"))
    
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`,
      { timeout: 15000 },
    )
    await fs.unlink(statePath).catch(() => {})
    console.log('[PerformanceMode Cleanup] Recovery complete. Orphaned state file removed.')
  } catch {
    // No state file or failed to read, do nothing
  }
}
