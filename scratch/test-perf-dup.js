const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const Module = require('module');

// Mock Electron
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'electron') {
    return {
      shell: {
        trashItem: async () => true
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const testDir = path.join(__dirname, 'perf-test-dir');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir);

console.log('Creating two 500MB test files...');
const buf = Buffer.alloc(1024 * 1024 * 10, 'A'); // 10MB chunk
for (let i = 1; i <= 2; i++) {
  const fd = fs.openSync(path.join(testDir, `large${i}.mp4`), 'w');
  for (let j = 0; j < 50; j++) fs.writeSync(fd, buf);
  fs.closeSync(fd);
}
console.log('Files created.');

async function runTest(servicePath, label) {
  console.log(`\n--- RUNNING ${label} ---`);
  
  const dupService = require(servicePath);

  let maxMemory = 0;
  let maxLag = 0;
  
  const memInterval = setInterval(() => {
    const mem = process.memoryUsage().rss / 1024 / 1024;
    if (mem > maxMemory) maxMemory = mem;
  }, 10);
  
  let lastTick = performance.now();
  const lagInterval = setInterval(() => {
    const now = performance.now();
    const lag = now - lastTick - 10;
    if (lag > maxLag) maxLag = lag;
    lastTick = now;
  }, 10);

  const start = performance.now();
  await dupService.scanForDuplicates([testDir], [], () => {});
  const end = performance.now();

  clearInterval(memInterval);
  clearInterval(lagInterval);

  console.log(`${label} completed in ${((end - start) / 1000).toFixed(2)}s`);
  console.log(`Peak Memory Usage: ${maxMemory.toFixed(2)} MB`);
  console.log(`Max Event Loop Lag (UI Freeze duration): ${maxLag.toFixed(2)} ms`);
}

async function main() {
  try {
    await runTest('./duplicateFinderService.js', 'OLD VERSION (Sync/Buffer)');
  } catch (e) {
    console.log('Old version crashed:', e.message);
  }

  // Allow some time for GC and node to settle
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    await runTest('./duplicateFinderService_new.js', 'NEW VERSION (Async/Stream)');
  } catch (e) {
    console.log('New version crashed:', e.message);
  }

  fs.rmSync(testDir, { recursive: true, force: true });
}

main().catch(console.error);
