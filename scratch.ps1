$apps = @()
$junkPattern = '^(KB\d+|Update for |Security Update|Hotfix for |Cumulative Update)'
$runtimePattern = 'Redistributable|(\.NET Framework)|Microsoft Visual C\+\+|DirectX|(OpenAL SDK)|(PhysX System)|(MSXML \d)|(ATL MFC)'
$driverPattern = '(Driver Package)|(Chipset Driver)|(Firmware Update)|(Windows Driver)'
$keys = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($key in $keys) {
  Get-ItemProperty $key -ErrorAction SilentlyContinue |
    Where-Object {
      $n = if ($_.DisplayName) { $_.DisplayName.Trim() } else { '' }
      $n -ne '' -and
      $n.Length -gt 3 -and
      -not ($_.SystemComponent -eq 1) -and
      -not $_.ParentKeyName -and
      -not ($n -match '^\{') -and
      -not ($n -match '^CN=') -and
      -not ($n -match $junkPattern) -and
      -not ($n -match $runtimePattern) -and
      -not ($n -match $driverPattern) -and
      ($_.DisplayIcon -or $_.InstallLocation)
    } |
    ForEach-Object {
      $pub = if ($_.Publisher) { $_.Publisher.Trim() } else { '' }
      if ($pub -match '^[0-9a-fA-F\-]{36}$') { $pub = '' }
      $ico = if ($_.DisplayIcon) { ($_.DisplayIcon -split ',')[0].Trim().Trim('"') } else { '' }
      $exe = if ($ico -and $ico.Length -gt 0) { [IO.Path]::GetFileNameWithoutExtension($ico) } else { '' }
      $apps += "$($_.DisplayName.Trim())|$pub|$exe|$ico"
    }
}
Get-AppxPackage -ErrorAction SilentlyContinue |
  Where-Object {
    -not $_.IsFramework -and
    $_.SignatureKind -ne 'System' -and
    $_.Name -notmatch '(Runtime|Framework|Extension|VCLibs)'
  } |
  ForEach-Object {
    $segs = $_.Name -split '\.'
    $uniq = $segs | Select-Object -Unique
    $n = if ($uniq.Count -eq 1) { $uniq[0] } else { $segs[$segs.Count - 1] }
    if ($n.Length -le 3 -or $n -match '^\d+$') { return }
    $p = if ($_.PublisherDisplayName -and $_.PublisherDisplayName -ne '') {
      $_.PublisherDisplayName
    } elseif ($_.Publisher) {
      $_.Publisher -replace '^CN=([^,]+).*','$1'
    } else { '' }
    if ($p -match '^[0-9a-fA-F\-]{36}$') { $p = '' }
    $exeIco = ''
    if ($_.InstallLocation) {
      $exes = Get-ChildItem $_.InstallLocation -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($exes) { $exeIco = $exes.FullName }
    }
    $apps += "$n|$p|$($_.PackageFamilyName)|$exeIco"
  }

# Ensure all ConsentStore apps are included
$devs = @('webcam','microphone','location')
foreach ($d in $devs) {
  $paths = @(
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$d",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$d\NonPackaged"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Get-ChildItem $p -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -ne 'NonPackaged' } | ForEach-Object {
        $cName = $_.PSChildName
        if ($p -match 'NonPackaged') {
          $exe = [IO.Path]::GetFileNameWithoutExtension(($cName -replace '#','\'))
          $apps += "$exe||$exe|"
        } else {
          $friendly = ($cName -split '_')[0]
          $friendly = ($friendly -split '\.')[-1]
          $apps += "$friendly||$cName|"
        }
      }
    }
  }
}

$apps | Where-Object { $_ } | Sort-Object -Unique
