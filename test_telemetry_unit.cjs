const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Compile mainTelemetry.ts with esbuild in memory
const compiled = execSync('npx esbuild electron/services/telemetry/mainTelemetry.ts --format=cjs', {
  cwd: __dirname,
  encoding: 'utf8'
});

// Load the compiled module in a sandboxed module wrapper
const m = { exports: {} };
const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', compiled);
fn(m, m.exports, (mod) => {
  if (mod === 'os') return require('os');
  if (mod === 'electron') return { app: { isPackaged: true } };
  if (mod === '../updater/updaterService') return { APP_VERSION: '1.4' };
  if (mod === '@sentry/electron/main') return { init: () => {}, getCurrentScope: () => ({ setTag: () => {} }), setTag: () => {} };
  return {};
}, __dirname, path.join(__dirname, 'mainTelemetry.js'));

const { scrubTelemetryEvent, scrubStackFrame, sanitizeMessage } = m.exports;

console.log('=== RUNNING TELEMETRY SCRUB UNIT TEST ===');

const fakeEvent = {
  message: "ENOENT C:\\Users\\Test\\Documents\\a.txt",
  breadcrumbs: [
    { message: "Failed opening file at C:\\Users\\Test\\Documents\\a.txt" }
  ],
  tags: {
    targetDir: "C:\\Users\\Test\\AppData\\Local"
  },
  extra: {
    traceInfo: "User directory was C:\\Users\\Test\\Documents"
  },
  exception: {
    values: [
      {
        type: "Error",
        value: "ENOENT C:\\Users\\Test\\Documents\\a.txt",
        stacktrace: {
          frames: [
            {
              filename: "C:\\Users\\Test\\AppData\\Local\\Programs\\Propel\\resources\\app.asar\\x.js",
              lineno: 42,
              colno: 12
            }
          ]
        }
      }
    ]
  }
};

console.log('\n--- INPUT FAKE EVENT ---');
console.log(JSON.stringify(fakeEvent, null, 2));

const scrubbedEvent = scrubTelemetryEvent(JSON.parse(JSON.stringify(fakeEvent)), "Test", "C:\\Users\\Test");

console.log('\n--- OUTPUT SCRUBBED EVENT ---');
console.log(JSON.stringify(scrubbedEvent, null, 2));

// Assertions
const scrubbedJson = JSON.stringify(scrubbedEvent);
const hasTest = /test/i.test(scrubbedJson);
const hasUserPath = /[a-z]:[\\/]users[\\/]/i.test(scrubbedJson);
const stackFrameClean = scrubbedEvent.exception.values[0].stacktrace.frames[0].filename;

console.log('\n--- VERIFICATION CHECKS ---');
console.log('1. Contains "Test" (case-insensitive):', hasTest ? 'FAIL (found)' : 'PASS (none)');
console.log('2. Contains user path (C:\\Users\\...):', hasUserPath ? 'FAIL (found)' : 'PASS (none)');
console.log('3. Stack frame filename rewritten:', stackFrameClean);
console.log('4. Exception message scrubbed:', scrubbedEvent.exception.values[0].value);
console.log('5. Top-level message scrubbed:', scrubbedEvent.message);
console.log('6. Breadcrumb message scrubbed:', scrubbedEvent.breadcrumbs[0].message);
console.log('7. Tag scrubbed:', scrubbedEvent.tags.targetDir);
console.log('8. Extra scrubbed:', scrubbedEvent.extra.traceInfo);

if (hasTest || hasUserPath || stackFrameClean.includes('Test') || stackFrameClean.includes('Users')) {
  console.error('\nUNIT TEST FAILED!');
  process.exit(1);
} else {
  console.log('\nUNIT TEST PASSED SUCCESSFULLY!');
}
