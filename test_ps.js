var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
const execFileAsync = promisify(execFile);
// ── PowerShell helper ────────────────────────────────────────────────────────
function runPS(script) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stdout } = yield execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8000 });
            return stdout.trim();
        }
        catch (_a) {
            return '';
        }
    });
}
// ── Camera / Microphone detection via CapabilityAccessManager ────────────────
function getActiveDeviceAccesses() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `
$results = @()
$devices = @('webcam','microphone','location','graphicsCaptureProgrammatic')
foreach ($dev in $devices) {
  $paths = @(
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\$dev",
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\$dev\\NonPackaged"
  )
  foreach ($path in $paths) {
    if (-not (Test-Path $path)) { continue }
    Get-ChildItem $path -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -ne 'NonPackaged' } | ForEach-Object {
      $start = $_.GetValue('LastUsedTimeStart')
      $stop  = $_.GetValue('LastUsedTimeStop')
      if ($start -gt 0 -and ($stop -eq 0 -or $stop -lt $start)) {
        if ($path -match 'NonPackaged') {
          $exeName = [IO.Path]::GetFileNameWithoutExtension(($_.PSChildName -replace '#','\\'))
        } else {
          $exeName = $_.PSChildName
        }
        $results += "$dev|$exeName"
      }
    }
  }
}
$results | ForEach-Object { $_ }
`;
        const raw = yield runPS(script);
        const accesses = [];
        if (!raw)
            return accesses;
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const [dev, appName] = trimmed.split('|');
            if (!dev || !appName)
                continue;
            let device;
            if (dev === 'webcam')
                device = 'camera';
            else if (dev === 'microphone')
                device = 'microphone';
            else if (dev === 'location')
                device = 'location';
            else if (dev === 'graphicsCaptureProgrammatic')
                device = 'screen';
            else
                continue;
            accesses.push({ device, app: appName, since: Date.now() });
        }
        return accesses;
    });
}
// ── Clipboard detection via Win32 GetClipboardOwner ─────────────────────────
function getClipboardApps() {
    return __awaiter(this, void 0, void 0, function* () {
        // Use Windows API to get the actual process that currently owns the clipboard
        // Each powershell.exe spawn is fresh so Add-Type compilation is safe each call
        const script = `
try {
  Add-Type -Name 'ClipWin' -Namespace 'ClipDetect' -MemberDefinition @'
    [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetClipboardOwner();
    [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(System.IntPtr hWnd, out int lpdwProcessId);
'@ -ErrorAction SilentlyContinue
  $h = [ClipDetect.ClipWin]::GetClipboardOwner()
  if ($h -ne [System.IntPtr]::Zero) {
    $pid = 0
    [ClipDetect.ClipWin]::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null
    if ($pid -gt 4) {
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      if ($proc) { $proc.Name }
    }
  }
} catch {}
`;
        const raw = yield runPS(script);
        if (!(raw === null || raw === void 0 ? void 0 : raw.trim()))
            return [];
        return raw.split('\n').map(l => l.trim()).filter(Boolean);
    });
}
// ── Overlay-injecting process detection ──────────────────────────────────────
// Detect known overlay processes (Steam, Discord, NVIDIA, GeForce, MSI Afterburner, etc.)
function getOverlayApps() {
    return __awaiter(this, void 0, void 0, function* () {
        const knownOverlayProcs = [
            'GameBar', 'GameBarFTServer', 'steamwebhelper', 'steam',
            'DiscordOverlay', 'discord',
            'nvcontainer', 'NvBackend', 'NVIDIA Share', 'NvTelemetryContainer',
            'MSIAfterburner', 'RivaTunerStatisticsServer', 'RTSS',
            'EpicGamesLauncher', 'GOGGalaxy', 'playnite', 'FRaps',
            'obs64', 'obs32', 'Reshade',
        ];
        const script = `Get-Process | Select-Object -ExpandProperty Name -Unique`;
        const raw = yield runPS(script);
        if (!raw)
            return [];
        const running = raw.split('\n').map(l => l.trim()).filter(Boolean);
        return running.filter(r => knownOverlayProcs.some(k => r.toLowerCase().includes(k.toLowerCase())));
    });
}
// ── Admin session check ───────────────────────────────────────────────────────
function getIsAdmin() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`;
        const result = yield runPS(script);
        return result.toLowerCase() === 'true';
    });
}
// ── Network apps (active TCP established connections) ────────────────────────
function getNetworkApps() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `
Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    Try { (Get-Process -Id $_ -ErrorAction Stop).Name } Catch {}
  } | Sort-Object -Unique
`;
        const raw = yield runPS(script);
        if (!raw)
            return [];
        return raw.split('\n').map(l => l.trim()).filter(Boolean);
    });
}
// ── Startup entries ───────────────────────────────────────────────────────────
export function getStartupEntries() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `
$entries = @()
$hkcu = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
$hklm = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
foreach ($key in @($hkcu,$hklm)) {
  $src = if ($key -like 'HKCU*') { 'HKCU' } else { 'HKLM' }
  if (Test-Path $key) {
    $props = Get-ItemProperty $key -ErrorAction SilentlyContinue
    if ($props) {
      $props.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
        $entries += "$src|$($_.Name)|$($_.Value)"
      }
    }
  }
}
$entries
`;
        const raw = yield runPS(script);
        if (!raw)
            return [];
        return raw
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(line => {
            const [src, name, ...rest] = line.split('|');
            return { source: src, name: name !== null && name !== void 0 ? name : '', command: rest.join('|') };
        });
    });
}
// ── Installed apps with permissions ──────────────────────────────────────────
export function getInstalledApps() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        // IMPORTANT: Do NOT use PowerShell 7 operators like ?? — must stay PS 5.1 compatible
        const script = `
$apps = @()
$junkPattern = '^(KB\\d+|Update for |Security Update|Hotfix for |Cumulative Update)'
$runtimePattern = 'Redistributable|(\.NET Framework)|Microsoft Visual C\\+\\+|DirectX|(OpenAL SDK)|(PhysX System)|(MSXML \\d)|(ATL MFC)'
$driverPattern = '(Driver Package)|(Chipset Driver)|(Firmware Update)|(Windows Driver)'
$keys = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($key in $keys) {
  Get-ItemProperty $key -ErrorAction SilentlyContinue |
    Where-Object {
      $n = if ($_.DisplayName) { $_.DisplayName.Trim() } else { '' }
      $n -ne '' -and
      $n.Length -gt 3 -and
      -not ($_.SystemComponent -eq 1) -and
      -not $_.ParentKeyName -and
      -not ($n -match '^\\{') -and
      -not ($n -match '^CN=') -and
      -not ($n -match $junkPattern) -and
      -not ($n -match $runtimePattern) -and
      -not ($n -match $driverPattern) -and
      ($_.DisplayIcon -or $_.InstallLocation)
    } |
    ForEach-Object {
      $pub = if ($_.Publisher) { $_.Publisher.Trim() } else { '' }
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
    $segs = $_.Name -split '\\.'
    $uniq = $segs | Select-Object -Unique
    $n = if ($uniq.Count -eq 1) { $uniq[0] } else { $segs[$segs.Count - 1] }
    if ($n.Length -le 3 -or $n -match '^\\d+$') { return }
    $p = if ($_.PublisherDisplayName -and $_.PublisherDisplayName -ne '') {
      $_.PublisherDisplayName
    } elseif ($_.Publisher) {
      $_.Publisher -replace '^CN=([^,]+).*','$1'
    } else { '' }
    $exeIco = ''
    if ($_.InstallLocation) {
      $exes = Get-ChildItem $_.InstallLocation -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($exes) { $exeIco = $exes.FullName }
    }
    $apps += "$n|$p||$exeIco"
  }
$apps | Where-Object { $_ } | Sort-Object -Unique
`;
        const appsRaw = yield runPS(script);
        // Get running processes
        const procScript = `Get-Process | Select-Object Name,Id | ForEach-Object { "$($_.Name)|$($_.Id)" }`;
        const procsRaw = yield runPS(procScript);
        const runningMap = {};
        for (const line of (procsRaw !== null && procsRaw !== void 0 ? procsRaw : '').split('\n')) {
            const [name, pid] = line.trim().split('|');
            if (name)
                runningMap[name.toLowerCase()] = parseInt(pid !== null && pid !== void 0 ? pid : '0', 10);
        }
        // Get apps with camera/mic/location consent (both UWP and Win32)
        const camScript = `
$out = @()
$devs = @('webcam','microphone','location')
foreach ($d in $devs) {
  $paths = @(
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\$d",
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\$d\\NonPackaged"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Get-ChildItem $p -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -ne 'NonPackaged' } | ForEach-Object {
        $val = $_.GetValue('Value')
        if ($val -eq 'Allow') {
          if ($p -match 'NonPackaged') {
            $exe = [IO.Path]::GetFileNameWithoutExtension(($_.PSChildName -replace '#','\\'))
          } else {
            $exe = $_.PSChildName
          }
          $out += "$d|$exe"
        }
      }
    }
  }
}
$out
`;
        const camRaw = yield runPS(camScript);
        const cameraApps = new Set();
        const micApps = new Set();
        const locApps = new Set();
        for (const line of (camRaw !== null && camRaw !== void 0 ? camRaw : '').split('\n')) {
            const [dev, exe] = line.trim().split('|');
            if (dev === 'webcam' && exe)
                cameraApps.add(exe.toLowerCase());
            if (dev === 'microphone' && exe)
                micApps.add(exe.toLowerCase());
            if (dev === 'location' && exe)
                locApps.add(exe.toLowerCase());
        }
        // Get startup names
        const startupEntries = yield getStartupEntries();
        const startupNames = new Set(startupEntries.map(s => s.name.toLowerCase()));
        // Get network apps
        const netApps = yield getNetworkApps();
        const netSet = new Set(netApps.map(n => n.toLowerCase()));
        const results = [];
        if (!appsRaw)
            return results;
        // Overlay apps
        const overlayApps = yield getOverlayApps();
        const overlaySet = new Set(overlayApps.map(o => o.toLowerCase()));
        const seen = new Set();
        for (const line of appsRaw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const parts = trimmed.split('|');
            const name = ((_a = parts[0]) !== null && _a !== void 0 ? _a : '').trim();
            const publisher = ((_b = parts[1]) !== null && _b !== void 0 ? _b : '').trim();
            // iconExe is the actual .exe filename extracted from the app's icon/install path — most reliable match
            const iconExe = ((_c = parts[2]) !== null && _c !== void 0 ? _c : '').trim().toLowerCase();
            const iconPath = ((_d = parts[3]) !== null && _d !== void 0 ? _d : '').trim();
            if (!name || name.length < 3)
                continue;
            if (/^\d+$/.test(name))
                continue;
            if (name.startsWith('{'))
                continue;
            if (seen.has(name.toLowerCase()))
                continue;
            seen.add(name.toLowerCase());
            const nameLower = name.toLowerCase();
            const exeName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            // Also match individual words (e.g. 'Google Chrome' → 'chrome')
            const words = name.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 3);
            // Check if a set contains this app using any of our name variants
            const matchesSet = (s) => (iconExe.length > 0 && s.has(iconExe)) ||
                s.has(exeName) ||
                s.has(nameLower) ||
                words.some(w => s.has(w));
            const runningPid = (iconExe && runningMap[iconExe]) ||
                runningMap[exeName] ||
                runningMap[nameLower] ||
                words.reduce((acc, w) => acc !== null && acc !== void 0 ? acc : runningMap[w], undefined);
            results.push({
                name,
                exeName: iconExe || exeName,
                publisher,
                iconPath,
                hasCamera: matchesSet(cameraApps),
                hasMicrophone: matchesSet(micApps),
                hasLocation: matchesSet(locApps),
                isStartup: matchesSet(startupNames),
                isRunning: !!(runningPid),
                hasNetwork: matchesSet(netSet),
                hasOverlay: matchesSet(overlaySet),
                hasAdmin: false,
                pid: runningPid || undefined,
            });
        }
        return results.slice(0, 300); // cap to 300 for UI performance
    });
}
// ── Kill process ──────────────────────────────────────────────────────────────
export function killProcess(pid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield execFileAsync('taskkill', ['/F', '/PID', String(pid)], { timeout: 5000 });
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
}
// ── Disable startup entry ─────────────────────────────────────────────────────
export function disableStartupEntry(name, source) {
    return __awaiter(this, void 0, void 0, function* () {
        const hive = source === 'HKCU' ? 'HKCU' : 'HKLM';
        const regPath = `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run`;
        const script = `Remove-ItemProperty -Path 'Registry::${regPath}' -Name '${name.replace(/'/g, "''")}' -ErrorAction Stop`;
        try {
            yield runPS(script);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
}
// ── Service class ─────────────────────────────────────────────────────────────
export class PermissionsService extends EventEmitter {
    constructor() {
        super(...arguments);
        this.pollTimer = null;
        this.history = [];
        this.lastAccesses = new Map();
        this.running = false;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        void this.poll();
        this.pollTimer = setInterval(() => void this.poll(), 2000);
    }
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.running = false;
        this.lastAccesses.clear(); // reset so re-start fires fresh events
    }
    getHistory() {
        return [...this.history];
    }
    poll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [accesses, netApps, isAdmin, clipboardApps, overlayApps] = yield Promise.all([
                    getActiveDeviceAccesses(),
                    getNetworkApps(),
                    getIsAdmin(),
                    getClipboardApps(),
                    getOverlayApps(),
                ]);
                // Augment accesses with overlay entries
                const allAccesses = [...accesses];
                for (const app of overlayApps) {
                    allAccesses.push({ device: 'overlay', app, since: Date.now() });
                }
                // Detect changes
                const currentKeys = new Set();
                for (const acc of allAccesses) {
                    const key = `${acc.device}:${acc.app}`;
                    currentKeys.add(key);
                    if (!this.lastAccesses.has(key)) {
                        const event = {
                            id: randomUUID(),
                            device: acc.device,
                            app: acc.app,
                            action: 'started',
                            timestamp: Date.now(),
                        };
                        this.addEvent(event);
                        this.emit('access-started', acc);
                    }
                }
                for (const [key, prev] of this.lastAccesses) {
                    if (!currentKeys.has(key)) {
                        const event = {
                            id: randomUUID(),
                            device: prev.device,
                            app: prev.app,
                            action: 'stopped',
                            timestamp: Date.now(),
                        };
                        this.addEvent(event);
                        this.emit('access-stopped', prev);
                    }
                }
                // Rebuild lastAccesses map
                this.lastAccesses.clear();
                for (const acc of allAccesses) {
                    const key = `${acc.device}:${acc.app}`;
                    this.lastAccesses.set(key, acc);
                }
                const snapshot = {
                    activeAccesses: allAccesses,
                    networkApps: netApps,
                    isAdminSession: isAdmin,
                    clipboardApps,
                    overlayApps,
                    timestamp: Date.now(),
                };
                this.emit('snapshot', snapshot);
            }
            catch (_a) {
                // Silently continue on poll errors
            }
        });
    }
    addEvent(event) {
        this.history.unshift(event);
        if (this.history.length > 100)
            this.history = this.history.slice(0, 100);
    }
}
export const permissionsService = new PermissionsService();
getInstalledApps().then(apps => console.log(apps.filter(a => a.name.includes('SDK') || a.name.includes('Installer') || a.name.includes('Claude'))));
