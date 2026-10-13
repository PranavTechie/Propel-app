# Propel Release Workflow & Operations Guide

> **Important Safety Notice**: This document outlines the official release procedure for Propel.  
> Do not execute publishing or deployment commands without explicit authorization.

---

## 1. Architecture Overview

### Dynamic Website Release Resolution
`propel-website` dynamically resolves the latest published release using client-side GitHub Releases API queries (`app/hooks/use-github-release.ts`):
- Repository: `pranavop45/propel-releases`
- Asset matching: `^Propel-Setup-.*\.exe$`
- Cache lifetime: 5 minutes (`300_000 ms`) with `localStorage` fallback.

**Key Rule**: The website **does not need manual version updates or redeployment** when a new desktop version is released. As soon as a release is published on GitHub, the production website at `cleanmasterpro.in` automatically resolves and delivers the new installer asset.

### Integrity Manifest & Backend Attestation
Propel desktop employs ASAR anti-tamper verification and cryptographic build attestation:
1. `out/main/index.js`, `out/preload/index.js`, and `out/renderer/assets/*.js` are SHA-256 hashed.
2. The manifest is signed via HMAC (`electron/security/integrity-manifest.json`).
3. A deterministic `buildSignature` is computed from the version, manifest hash, and entry bundle hashes.
4. The backend (`propel-backend/services/official-builds.json`) validates this `buildSignature` during license and integrity attestation.
5. **Strict Build Ordering is Required**: Packaging must use the **exact compiled build** that was hashed and registered. Rebuilding after registration creates an unrecorded build signature, causing license verification failures on user machines.

---

## 2. Sequential Interactive Windows Release Workflow

Propel features a production-safe, sequential, step-by-step interactive release orchestrator:
- **`RELEASE-PROPEL.bat`** at the `CMP-V5` workspace root.
- **`release-orchestrator.mjs`** inside `propel-app/scripts/`.

### How to Execute the Release Workflow

#### Option A: Double-Click (GUI Interactive)
1. Double-click `RELEASE-PROPEL.bat` in Windows Explorer.
2. Enter the target release version when prompted:
   ```text
   Enter the target release version (e.g. 1.5.0):
   Target Version: 1.5.0
   ```
3. The orchestrator executes all 16 release steps sequentially in the same window.
4. After every step:
   - Displays `[SUCCESS]` or `[FAILED]`.
   - Shows a summary of results.
   - On success, prompts:
     ```text
     Step completed successfully.
     Continue to the next step?

     [YES] Continue
     [NO] Stop safely
     ```
   - Enter `YES` (or `Y`, case-insensitive) to proceed to the next step.
   - Enter `NO` (or `N`, case-insensitive) to stop safely without executing subsequent steps.
   - Rejects empty or invalid inputs and asks again.
   - On step failure, halts immediately (fail-closed); never asks to continue after a failure.

#### Option B: Terminal Command
```cmd
# From the workspace root:
RELEASE-PROPEL.bat 1.5.0

# Non-mutating dry-run simulation (simulates all 16 steps without modifying files, building, or publishing):
RELEASE-PROPEL.bat 1.5.0 --dry-run
```

#### Option C: npm Script
```bash
cd propel-app

# Interactive release workflow:
npm run release:orchestrate -- 1.5.0

# Non-mutating dry-run simulation:
npm run release:orchestrate -- 1.5.0 --dry-run
```

### The 16 Sequential Steps
1. **Pre-release inspection**: Validates Node.js (18+), Git and npm in PATH, inspects branches/remotes/status across all 3 repositories, verifies historical signatures (`1.2` through `1.4.0`), and runs automated safety tests (`test-release-infrastructure.mjs`).
2. **Release dry-run**: Pre-validates version synchronization in memory for the target version and confirms 0 files were modified on disk.
3. **Apply release version**: Atomically synchronizes the 10 desktop application files to the target release version and verifies version references.
4. **Build application**: Compiles application bundles (`out/`) exactly once via `npm run build` (`electron-vite build`).
5. **Generate & verify integrity manifest**: Hashes compiled bundles and computes signed HMAC manifest (`integrity-manifest.json`), then verifies on-disk hashes.
6. **Register backend build signature**: Appends deterministic build signature to `propel-backend/services/official-builds.json` under both display and full semver keys, and verifies historical records remain unchanged.
7. **Package Windows installer**: Packages existing build output into `release/Propel-Setup-<version>.exe` without recompiling (`npm run package:win`).
8. **Verify installer**: Performs strict timestamp verification, compares `latest.yml` version and SHA-512 against the binary, and verifies packaged ASAR internal manifest against the registered signature.
9. **Review Git changes**: Inspects explicit intended file lists for backend and desktop commits without wildcards (`git add .`), warning against untracked or unrelated files.
10. **Commit backend registry**: Stages only `services/official-builds.json`, displays staged diff, prompts for confirmation, and creates the backend release commit.
11. **Push backend & verify deployment**: Pushes `propel-backend` to `origin/main` and queries the live Render endpoint (`https://cleanmasterpro-backend-server.onrender.com/`).
12. **Commit desktop release**: Stages only approved desktop release files, displays staged diff, prompts for confirmation, and creates the desktop release commit.
13. **Create & push tag**: Checks tag existence, prompts for confirmation, creates annotated tag `v<version>`, verifies it points to HEAD commit, and pushes tag & `main`.
14. **Publishing dry-run**: Runs guarded `release-publish.mjs --dry-run` to ensure all installer hashes, ASAR signatures, and metadata match without uploading anything.
15. **Publish GitHub Release**: Checks `GH_TOKEN`, requires explicit final confirmation (`Type YES to publish or NO to stop.`), and executes guarded publication to `pranavop45/propel-releases`.
16. **Final verification**: Queries GitHub Releases API for tag and asset presence, checks website download resolver configuration, and displays final release summary.

---

## 3. Manual Release Command Sequence (Step-by-Step Alternative)

If you prefer to execute individual phases manually or inspect steps interactively:

### Phase 1: Pre-Release Validation & Version Synchronization
Synchronize desktop application version references across all internal files atomically.

```bash
cd propel-app

# 1. Pre-validate in dry-run mode (read-only, modifies no files)
npm run release:prepare -- 1.5.0 --dry-run

# 2. Atomically update desktop version references
npm run release:prepare -- 1.5.0

# 3. Verify complete workspace version synchronization (read-only)
npm run release:verify

# 4. Run automated release infrastructure test suite
npm run test:release
```

---

### Phase 2: Application Compilation & Integrity Manifest Generation
Compile the application bundles and generate the integrity manifest from that exact output.

```bash
# 1. Compile Electron main, preload, and renderer bundles
npm run build

# 2. Generate cryptographic integrity manifest from the compiled out/ directory
npm run generate:manifest

# 3. Verify all files on disk match the newly generated manifest
npm run verify:integrity
```

---

### Phase 3: Official Build Signature Registration
Calculate the deterministic build signature and register it with the backend.

```bash
# 1. Register build signature into propel-backend/services/official-builds.json
npm run release:register

# 2. Verify that manifest, files on disk, and backend registry are 100% synchronized
npm run verify:build-signature
```

---

### Phase 4: Package-Only Installer Creation
Package the **existing** build output without rebuilding or re-generating manifests.

```bash
# Package existing build into Windows NSIS installer
npm run package:win
```

> ⚠️ **CRITICAL**: Do NOT run `npm run build:win` during a release!  
> `build:win` re-triggers `electron-vite build` and `generate:manifest`, which re-hashes newly generated bundles and invalidates the backend signature registered in Phase 3.  
> Use `npm run package:win` exclusively, which runs `electron-builder --win` on the existing build artifacts.

After packaging, run:
```bash
# Verify installer output presence and size
npm run verify:build-signature
```

---

### Phase 5: Backend Deployment (Prerequisite to Release)
The backend registry containing the new build signature **must be deployed before the installer is distributed to users**.

```bash
cd ../propel-backend

# Ensure git status is clean and official-builds.json contains the new version
git status

# Deploy backend to production (e.g. Render)
# (Follow standard backend deployment protocol)
```

---

### Phase 6: Guarded GitHub Release Publishing
Publish the installer and updater metadata using the guarded publication script.

```bash
cd propel-app

# 1. First validate in dry-run mode (read-only verification of all release artifacts)
npm run release:publish -- --dry-run

# 2. Tag git commit
git tag v1.5.0
git push origin v1.5.0

# 3. Publish to GitHub Releases (requires GH_TOKEN, validates all artifacts before uploading)
npm run release:publish
```

> 🛡️ **Guarded Publishing Protection**:  
> `npm run release:publish` enforces strict pre-flight validation on the immutable artifacts:
> - Verifies that the installer `Propel-Setup-1.5.0.exe` exists and is newer than the manifest (stale installer rejection).
> - Verifies that `latest.yml` version and SHA-512 match the installer binary byte-for-byte.
> - Verifies that the packaged ASAR internal manifest matches the registered build signature.
> - Verifies that the build signature is registered in `official-builds.json`.
> - Fails closed on any missing file, mismatch, stale artifact, or missing `GH_TOKEN`.
> - Operates on existing build output — never recompiles or regenerates manifests during publishing.

---

### Phase 7: Website Automatic Release Detection
- **Action Required**: None.
- Within 5 minutes (or immediately in private browsing), `https://cleanmasterpro.in/downloads` and `https://cleanmasterpro.in` detect the new published GitHub release via the GitHub API.
- Download buttons automatically point to `Propel-Setup-1.5.0.exe`.

---

### Phase 8: Auto-Update & Post-Release Verification
Verify that existing desktop installations detect and process the new update:
1. Launch an installed instance of Propel (e.g., version 1.4.0).
2. Open Settings -> About (or wait for the periodic check).
3. Confirm the update prompt displays version 1.5.0.
4. Verify update download and hash validation.

---

## 4. Command Safety Matrix

| Command | Type | Idempotent / Re-run Safe | Description |
| :--- | :--- | :--- | :--- |
| `RELEASE-PROPEL.bat [ver] [--dry-run]` | Orchestrated | ⚠️ Runs full sequence safely | One-click release preparation batch file at workspace root. Executes 10 phases and pauses for review. |
| `npm run release:orchestrate -- <ver> [--dry-run]` | Orchestrated | ⚠️ Runs full sequence safely | Node orchestrator equivalent of the batch workflow. |
| `npm run release:prepare -- <ver> --dry-run` | Read-only | ✅ Safe to rerun anytime | Validates target semver and tests file transforms without writing. |
| `npm run release:prepare -- <ver>` | Mutating | ⚠️ Run once per release | Synchronizes version across 10 desktop application files. Refuses downgrades without `--force`. |
| `npm run release:verify` | Read-only | ✅ Safe to rerun anytime | Verifies all 14 version, website hook, and historical record assertions. |
| `npm run test:release` | Read-only | ✅ Safe to rerun anytime | Runs automated unit tests covering semver, safety checks, tamper protection, and publishing guards. |
| `npm run build` | Mutating | ✅ Safe to rerun | Compiles Electron main, preload, and renderer bundles to `out/`. |
| `npm run generate:manifest` | Mutating | ✅ Safe to rerun | Hashes `out/` bundles into `integrity-manifest.json`. |
| `npm run verify:integrity` | Read-only | ✅ Safe to rerun anytime | Re-hashes files on disk against `integrity-manifest.json`. |
| `npm run release:register` | Mutating | ⚠️ Safe duplicate, blocks mismatch | Strictly verifies `out/` against manifest, then registers signatures in `official-builds.json`. Safe if identical; strictly refuses if signature conflicts. |
| `npm run verify:build-signature` | Read-only | ✅ Safe to rerun anytime | Confirms manifest, disk files, backend registry, installer, and ASAR are aligned. |
| `npm run package:win` | Mutating | ✅ Safe to rerun | Packages existing `out/` and manifest into `Propel-Setup-*.exe` without re-compiling. |
| `npm run release:publish -- --dry-run` | Read-only | ✅ Safe to rerun anytime | Pre-validates all release artifacts, manifests, signatures, and updater descriptors without uploading. |
| `npm run release:publish` | Mutating | ⚠️ Final step | Guarded publication: fails closed if any artifact, manifest, or signature mismatch is detected; requires `GH_TOKEN`. |

---

## 5. Protected Historical Signatures

The following historical production releases are permanently protected by `assertLegacyBackendRecords()` in `scripts/release-safety.mjs`. Any modification or deletion of these entries causes release tooling to abort immediately:

- **1.2 / 1.2.0**: `c415d07d65b9b979b258b2c6477c549330b6a0718c8e681655b9fb727feb6e94`
- **1.3 / 1.3.0**: `b6ca1360f144f39c907d083877fcc677c7afa2a6f8b3c581943a413e89e64bac`
- **1.4 / 1.4.0**: `3c77454dd31cfa0b8e9091f87aeabfd18db09df7220129a29aaafa209e7dcfc8`

---

## 6. Current Workspace State & Prerequisites for Future Release

- **Current Version**: Propel is currently at version **1.4.0** (1.4).
- **Working-Tree Integrity Note**: The local `integrity-manifest.json` on disk currently reflects modified development files (`0827c833...`) which differ from the historical 1.4 production build (`3c77454d...`).
- **Prerequisite for 1.5.0**: When authorized to publish version 1.5.0, do NOT reuse existing installer binaries. Follow the sequence starting from Phase 1 (`release:prepare -- 1.5.0`) through Phase 4 (`package:win`) so that a fresh, synchronized build is generated and packaged.
