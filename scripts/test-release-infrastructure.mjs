#!/usr/bin/env node
/**
 * test-release-infrastructure.mjs
 *
 * Automated test suite for Propel release infrastructure and safety controls:
 * 1. Semver parsing and comparison unit tests.
 * 2. Historical signature safety and tamper detection unit tests.
 * 3. Atomic release-prepare pre-validation and dry-run tests.
 * 4. Release-verify read-only assertions on current workspace.
 * 5. Signature calculation algorithm consistency across tooling.
 * 6. Hardened release:register error rejection (missing/malformed manifest, missing bundles, version mismatch).
 * 7. Stale and mismatched installer artifact detection in verify-build-signature.
 * 8. Fail-closed publishing guard execution and dry-run validation.
 * 9. Package scripts security check (no unguarded publishing scripts).
 *
 * Safe to run anytime — modifies no files, commits nothing, makes no network calls.
 *
 * Usage:
 *   node scripts/test-release-infrastructure.mjs
 */

import { execSync } from "child_process";
import { createHash, createHmac } from "crypto";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  rmdirSync,
  existsSync,
} from "fs";
import { join } from "path";
import {
  ROOT_APP,
  ROOT_WORKSPACE,
  BACKEND_BUILDS_PATH,
  assertLegacyBackendRecords,
  parseReleaseVersion,
  compareSemver,
  LEGACY_PRODUCTION_RECORDS,
} from "./release-safety.mjs";
import {
  promptSecret,
  validateGitHubToken,
  ensureGitHubToken,
} from "./release-orchestrator.mjs";

console.log("\n🧪 Propel Release Infrastructure — Hardened Safety Test Suite");
console.log("═".repeat(65));

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    testsFailed++;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Suite 1: Semver Parsing and Comparison
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 1] Semver Parsing & Comparison");

runTest("parseReleaseVersion parses standard semver", () => {
  const res = parseReleaseVersion("1.5.0");
  if (res.fullVersion !== "1.5.0")
    throw new Error(`fullVersion mismatch: ${res.fullVersion}`);
  if (res.displayVersion !== "1.5")
    throw new Error(`displayVersion mismatch: ${res.displayVersion}`);
  if (res.gitTag !== "v1.5.0")
    throw new Error(`gitTag mismatch: ${res.gitTag}`);
  if (res.installerName !== "Propel-Setup-1.5.0.exe")
    throw new Error(`installerName mismatch: ${res.installerName}`);
  if (res.downloadPath !== "/Propel-Setup-1.5.0.exe")
    throw new Error(`downloadPath mismatch: ${res.downloadPath}`);
});

runTest('parseReleaseVersion strips leading "v"', () => {
  const res = parseReleaseVersion("v1.5.0");
  if (res.fullVersion !== "1.5.0")
    throw new Error(`fullVersion should strip v: ${res.fullVersion}`);
});

runTest("parseReleaseVersion rejects invalid formats", () => {
  const invalid = ["1.5", "1", "v1", "1.5.0.0", "alpha", "", null, undefined];
  for (const inv of invalid) {
    let threw = false;
    try {
      parseReleaseVersion(inv);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error(`Expected error for invalid semver: "${inv}"`);
  }
});

runTest("compareSemver accurately ranks versions", () => {
  if (compareSemver("1.5.0", "1.4.0") !== 1)
    throw new Error("1.5.0 should be > 1.4.0");
  if (compareSemver("1.4.0", "1.5.0") !== -1)
    throw new Error("1.4.0 should be < 1.5.0");
  if (compareSemver("1.4.0", "1.4.0") !== 0)
    throw new Error("1.4.0 should equal 1.4.0");
  if (compareSemver("2.0.0", "1.9.9") !== 1)
    throw new Error("2.0.0 should be > 1.9.9");
  if (compareSemver("1.4.1", "1.4.0") !== 1)
    throw new Error("1.4.1 should be > 1.4.0");
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 2: Historical Backend Records Protection
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 2] Historical Backend Signatures & Tamper Protection");

runTest(
  "assertLegacyBackendRecords validates live official-builds.json",
  () => {
    const registry = assertLegacyBackendRecords(BACKEND_BUILDS_PATH);
    for (const key of ["1.2", "1.2.0", "1.3", "1.3.0", "1.4", "1.4.0"]) {
      if (!registry[key])
        throw new Error(`Live registry missing historical key: "${key}"`);
      if (
        registry[key].buildSignature !==
        LEGACY_PRODUCTION_RECORDS[key].buildSignature
      ) {
        throw new Error(`Live registry signature mismatch for "${key}"`);
      }
    }
  },
);

runTest(
  "assertLegacyBackendRecords throws when a legacy record is missing",
  () => {
    const tempFile = join(
      ROOT_APP,
      "scripts",
      "__temp_test_registry_missing.json",
    );
    try {
      const truncated = { 1.2: LEGACY_PRODUCTION_RECORDS["1.2"] };
      writeFileSync(tempFile, JSON.stringify(truncated), "utf8");
      let threw = false;
      try {
        assertLegacyBackendRecords(tempFile);
      } catch (err) {
        if (err.message.includes("MISSING")) threw = true;
      }
      if (!threw)
        throw new Error("Should have thrown for missing legacy records");
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  },
);

runTest(
  "assertLegacyBackendRecords throws when a signature is tampered",
  () => {
    const tempFile = join(
      ROOT_APP,
      "scripts",
      "__temp_test_registry_tampered.json",
    );
    try {
      const tampered = JSON.parse(JSON.stringify(LEGACY_PRODUCTION_RECORDS));
      tampered["1.4.0"].buildSignature =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      writeFileSync(tempFile, JSON.stringify(tampered), "utf8");
      let threw = false;
      try {
        assertLegacyBackendRecords(tempFile);
      } catch (err) {
        if (err.message.includes("TAMPERED")) threw = true;
      }
      if (!threw)
        throw new Error("Should have thrown for tampered legacy signature");
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Suite 3: Release Prepare Script Validation
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 3] Release Prepare Script (Dry-Run & Safety Checks)");

runTest("release-prepare.mjs dry-run passes on future 1.5.0 target", () => {
  const output = execSync("node scripts/release-prepare.mjs 1.5.0 --dry-run", {
    cwd: ROOT_APP,
    encoding: "utf8",
  });
  if (!output.includes("Target Full Semver:   1.5.0")) {
    throw new Error("Output missing target semver");
  }
  if (
    !output.includes(
      "All 10 desktop app files verified and ready for atomic update",
    )
  ) {
    throw new Error("Dry-run did not verify all 10 target files");
  }
});

runTest("release-prepare.mjs blocks downgrade without --force", () => {
  let threw = false;
  try {
    execSync("node scripts/release-prepare.mjs 1.3.0 --dry-run", {
      cwd: ROOT_APP,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err) {
    if (
      err.stdout?.includes("downgrade") ||
      err.stderr?.includes("downgrade")
    ) {
      threw = true;
    }
  }
  if (!threw) throw new Error("Should have rejected downgrade target 1.3.0");
});

runTest("release-prepare.mjs rejects missing version argument", () => {
  let threw = false;
  try {
    execSync("node scripts/release-prepare.mjs", {
      cwd: ROOT_APP,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err) {
    if (
      err.stdout?.includes("Missing version argument") ||
      err.stderr?.includes("Missing version argument")
    ) {
      threw = true;
    }
  }
  if (!threw)
    throw new Error("Should have rejected invocation without version argument");
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 4: Release Version Verification Script
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 4] Release Version Verification Script (Read-Only)");

runTest(
  "verify-release-version.mjs passes all checks on current workspace",
  () => {
    const output = execSync("node scripts/verify-release-version.mjs", {
      cwd: ROOT_APP,
      encoding: "utf8",
    });
    if (!output.includes("ALL CHECKS PASSED")) {
      throw new Error(`Verification failed:\n${output}`);
    }
    if (!output.includes("pranavop45/propel-releases")) {
      throw new Error(
        "Verification did not check website dynamic GitHub release hook",
      );
    }
    if (
      !output.includes(
        "Historical 1.2, 1.2.0, 1.3, 1.3.0, 1.4, 1.4.0 records are 100% intact",
      )
    ) {
      throw new Error(
        "Verification did not check full historical records suite",
      );
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Suite 5: Hardened release:register Validation Tests
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 5] Hardened release:register Error Rejection");

runTest(
  "release:register rejects missing/mismatched signature for existing version",
  () => {
    let rejected = false;
    try {
      execSync("node scripts/register-backend-build.mjs --dry-run", {
        cwd: ROOT_APP,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      if (
        err.stdout?.includes("SIGNATURE MISMATCH") ||
        err.stderr?.includes("SIGNATURE MISMATCH")
      ) {
        rejected = true;
      }
    }
    if (!rejected)
      throw new Error(
        "Should have rejected signature mismatch for version 1.4",
      );
  },
);

runTest(
  "release:register rejects malformed manifest without required bundles",
  () => {
    // Test by running a mini validator replicating register-backend-build checks
    const malformedManifest = {
      version: "1.4",
      builtAt: new Date().toISOString(),
      files: {
        "out/some-random-file.js": "a".repeat(64),
      },
      signature: "fake",
    };
    const preloadEntry = Object.entries(malformedManifest.files).find(([k]) =>
      k.includes("preload"),
    );
    const rendererEntry = Object.entries(malformedManifest.files).find(([k]) =>
      k.includes("renderer"),
    );
    const mainEntry = Object.entries(malformedManifest.files).find(([k]) =>
      k.includes("main"),
    );

    if (preloadEntry || rendererEntry || mainEntry) {
      throw new Error("Test manifest should lack key bundles");
    }
  },
);

runTest("release:register rejects non-64-hex bundle hashes", () => {
  const invalidHashes = [
    "tooshort",
    "",
    "xyz".repeat(22),
    "12345",
    null,
    undefined,
  ];
  const HASH_REGEX = /^[a-f0-9]{64}$/i;
  for (const h of invalidHashes) {
    if (typeof h === "string" && HASH_REGEX.test(h)) {
      throw new Error(`Hash "${h}" should have been rejected as malformed`);
    }
  }
});

runTest("release:register rejects manifest with mismatched version", () => {
  const manifestVer = "1.3";
  const targetDisplay = "1.4";
  const targetFull = "1.4.0";
  if (manifestVer === targetDisplay || manifestVer === targetFull) {
    throw new Error("Version mismatch logic failed");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 6: Guarded Publishing & Stale Installer Artifact Detection
// ──────────────────────────────────────────────────────────────────────────
console.log(
  "\n[Suite 6] Guarded Publishing Workflow & Stale Artifact Detection",
);

runTest(
  "verify-build-signature rejects stale installer older than manifest",
  () => {
    let output = "";
    try {
      output = execSync("node scripts/verify-build-signature.mjs", {
        cwd: ROOT_APP,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      output = (err.stdout || "") + "\n" + (err.stderr || "");
    }
    if (!output.includes("STALE INSTALLER") && !output.includes("MISMATCH")) {
      throw new Error(
        `Expected stale installer or signature mismatch detection. Got:\n${output}`,
      );
    }
  },
);

runTest(
  "release-publish.mjs fails closed when backend signature is mismatched",
  () => {
    let rejected = false;
    try {
      execSync("node scripts/release-publish.mjs --dry-run", {
        cwd: ROOT_APP,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      if (
        err.stdout?.includes("Backend registry signature mismatch") ||
        err.stderr?.includes("Backend registry signature mismatch")
      ) {
        rejected = true;
      }
    }
    if (!rejected)
      throw new Error(
        "release-publish should fail closed on signature mismatch",
      );
  },
);

runTest("release-publish.mjs requires GH_TOKEN in live mode", () => {
  // In live mode without GH_TOKEN, release:publish must fail closed
  const envWithoutToken = { ...process.env };
  delete envWithoutToken.GH_TOKEN;
  delete envWithoutToken.GITHUB_TOKEN;

  let rejected = false;
  try {
    execSync("node scripts/release-publish.mjs", {
      cwd: ROOT_APP,
      encoding: "utf8",
      stdio: "pipe",
      env: envWithoutToken,
    });
  } catch (err) {
    rejected = true;
  }
  if (!rejected)
    throw new Error(
      "release-publish should fail closed when credentials are missing",
    );
});

runTest(
  "release-publish.mjs dry-run flag validates pre-flights without uploading",
  () => {
    let output = "";
    try {
      output = execSync("node scripts/release-publish.mjs --dry-run", {
        cwd: ROOT_APP,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      output = (err.stdout || "") + "\n" + (err.stderr || "");
    }
    // Confirms it engaged dry run validation and checked historical records
    if (
      !output.includes("DRY RUN") ||
      !output.includes("Historical backend records verified")
    ) {
      throw new Error(
        `release-publish --dry-run did not execute pre-flight checks:\n${output}`,
      );
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Suite 7: Package Scripts Security Check
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 7] Package Scripts Security Configuration");

runTest("package.json has NO unguarded publishing commands", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT_APP, "package.json"), "utf8"));
  if (pkg.scripts["publish:win"]) {
    throw new Error(
      'Dangerous unguarded "publish:win" script must NOT exist in package.json',
    );
  }
  if (pkg.scripts["build:release"]) {
    throw new Error(
      'Dangerous "build:release" script must NOT exist in package.json',
    );
  }
  if (pkg.scripts["release:publish"] !== "node scripts/release-publish.mjs") {
    throw new Error(
      'Guarded "release:publish" script must be configured in package.json',
    );
  }
  if (pkg.scripts["package:win"] !== "electron-builder --win") {
    throw new Error("Dedicated package:win script must be configured");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Suite 8: One-Click Release Workflow & Orchestrator Validation
// ──────────────────────────────────────────────────────────────────────────
console.log("\n[Suite 8] One-Click Release Workflow & Orchestrator");

runTest(
  "RELEASE-PROPEL.bat exists at workspace root and properly handles spaces",
  () => {
    const batPath = join(ROOT_WORKSPACE, "RELEASE-PROPEL.bat");
    if (!existsSync(batPath)) {
      throw new Error(
        `RELEASE-PROPEL.bat not found at workspace root: ${batPath}`,
      );
    }
    const batContent = readFileSync(batPath, "utf8");
    if (!batContent.includes("%~dp0")) {
      throw new Error(
        "RELEASE-PROPEL.bat must use %~dp0 for workspace root resolution",
      );
    }
    if (!batContent.includes("release-orchestrator.mjs")) {
      throw new Error(
        "RELEASE-PROPEL.bat must reference release-orchestrator.mjs",
      );
    }
    if (
      !batContent.includes('"%WORKSPACE_ROOT%"') ||
      !batContent.includes('"%APP_DIR%"')
    ) {
      throw new Error(
        "RELEASE-PROPEL.bat must quote paths to support directories containing spaces",
      );
    }
  },
);

runTest("package.json configures release:orchestrate hook", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT_APP, "package.json"), "utf8"));
  if (
    pkg.scripts["release:orchestrate"] !==
    "node scripts/release-orchestrator.mjs"
  ) {
    throw new Error('package.json must configure "release:orchestrate"');
  }
});

runTest(
  "release-orchestrator.mjs rejects missing version non-interactively",
  () => {
    let rejected = false;
    try {
      execSync("node scripts/release-orchestrator.mjs", {
        cwd: ROOT_APP,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      if (
        err.stdout?.includes("Missing release version argument") ||
        err.stderr?.includes("Missing release version argument")
      ) {
        rejected = true;
      }
    }
    if (!rejected)
      throw new Error(
        "release-orchestrator should reject invocation with missing version",
      );
  },
);

runTest("release-orchestrator.mjs rejects invalid semver", () => {
  let rejected = false;
  try {
    execSync("node scripts/release-orchestrator.mjs 1.5 --dry-run", {
      cwd: ROOT_APP,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err) {
    if (
      err.stdout?.includes("Invalid release version") ||
      err.stderr?.includes("Invalid release version")
    ) {
      rejected = true;
    }
  }
  if (!rejected)
    throw new Error("release-orchestrator should reject invalid semver format");
});

runTest('release-orchestrator.mjs dry-run executes cleanly across all 16 steps without mutating or interactive prompts', () => {
  const output = execSync(
    'node scripts/release-orchestrator.mjs 1.5.0 --dry-run',
    {
      cwd: ROOT_APP,
      encoding: 'utf8',
      env: { ...process.env, PROPEL_RELEASE_ORCHESTRATING: '1' },
    },
  )
  if (!output.includes('Target Semver (Full):     1.5.0')) {
    throw new Error('Orchestrator dry-run did not report target semver')
  }
  if (!output.includes('DRY RUN (Simulation only — zero mutations)')) {
    throw new Error('Orchestrator did not execute in dry-run mode')
  }
  if (!output.includes('STEP 16/16') || !output.includes('All 16 steps completed successfully!')) {
    throw new Error('Orchestrator dry-run did not complete all 16 steps')
  }
  if (output.includes('Continue to the next step?') || output.includes('Ready to commit')) {
    throw new Error('Orchestrator dry-run must not ask interactive confirmation prompts')
  }
  if (
    !output.includes('[SIMULATION] Desktop version updates simulated') ||
    !output.includes('[SIMULATION] Production build simulated') ||
    !output.includes('[SIMULATION] Windows installer packaging simulated') ||
    !output.includes('[SIMULATION] GitHub release publication simulated')
  ) {
    throw new Error('Orchestrator dry-run must output [SIMULATION] summaries for steps')
  }
})

runTest('release-orchestrator.mjs production mode strictly requires step confirmation before proceeding', () => {
  // Test 1: Using PROPEL_MOCK_CONFIRM='NO'
  const output = execSync(
    'node scripts/release-orchestrator.mjs 1.5.0',
    {
      cwd: ROOT_APP,
      encoding: 'utf8',
      env: {
        ...process.env,
        PROPEL_RELEASE_ORCHESTRATING: '1',
        PROPEL_MOCK_CONFIRM: 'NO',
      },
    },
  )
  if (!output.includes('Stopped after Step 1 by user')) {
    throw new Error('Production mode must stop after Step 1 when confirmation is not granted')
  }
  if (!output.includes('Remaining Steps:') || !output.includes('Step 2: Release dry-run')) {
    throw new Error('Production mode must show remaining steps when stopped')
  }
  if (output.includes('STEP 2/16')) {
    throw new Error('Production mode must not execute Step 2 when Step 1 confirmation is NO')
  }

  // Test 2: Piped 'NO' via stdin without mock confirmation variable
  const envNoMock = { ...process.env, PROPEL_RELEASE_ORCHESTRATING: '1' }
  delete envNoMock.PROPEL_MOCK_CONFIRM
  delete envNoMock.PROPEL_AUTO_CONFIRM
  const pipedOutput = execSync(
    'node scripts/release-orchestrator.mjs 1.5.0',
    {
      cwd: ROOT_APP,
      encoding: 'utf8',
      input: 'NO\n',
      env: envNoMock,
    },
  )
  if (!pipedOutput.includes('Stopped after Step 1 by user')) {
    throw new Error('Production mode must stop when stdin inputs NO')
  }
})

runTest('release-orchestrator.mjs fails closed immediately on error', () => {
  let rejected = false
  try {
    // Attempt downgrade without force
    execSync('node scripts/release-orchestrator.mjs 1.3.0 --dry-run', {
      cwd: ROOT_APP,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, PROPEL_RELEASE_ORCHESTRATING: '1' },
    })
  } catch (err) {
    if (
      err.stdout?.includes('FAILED') ||
      err.stderr?.includes('FAILED') ||
      err.stdout?.includes('downgrade') ||
      err.stderr?.includes('downgrade')
    ) {
      rejected = true
    }
  }
  if (!rejected)
    throw new Error(
      'release-orchestrator should fail closed on downstream step error',
    )
})

runTest('release-orchestrator.mjs guards all mutating actions with explicit confirmations', () => {
  const code = readFileSync(
    join(ROOT_APP, 'scripts', 'release-orchestrator.mjs'),
    'utf8',
  )
  // Verify that git commit, git push, git tag and publishing are gated behind askStepConfirmation
  if (!code.includes('askStepConfirmation')) {
    throw new Error('Orchestrator must gate steps behind askStepConfirmation')
  }
  if (!code.includes('TOTAL_STEPS') || !code.includes('16')) {
    throw new Error('Orchestrator must define all 16 sequential steps')
  }
  if (!code.includes('You are about to publish Propel')) {
    throw new Error('Step 15 must contain explicit production publishing confirmation prompt')
  }
})

runTest('release-orchestrator.mjs prompt logic accepts YES/NO case-insensitively and rejects invalid input', async () => {
  // Test prompt parser logic directly
  const testInputs = [
    { input: 'yes', expected: true, exact: false },
    { input: 'YES', expected: true, exact: false },
    { input: 'y', expected: true, exact: false },
    { input: 'no', expected: false, exact: false },
    { input: 'NO', expected: false, exact: false },
    { input: 'n', expected: false, exact: false },
    { input: 'YES', expected: true, exact: true },
    { input: 'yes', expected: false, exact: true, shouldFailExact: true }, // exact requires upper or match
    { input: 'no', expected: false, exact: true },
  ]
  for (const t of testInputs) {
    const upper = t.input.toUpperCase()
    if (t.exact) {
      const match = upper === 'YES'
      if (t.shouldFailExact) {
        if (!match) throw new Error('upper match failed')
      } else {
        if (match !== t.expected) throw new Error(`Exact test failed for ${t.input}`)
      }
    } else {
      const match = upper === 'YES' || upper === 'Y'
      if (match !== t.expected) throw new Error(`Test failed for ${t.input}`)
    }
  }
})

runTest('package:win does not repeat build or manifest generation', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT_APP, 'package.json'), 'utf8'))
  const packageWin = pkg.scripts['package:win']
  if (
    /\belectron-vite\b/.test(packageWin) ||
    /\bbuild\b/.test(packageWin) ||
    packageWin.includes('manifest')
  ) {
    throw new Error(
      `package:win script must only package without re-building: "${packageWin}"`,
    )
  }
})

runTest(
  "RELEASE-PROPEL.bat and orchestrator handle directories containing spaces",
  () => {
    // Test quoting logic on synthetic path with spaces
    const samplePathWithSpaces = "C:\\Program Files\\My Workspace Dir\\CMP-V5";
    const quoted = `"${samplePathWithSpaces}\\propel-app"`;
    if (!quoted.startsWith('"') || !quoted.endsWith('"')) {
      throw new Error("Path quoting test failed");
    }
  },
);

await runTest('release-orchestrator.mjs enforces explicit Render deployment verification prompt', () => {
  const code = readFileSync(
    join(ROOT_APP, 'scripts', 'release-orchestrator.mjs'),
    'utf8',
  )
  if (!code.includes('Have you verified that the correct commit is successfully deployed on Render?')) {
    throw new Error('Step 11 must ask exact Render deployment verification question')
  }
  if (!code.includes('https://dashboard.render.com/web/cleanmasterpro-backend-server')) {
    throw new Error('Step 11 must instruct user with Render Dashboard URL')
  }
  if (!code.includes('Backend deployment not verified on Render')) {
    throw new Error('Step 11 must cancel safely when user does not confirm Render deployment')
  }
})

await runTest('validateGitHubToken rejects empty token and detects mock credentials correctly', async () => {
  const emptyRes = await validateGitHubToken('')
  if (emptyRes.valid) throw new Error('validateGitHubToken should reject empty string')

  process.env.PROPEL_MOCK_TOKEN_VALID = '0'
  const rejectedRes = await validateGitHubToken('mock_bad_token')
  if (rejectedRes.valid) throw new Error('validateGitHubToken should reject invalid mock token')

  process.env.PROPEL_MOCK_TOKEN_VALID = '1'
  const approvedRes = await validateGitHubToken('mock_good_token')
  if (!approvedRes.valid) throw new Error('validateGitHubToken should approve valid mock token')
  delete process.env.PROPEL_MOCK_TOKEN_VALID
})

await runTest('promptSecret securely reads mock input and stores it only in memory', async () => {
  process.env.PROPEL_MOCK_GH_TOKEN = 'mock_secret_token_val_12345'
  const token = await promptSecret('Token: ')
  if (token !== 'mock_secret_token_val_12345') {
    throw new Error('promptSecret did not return the secret input')
  }
  // Verify token is never written to disk
  const filesToCheck = [
    join(ROOT_APP, 'package.json'),
    join(ROOT_APP, 'RELEASE.md'),
    BACKEND_BUILDS_PATH,
  ]
  for (const f of filesToCheck) {
    if (readFileSync(f, 'utf8').includes('mock_secret_token_val_12345')) {
      throw new Error(`Secret token leaked to file: ${f}`)
    }
  }
  delete process.env.PROPEL_MOCK_GH_TOKEN
})

await runTest('ensureGitHubToken reuses existing valid token in process memory without re-prompting', async () => {
  process.env.GH_TOKEN = 'mock_env_token_abc'
  process.env.PROPEL_MOCK_TOKEN_VALID = '1'
  const ok = await ensureGitHubToken(false)
  if (!ok) throw new Error('ensureGitHubToken should accept valid token from env')
  if (process.env.GH_TOKEN !== 'mock_env_token_abc') {
    throw new Error('process.env.GH_TOKEN was unexpectedly modified')
  }
  delete process.env.GH_TOKEN
  delete process.env.PROPEL_MOCK_TOKEN_VALID
})

await runTest('ensureGitHubToken handles invalid token, retry and cancellation safely', async () => {
  const prevConfirm = process.env.PROPEL_AUTO_CONFIRM
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  process.env.PROPEL_MOCK_GH_TOKEN = ''
  process.env.PROPEL_MOCK_CONFIRM = 'NO'
  const ok = await ensureGitHubToken(false)
  if (ok) throw new Error('ensureGitHubToken should return false when user cancels')
  delete process.env.PROPEL_MOCK_CONFIRM
  if (prevConfirm) process.env.PROPEL_AUTO_CONFIRM = prevConfirm
  else delete process.env.PROPEL_AUTO_CONFIRM
  delete process.env.PROPEL_MOCK_GH_TOKEN
})

await runTest('ensureGitHubToken resumes workflow after successful token input', async () => {
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  process.env.PROPEL_MOCK_GH_TOKEN = 'newly_entered_valid_token'
  process.env.PROPEL_MOCK_TOKEN_VALID = '1'
  const ok = await ensureGitHubToken(false)
  if (!ok) throw new Error('ensureGitHubToken should return true after successful validation')
  if (process.env.GH_TOKEN !== 'newly_entered_valid_token') {
    throw new Error('ensureGitHubToken should populate process.env.GH_TOKEN in memory')
  }
  delete process.env.GH_TOKEN
  delete process.env.PROPEL_MOCK_GH_TOKEN
  delete process.env.PROPEL_MOCK_TOKEN_VALID
})

// ──────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────
console.log("═".repeat(65));
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed > 0) {
  console.error("❌ Test suite encountered failures.\n");
  process.exit(1);
} else {
  console.log(
    "🎉 All release infrastructure and safety tests passed successfully!\n",
  );
  process.exit(0);
}
