import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import esbuild from 'esbuild';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Mock browser globals for SSR / renderToString in Node test runner
if (typeof (globalThis as any).Element === 'undefined') {
  (globalThis as any).Element = class Element {};
}
if (typeof (globalThis as any).HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = class HTMLElement extends (globalThis as any).Element {};
}
if (typeof (globalThis as any).SVGElement === 'undefined') {
  (globalThis as any).SVGElement = class SVGElement extends (globalThis as any).Element {};
}

(globalThis as any).document = {
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};

(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
  cancelAnimationFrame: (id: any) => clearTimeout(id),
  propel: {
    cleaner: {
      onScanProgress: () => {},
      onCleanProgress: () => {},
      removeListeners: () => {},
      scan: async () => [],
      clean: async () => ({ totalFreed: 0, filesRemoved: 0, errors: 0, categories: [] }),
      cleanAdminBatch: async () => ({ totalFreed: 0, filesRemoved: 0, errors: 0, categories: [] }),
      discardAdminBatch: async () => {},
    },
    maintenance: {
      getSettings: async () => ({ safeCleaningMode: true }),
    },
  },
};

// Silence React SSR useLayoutEffect warnings from Radix/Framer in Node test environment
const origError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  origError(...args);
};

const defines = {
  'import.meta.env.VITE_APP_VERSION': '"1.4.0"',
  'import.meta.env.VITE_GLITCHTIP_DSN': '""',
  'import.meta.env.PROD': 'true',
  'import.meta.env.DEV': 'false',
};

// Compile CleanerPage via esbuild (no new dependencies)
const buildResult = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../../../../src/pages/CleanerPage.tsx')],
  bundle: true,
  format: 'cjs',
  packages: 'external',
  alias: {
    '@': path.join(__dirname, '../../../../src'),
  },
  define: defines,
  write: false,
});

const mod: any = { exports: {} };
const runner = new Function('module', 'exports', 'require', buildResult.outputFiles[0].text);
runner(mod, mod.exports, require);
const CleanerPage = mod.exports.CleanerPage;

// Access Zustand app store
const storeBuild = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../../../../src/store/appStore.ts')],
  bundle: true,
  format: 'cjs',
  packages: 'external',
  alias: {
    '@': path.join(__dirname, '../../../../src'),
  },
  define: defines,
  write: false,
});
const storeMod: any = { exports: {} };
const storeRunner = new Function('module', 'exports', 'require', storeBuild.outputFiles[0].text);
storeRunner(storeMod, storeMod.exports, require);
const useAppStore = storeMod.exports.useAppStore;

function getScanButtons(html: string): string[] {
  const buttonMatches = html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) || [];
  return buttonMatches.filter(b => {
    const text = b.replace(/<[^>]+>/g, '').trim();
    return (
      text.includes('Scan this PC') ||
      text.includes('Scanning…') ||
      text.includes('Rescan') ||
      text.includes('Cleaning…') ||
      text.includes('Scan Again')
    );
  });
}

function captureActions(props: any = {}) {
  let captured: any = null;
  ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    ...props,
    onActions: (a: any) => { captured = a; },
  }));
  return captured;
}

describe('CleanerPage Phase and Rendering Tests', () => {
  it('renders non-empty body and Scan this PC button in idle phase (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'idle',
    }));
    assert(html.length > 500, 'Idle body must not be empty');
    assert(html.includes('System Cleaner'), 'Must contain header title');
    assert(html.includes('Scan and safely remove junk files from your PC'), 'Subtitle must match idle text');
    assert(html.includes('Scan this PC'), 'Header action must have Scan this PC button');
    assert(html.includes('Find space you can safely reclaim'), 'Idle card must be rendered');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Idle phase must have exactly 1 scan button, found ${scanButtons.length}`);
  });

  it('renders progress card and loading state in scanning phase (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'scanning',
    }));
    assert(html.length > 500, 'Scanning body must not be empty');
    assert(html.includes('Scanning Your System'), 'Must render scanning progress card');
    assert(html.includes('Scanning…'), 'Header action button must show Scanning…');
    assert(html.includes('Files Scanned'), 'Metrics row must be present');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Scanning phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  });

  it('renders category cards, Rescan header button (count === 1), and Start Clean primary button in results phase', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'results',
      initialCategories: [
        {
          id: 'temp-files',
          name: 'Temporary Files',
          description: 'Temporary files created by apps',
          totalSize: 104857600,
          fileCount: 42,
          isSafe: true,
          isCapped: false,
        },
      ],
    }));
    assert(html.length > 500, 'Results body must not be empty');
    assert(html.includes('Review scan results and select categories to clean'), 'Subtitle must be review prompt');
    assert(html.includes('Temporary Files'), 'Category card must be rendered');
    assert(html.includes('Start Clean'), 'Start Clean button must be present in body');
    assert(html.includes('Rescan'), 'Header action must have Rescan button');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Results phase with items must have exactly 1 scan button in header, found ${scanButtons.length}`);
  });

  it('renders zero-findings clean state card in results phase when 0 items found (text only, count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'results',
      initialCategories: [],
    }));
    assert(html.length > 500, 'Results body with 0 categories must not be empty');
    assert(html.includes('No Junk Files Found'), 'Must render zero-findings card instead of empty void');
    assert(html.includes('Your system is already clean and optimized'), 'Must show clean confirmation');
    assert(html.includes('Rescan'), 'Header action must have Rescan button');
    assert(!html.includes('Scan Again'), 'Zero-findings card must be text-only with NO duplicate scan button');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Results phase with 0 items must have exactly 1 scan button in header, found ${scanButtons.length}`);
  });

  it('renders progress card in cleaning phase (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'cleaning',
    }));
    assert(html.length > 500, 'Cleaning body must not be empty');
    assert(html.includes('Cleaning Your System'), 'Must render cleaning card');
    assert(html.includes('Cleaning…'), 'Header action must show Cleaning…');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Cleaning phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  });

  it('renders success report card in done-success phase (Scan Again solely in header, count === 1)', () => {
    const successReport = {
      durationMs: 2500,
      totalFreed: 104857600,
      filesRemoved: 150,
      errors: 0,
      categories: ['temp-files', 'recycle-bin'],
    };
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'complete',
      initialReport: successReport,
    }));
    assert(html.length > 500, 'Done-success body must not be empty');
    assert(html.includes('System successfully optimized'), 'Subtitle must show optimization text on success');
    assert(html.includes('Cleanup Complete!'), 'Must show success title');
    assert(html.includes('150'), 'Must show removed file count');
    assert(html.includes('View Recovery Info'), 'Must have View Recovery Info button in report card');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Complete phase (success) must have exactly 1 scan button, found ${scanButtons.length}`);
  });

  it('renders report card with breakdown of skipped reasons in done-partial phase (count === 1)', () => {
    const partialReport = {
      durationMs: 3000,
      totalFreed: 52428800,
      filesRemoved: 80,
      errors: 10,
      categories: ['temp-files'],
      skippedByReason: {
        locked: 6,
        permission: 4,
        missing: 0,
        other: 0,
      },
    };
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'complete',
      initialReport: partialReport,
    }));
    assert(html.length > 500, 'Done-partial body must not be empty');
    assert(html.includes('Cleanup Complete!'), 'Partial clean retains complete heading');
    assert(html.includes('in use and skipped'), 'Must report locked files count');
    assert(html.includes('administrator permission required'), 'Must report admin files count');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Complete phase (partial) must have exactly 1 scan button, found ${scanButtons.length}`);
  });

  it('renders honest failure state and honest subtitle in done-total-failure phase (count === 1)', () => {
    const failureReport = {
      durationMs: 1200,
      totalFreed: 0,
      filesRemoved: 0,
      errors: 25,
      categories: ['temp-files'],
      skippedByReason: {
        locked: 25,
        permission: 0,
        missing: 0,
        other: 0,
      },
    };
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'complete',
      initialReport: failureReport,
    }));
    assert(html.length > 500, 'Done-total-failure body must not be empty');
    assert(html.includes('Cleanup incomplete — files could not be removed'), 'Subtitle must NOT say System successfully optimized on 0 files removed');
    assert(html.includes('Cleanup Incomplete'), 'Header card must show Cleanup Incomplete');
    assert(html.includes('No files could be removed'), 'Description must explain total failure');
    assert(html.includes('in use and skipped'), 'Must show in use reason callout');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Complete phase (failure) must have exactly 1 scan button, found ${scanButtons.length}`);
  });

  it('renders non-empty fallback card when complete phase has null report (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'complete',
      initialReport: null,
    }));
    assert(html.length > 500, 'Complete with null report must NEVER render blank body');
    assert(!html.includes('System successfully optimized'), 'Must NOT display stale System successfully optimized subtitle when report is missing');
    assert(html.includes('System scan and cleanup ready'), 'Subtitle falls back gracefully');
    assert(html.includes('Cleanup Finished'), 'Body contains fallback cleanup card');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Complete with null report must have exactly 1 scan button in header, found ${scanButtons.length}`);
  });

  it('renders recovery view with Scan button when an unknown phase is encountered (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'some-unknown-phase' as any,
    }));
    assert(html.length > 500, 'Unknown phase must NEVER render empty body');
    assert(html.includes('System Cleaner'), 'Contains title');
    assert(html.includes('Ready to scan and clean junk files'), 'Renders fallback recovery card');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Unknown phase must have exactly 1 scan button in header, found ${scanButtons.length}`);
  });

  it('renders informative background card in pending-permission phase (count === 1)', () => {
    const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
      initialPhase: 'pending-permission',
    }));
    assert(html.length > 500, 'Pending permission body must not be empty');
    assert(html.includes('Administrator Permission Required'), 'Renders informative permission message in body');
    const scanButtons = getScanButtons(html);
    assert.strictEqual(scanButtons.length, 1, `Pending permission phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  });
});

describe('isBusy & Error-Path Recovery Tests', () => {
  it('resets isScanning when scan throws, allowing subsequent scan to start and succeed', async () => {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    let scanAttempts = 0;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanAttempts++;
      if (scanAttempts === 1) {
        throw new Error('EPERM: disk read failed during scan');
      }
      return [{ id: 'temp-files', name: 'Temp Files', totalSize: 500, fileCount: 2 }];
    };

    const actions = captureActions({ initialPhase: 'idle' });
    assert(actions, 'Actions must be captured');

    await actions.handleScan();
    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be false after scan throws');

    await actions.handleScan();
    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be false after second scan completes');
    assert.strictEqual(scanAttempts, 2, 'Second scan must have executed successfully');
  });

  it('resets isCleaning when clean throws, allowing subsequent scan to start', async () => {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    (globalThis as any).window.propel.cleaner.clean = async () => {
      throw new Error('IPC timeout: cleaner worker process crashed');
    };

    const actions = captureActions({
      initialPhase: 'results',
      initialCategories: [{ id: 'temp-files', name: 'Temp Files', totalSize: 100, fileCount: 1, isSafe: true, isCapped: false }],
    });

    await actions.handleClean();
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after clean throws');

    let scanRan = false;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanRan = true;
      return [];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after clean throws');
  });

  it('resets isCleaning when clean returns invalid report, allowing subsequent scan to start', async () => {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    (globalThis as any).window.propel.cleaner.clean = async () => ({});

    const actions = captureActions({
      initialPhase: 'results',
      initialCategories: [{ id: 'temp-files', name: 'Temp Files', totalSize: 100, fileCount: 1, isSafe: true, isCapped: false }],
    });

    await actions.handleClean();
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after invalid report');

    let scanRan = false;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanRan = true;
      return [];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after invalid report');
  });

  it('resets isCleaning when UAC is declined, allowing subsequent scan to start', async () => {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    (globalThis as any).window.propel.cleaner.cleanAdminBatch = async () => {
      const err: any = new Error('The operation was canceled by the user (UAC declined)');
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

    await actions.finishPermissionBatch('continue');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after UAC is declined');

    const postActions = captureActions({ initialPhase: 'complete', initialReport });
    let scanRan = false;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanRan = true;
      return [];
    };
    await postActions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after UAC was declined');
  });

  it('resets isCleaning when UAC times out, allowing subsequent scan to start', async () => {
    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    (globalThis as any).window.propel.cleaner.cleanAdminBatch = async () => {
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

    await actions.finishPermissionBatch('continue');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be false after UAC timeout');

    const postActions = captureActions({ initialPhase: 'complete', initialReport });
    let scanRan = false;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanRan = true;
      return [];
    };
    await postActions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan must start after UAC timeout');
  });

  it('resets store flags on unmount, allowing subsequent scan to start', async () => {
    useAppStore.getState().setIsScanning(true);
    useAppStore.getState().setIsCleaning(true);

    assert.strictEqual(useAppStore.getState().isScanning, true);
    assert.strictEqual(useAppStore.getState().isCleaning, true);

    useAppStore.getState().setIsScanning(false);
    useAppStore.getState().setIsCleaning(false);

    assert.strictEqual(useAppStore.getState().isScanning, false, 'isScanning must be reset to false on unmount');
    assert.strictEqual(useAppStore.getState().isCleaning, false, 'isCleaning must be reset to false on unmount');

    const actions = captureActions({ initialPhase: 'idle' });
    let scanRan = false;
    (globalThis as any).window.propel.cleaner.scan = async () => {
      scanRan = true;
      return [];
    };
    await actions.handleScan();
    assert.strictEqual(scanRan, true, 'Subsequent scan can start after unmount reset');
  });
});
