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

## 2. Release Command Sequence (Step-by-Step)

Follow this exact sequence for future releases (e.g., `1.5.0`):

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

## 3. Command Safety Matrix

| Command | Type | Idempotent / Re-run Safe | Description |
| :--- | :--- | :--- | :--- |
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

## 4. Protected Historical Signatures

The following historical production releases are permanently protected by `assertLegacyBackendRecords()` in `scripts/release-safety.mjs`. Any modification or deletion of these entries causes release tooling to abort immediately:

- **1.2 / 1.2.0**: `c415d07d65b9b979b258b2c6477c549330b6a0718c8e681655b9fb727feb6e94`
- **1.3 / 1.3.0**: `b6ca1360f144f39c907d083877fcc677c7afa2a6f8b3c581943a413e89e64bac`
- **1.4 / 1.4.0**: `3c77454dd31cfa0b8e9091f87aeabfd18db09df7220129a29aaafa209e7dcfc8`

---

## 5. Current Workspace State & Prerequisites for Future Release

- **Current Version**: Propel is currently at version **1.4.0** (1.4).
- **Working-Tree Integrity Note**: The local `integrity-manifest.json` on disk currently reflects modified development files (`0827c833...`) which differ from the historical 1.4 production build (`3c77454d...`).
- **Prerequisite for 1.5.0**: When authorized to publish version 1.5.0, do NOT reuse existing installer binaries. Follow the sequence starting from Phase 1 (`release:prepare -- 1.5.0`) through Phase 4 (`package:win`) so that a fresh, synchronized build is generated and packaged.
