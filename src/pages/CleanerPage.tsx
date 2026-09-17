import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Search,
  CheckSquare,
  Square,
  Zap,
  Globe,
  Cpu,
  HardDrive,
  Image,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Files,
  BarChart3,
  Sparkles,
  History,
  Shield,
  RotateCcw,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useCleanerHistoryStore } from "@/store/cleanerHistoryStore";
import { logError } from "@/services/crashLogger";
import { perfTime } from "@/services/perfProfiler";
import { Button } from "@/components/ui/Button";
import { CleanupPreviewModal } from "@/components/cleaner/CleanupPreviewModal";
import { ExclusionsModal } from "@/components/cleaner/ExclusionsModal";
import { HistoryPanel } from "@/components/cleaner/HistoryPanel";
import { RestoreInfoModal } from "@/components/cleaner/RestoreInfoModal";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { formatBytes } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { ScanCategory, CleanupReport } from "@/types";

// ── Category icon map ──────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "temp-files": <Trash2 className="w-5 h-5" />,
  "browser-cache": <Globe className="w-5 h-5" />,
  "recycle-bin": <Trash2 className="w-5 h-5" />,
  "thumbnail-cache": <Image className="w-5 h-5" />,
  "gpu-cache": <Cpu className="w-5 h-5" />,
  "crash-dumps": <AlertTriangle className="w-5 h-5" />,
  "windows-logs": <FileText className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  "temp-files": "text-orange-400 bg-orange-500/10",
  "browser-cache": "text-blue-400 bg-blue-500/10",
  "recycle-bin": "text-red-400 bg-red-500/10",
  "thumbnail-cache": "text-brand-secondary bg-brand-secondary/10",
  "gpu-cache": "text-brand-primary bg-brand-primary/10",
  "crash-dumps": "text-amber-400 bg-amber-500/10",
  "windows-logs": "text-emerald-400 bg-emerald-500/10",
};

type Phase = "idle" | "scanning" | "results" | "cleaning" | "complete";

interface ScanLiveState {
  currentPath: string;
  totalSize: number;
  totalFiles: number;
  activeCategory: string;
}

interface CleanLiveState {
  current: number;
  total: number;
  currentFile: string;
  freed: number;
}

// ── CategoryCard ──────────────────────────────────────────────────────────
const CategoryCard: React.FC<{
  cat: ScanCategory;
  selected: boolean;
  scanning?: boolean;
  onToggle: () => void;
}> = ({ cat, selected, scanning, onToggle }) => {
  const iconColors = CATEGORY_COLORS[cat.id] ?? "text-text-muted bg-white/5";
  const pct =
    cat.totalSize > 0 ? Math.min(100, (cat.fileCount / 500) * 100) : 0;

  return (
    <motion.div
      variants={staggerItem}
      layout
      className={cn(
        "glass rounded-2xl p-4 cursor-pointer transition-all border",
        selected
          ? "border-brand-primary/40 bg-brand-primary/5"
          : "border-border hover:border-border-hover",
        scanning && "opacity-50 pointer-events-none",
      )}
      onClick={onToggle}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="mt-0.5 shrink-0">
          {selected ? (
            <CheckSquare className="w-4 h-4 text-brand-primary" />
          ) : (
            <Square className="w-4 h-4 text-text-muted" />
          )}
        </div>

        {/* Icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            iconColors,
          )}
        >
          {CATEGORY_ICONS[cat.id] ?? <HardDrive className="w-5 h-5" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">
              {cat.name}
            </p>
            <span
              className={cn(
                "text-xs font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-full",
                cat.totalSize > 0
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "bg-white/5 text-text-muted",
              )}
            >
              {formatBytes(cat.totalSize)}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {cat.description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className="text-2xs text-text-muted tabular-nums shrink-0">
              {cat.fileCount.toLocaleString()} files
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="text-2xs text-emerald-400">Safe to remove</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── ShimmerCard ───────────────────────────────────────────────────────────
const ShimmerCard: React.FC = () => (
  <div className="glass rounded-2xl p-4 overflow-hidden relative">
    <div className="flex items-start gap-3">
      <div className="w-4 h-4 rounded bg-white/5 mt-0.5 shrink-0" />
      <div className="w-9 h-9 rounded-xl bg-white/5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-3.5 w-32 rounded bg-white/5" />
          <div className="h-3.5 w-14 rounded bg-white/5" />
        </div>
        <div className="h-2.5 w-48 rounded bg-white/5" />
        <div className="h-1 w-full rounded-full bg-white/5" />
      </div>
    </div>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
  </div>
);

// ── CleanupReportCard ─────────────────────────────────────────────────────
const CleanupReportCard: React.FC<{
  report: CleanupReport;
  onRescan: () => void;
  onViewRestore: () => void;
}> = ({ report, onRescan, onViewRestore }) => {
  const mins = Math.floor(report.durationMs / 60000);
  const secs = ((report.durationMs % 60000) / 1000).toFixed(1);
  const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass rounded-2xl overflow-hidden border border-emerald-500/25"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center shadow-glow-sm">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-base font-bold text-emerald-400">
            Cleanup Complete!
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Your system has been optimized
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="p-5 grid grid-cols-2 gap-3">
        {[
          {
            label: "Space Freed",
            value: formatBytes(report.totalFreed),
            icon: <HardDrive className="w-4 h-4 text-emerald-400" />,
          },
          {
            label: "Files Removed",
            value: report.filesRemoved.toLocaleString(),
            icon: <Files className="w-4 h-4 text-blue-400" />,
          },
          {
            label: "Duration",
            value: durationLabel,
            icon: <Clock className="w-4 h-4 text-brand-secondary" />,
          },
          {
            label: "Categories",
            value: `${report.categories.length} cleaned`,
            icon: <BarChart3 className="w-4 h-4 text-amber-400" />,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="glass rounded-xl p-3 flex items-start gap-2.5"
          >
            <div className="mt-0.5">{item.icon}</div>
            <div>
              <p className="text-2xs text-text-muted">{item.label}</p>
              <p className="text-sm font-bold text-text-primary mt-0.5">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {report.errors > 0 && (
        <div className="px-5 pb-3">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {report.errors} files were in use and skipped — they can be removed
            after a restart.
          </p>
        </div>
      )}

      <div className="px-5 pb-5 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Search className="w-3.5 h-3.5" />}
          onClick={onRescan}
        >
          Scan Again
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={onViewRestore}
        >
          View Recovery Info
        </Button>
      </div>
    </motion.div>
  );
};

// ── Safety badge ──────────────────────────────────────────────────────────
const SafetyBadge: React.FC<{ safe: boolean }> = ({ safe }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 text-2xs font-medium px-2.5 py-1 rounded-full border shrink-0",
      safe
        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
        : "bg-amber-500/10 border-amber-500/25 text-amber-400",
    )}
  >
    <span
      className={cn(
        "w-1.5 h-1.5 rounded-full",
        safe ? "bg-emerald-400" : "bg-amber-400",
      )}
    />
    {safe ? "Safe Mode Enabled" : "Permanent Delete Mode"}
  </span>
);

// ── Main Page ─────────────────────────────────────────────────────────────
export const CleanerPage: React.FC = () => {
  const { setScanResults, setIsScanning, setIsCleaning, addToast } =
    useAppStore();
  const { addReport: addHistoryReport } = useCleanerHistoryStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [categories, setCategories] = useState<ScanCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanLive, setScanLive] = useState<ScanLiveState>({
    currentPath: "",
    totalSize: 0,
    totalFiles: 0,
    activeCategory: "",
  });
  const [cleanLive, setCleanLive] = useState<CleanLiveState>({
    current: 0,
    total: 0,
    currentFile: "",
    freed: 0,
  });
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);
  const [restoreWarning, setRestoreWarning] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [safeCleaningMode, setSafeCleaningMode] = useState(true);
  // ── Scan progress percentage (0-100) derived from category completion ──
  const [scanPct, setScanPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanerRef = useRef(window.propel?.cleaner);
  // RAF accumulator — prevents flooding React with per-file state updates
  const pendingScan = useRef<Partial<ScanLiveState>>({});
  const scanRAF = useRef<number | null>(null);

  // Known ordered category ids — used to derive scan % and stage labels
  const SCAN_ORDER = [
    "temp-files",
    "recycle-bin",
    "windows-logs",
    "crash-dumps",
    "browser-cache",
    "thumbnail-cache",
    "gpu-cache",
  ];
  const STAGE_LABELS: Record<string, string> = {
    "": "Preparing Scan…",
    "temp-files": "Scanning Temporary Files…",
    "recycle-bin": "Scanning Recycle Bin…",
    "windows-logs": "Scanning Windows Logs…",
    "crash-dumps": "Scanning Crash Dumps…",
    "browser-cache": "Scanning Browser Cache…",
    "thumbnail-cache": "Scanning Thumbnail Cache…",
    "gpu-cache": "Scanning GPU Cache…",
  };

  useEffect(() => {
    cleanerRef.current = window.propel?.cleaner;
    window.propel?.maintenance
      .getSettings()
      .then((s) => {
        setSafeCleaningMode(s.safeCleaningMode ?? true);
      })
      .catch(() => {});
  }, []);

  // ── Scan ────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    if (!cleanerRef.current) {
      addToast({
        type: "error",
        title: "Not Available",
        description: "Cleaner engine not loaded.",
      });
      return;
    }

    setPhase("scanning");
    setCategories([]);
    setSelected(new Set());
    setReport(null);
    setScanLive({
      currentPath: "",
      totalSize: 0,
      totalFiles: 0,
      activeCategory: "",
    });
    setScanPct(0);
    setElapsedSec(0);
    setIsScanning(true);
    // Start elapsed-time ticker
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);

    cleanerRef.current.removeListeners();
    cleanerRef.current.onScanProgress((evt) => {
      if (evt.type === "file-found") {
        // Accumulate updates; flush once per animation frame max
        pendingScan.current = {
          currentPath: evt.currentPath ?? "",
          totalSize: evt.totalSize ?? 0,
          totalFiles: evt.fileCount ?? 0,
          activeCategory: evt.categoryId ?? pendingScan.current.activeCategory,
        };
        if (!scanRAF.current) {
          scanRAF.current = requestAnimationFrame(() => {
            scanRAF.current = null;
            const p = pendingScan.current;
            if (Object.keys(p).length > 0) {
              setScanLive((prev) => ({ ...prev, ...p }));
              pendingScan.current = {};
            }
          });
        }
      }
      if (evt.type === "category-done") {
        setCategories((prev) => {
          const existing = prev.find((c) => c.id === evt.id);
          const next = existing
            ? prev.map((c) =>
                c.id === evt.id
                  ? {
                      ...c,
                      totalSize: evt.totalSize ?? 0,
                      fileCount: evt.fileCount ?? 0,
                    }
                  : c,
              )
            : [
                ...prev,
                {
                  id: evt.id ?? "",
                  name: evt.name ?? "",
                  description: "",
                  totalSize: evt.totalSize ?? 0,
                  fileCount: evt.fileCount ?? 0,
                  isSafe: true,
                },
              ];
          // Derive scan % from how many of the known ordered categories are done
          const doneCount = next.length;
          const total = SCAN_ORDER.length;
          setScanPct(Math.min(95, Math.round((doneCount / total) * 95)));
          return next;
        });
      }
    });

    try {
      const results = await perfTime(
        "cleaner:scan",
        () => cleanerRef.current!.scan(),
        "scan",
      );
      if (scanRAF.current) {
        cancelAnimationFrame(scanRAF.current);
        scanRAF.current = null;
      }
      pendingScan.current = {};
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      // Animate to 100% then transition
      setScanPct(100);
      await new Promise((r) => setTimeout(r, 600));
      setCategories(results);
      const allIds = new Set(results.map((r) => r.id));
      setSelected(allIds);
      setScanResults(results);
      setPhase("results");
      const total = results.reduce((a, c) => a + c.totalSize, 0);
      addToast({
        type: "success",
        title: "Scan Complete",
        description: `Found ${formatBytes(total)} across ${results.length} categories`,
      });
    } catch (err) {
      setPhase("idle");
      logError(
        "cleaner",
        "Scan failed",
        err instanceof Error ? err.message : String(err),
      );
      addToast({
        type: "error",
        title: "Scan Failed",
        description: "Could not complete system scan.",
      });
    } finally {
      setIsScanning(false);
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      cleanerRef.current?.removeListeners();
    }
  }, [addToast, setScanResults, setIsScanning]);

  // ── Preview gate ────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);

  const openPreview = useCallback(() => {
    if (selected.size === 0) return;
    // Show one-time restore point warning for large cleanups (>100MB)
    const size = categories
      .filter((c) => selected.has(c.id))
      .reduce((a, c) => a + c.totalSize, 0);
    if (size > 100 * 1024 * 1024 && !restoreWarning) {
      setRestoreWarning(true);
      return;
    }
    setShowPreview(true);
  }, [selected, categories, restoreWarning]);

  // ── Clean ───────────────────────────────────────────────────────────────
  const handleClean = useCallback(async () => {
    setShowPreview(false);
    if (!cleanerRef.current || selected.size === 0) return;

    setPhase("cleaning");
    setIsCleaning(true);
    setCleanLive({ current: 0, total: 0, currentFile: "", freed: 0 });

    cleanerRef.current.removeListeners();
    cleanerRef.current.onCleanProgress((evt) => {
      if (evt.type === "file-cleaned") {
        setCleanLive({
          current: evt.current ?? 0,
          total: evt.total ?? 0,
          currentFile: evt.currentFile ?? "",
          freed: evt.freed ?? 0,
        });
      }
    });

    try {
      const result = await perfTime(
        "cleaner:clean",
        () => cleanerRef.current!.clean([...selected]),
        "ipc",
        { categories: [...selected] },
      );
      setReport(result);
      addHistoryReport(result);
      setCategories([]);
      setScanResults([]);
      setSelected(new Set());
      setPhase("complete");
      addToast({
        type: "success",
        title: "Cleanup Complete!",
        description: `Freed ${formatBytes(result.totalFreed)} from ${result.filesRemoved.toLocaleString()} files`,
      });
    } catch (err) {
      setPhase("results");
      logError(
        "cleaner",
        "Cleanup failed",
        err instanceof Error ? err.message : String(err),
      );
      addToast({
        type: "error",
        title: "Cleanup Failed",
        description: "An error occurred during cleanup.",
      });
    } finally {
      setIsCleaning(false);
      cleanerRef.current?.removeListeners();
    }
  }, [selected, addToast, setScanResults, setIsCleaning, addHistoryReport]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toggleCategory = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectAll = () => setSelected(new Set(categories.map((c) => c.id)));
  const clearAll = () => setSelected(new Set());

  const totalJunk = categories.reduce((a, c) => a + c.totalSize, 0);
  const selectedSize = categories
    .filter((c) => selected.has(c.id))
    .reduce((a, c) => a + c.totalSize, 0);
  const cleanPct =
    cleanLive.total > 0
      ? Math.round((cleanLive.current / cleanLive.total) * 100)
      : 0;

  return (
    <>
      <CleanupPreviewModal
        open={showPreview}
        categories={categories}
        selectedIds={selected}
        selectedSize={selectedSize}
        onConfirm={handleClean}
        onCancel={() => setShowPreview(false)}
      />
      <ExclusionsModal
        open={showExclusions}
        onClose={() => setShowExclusions(false)}
      />
      <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
      {report && (
        <RestoreInfoModal
          open={showRestore}
          report={report}
          onClose={() => setShowRestore(false)}
        />
      )}
      <div className="h-full flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0"
        >
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              System Cleaner
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {phase === "idle" &&
                "Scan and safely remove junk files from your PC"}
              {phase === "scanning" && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse inline-block" />
                  Scanning — {formatBytes(scanLive.totalSize)} found so far
                </span>
              )}
              {phase === "results" &&
                `Found ${formatBytes(totalJunk)} across ${categories.length} categories`}
              {phase === "cleaning" &&
                `Cleaning — freed ${formatBytes(cleanLive.freed)} so far`}
              {phase === "complete" && "System successfully optimized"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SafetyBadge safe={safeCleaningMode} />
            {(phase === "idle" || phase === "results") && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Shield className="w-3.5 h-3.5" />}
                onClick={() => setShowExclusions(true)}
              >
                Exclusions
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<History className="w-3.5 h-3.5" />}
              onClick={() => setShowHistory(true)}
            >
              History
            </Button>
            {(phase === "idle" || phase === "results") && (
              <Button
                variant="primary"
                size="sm"
                icon={<Search className="w-3.5 h-3.5" />}
                onClick={handleScan}
              >
                {phase === "results" ? "Re-Scan" : "Scan Now"}
              </Button>
            )}
          </div>
        </motion.div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {/* ── IDLE: Hero CTA ── */}
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid grid-cols-[minmax(360px,1.15fr)_minmax(300px,.85fr)] gap-5 max-[1050px]:grid-cols-1"
              >
                <section className="rounded-2xl border border-brand-primary/20 bg-bg-elevated p-6 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-secondary">
                      <span className="status-dot" />
                      Cleaner ready
                    </div>
                    <h2 className="mt-5 text-[30px] font-semibold tracking-[-.04em] text-text-primary">
                      Find space you can safely reclaim
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
                      Propel checks temporary data, browser caches, Windows
                      leftovers and other non-essential files while respecting
                      your exclusions.
                    </p>
                  </div>
                  <div className="mt-7 flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      icon={<Search className="w-4 h-4" />}
                      onClick={handleScan}
                    >
                      Scan this PC
                    </Button>
                    <span className="text-[11px] text-text-muted">
                      Usually 10–30 seconds
                    </span>
                  </div>
                </section>
                <aside className="rounded-2xl border border-border/70 bg-bg-surface/65 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="section-label">Scan overview</p>
                      <h3 className="mt-1 text-base font-semibold text-text-primary">
                        What Propel will check
                      </h3>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {SCAN_ORDER.map((id) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs text-text-secondary"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary/70" />
                        {STAGE_LABELS[id]
                          ?.replace("…", "")
                          .replace("Scanning ", "") ?? id}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowExclusions(true)}
                      className="rounded-lg border border-border/70 bg-bg-elevated px-3 py-2 text-left"
                    >
                      <span className="block text-xs font-semibold text-text-primary">
                        Exclusions
                      </span>
                      <span className="text-[10px] text-text-muted">
                        Review protected paths
                      </span>
                    </button>
                    <button
                      onClick={() => setShowHistory(true)}
                      className="rounded-lg border border-border/70 bg-bg-elevated px-3 py-2 text-left"
                    >
                      <span className="block text-xs font-semibold text-text-primary">
                        History
                      </span>
                      <span className="text-[10px] text-text-muted">
                        Previous cleanups
                      </span>
                    </button>
                  </div>
                </aside>
              </motion.div>
            )}

            {/* ── SCANNING: Premium linear progress ── */}
            {phase === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* ── Primary progress card ── */}
                <div className="glass rounded-2xl p-7 border border-brand-primary/20">
                  {/* Title + subtitle */}
                  <p className="text-base font-bold text-text-primary mb-0.5">
                    Scanning Your System
                  </p>
                  <p className="text-xs text-text-muted mb-6">
                    Analyzing temporary files, browser cache and Windows junk…
                  </p>

                  {/* Large percentage — single source of truth */}
                  <div className="flex items-end justify-between mb-3">
                    <motion.span
                      key={scanPct}
                      initial={{ opacity: 0.6, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-5xl font-black text-text-primary tabular-nums leading-none"
                    >
                      {scanPct}
                      <span className="text-2xl font-semibold text-text-muted">
                        %
                      </span>
                    </motion.span>
                    <span className="text-xs text-text-muted pb-1">
                      {STAGE_LABELS[scanLive.activeCategory] ??
                        STAGE_LABELS[""]}
                    </span>
                  </div>

                  {/* Linear bar — width === scanPct, always in sync */}
                  <div className="h-3 rounded-full bg-white/[0.07] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: "var(--t-progress-gradient)",
                      }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${scanPct}%` }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    />
                  </div>

                  {/* Current stage label */}
                  <p className="text-xs text-text-muted mt-2.5">
                    Current Stage:{" "}
                    <span className="text-text-primary font-medium">
                      {STAGE_LABELS[scanLive.activeCategory] ??
                        STAGE_LABELS[""]}
                    </span>
                  </p>
                </div>

                {/* ── Live metrics row ── */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Files Scanned",
                      value: scanLive.totalFiles.toLocaleString(),
                      icon: <Files className="w-4 h-4 text-brand-primary" />,
                    },
                    {
                      label: "Junk Found",
                      value: formatBytes(scanLive.totalSize),
                      icon: <HardDrive className="w-4 h-4 text-amber-400" />,
                    },
                    {
                      label: "Elapsed",
                      value: `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`,
                      icon: <Clock className="w-4 h-4 text-text-muted" />,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="glass rounded-xl p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-1.5 text-2xs text-text-muted">
                        {m.icon}
                        {m.label}
                      </div>
                      <p className="text-xl font-bold text-text-primary tabular-nums leading-none">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Category stage checklist ── */}
                <div className="glass rounded-2xl p-5">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                    Scan Progress
                  </p>
                  <div className="space-y-2">
                    {SCAN_ORDER.map((id, idx) => {
                      const done = categories.some((c) => c.id === id);
                      const active = scanLive.activeCategory === id && !done;
                      const pending = !done && !active;
                      const cat = categories.find((c) => c.id === id);
                      return (
                        <motion.div
                          key={id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            {done ? (
                              <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] text-emerald-400 font-bold leading-none">
                                  ✓
                                </span>
                              </span>
                            ) : active ? (
                              <span className="w-4 h-4 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-white/10 shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-xs",
                                done
                                  ? "text-emerald-400 line-through"
                                  : active
                                    ? "text-text-primary font-semibold"
                                    : "text-text-muted",
                              )}
                            >
                              {STAGE_LABELS[id]
                                ?.replace("…", "")
                                .replace("Scanning ", "") ?? id}
                            </span>
                            {active && (
                              <span className="text-2xs text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded font-medium">
                                scanning
                              </span>
                            )}
                          </div>
                          {done && cat && (
                            <span className="text-2xs text-emerald-400 tabular-nums">
                              {formatBytes(cat.totalSize)}
                            </span>
                          )}
                          {pending && (
                            <span className="text-2xs text-text-muted">
                              next
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* 100% complete flash */}
                <AnimatePresence>
                  {scanPct === 100 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="glass rounded-2xl p-5 border border-emerald-500/30 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <span className="text-emerald-400 font-bold text-base">
                          ✓
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-400">
                          Scan Complete
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatBytes(scanLive.totalSize)} Recoverable —
                          loading results…
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── RESULTS: Category cards ── */}
            {phase === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Summary bar */}
                <div className="glass rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {formatBytes(selectedSize)} selected
                      </p>
                      <p className="text-xs text-text-muted">
                        {selected.size} of {categories.length} categories
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-brand-primary hover:text-text-accent transition-colors"
                    >
                      All
                    </button>
                    <span className="text-text-muted text-xs">·</span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Category grid */}
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 gap-3 max-[1000px]:grid-cols-1"
                >
                  {categories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      selected={selected.has(cat.id)}
                      onToggle={() => toggleCategory(cat.id)}
                    />
                  ))}
                </motion.div>

                {/* Restore point warning (>100MB, one-time) */}
                <AnimatePresence>
                  {restoreWarning && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="glass rounded-2xl p-4 border border-amber-500/25 bg-amber-500/[0.04] flex items-start gap-3"
                    >
                      <RotateCcw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-400">
                          Recommended: Create a Restore Point
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          You're about to clean{" "}
                          <span className="font-semibold text-text-primary">
                            {formatBytes(selectedSize)}
                          </span>
                          . Before proceeding, consider creating a Windows
                          System Restore Point as a safety net.
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setRestoreWarning(false);
                            setShowPreview(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-2xs font-bold text-white [background:var(--t-btn-bg)] hover:brightness-105 transition-all"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => setRestoreWarning(false)}
                          className="px-3 py-1.5 rounded-lg text-2xs text-text-muted border border-border hover:text-text-secondary transition-colors text-center"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Clean CTA */}
                {selected.size > 0 && !restoreWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky bottom-0 glass rounded-2xl p-4 border border-brand-primary/25 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {formatBytes(selectedSize)} will be freed
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-text-muted">
                          {selected.size} categories selected
                        </p>
                        <div className="flex items-center gap-1 text-2xs text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          {safeCleaningMode
                            ? "Safe Cleanup"
                            : "Permanent Delete"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      icon={<Zap className="w-4 h-4" />}
                      onClick={openPreview}
                    >
                      Start Clean
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── CLEANING: Premium linear progress ── */}
            {phase === "cleaning" && (
              <motion.div
                key="cleaning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="glass rounded-2xl p-6 border border-brand-primary/20">
                  {/* Top row: icon + title + freed counter */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">
                          Cleaning Your System
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 truncate max-w-[260px]">
                          {cleanLive.currentFile || "Preparing…"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 font-bold tabular-nums text-sm">
                        {formatBytes(cleanLive.freed)}
                      </p>
                      <p className="text-2xs text-text-muted">freed so far</p>
                    </div>
                  </div>

                  {/* Large percentage label — always in sync with bar */}
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-4xl font-bold text-text-primary tabular-nums leading-none">
                      {cleanPct}
                      <span className="text-xl text-text-muted">%</span>
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {cleanLive.current.toLocaleString()} /{" "}
                      {cleanLive.total.toLocaleString()} files
                    </span>
                  </div>

                  {/* Linear progress bar — width drives directly from cleanPct */}
                  <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden relative">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: "var(--t-progress-gradient)",
                      }}
                      animate={{ width: `${cleanPct}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>

                  {/* Status label */}
                  <p className="text-xs text-text-muted mt-3">
                    {cleanPct < 100
                      ? "Removing junk files safely…"
                      : "Finalizing…"}
                  </p>

                  {/* Live metrics row */}
                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-2xs text-text-muted">
                      <Files className="w-3 h-3 text-brand-primary" />
                      <span className="tabular-nums font-medium">
                        {cleanLive.current.toLocaleString()}
                      </span>{" "}
                      files removed
                    </div>
                    <div className="flex items-center gap-1.5 text-2xs text-text-muted">
                      <HardDrive className="w-3 h-3 text-emerald-400" />
                      <span className="tabular-nums font-medium">
                        {formatBytes(cleanLive.freed)}
                      </span>{" "}
                      reclaimed
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── COMPLETE: Report ── */}
            {phase === "complete" && report && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CleanupReportCard
                  report={report}
                  onRescan={() => {
                    setPhase("idle");
                    setReport(null);
                  }}
                  onViewRestore={() => setShowRestore(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
