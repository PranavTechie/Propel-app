import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface PerformanceModeResult {
  enabled: boolean
  processesAffected: number
}

// Lower priority of background processes (no visible window) to BelowNormal.
// This gives foreground apps (games/workloads) more CPU scheduling time.
// Same technique used by game boosters — no processes are killed.
const ENABLE_SCRIPT = `
$count = 0
Get-Process | Where-Object {
    try {
        !$_.HasExited -and $_.MainWindowHandle -eq 0 -and
        $_.PriorityClass -ne 'Idle' -and $_.PriorityClass -ne 'BelowNormal' -and
        $_.Name -notmatch "^(System|Idle|smss|csrss|wininit|winlogon|lsass|services|svchost|dwm)$"
    } catch { $false }
} | ForEach-Object {
    try { $_.PriorityClass = 'BelowNormal'; $count++ } catch {}
}
$count
`

const DISABLE_SCRIPT = `
$count = 0
Get-Process | Where-Object {
    try { !$_.HasExited -and $_.PriorityClass -eq 'BelowNormal' } catch { $false }
} | ForEach-Object {
    try { $_.PriorityClass = 'Normal'; $count++ } catch {}
}
$count
`

export async function setPerformanceMode(enabled: boolean): Promise<PerformanceModeResult> {
  const script = enabled ? ENABLE_SCRIPT : DISABLE_SCRIPT
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n/g, ' ')}"`,
      { timeout: 15000 },
    )
    const affected = parseInt(stdout.trim(), 10) || 0
    return { enabled, processesAffected: affected }
  } catch {
    return { enabled, processesAffected: 0 }
  }
}
