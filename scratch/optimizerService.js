var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var optimizerService_exports = {};
__export(optimizerService_exports, {
  runSafeOptimization: () => runSafeOptimization
});
module.exports = __toCommonJS(optimizerService_exports);
var import_child_process = require("child_process");
var import_util = require("util");
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
const execAsync = (0, import_util.promisify)(import_child_process.exec);
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
`;
async function runSafeOptimization(onProgress) {
  const startTime = Date.now();
  const tmpFile = import_path.default.join(import_os.default.tmpdir(), `cm_opt_${Date.now()}.ps1`);
  onProgress({ step: "Optimizing memory\u2026", processed: 0, total: 1 });
  try {
    await import_promises.default.writeFile(tmpFile, OPTIMIZE_SCRIPT, "utf8");
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 6e4 }
    );
    const parts = stdout.trim().split("|");
    const recoveredBytes = parseInt(parts[0] ?? "0", 10) || 0;
    const count = parseInt(parts[1] ?? "0", 10) || 0;
    const names = (parts[2] ?? "").split(",").filter(Boolean);
    await import_promises.default.unlink(tmpFile).catch(() => {
    });
    onProgress({ step: "Complete", processed: 1, total: 1 });
    return {
      recoveredBytes,
      processesOptimized: count,
      durationMs: Date.now() - startTime,
      optimizedProcesses: names.slice(0, 20)
    };
  } catch {
    await import_promises.default.unlink(tmpFile).catch(() => {
    });
    onProgress({ step: "Complete", processed: 1, total: 1 });
    return {
      recoveredBytes: 0,
      processesOptimized: 0,
      durationMs: Date.now() - startTime,
      optimizedProcesses: []
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runSafeOptimization
});
