const { execFile } = require('child_process');

const script = `
$runKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$approvedKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
try {
  $props = Get-ItemProperty -Path $runKey -ErrorAction Stop
  $approvedProps = $null
  if (Test-Path $approvedKey) {
    $approvedProps = Get-ItemProperty -Path $approvedKey -ErrorAction SilentlyContinue
  }
  $props.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS' } | ForEach-Object {
    $isEnabled = $true
    if ($approvedProps -and $null -ne $approvedProps.($_.Name) -and $approvedProps.($_.Name).Length -ge 1) {
      if ($approvedProps.($_.Name)[0] -eq 3) { $isEnabled = $false }
    }
    "$($_.Name)|||$($_.Value)|||$isEnabled"
  }
} catch { }
`.trim();

execFile('powershell.exe', [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  script.replace(/\r?\n/g, ' ')
], (err, stdout, stderr) => {
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
});
