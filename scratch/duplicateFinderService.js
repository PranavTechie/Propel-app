var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var duplicateFinderService_exports = {};
__export(duplicateFinderService_exports, {
  deleteSelectedDuplicates: () => deleteSelectedDuplicates,
  getLastScanResult: () => getLastScanResult,
  scanForDuplicates: () => scanForDuplicates,
  setLastScanResultForTesting: () => setLastScanResultForTesting
});
module.exports = __toCommonJS(duplicateFinderService_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_crypto = __toESM(require("crypto"));
var import_os = __toESM(require("os"));
var import_electron = require("electron");
let lastScanResult = null;
function getLastScanResult() {
  return lastScanResult;
}
function setLastScanResultForTesting(result) {
  lastScanResult = result;
}
const CATEGORY_EXTS = {
  images: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".heic", ".svg", ".ico"],
  videos: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"],
  documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", ".csv"],
  archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".cab"],
  installers: [".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".iso"],
  other: []
};
function getCategory(ext) {
  const lower = ext.toLowerCase();
  for (const [cat, exts] of Object.entries(CATEGORY_EXTS)) {
    if (cat !== "other" && exts.includes(lower)) return cat;
  }
  return "other";
}
const ALL_EXTS = /* @__PURE__ */ new Set([
  ...CATEGORY_EXTS.images,
  ...CATEGORY_EXTS.videos,
  ...CATEGORY_EXTS.documents,
  ...CATEGORY_EXTS.archives,
  ...CATEGORY_EXTS.installers
]);
function getDefaultScanRoots() {
  const home = import_os.default.homedir();
  const candidates = [
    import_path.default.join(home, "Documents"),
    import_path.default.join(home, "Pictures"),
    import_path.default.join(home, "Videos"),
    import_path.default.join(home, "Music"),
    import_path.default.join(home, "Downloads"),
    import_path.default.join(home, "Desktop")
  ];
  return candidates.filter((d) => import_fs.default.existsSync(d));
}
const PROTECTED_PATHS = [
  "windows",
  "program files",
  "programdata",
  "system32",
  "syswow64",
  "$recycle.bin",
  "appdata\\local\\temp"
];
function isProtected(filePath) {
  const lower = filePath.toLowerCase();
  return PROTECTED_PATHS.some((p) => lower.includes(p));
}
async function collectFiles(roots, excludedPaths, onProgress) {
  const results = [];
  const excluded = excludedPaths.map((p) => p.toLowerCase());
  async function walk(dir) {
    if (isProtected(dir)) return;
    if (excluded.some((ex) => dir.toLowerCase().startsWith(ex))) return;
    let entries;
    try {
      entries = await import_fs.default.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = import_path.default.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isProtected(full)) await walk(full);
      } else if (entry.isFile()) {
        const ext = import_path.default.extname(entry.name).toLowerCase();
        if (ALL_EXTS.has(ext)) {
          try {
            const { size } = await import_fs.default.promises.stat(full);
            if (size > 1024) {
              results.push({ path: full, size, ext });
              if (results.length % 100 === 0) onProgress(results.length, full);
            }
          } catch {
          }
        }
      }
    }
  }
  for (const root of roots) {
    await walk(root);
  }
  return results;
}
async function quickHash(filePath, size) {
  let fd = null;
  try {
    const CHUNK = 65536;
    fd = await import_fs.default.promises.open(filePath, "r");
    const buf = Buffer.alloc(Math.min(CHUNK, size));
    await fd.read(buf, 0, buf.length, 0);
    const hash = import_crypto.default.createHash("md5");
    hash.update(buf);
    hash.update(`:size:${size}`);
    return hash.digest("hex");
  } catch {
    return `error_${Math.random()}`;
  } finally {
    if (fd) await fd.close().catch(() => {
    });
  }
}
async function fullHash(filePath) {
  return new Promise((resolve) => {
    const hash = import_crypto.default.createHash("md5");
    const stream = import_fs.default.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", () => resolve(`error_${Math.random()}`));
  });
}
async function scanForDuplicates(scanRoots, excludedPaths, onProgress) {
  const startTime = Date.now();
  const roots = scanRoots ?? getDefaultScanRoots();
  onProgress({ phase: "scanning", scannedFiles: 0, hashedFiles: 0, totalFiles: 0, currentPath: "", duplicatesFound: 0 });
  let collectedCount = 0;
  const files = await collectFiles(roots, excludedPaths, (count, currentPath) => {
    collectedCount = count;
    onProgress({ phase: "scanning", scannedFiles: count, hashedFiles: 0, totalFiles: count, currentPath, duplicatesFound: 0 });
  });
  const totalFiles = files.length;
  onProgress({ phase: "hashing", scannedFiles: totalFiles, hashedFiles: 0, totalFiles, currentPath: "", duplicatesFound: 0 });
  const sizeGroups = /* @__PURE__ */ new Map();
  for (const f of files) {
    const group = sizeGroups.get(f.size) ?? [];
    group.push(f);
    sizeGroups.set(f.size, group);
  }
  const candidates = [...sizeGroups.values()].filter((g) => g.length > 1).flat();
  const quickHashGroups = /* @__PURE__ */ new Map();
  let hashedCount = 0;
  for (const f of candidates) {
    const qh = await quickHash(f.path, f.size);
    const group = quickHashGroups.get(qh) ?? [];
    group.push(f);
    quickHashGroups.set(qh, group);
    hashedCount++;
    if (hashedCount % 20 === 0) {
      onProgress({ phase: "hashing", scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: f.path, duplicatesFound: 0 });
    }
  }
  onProgress({ phase: "grouping", scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: "", duplicatesFound: 0 });
  const finalGroups = /* @__PURE__ */ new Map();
  for (const [, group] of quickHashGroups) {
    if (group.length < 2) continue;
    for (const f of group) {
      const fh = await fullHash(f.path);
      const fg = finalGroups.get(fh) ?? [];
      fg.push(f);
      finalGroups.set(fh, fg);
    }
  }
  const duplicateGroups = [];
  let totalDuplicates = 0;
  let totalWastedBytes = 0;
  let scannedBytes = 0;
  for (const [hash, group] of finalGroups) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.path.length - b.path.length);
    const size = group[0].size;
    const wasted = size * (group.length - 1);
    totalWastedBytes += wasted;
    totalDuplicates += group.length - 1;
    scannedBytes += size * group.length;
    const duplicateFiles = group.map((f, i) => ({
      path: f.path,
      size: f.size,
      name: import_path.default.basename(f.path),
      extension: f.ext,
      isOriginal: i === 0
    }));
    duplicateGroups.push({
      hash,
      size,
      count: group.length,
      totalWasted: wasted,
      files: duplicateFiles,
      category: getCategory(group[0].ext)
    });
  }
  duplicateGroups.sort((a, b) => b.totalWasted - a.totalWasted);
  onProgress({ phase: "done", scannedFiles: totalFiles, hashedFiles: hashedCount, totalFiles, currentPath: "", duplicatesFound: totalDuplicates });
  const scanResult = {
    groups: duplicateGroups,
    totalFiles,
    totalDuplicates,
    totalWastedBytes,
    scannedBytes,
    scannedFiles: totalFiles,
    durationMs: Date.now() - startTime,
    scannedAt: Date.now()
  };
  lastScanResult = scanResult;
  return scanResult;
}
async function deleteSelectedDuplicates(filePaths) {
  let deletedCount = 0;
  let freedBytes = 0;
  let errors = 0;
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { deletedCount: 0, freedBytes: 0, errors: 0 };
  }
  if (!lastScanResult || !lastScanResult.groups || lastScanResult.groups.length === 0) {
    return { deletedCount: 0, freedBytes: 0, errors: filePaths.length };
  }
  const requestedNormSet = new Set(
    filePaths.map((p) => import_path.default.normalize(p).toLowerCase())
  );
  const approvedToDelete = [];
  const processedInScan = /* @__PURE__ */ new Set();
  for (const group of lastScanResult.groups) {
    const requestedInGroup = [];
    const notRequestedInGroup = [];
    for (const file of group.files) {
      const norm = import_path.default.normalize(file.path).toLowerCase();
      if (requestedNormSet.has(norm)) {
        requestedInGroup.push(file);
        processedInScan.add(norm);
      } else {
        notRequestedInGroup.push(file);
      }
    }
    if (requestedInGroup.length === 0) continue;
    if (notRequestedInGroup.length === 0) {
      const originalIdx = requestedInGroup.findIndex((f) => f.isOriginal);
      const preserveIdx = originalIdx >= 0 ? originalIdx : 0;
      requestedInGroup.splice(preserveIdx, 1);
      errors++;
    }
    for (const f of requestedInGroup) {
      approvedToDelete.push(f.path);
    }
  }
  for (const p of filePaths) {
    const norm = import_path.default.normalize(p).toLowerCase();
    if (!processedInScan.has(norm)) {
      errors++;
    }
  }
  const successfullyTrashed = /* @__PURE__ */ new Set();
  for (const filePath of approvedToDelete) {
    if (isProtected(filePath)) {
      errors++;
      continue;
    }
    try {
      let stat;
      try {
        stat = await import_fs.default.promises.stat(filePath);
      } catch {
        errors++;
        continue;
      }
      await import_electron.shell.trashItem(filePath);
      freedBytes += stat.size;
      deletedCount++;
      successfullyTrashed.add(import_path.default.normalize(filePath).toLowerCase());
    } catch {
      errors++;
    }
  }
  if (successfullyTrashed.size > 0 && lastScanResult) {
    for (const group of lastScanResult.groups) {
      group.files = group.files.filter(
        (f) => !successfullyTrashed.has(import_path.default.normalize(f.path).toLowerCase())
      );
    }
    lastScanResult.groups = lastScanResult.groups.filter((g) => g.files.length > 1);
  }
  return { deletedCount, freedBytes, errors };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deleteSelectedDuplicates,
  getLastScanResult,
  scanForDuplicates,
  setLastScanResultForTesting
});
