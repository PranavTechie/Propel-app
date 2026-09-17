import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function ps(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${cmd.replace(/\r?\n/g, ' ')}"`,
      { timeout: 15000 },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

export interface SecurityStatus {
  defenderEnabled: boolean
  defenderUpToDate: boolean
  firewallEnabled: boolean
  secureBootEnabled: boolean
  tpmAvailable: boolean
  tpmVersion: string
  bitLockerEnabled: boolean
  uacEnabled: boolean
  windowsUpdatePending: boolean
  lastUpdateDays: number | null
  antispywareEnabled: boolean
  securityScore: number
  issues: string[]
  recommendations: string[]
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  const issues: string[] = []
  const recommendations: string[] = []

  // Windows Defender & Firewall via PowerShell CIM
  const defenderRaw = await ps(`
try {
  $d = Get-MpComputerStatus -ErrorAction Stop
  "$($d.AntivirusEnabled)|$($d.AntispywareEnabled)|$($d.AntivirusSignatureAge)"
} catch { "err|err|err" }
`)
  let defenderEnabled = false
  let antispywareEnabled = false
  let defenderUpToDate = false

  if (defenderRaw && !defenderRaw.startsWith('err')) {
    const parts = defenderRaw.split('|')
    defenderEnabled = parts[0]?.toLowerCase() === 'true'
    antispywareEnabled = parts[1]?.toLowerCase() === 'true'
    const sigAge = parseInt(parts[2] ?? '99', 10)
    defenderUpToDate = sigAge <= 3
    if (!defenderEnabled) {
      issues.push('Windows Defender is disabled')
      recommendations.push('Enable Windows Defender for real-time protection')
    }
    if (!defenderUpToDate) {
      issues.push(`Defender signatures are ${sigAge} day(s) old`)
      recommendations.push('Update Windows Defender signatures')
    }
  }

  // Firewall
  const firewallRaw = await ps(`
try {
  $fw = Get-NetFirewallProfile -Profile Domain,Public,Private -ErrorAction Stop
  ($fw | Where-Object { $_.Enabled -eq 'True' }).Count
} catch { "0" }
`)
  const firewallEnabled = parseInt(firewallRaw, 10) > 0
  if (!firewallEnabled) {
    issues.push('Windows Firewall is disabled on all profiles')
    recommendations.push('Enable Windows Firewall to block unauthorized network access')
  }

  // Secure Boot
  const secureBootRaw = await ps(
    `try { (Confirm-SecureBootUEFI -ErrorAction Stop).ToString() } catch { 'false' }`
  )
  const secureBootEnabled = secureBootRaw.toLowerCase() === 'true'
  if (!secureBootEnabled) {
    recommendations.push('Secure Boot is not enabled — consider enabling it in BIOS for enhanced security')
  }

  // TPM
  const tpmRaw = await ps(`
try {
  $t = Get-Tpm -ErrorAction Stop
  "$($t.TpmPresent)|$($t.TpmVersion)"
} catch { "false|none" }
`)
  const tpmParts = (tpmRaw || 'false|none').split('|')
  const tpmAvailable = tpmParts[0]?.toLowerCase() === 'true'
  const tpmVersion = tpmParts[1] ?? 'Unknown'
  if (!tpmAvailable) {
    recommendations.push('TPM not detected. TPM 2.0 is required for Windows 11 and BitLocker')
  }

  // BitLocker
  const bitLockerRaw = await ps(`
try {
  $bl = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction Stop
  $bl.ProtectionStatus.ToString()
} catch { "Unknown" }
`)
  const bitLockerEnabled = bitLockerRaw.toLowerCase() === 'on' || bitLockerRaw === '1'

  // UAC
  const uacRaw = await ps(
    `(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -ErrorAction SilentlyContinue).EnableLUA`
  )
  const uacEnabled = uacRaw.trim() === '1'
  if (!uacEnabled) {
    issues.push('User Account Control (UAC) is disabled')
    recommendations.push('Enable UAC to prevent unauthorized system changes')
  }

  // Windows Update pending
  const updateRaw = await ps(`
try {
  $s = New-Object -ComObject Microsoft.Update.Session -ErrorAction Stop
  $searcher = $s.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and Type='Software'")
  $result.Updates.Count
} catch { "-1" }
`)
  const pendingUpdates = parseInt(updateRaw, 10)
  const windowsUpdatePending = pendingUpdates > 0

  if (windowsUpdatePending && pendingUpdates > 0) {
    issues.push(`${pendingUpdates} Windows update(s) pending`)
    recommendations.push('Install pending Windows updates for security patches')
  }

  // Last update date
  const lastUpdateRaw = await ps(`
try {
  $lastUpdate = (Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn
  if ($lastUpdate) { [int]((Get-Date) - $lastUpdate).TotalDays } else { -1 }
} catch { -1 }
`)
  const lastUpdateDays = parseInt(lastUpdateRaw, 10)
  if (lastUpdateDays > 30) {
    recommendations.push(`Last update was ${lastUpdateDays} days ago — keep Windows up to date`)
  }

  // Score: start 100, deduct per issue
  let score = 100
  if (!defenderEnabled) score -= 25
  if (!firewallEnabled) score -= 20
  if (!uacEnabled) score -= 15
  if (!defenderUpToDate) score -= 10
  if (windowsUpdatePending) score -= 10
  if (!secureBootEnabled) score -= 10
  if (!tpmAvailable) score -= 5
  if (!bitLockerEnabled) score -= 5

  return {
    defenderEnabled,
    defenderUpToDate,
    firewallEnabled,
    secureBootEnabled,
    tpmAvailable,
    tpmVersion,
    bitLockerEnabled,
    uacEnabled,
    windowsUpdatePending,
    lastUpdateDays: lastUpdateDays >= 0 ? lastUpdateDays : null,
    antispywareEnabled,
    securityScore: Math.max(0, score),
    issues,
    recommendations,
  }
}
