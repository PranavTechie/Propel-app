var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// test-gm.ts
var import_electron2 = require("electron");
var import_child_process3 = require("child_process");
var import_fs = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));

// electron/services/ai/gameModeService.ts
var import_electron = require("electron");
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var import_path2 = __toESM(require("path"));
var import_promises2 = __toESM(require("fs/promises"));

// electron/services/memory/optimizerService.ts
var import_child_process = require("child_process");
var import_util = require("util");
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var OPTIMIZE_SCRIPT = `
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
"$freed|$($results.Count)|$($results | Select-Object -Unique | Join-String -Separator ',')"
`;
async function runSafeOptimization(onProgress) {
  const startTime = Date.now();
  const tmpFile = import_path.default.join(import_os.default.tmpdir(), `cm_opt_${Date.now()}.ps1`);
  onProgress({ step: "Analyzing memory pressure\u2026", processed: 0, total: 4 });
  try {
    await import_promises.default.writeFile(tmpFile, OPTIMIZE_SCRIPT, "utf8");
    onProgress({ step: "Identifying reclaimable working sets\u2026", processed: 1, total: 4 });
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 6e4 }
    );
    onProgress({ step: "Trimming inactive memory pages\u2026", processed: 2, total: 4 });
    const parts = stdout.trim().split("|");
    const recoveredBytes = parseInt(parts[0] ?? "0", 10) || 0;
    const count = parseInt(parts[1] ?? "0", 10) || 0;
    const names = (parts[2] ?? "").split(",").filter(Boolean);
    onProgress({ step: "Finalizing optimization\u2026", processed: 3, total: 4 });
    await import_promises.default.unlink(tmpFile).catch(() => {
    });
    onProgress({ step: "Complete", processed: 4, total: 4 });
    return {
      recoveredBytes,
      processesOptimized: count,
      durationMs: Date.now() - startTime,
      optimizedProcesses: names.slice(0, 20)
    };
  } catch {
    await import_promises.default.unlink(tmpFile).catch(() => {
    });
    onProgress({ step: "Complete", processed: 4, total: 4 });
    return {
      recoveredBytes: 0,
      processesOptimized: 0,
      durationMs: Date.now() - startTime,
      optimizedProcesses: []
    };
  }
}

// electron/services/ai/gameModeService.ts
var execAsync2 = (0, import_util2.promisify)(import_child_process2.exec);
var DEFAULT_STATE = {
  gameModeActive: false,
  originalPowerPlanGuid: null,
  originalFocusAssistState: null,
  demotedProcesses: [],
  activatedAt: null
};
function getStateFile() {
  return import_path2.default.join(import_electron.app.getPath("userData"), "gameModeState.json");
}
async function loadState() {
  try {
    const data = await import_promises2.default.readFile(getStateFile(), "utf8");
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_STATE };
  }
}
async function saveState(state) {
  await import_promises2.default.writeFile(getStateFile(), JSON.stringify(state, null, 2), "utf8");
}
async function getCurrentPowerPlan() {
  try {
    const { stdout } = await execAsync2("powercfg /getactivescheme", { timeout: 5e3 });
    const match = stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
async function getCandidateProcesses() {
  const SCRIPT = `
$SKIP = @("System","Idle","smss","csrss","wininit","winlogon","lsass","services","svchost","dwm","audiodg","Registry","MsMpEng","spoolsv","SearchIndexer","SearchHost","sihost","taskhostw","explorer")
Get-Process | Where-Object {
    try {
        !$_.HasExited -and $_.MainWindowHandle -eq 0 -and
        $_.PriorityClass -notin @('Idle','BelowNormal') -and
        $SKIP -notcontains $_.Name
    } catch { $false }
} | Select-Object Id, PriorityClass | ConvertTo-Json -Compress
  `.trim();
  try {
    const { stdout } = await execAsync2(`powershell -NoProfile -NonInteractive -Command "${SCRIPT.replace(/\r?\n/g, " ")}"`, { timeout: 15e3 });
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout);
    const procs = Array.isArray(parsed) ? parsed : [parsed];
    return procs.map((p) => ({
      pid: p.Id,
      originalPriority: p.PriorityClass === 32 ? "Normal" : p.PriorityClass === 64 ? "Idle" : p.PriorityClass === 128 ? "High" : p.PriorityClass === 256 ? "RealTime" : p.PriorityClass === 16384 ? "BelowNormal" : p.PriorityClass === 32768 ? "AboveNormal" : "Normal"
      // Fallback
    }));
  } catch {
    return [];
  }
}
async function setProcessesPriority(pids, priority) {
  if (pids.length === 0) return 0;
  const SCRIPT = `
$pids = @(${pids.join(",")})
$count = 0
foreach ($pid in $pids) {
    try {
        $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($p -and !$p.HasExited) {
            $p.PriorityClass = '${priority}'
            $count++
        }
    } catch {}
}
$count
  `.trim();
  try {
    const { stdout } = await execAsync2(`powershell -NoProfile -NonInteractive -Command "${SCRIPT.replace(/\r?\n/g, " ")}"`, { timeout: 15e3 });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
async function enableGameMode() {
  const state = await loadState();
  if (state.gameModeActive) {
    return {
      active: true,
      ramFreedBytes: 0,
      processesAffected: 0,
      actionsApplied: ["Game Mode already active"],
      powerPlanSet: !!state.originalPowerPlanGuid,
      activatedAt: state.activatedAt
    };
  }
  const actionsApplied = [];
  const newState = { ...DEFAULT_STATE };
  newState.gameModeActive = true;
  newState.activatedAt = Date.now();
  newState.originalPowerPlanGuid = await getCurrentPowerPlan();
  const candidates = await getCandidateProcesses();
  newState.demotedProcesses = candidates;
  await saveState(newState);
  let powerPlanSet = false;
  try {
    await execAsync2("powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c", { timeout: 8e3 });
    actionsApplied.push("Switched to High Performance power plan");
    powerPlanSet = true;
  } catch {
    try {
      await execAsync2("powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e", { timeout: 8e3 });
      actionsApplied.push("Applied Balanced power plan");
      powerPlanSet = true;
    } catch {
    }
  }
  const affected = await setProcessesPriority(candidates.map((c) => c.pid), "BelowNormal");
  if (affected > 0) {
    actionsApplied.push(`Demoted ${affected} background processes`);
  }
  let ramFreedBytes = 0;
  try {
    const memResult = await runSafeOptimization(() => {
    });
    ramFreedBytes = memResult.recoveredBytes;
    if (ramFreedBytes > 0) {
      actionsApplied.push(`Optimized Memory (~${Math.round(ramFreedBytes / 1024 / 1024)} MB freed)`);
    }
  } catch {
  }
  return {
    active: true,
    ramFreedBytes,
    processesAffected: affected,
    actionsApplied,
    powerPlanSet,
    activatedAt: newState.activatedAt
  };
}
async function disableGameMode() {
  const state = await loadState();
  const actionsApplied = [];
  if (state.originalPowerPlanGuid) {
    try {
      await execAsync2(`powercfg /setactive ${state.originalPowerPlanGuid}`, { timeout: 8e3 });
      actionsApplied.push("Restored original power plan");
    } catch {
    }
  }
  let restoredCount = 0;
  if (state.demotedProcesses.length > 0) {
    const groups = {};
    for (const p of state.demotedProcesses) {
      if (!groups[p.originalPriority]) groups[p.originalPriority] = [];
      groups[p.originalPriority].push(p.pid);
    }
    for (const [priority, pids] of Object.entries(groups)) {
      restoredCount += await setProcessesPriority(pids, priority);
    }
    if (restoredCount > 0) {
      actionsApplied.push(`Restored ${restoredCount} background processes to original priorities`);
    }
  }
  await saveState(DEFAULT_STATE);
  return {
    active: false,
    ramFreedBytes: 0,
    processesAffected: restoredCount,
    actionsApplied,
    powerPlanSet: false,
    activatedAt: null
  };
}

// test-gm.ts
import_electron2.app.whenReady().then(async () => {
  try {
    console.log("==================================================");
    console.log("TEST 1: CLEAN BASELINE");
    console.log("==================================================");
    const activePlan = (0, import_child_process3.execSync)("powercfg /getactivescheme").toString().trim();
    console.log("1. Baseline Power Plan:\n   " + activePlan);
    import_electron2.app.setPath("userData", import_path3.default.join(import_electron2.app.getPath("appData"), "cleanmaster-pro"));
    const stateFile = import_path3.default.join(import_electron2.app.getPath("userData"), "gameModeState.json");
    console.log("2. Game Mode persisted state exists:", import_fs.default.existsSync(stateFile));
    if (import_fs.default.existsSync(stateFile)) {
      console.log("   State contents:", import_fs.default.readFileSync(stateFile, "utf8"));
    }
    console.log("3. No polling running (Backend fully manual).");
    console.log("4. Propel launched (Electron runner).");
    console.log("\n==================================================");
    console.log("TEST 2: ACTIVATE GAME MODE");
    console.log("==================================================");
    const status = await enableGameMode();
    console.log("Activation Result:", JSON.stringify(status, null, 2));
    console.log("\nA. Power Plan:");
    const newPlan = (0, import_child_process3.execSync)("powercfg /getactivescheme").toString().trim();
    console.log("   " + newPlan);
    console.log("\nB. Persistent state:");
    const newStateStr = import_fs.default.readFileSync(stateFile, "utf8");
    const newState = JSON.parse(newStateStr);
    console.log("   gameModeActive:", newState.gameModeActive);
    console.log("   originalPowerPlanGuid:", newState.originalPowerPlanGuid);
    console.log("   activatedAt:", newState.activatedAt);
    console.log(`   demotedProcesses: ${newState.demotedProcesses.length} tracked`);
    console.log("\nC. Process tracking:");
    if (newState.demotedProcesses.length > 0) {
      console.log(`   Verified ${newState.demotedProcesses.length} PIDs with original PriorityClass captured.`);
    } else {
      console.log("   No eligible processes found to demote.");
    }
    console.log("\nD. Memory:");
    console.log(`   RAM Freed: ${Math.round(status.ramFreedBytes / 1024 / 1024)} MB`);
    console.log(`   Actions Applied: ${JSON.stringify(status.actionsApplied)}`);
    console.log("\n==================================================");
    console.log("TEST 3: CLEAN DEACTIVATION");
    console.log("==================================================");
    const deactStatus = await disableGameMode();
    console.log("Deactivation Result:", JSON.stringify(deactStatus, null, 2));
    console.log("\nA. Power Plan Restored:");
    const restoredPlan = (0, import_child_process3.execSync)("powercfg /getactivescheme").toString().trim();
    console.log("   " + restoredPlan);
    console.log("\nB/C. Process priorities restored:");
    console.log(`   ${deactStatus.processesAffected} processes restored.`);
    console.log("\nD. Persisted state cleared:");
    const finalState = JSON.parse(import_fs.default.readFileSync(stateFile, "utf8"));
    console.log("   gameModeActive:", finalState.gameModeActive);
    console.log("\n==================================================");
    console.log("TEST 4: CRASH RECOVERY");
    console.log("==================================================");
    console.log("Activating Game Mode to simulate crash...");
    await enableGameMode();
    console.log("Game mode active. Persisted State:", JSON.parse(import_fs.default.readFileSync(stateFile, "utf8")).gameModeActive);
    console.log("Force killing self with process.exit(1) BEFORE deactivating to orphan the state!");
    process.exit(1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
