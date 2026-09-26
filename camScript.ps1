$devs = @('webcam','microphone','location')
foreach ($d in $devs) {
  $paths = @(
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$d",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$d\NonPackaged"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Get-ChildItem $p -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -ne 'NonPackaged' } | ForEach-Object {
        $val = $_.GetValue('Value')
        if ($val -eq 'Allow') {
          if ($p -match 'NonPackaged') {
            $exe = [IO.Path]::GetFileNameWithoutExtension(($_.PSChildName -replace '#','\'))
          } else {
            $exe = $_.PSChildName
          }
          Write-Output "$d|$exe"
        }
      }
    }
  }
}
