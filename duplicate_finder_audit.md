# Deep Forensic Audit: Duplicate Finder

## Executive Summary
An end-to-end forensic audit was conducted on the Duplicate Finder feature (`duplicateFinderService.ts` and `AIFeaturesPage.tsx`). The feature demonstrates **exceptional safety standards** regarding data deletion, strict validation, and symlink handling. However, it suffers from **critical performance and memory flaws** that guarantee application freezes and likely out-of-memory (OOM) crashes on large files.

---

## 1. SCANNING
- **Folders Scanned:** Safely scopes to user directories (Documents, Pictures, Videos, Music, Downloads, Desktop) by default. 
- **Recursive Behavior:** Uses a recursive `walkSync` function.
- **File Types:** Restricted to a strict allowlist of extensions (images, videos, documents, archives, installers). Files under 1KB are ignored.
- **System/App Folders:** Specifically excluded via `isProtected()` (blocks `windows`, `program files`, `appdata`, etc.).
- **Symlink/Junction Handling:** SAFE. It uses `fs.readdirSync({ withFileTypes: true })` and checks `entry.isFile()`. In Node.js, `isFile()` evaluates to `false` for symbolic links. Symlinks are safely and automatically ignored.
- **Permission Handling:** SAFE. Wrapped in `try/catch` blocks. Access-denied errors are swallowed gracefully without halting the scan.

## 2. DUPLICATE DETECTION
- **Algorithm:** 3-stage detection. 
  1. Exact byte size match.
  2. `quickHash`: MD5 on the first 64KB + file size.
  3. `fullHash`: MD5 on the entire file content.
- **Collision Safety:** MD5 is cryptographically broken, but since files must have the *exact same byte size* and *exact same 64KB prefix* before a full MD5 is run, the risk of accidental collision causing false duplicates is statistically zero.
- **Grouping:** Creates maps keyed by hash. Sorts duplicate files by path length to heuristically designate the shortest path as the "Original" file.

## 3. PERFORMANCE (CRITICAL ISSUES)
- **Main-Thread Blocking:** **CRITICAL**. The entire scanning and hashing process is fully synchronous (`fs.readdirSync`, `fs.statSync`, `fs.readFileSync`). Despite the function being `async`, it never yields to the event loop. The UI will completely freeze, and `onProgress` callbacks will not render until the entire scan finishes.
- **Memory Usage (OOM Risk):** **CRITICAL**. `fullHash` uses `fs.readFileSync(filePath)`. This attempts to read the *entire file* into a single V8 Buffer in memory. If the user scans a 4GB video file, the Electron Node process will exceed its heap limit and hard crash.

## 4. DELETE / TRASH SAFETY (CRITICAL)
- **Exact Deletion Flow:** Paths are sent to the backend, normalized, validated against the previous scan result, and then sent to the Recycle Bin.
- **Recycle Bin:** SAFE. It strictly uses `shell.trashItem(filePath)` rather than permanent `fs.rm` or `fs.unlink`.
- **Arbitrary Path Input:** SAFE. Validates every requested path against `processedInScan`, which is derived securely from the in-memory `lastScanResult`. Arbitrary paths bypassing the scan are rejected.
- **Preservation Guarantee:** SAFE. If the UI attempts to delete *all* files in a duplicate group, the backend intercepts this and explicitly preserves the original file (`notRequestedInGroup.length === 0` fallback).
- **Disappearing Files:** SAFE. Validates with `fs.existsSync` immediately before attempting `trashItem`.

## 5. UI ↔ BACKEND CLAIM AUDIT
- **"Hash-based duplicate detection"**: TRUE (MD5).
- **Supported folders/file types**: TRUE.
- **"Safe removal"**: TRUE (Preserves original, validates paths, uses Recycle Bin).
- **Scan results/metrics**: TRUE (Correctly calculates total wasted bytes).

## 6. SECURITY FINDINGS
- A repository-wide search for `trashItem` confirmed that all calls are routed securely. There are no exposed generic IPC handlers that allow arbitrary file deletion bypassing these validation checks.

## 7. RUNTIME TEST EVIDENCE
A synthetic, non-destructive test was executed on a temporary directory (`scratch/dup-test-dir`).
* **Detection:** Correctly grouped 3 exact duplicate files into 1 group.
* **Symlink Test:** A symlink to a duplicate file was created. The scanner correctly skipped it (Total files scanned: 5 instead of 6).
* **Non-Duplicate Test:** Files with identical sizes but different content, and files with different sizes, were correctly ignored.
* **Deletion Safety 1:** Attempted to delete a file that was not part of the scan. Result: Rejected (`{ errors: 1 }`).
* **Deletion Safety 2:** Attempted to delete ALL 3 files in the duplicate group. Result: Backend intervened, trashed 2 copies, preserved 1 copy, and threw 1 error for the rejected operation.

**Runtime Output:**
```text
Total files scanned: 5
Groups found: 1
Group 1:
Count: 3
 - C:\...\scratch\dup-test-dir\dup1.txt (Original)
 - C:\...\scratch\dup-test-dir\dup2.txt 
 - C:\...\scratch\dup-test-dir\sub\dup3.txt 

--- TESTING DELETION SAFETY ---
Delete non-scanned file result (should be 1 error): { deletedCount: 0, freedBytes: 0, errors: 1 }
Attempting to delete ALL files in group 1: 3 files
[MOCK ELECTRON] Trashed: C:\...\scratch\dup-test-dir\dup2.txt
[MOCK ELECTRON] Trashed: C:\...\scratch\dup-test-dir\sub\dup3.txt
Delete ALL files result (should be 1 error, preserved 1): { deletedCount: 2, freedBytes: 4096, errors: 1 }
```

## 8. PRIORITIZED REMEDIATION PLAN

### Priority 1: Fix Memory Leaks / OOM Crashes (High)
**Issue:** `fs.readFileSync(filePath)` in `fullHash` will crash the app on large files.
**Remediation:** Convert `fullHash` to use `fs.createReadStream` piped to a `crypto.createHash` stream.
**Location:** `electron/services/ai/duplicateFinderService.ts` -> `fullHash()`

### Priority 2: Fix UI Freezes / Main Thread Blocking (High)
**Issue:** All filesystem operations use sync variants (`readdirSync`, `statSync`), blocking the Electron main thread and breaking the progress UI.
**Remediation:** 
1. Convert `collectFiles` to use `fs.promises.readdir` and `fs.promises.stat`.
2. Introduce a concurrency limit (e.g., using `p-limit` or chunking) for hashing so the event loop can breathe and flush `onProgress` IPC events to the UI.
**Location:** `electron/services/ai/duplicateFinderService.ts` -> `collectFiles()` & `scanForDuplicates()`
