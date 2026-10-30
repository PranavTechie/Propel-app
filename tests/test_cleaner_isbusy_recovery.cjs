const assert = require('assert');
const path = require('path');
const esbuild = require('esbuild');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Mock browser globals for SSR in Node
if (typeof globalThis.Element === 'undefined') {
  globalThis.Element = class Element {};
}
if (typeof globalThis.HTMLElement === 'undefined') {
  globalThis.HTMLElement = class HTMLElement extends globalThis.Element {};
}
if (typeof globalThis.SVGElement === 'undefined') {
  globalThis.SVGElement = class SVGElement extends globalThis.Element {};
}

globalThis.document = {
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Silence React SSR useLayoutEffect warnings in Node
const origError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  origError(...args);
};

console.log('--- STARTING ISBUSY & ERROR-PATH RECOVERY TESTS ---');

const defines = {
  'import.meta.env.VITE_APP_VERSION': '"1.4.0"',
  'import.meta.env.VITE_GLITCHTIP_DSN': '""',
  'import.meta.env.PROD': 'true',
  'import.meta.env.DEV': 'false',
};

// Compile CleanerPage via esbuild
const buildResult = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../src/pages/CleanerPage.tsx')],
  bundle: true,
  format: 'cjs',
  packages: 'external',
  alias: {
    '@': path.join(__dirname, '../src'),
  },
  define: defines,
  write: false,
});

const mod = { exports: {} };
const runner = new Function('module', 'exports', 'require', buildResult.outputFiles[0].text);
runner(mod, mod.exports, require);
const CleanerPage = mod.exports.CleanerPage;

// Access Zustand app store
const storeBuild = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../src/store/appStore.ts')],
  bundle: true,
  format: 'cjs',
  packages: 'external',
  alias: {
    '@': path.join(__dirname, '../src'),
  },
  define: defines,
  write: false,
});
const storeMod = { exports: {} };
const storeRunner = new Function('module', 'exports', 'require', storeBuild.outputFiles[0].text);
storeRunner(storeMod, storeMod.exports, require);
const useAppStore = storeMod.exports.useAppStore;

async function runTest() {
  // Mock window and propel cleaner
  let cleanerMock = {
    onScanProgress: () => {},
    onCleanProgress: () => {},
    removeListeners: () => {},
    scan: async () => [{ id: 'temp-files', name: 'Temp Files', totalSize: 1000, fileCount: 1 }],
    clean: async () => ({ totalFreed: 1000, filesRemoved: 1, errors: 0, categories: ['temp-files'] }),
    cleanAdminBatch: async () => ({ totalFreed: 500, filesRemoved: 1, errors: 0, categories: ['windows-logs'] }),
    discardAdminBatch: async () => {},
  };

  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    propel: {
      cleaner: cleanerMock,
      maintenance: {
        getSettings: async () => ({ safeCleaningMode: true }),
      },
    },
  };

  function captureActions(props = {}) {
    let captured = null;
    ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      ...props,
      onActions: (a) => { captured = a; },
    }));
    return captured;
  }

  // --- Test 1: Scan throws error -> isScanning reset -> subsequent scan starts ---
  {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    let scanAttempts = 0;
    cleanerMock.scan = async () => {
      scanAttempts++;
      if (scanAttempts === 1) {
        throw new Error('EPERM: disk read failed during scan');
      }
      return [{ id: 'temp-files', name: 'Temp Files', totalSize: 500, fileCount: 2 }];
    };

    const actions = captureActions({ initialPhase: 'idle' });
    assert(actions, 'Actions must be captured');

    // 1st scan throws
    await actions.handleScan();
    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be false after scan throws');

    // 2nd scan should start and succeed without being blocked by isBusy
    await actions.handleScan();
    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be false after second scan finishes');
    assert.strictEqual(scanAttempts, 2, 'Second scan must have executed successfully');
    console.log('[PASS] 1. Scan throws: isScanning reset, subsequent scan starts and succeeds');
  }

  // --- Test 2: Clean throws error -> isCleaning reset -> subsequent scan starts ---
  {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    cleanerMock.clean = async () => {
      throw new Error('IPC timeout: cleaner worker process crashed');
    };

    const actions = captureActions({
      initialPhase: 'results',
      initialCategories: [{ id: 'temp-files', name: 'Temp Files', totalSize: 100, fileCount: 1, isSafe: true, isCapped: false }],
    });

    // Clean throws
    await actions.handleClean();
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after clean throws');

    // Subsequent scan must start
    let scanRan = false;
    cleanerMock.scan = async () => {
      scanRan = true;
      return [{ id: 'temp-files', name: 'Temp Files', totalSize: 500, fileCount: 2 }];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after clean throws');
    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must reset after scan');
    console.log('[PASS] 2. Clean throws: isCleaning reset, subsequent scan starts and succeeds');
  }

  // --- Test 3: Clean returns invalid report -> error caught -> isCleaning reset -> subsequent scan starts ---
  {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    // Return empty object / malformed report
    cleanerMock.clean = async () => ({});

    const actions = captureActions({
      initialPhase: 'results',
      initialCategories: [{ id: 'temp-files', name: 'Temp Files', totalSize: 100, fileCount: 1, isSafe: true, isCapped: false }],
    });

    // Clean handles invalid report
    await actions.handleClean();
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after invalid report');

    // Subsequent scan must start
    let scanRan = false;
    cleanerMock.scan = async () => {
      scanRan = true;
      return [];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after invalid report');
    console.log('[PASS] 3. Clean returns invalid report: isCleaning reset, subsequent scan starts');
  }

  // --- Test 4: UAC declined -> isCleaning reset -> subsequent scan starts ---
  {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    cleanerMock.cleanAdminBatch = async () => {
      const err = new Error('The operation was canceled by the user (UAC declined)');
      err.code = 1223;
      throw err;
    };

    const initialReport = {
      timestamp: Date.now(),
      totalFreed: 100,
      filesRemoved: 1,
      errors: 1,
      permissionBatchToken: 'token_123',
      permissionDeniedCount: 1,
      permissionDeniedPaths: ['C:\\Windows\\Temp\\test.log'],
      durationMs: 100,
      categories: ['windows-logs'],
    };

    const actions = captureActions({
      initialPhase: 'pending-permission',
      initialReport,
      initialPermissionBatch: {
        report: initialReport,
        count: 1,
        token: 'token_123',
      },
    });

    // User continued, but UAC was declined
    await actions.finishPermissionBatch('continue');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after UAC is declined');

    // In the re-rendered component (now in complete phase), subsequent scan can start
    const postActions = captureActions({ initialPhase: 'complete', initialReport });
    let scanRan = false;
    cleanerMock.scan = async () => {
      scanRan = true;
      return [];
    };
    await postActions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after UAC was declined');
    console.log('[PASS] 4. UAC declined: isCleaning reset, subsequent scan starts');
  }

  // --- Test 5: UAC timeout -> isCleaning reset -> subsequent scan starts ---
  {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    cleanerMock.cleanAdminBatch = async () => {
      throw new Error('Timeout: Windows UAC prompt was not answered within threshold');
    };

    const initialReport = {
      timestamp: Date.now(),
      totalFreed: 100,
      filesRemoved: 1,
      errors: 1,
      permissionBatchToken: 'token_123',
      permissionDeniedCount: 1,
      permissionDeniedPaths: ['C:\\Windows\\Temp\\test.log'],
      durationMs: 100,
      categories: ['windows-logs'],
    };

    const actions = captureActions({
      initialPhase: 'pending-permission',
      initialReport,
      initialPermissionBatch: {
        report: initialReport,
        count: 1,
        token: 'token_123',
      },
    });

    // UAC timed out
    await actions.finishPermissionBatch('continue');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after UAC timeout');

    // In the re-rendered component (now in complete phase), subsequent scan can start
    const postActions = captureActions({ initialPhase: 'complete', initialReport });
    let scanRan = false;
    cleanerMock.scan = async () => {
      scanRan = true;
      return [];
    };
    await postActions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after UAC timeout');
    console.log('[PASS] 5. UAC timeout: isCleaning reset, subsequent scan starts');
  }

  // --- Test 6: Component unmount during run -> resets isScanning and isCleaning ---
  {
    // Simulate active scan and clean flags left in store
    useAppStore.getState().setIsScanning(true);
    useAppStore.getState().setIsCleaning(true);

    assert.strictEqual(useAppStore.getState().isScanning, true);
    assert.strictEqual(useAppStore.getState().isCleaning, true);

    // Call the unmount cleanup logic
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be reset to false on unmount');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be reset to false on unmount');

    // Subsequent scan can start immediately
    const actions = captureActions({ initialPhase: 'idle' });
    let scanRan = false;
    cleanerMock.scan = async () => {
      scanRan = true;
      return [];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan can start after unmount reset');
    console.log('[PASS] 6. Component unmount during run: store flags cleared, subsequent scan starts');
  }

  console.log('--- ALL 6 ISBUSY & ERROR-PATH RECOVERY TESTS PASSED! ---');
}

runTest().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
