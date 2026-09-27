const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock Electron
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'electron') {
    return {
      shell: {
        trashItem: async (filePath) => {
          console.log('[MOCK ELECTRON] Trashed:', filePath);
          return true;
        }
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const dupService = require('./duplicateFinderService.js');

async function runTest() {
  const testDir = path.join(__dirname, 'dup-test-dir');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  console.log('--- SETTING UP TEST FILES ---');
  // Need > 1024 bytes
  const dupContent = Buffer.alloc(2048, 'A');
  const diffContent1 = Buffer.alloc(2048, 'B'); // Same size, diff content
  const diffContent2 = Buffer.alloc(3000, 'C'); // Diff size

  // Group 1: 3 identical files
  fs.writeFileSync(path.join(testDir, 'dup1.txt'), dupContent);
  fs.writeFileSync(path.join(testDir, 'dup2.txt'), dupContent);
  
  // Put one in a subdirectory
  const subDir = path.join(testDir, 'sub');
  fs.mkdirSync(subDir);
  fs.writeFileSync(path.join(subDir, 'dup3.txt'), dupContent);

  // Same size but different content
  fs.writeFileSync(path.join(testDir, 'diff1.txt'), diffContent1);

  // Completely different
  fs.writeFileSync(path.join(testDir, 'diff2.txt'), diffContent2);
  
  // Symlink loop or just a symlink
  try {
    fs.symlinkSync(path.join(testDir, 'dup1.txt'), path.join(testDir, 'sym_dup.txt'));
  } catch (e) {
    console.log('Symlink creation failed/skipped (needs admin usually on Windows).');
  }

  console.log('--- RUNNING SCAN ---');
  const result = await dupService.scanForDuplicates(
    [testDir],
    [],
    (prog) => {}
  );

  console.log('--- SCAN RESULTS ---');
  console.log('Total files scanned:', result.totalFiles);
  console.log('Groups found:', result.groups.length);
  result.groups.forEach((g, i) => {
    console.log(`\nGroup ${i+1}:`);
    console.log('Count:', g.count);
    g.files.forEach(f => console.log(' -', f.path, f.isOriginal ? '(Original)' : ''));
  });

  console.log('\n--- TESTING DELETION SAFETY ---');
  // 1. Try to delete a file that wasn't scanned
  const notScannedFile = path.join(testDir, 'not_scanned.txt');
  fs.writeFileSync(notScannedFile, 'not scanned');
  let delRes = await dupService.deleteSelectedDuplicates([notScannedFile]);
  console.log('Delete non-scanned file result (should be 1 error):', delRes);

  // 2. Try to delete ALL files in a group
  if (result.groups.length > 0) {
    const allGroupFiles = result.groups[0].files.map(f => f.path);
    console.log('\nAttempting to delete ALL files in group 1:', allGroupFiles.length, 'files');
    const allDelRes = await dupService.deleteSelectedDuplicates(allGroupFiles);
    console.log('Delete ALL files result:', allDelRes);
  }

  // Cleanup
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

runTest().catch(console.error);
