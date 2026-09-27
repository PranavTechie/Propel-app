const { runSafeOptimization } = require('./optimizerService.js');
const { performance } = require('perf_hooks');
const os = require('os');

async function main() {
  console.log('--- STARTING MEMORY OPTIMIZATION ---');
  
  const totalMem = os.totalmem();
  const initialFree = os.freemem();
  
  console.log(`System Initial Free Memory: ${(initialFree / 1024 / 1024).toFixed(2)} MB`);

  const start = performance.now();
  let lagTicks = 0;
  let maxLag = 0;
  let lastTick = performance.now();

  const lagInterval = setInterval(() => {
    const now = performance.now();
    const lag = now - lastTick - 10;
    if (lag > maxLag) maxLag = lag;
    lastTick = now;
    lagTicks++;
  }, 10);

  const result = await runSafeOptimization((prog) => {
    console.log(`Progress: [${prog.processed}/${prog.total}] ${prog.step}`);
  });

  const end = performance.now();
  clearInterval(lagInterval);

  const finalFree = os.freemem();

  console.log('\n--- RESULTS ---');
  console.log(`Duration: ${(end - start).toFixed(2)} ms`);
  console.log(`Event Loop Ticks: ${lagTicks}`);
  console.log(`Max Event Loop Lag: ${maxLag.toFixed(2)} ms`);
  
  console.log(`\nProcesses Optimized: ${result.processesOptimized}`);
  console.log(`Top 20 Processes: ${result.optimizedProcesses.join(', ')}`);
  
  console.log(`\nReclaimed Bytes (reported by service): ${(result.recoveredBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Actual Free Memory Diff (Node OS): ${((finalFree - initialFree) / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
