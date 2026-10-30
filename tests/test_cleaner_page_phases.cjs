const assert = require('assert');
const path = require('path');
const esbuild = require('esbuild');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Mock browser globals for SSR / renderToString
if (typeof globalThis.Element === 'undefined') {
  globalThis.Element = class Element {};
}
if (typeof globalThis.HTMLElement === 'undefined') {
  globalThis.HTMLElement = class HTMLElement extends globalThis.Element {};
}
if (typeof globalThis.SVGElement === 'undefined') {
  globalThis.SVGElement = class SVGElement extends globalThis.Element {};
}

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  propel: {
    cleaner: {
      onScanProgress: () => {},
      onCleanProgress: () => {},
      removeListeners: () => {},
      scan: async () => [],
      clean: async () => ({ totalFreed: 0, filesRemoved: 0, errors: 0, categories: [] }),
    },
    maintenance: {
      getSettings: async () => ({ safeCleaningMode: true }),
    },
  },
};

globalThis.document = {
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Silence React SSR useLayoutEffect warnings from Radix/Framer in Node
const origError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  origError(...args);
};

console.log('--- STARTING CLEANER PAGE PHASE & RENDER TESTS ---');

// Compile CleanerPage via esbuild (no new dependencies)
const buildResult = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../src/pages/CleanerPage.tsx')],
  bundle: true,
  format: 'cjs',
  packages: 'external',
  alias: {
    '@': path.join(__dirname, '../src'),
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': '"1.4.0"',
    'import.meta.env.VITE_GLITCHTIP_DSN': '""',
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  },
  write: false,
});

const mod = { exports: {} };
const runner = new Function('module', 'exports', 'require', buildResult.outputFiles[0].text);
runner(mod, mod.exports, require);
const CleanerPage = mod.exports.CleanerPage;

assert(typeof CleanerPage === 'function', 'CleanerPage should be exported as a React component');

// Test 1: Phase IDLE
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'idle',
  }));
  assert(html.length > 500, 'Idle body must not be empty');
  assert(html.includes('System Cleaner'), 'Must contain header title');
  assert(html.includes('Scan and safely remove junk files from your PC'), 'Subtitle must match idle text');
  assert(html.includes('Scan this PC'), 'Header action must have Scan this PC button');
  assert(html.includes('Find space you can safely reclaim'), 'Idle card must be rendered');
  console.log('[PASS] 1. Idle phase renders non-empty body and Scan this PC button');
}

// Test 2: Phase SCANNING
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'scanning',
  }));
  assert(html.length > 500, 'Scanning body must not be empty');
  assert(html.includes('Scanning Your System'), 'Must render scanning progress card');
  assert(html.includes('Scanning…'), 'Header action button must show Scanning…');
  assert(html.includes('Files Scanned'), 'Metrics row must be present');
  console.log('[PASS] 2. Scanning phase renders scanning progress and loading state');
}

// Test 3: Phase RESULTS (with categories)
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'results',
    initialCategories: [
      {
        id: 'temp-files',
        name: 'Temporary Files',
        description: 'Temporary files created by apps',
        totalSize: 104857600, // 100 MB
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
  console.log('[PASS] 3. Results phase (with items) renders category cards and Start Clean button');
}

// Test 4: Phase RESULTS (with 0 categories - clean system)
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'results',
    initialCategories: [],
  }));
  assert(html.length > 500, 'Results body with 0 categories must not be empty');
  assert(html.includes('No Junk Files Found'), 'Must render zero-findings card instead of empty void');
  assert(html.includes('Your system is already clean and optimized'), 'Must show clean confirmation');
  assert(html.includes('Scan Again'), 'Must provide Scan Again CTA');
  console.log('[PASS] 4. Results phase (with 0 items) renders clean state card rather than blank grid');
}

// Test 5: Phase CLEANING
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'cleaning',
  }));
  assert(html.length > 500, 'Cleaning body must not be empty');
  assert(html.includes('Cleaning Your System'), 'Must render cleaning card');
  assert(html.includes('Cleaning…'), 'Header action must show Cleaning…');
  console.log('[PASS] 5. Cleaning phase renders cleaning progress card');
}

// Test 6: Phase DONE-SUCCESS
{
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
  assert(html.includes('Scan Again'), 'Must have Scan Again button');
  console.log('[PASS] 6. Done-success renders Cleanup Complete report card');
}

// Test 7: Phase DONE-PARTIAL
{
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
  assert(html.includes('Scan Again'), 'Must have Scan Again button');
  console.log('[PASS] 7. Done-partial renders Cleanup Complete with skipped reasons breakdown');
}

// Test 8: Phase DONE-TOTAL-FAILURE
{
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
  console.log('[PASS] 8. Done-total-failure displays truthful failure state and honest subtitle');
}

// Test 9: Complete phase with NULL report (the bug reproduction scenario!)
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'complete',
    initialReport: null,
  }));
  assert(html.length > 500, 'Complete with null report must NEVER render blank body');
  assert(!html.includes('System successfully optimized'), 'Must NOT display stale System successfully optimized subtitle when report is missing');
  assert(html.includes('System scan and cleanup ready'), 'Subtitle falls back gracefully');
  assert(html.includes('Cleanup Finished'), 'Body contains fallback cleanup card');
  assert(html.includes('Scan Again'), 'Provides action to scan again');
  console.log('[PASS] 9. Complete with null report renders non-empty fallback card (blank body fixed)');
}

// Test 10: Unknown/unmatched phase fallback
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'some-unknown-phase',
  }));
  assert(html.length > 500, 'Unknown phase must NEVER render empty body');
  assert(html.includes('System Cleaner'), 'Contains title');
  assert(html.includes('Ready to scan and clean junk files'), 'Renders fallback recovery card');
  assert(html.includes('Scan this PC'), 'Provides recovery button');
  console.log('[PASS] 10. Unknown phase falls back to non-empty recovery view with Scan button');
}

// Test 11: Pending permission phase
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'pending-permission',
  }));
  assert(html.length > 500, 'Pending permission body must not be empty');
  assert(html.includes('Administrator Permission Required'), 'Renders informative permission message in body');
  console.log('[PASS] 11. Pending-permission phase renders informative background body');
}

console.log('--- ALL 11 CLEANER PAGE PHASE TESTS PASSED SUCCESSFULLY! ---');
