import { exec } from 'child_process'
import { promisify } from 'util'
import { setPerformanceMode, recoverPerformanceModeState } from './electron/services/memory/performanceModeService'
import fs from 'fs/promises'

const execAsync = promisify(exec)

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function startDummyProcess(name: string, setBelowNormal = false) {
  // Start a ping loop hidden (no window)
  const script = `
    $p = Start-Process notepad -WindowStyle Hidden -PassThru;
    ${setBelowNormal ? "$p.PriorityClass = 'BelowNormal';" : "$p.PriorityClass = 'Normal';"}
    $p.Id;
  `
  const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${script.replace(/\n/g, ' ')}"`)
  return parseInt(stdout.trim(), 10)
}

async function getPriority(pid: number) {
  try {
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "(Get-Process -Id ${pid}).PriorityClass.ToString()"`)
    return stdout.trim()
  } catch {
    return 'Dead'
  }
}

async function killProcess(pid: number) {
  try { await execAsync(`powershell -NoProfile -NonInteractive -Command "Stop-Process -Id ${pid} -Force"`) } catch {}
}

async function main() {
  console.log("=== STARTING PERFORMANCE MODE VALIDATION TEST ===")
  
  // 1. Create dummy processes
  console.log("1. Starting dummy hidden processes...")
  const normalPid = await startDummyProcess('NormalDummy', false)
  const belowNormalPid = await startDummyProcess('BelowNormalDummy', true)
  
  console.log(`   - Dummy 1 (Normal expected): PID ${normalPid} -> Priority: ${await getPriority(normalPid)}`)
  console.log(`   - Dummy 2 (BelowNormal expected): PID ${belowNormalPid} -> Priority: ${await getPriority(belowNormalPid)}`)
  
  // 2. Enable Perf Mode
  console.log("\n2. Enabling Performance Mode...")
  const result = await setPerformanceMode(true)
  console.log(`   Result: Enabled=${result.enabled}, Affected=${result.processesAffected}`)
  
  // Read state JSON
  const stateData = await fs.readFile('performance_mode_state.json', 'utf8')
  console.log(`   State JSON content (sample of 3): ${JSON.stringify(JSON.parse(stateData).slice(0, 3))}...`)
  
  // Check priorities
  console.log(`   - Dummy 1 (Should now be BelowNormal): PID ${normalPid} -> Priority: ${await getPriority(normalPid)}`)
  console.log(`   - Dummy 2 (Should remain BelowNormal): PID ${belowNormalPid} -> Priority: ${await getPriority(belowNormalPid)}`)
  
  // 3. Disable Perf Mode
  console.log("\n3. Disabling Performance Mode...")
  await setPerformanceMode(false)
  console.log(`   - Dummy 1 (Should be restored to Normal): PID ${normalPid} -> Priority: ${await getPriority(normalPid)}`)
  console.log(`   - Dummy 2 (Should remain BelowNormal untouched): PID ${belowNormalPid} -> Priority: ${await getPriority(belowNormalPid)}`)
  
  // 4. CRASH RECOVERY TEST
  console.log("\n4. Running Crash Recovery Test...")
  await setPerformanceMode(true)
  console.log("   Performance mode enabled.")
  console.log(`   - Dummy 1 Priority: ${await getPriority(normalPid)}`)
  
  // Simulate app crash by not calling setPerformanceMode(false)
  console.log("   [App crashed] Relaunching app...")
  
  // App startup sequence calls recoverPerformanceModeState
  console.log("   Calling recoverPerformanceModeState() on startup...")
  await recoverPerformanceModeState()
  
  console.log(`   - Dummy 1 (Should be restored to Normal): PID ${normalPid} -> Priority: ${await getPriority(normalPid)}`)
  console.log(`   - Dummy 2 (Should remain BelowNormal untouched): PID ${belowNormalPid} -> Priority: ${await getPriority(belowNormalPid)}`)
  
  // Cleanup
  console.log("\nCleaning up dummy processes...")
  await killProcess(normalPid)
  await killProcess(belowNormalPid)
  console.log("Done.")
}

main().catch(console.error)
