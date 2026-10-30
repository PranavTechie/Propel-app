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

console.log('--- STARTING CLEANER PAGE PHASE & SINGLE SCAN TRIGGER TESTS ---');

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

/**
 * Counts scan action buttons in rendered HTML.
 * The standing rule requires the header to be the single owner of the scan action in every phase:
 * - idle: "Scan this PC"
 * - scanning: "Scanning…"
 * - results: "Rescan"
 * - cleaning / pending-permission: "Cleaning…"
 * - complete: "Scan Again"
 */
function getScanButtons(html) {
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
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Idle phase must have exactly 1 scan button, found ${scanButtons.length}`);
  console.log('[PASS] 1. Idle phase: non-empty body, Scan this PC header button (count === 1)');
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
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Scanning phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  console.log('[PASS] 2. Scanning phase: progress card and Scanning… header action (count === 1)');
}

// Test 3: Phase RESULTS (with categories including Recycle Bin)
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
      {
        id: 'recycle-bin',
        name: 'Recycle Bin',
        description: 'Deleted items awaiting permanent removal',
        totalSize: 52428800,
        fileCount: 12,
        isSafe: true,
        isCapped: false,
      },
    ],
  }));
  assert(html.length > 500, 'Results body must not be empty');
  assert(html.includes('Review scan results and select categories to clean'), 'Subtitle must be review prompt');
  assert(html.includes('Temporary Files'), 'Category card must be rendered');
  assert(html.includes('Recycle Bin'), 'Recycle Bin card must be rendered');
  assert(html.includes('Permanently empties your Recycle Bin. Cannot be undone.'), 'Recycle Bin card must display hint');
  assert(html.includes('Start Clean'), 'Start Clean button must be present in body as primary action');
  assert(html.includes('Rescan'), 'Header action must have Rescan button');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Results phase (with items) must have exactly 1 scan button (Rescan), found ${scanButtons.length}`);
  console.log('[PASS] 3. Results phase (with items): Rescan in header (count === 1), Start Clean stays primary in body, Recycle Bin card displays one-line hint');
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
  assert(html.includes('Rescan'), 'Header action has Rescan button');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Results phase (0 items) must have exactly 1 scan button in header, found ${scanButtons.length}`);
  assert(!html.includes('Scan Again'), 'Zero-findings card must be text-only with NO duplicate scan button');
  console.log('[PASS] 4. Results phase (0 items): zero-findings card is text-only, Rescan in header (count === 1)');
}

// Test 5: Phase CLEANING
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'cleaning',
  }));
  assert(html.length > 500, 'Cleaning body must not be empty');
  assert(html.includes('Cleaning Your System'), 'Must render cleaning card');
  assert(html.includes('Cleaning…'), 'Header action must show Cleaning…');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Cleaning phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  console.log('[PASS] 5. Cleaning phase: cleaning progress card and Cleaning… header action (count === 1)');
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
  assert(!html.includes('View Recovery Info'), 'Done-success must NOT contain View Recovery Info button');
  assert(!html.includes('Cleanup Details & Recovery'), 'Done-success must NOT contain Cleanup Details & Recovery modal');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Complete phase (success) must have exactly 1 scan button, found ${scanButtons.length}`);
  console.log('[PASS] 6. Done-success: Cleanup Complete report card, Scan Again solely in header (count === 1), no recovery button or modal');
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
  assert(html.includes('are in use by other programs and were skipped. Close those programs and scan again.'), 'Must report locked files with updated copy');
  assert(html.includes('administrator permission required'), 'Must report admin files count');
  assert(!html.includes('View Recovery Info'), 'Done-partial must NOT contain View Recovery Info button');
  assert(!html.includes('Cleanup Details & Recovery'), 'Done-partial must NOT contain Cleanup Details & Recovery modal');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Complete phase (partial) must have exactly 1 scan button, found ${scanButtons.length}`);
  console.log('[PASS] 7. Done-partial: skipped breakdown with updated copy, Scan Again solely in header (count === 1), no recovery button');
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
  assert(html.includes('are in use by other programs and were skipped. Close those programs and scan again.'), 'Must show in use reason with updated copy');
  assert(!html.includes('View Recovery Info'), 'Done-total-failure must NOT contain View Recovery Info button');
  assert(!html.includes('Cleanup Details & Recovery'), 'Done-total-failure must NOT contain Cleanup Details & Recovery modal');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Complete phase (failure) must have exactly 1 scan button, found ${scanButtons.length}`);
  console.log('[PASS] 8. Done-total-failure: truthful failure state, Scan Again solely in header (count === 1), no recovery button');
}

// Test 9: Complete phase with NULL report (stale / missing report scenario)
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'complete',
    initialReport: null,
  }));
  assert(html.length > 500, 'Complete with null report must NEVER render blank body');
  assert(!html.includes('System successfully optimized'), 'Must NOT display stale System successfully optimized subtitle when report is missing');
  assert(html.includes('System scan and cleanup ready'), 'Subtitle falls back gracefully');
  assert(html.includes('Cleanup Finished'), 'Body contains fallback cleanup card');
  assert(!html.includes('View Recovery Info'), 'Complete fallback must NOT contain View Recovery Info button');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Complete with null report must have exactly 1 scan button in header, found ${scanButtons.length}`);
  console.log('[PASS] 9. Complete with null report: fallback card text-only, Scan Again solely in header (count === 1)');
}

// Test 10: Unknown/unmatched phase fallback
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'some-unknown-phase',
  }));
  assert(html.length > 500, 'Unknown phase must NEVER render empty body');
  assert(html.includes('System Cleaner'), 'Contains title');
  assert(html.includes('Ready to scan and clean junk files'), 'Renders fallback recovery card');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Unknown phase must have exactly 1 scan button in header, found ${scanButtons.length}`);
  console.log('[PASS] 10. Unknown phase fallback: recovery view text-only, Scan this PC solely in header (count === 1)');
}

// Test 11: Pending permission phase
{
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'pending-permission',
  }));
  assert(html.length > 500, 'Pending permission body must not be empty');
  assert(html.includes('Administrator Permission Required'), 'Renders informative permission message in body');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, `Pending permission phase must have exactly 1 scan action button, found ${scanButtons.length}`);
  console.log('[PASS] 11. Pending-permission phase: informative body, Cleaning… header action (count === 1)');
}

// Test 12: Complete screen has NO recovery button and NO recovery modal
{
  const report = {
    durationMs: 1500,
    totalFreed: 1048576,
    filesRemoved: 10,
    errors: 0,
    categories: ['temp-files', 'recycle-bin'],
  };
  const html = ReactDOMServer.renderToString(React.createElement(CleanerPage, {
    initialPhase: 'complete',
    initialReport: report,
  }));
  assert(!html.includes('View Recovery Info'), 'Complete screen must NOT contain View Recovery Info button');
  assert(!html.includes('Cleanup Details & Recovery'), 'Complete screen must NOT contain Cleanup Details & Recovery modal title');
  assert(!html.includes('Need full system recovery?'), 'Complete screen must NOT contain system recovery prompt');
  assert(!html.includes('ms-settings:recovery'), 'Complete screen must NOT contain recovery settings URI');
  const scanButtons = getScanButtons(html);
  assert.strictEqual(scanButtons.length, 1, 'Complete screen must keep exactly 1 scan button in header');
  assert(html.includes('Scan Again'), 'Complete screen header must have Scan Again');
  console.log('[PASS] 12. Complete screen has no recovery button or modal, exactly one scan button in header');
}

console.log('--- ALL 12 CLEANER PAGE PHASE & SINGLE SCAN TRIGGER TESTS PASSED! ---');
