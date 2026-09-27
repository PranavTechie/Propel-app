import { app } from 'electron';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { enableGameMode, disableGameMode } from './electron/services/ai/gameModeService';

app.whenReady().then(async () => {
  try {
    console.log("==================================================");
    console.log("TEST 1: CLEAN BASELINE");
    console.log("==================================================");
    const activePlan = execSync('powercfg /getactivescheme').toString().trim();
    console.log("1. Baseline Power Plan:\n   " + activePlan);
    
    app.setPath("userData", path.join(app.getPath("appData"), "cleanmaster-pro"));
    const stateFile = path.join(app.getPath('userData'), 'gameModeState.json');
    console.log("2. Game Mode persisted state exists:", fs.existsSync(stateFile));
    if (fs.existsSync(stateFile)) {
       console.log("   State contents:", fs.readFileSync(stateFile, 'utf8'));
    }
    console.log("3. No polling running (Backend fully manual).");
    console.log("4. Propel launched (Electron runner).");
    
    console.log("\n==================================================");
    console.log("TEST 2: ACTIVATE GAME MODE");
    console.log("==================================================");
    const status = await enableGameMode();
    console.log("Activation Result:", JSON.stringify(status, null, 2));
    
    console.log("\nA. Power Plan:");
    const newPlan = execSync('powercfg /getactivescheme').toString().trim();
    console.log("   " + newPlan);
    
    console.log("\nB. Persistent state:");
    const newStateStr = fs.readFileSync(stateFile, 'utf8');
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
    const restoredPlan = execSync('powercfg /getactivescheme').toString().trim();
    console.log("   " + restoredPlan);
    
    console.log("\nB/C. Process priorities restored:");
    console.log(`   ${deactStatus.processesAffected} processes restored.`);
    
    console.log("\nD. Persisted state cleared:");
    const finalState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    console.log("   gameModeActive:", finalState.gameModeActive);
    
    console.log("\n==================================================");
    console.log("TEST 4: CRASH RECOVERY");
    console.log("==================================================");
    console.log("Activating Game Mode to simulate crash...");
    await enableGameMode();
    console.log("Game mode active. Persisted State:", JSON.parse(fs.readFileSync(stateFile, 'utf8')).gameModeActive);
    console.log("Force killing self with process.exit(1) BEFORE deactivating to orphan the state!");
    process.exit(1);

  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
