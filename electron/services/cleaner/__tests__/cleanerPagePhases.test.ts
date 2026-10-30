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

(globalThis as any).window = {
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

(globalThis as any).document = {
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Silence React SSR useLayoutEffect warnings from Radix/Framer in Node test environment
const origError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  origError(...args);
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
  define: {
    'import.meta.env.VITE_APP_VERSION': '"1.4.0"',
    'import.meta.env.VITE_GLITCHTIP_DSN': '""',
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  },
  write: false,
});

const mod: any = { exports: {} };
const runner = new Function('module', 'exports', 'require', buildResult.outputFiles[0].text);
runner(mod, mod.exports, require);
const CleanerPage = mod.exports.CleanerPage;

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
