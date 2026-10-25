import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Search,
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
  CheckCircle2,
  History,
  Shield,
  RotateCcw,
  ChevronRight,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useCleanerHistoryStore } from "@/store/cleanerHistoryStore";
import { useSessionStore } from "@/store/sessionStore";
import { logError } from "@/services/crashLogger";
import { perfTime } from "@/services/perfProfiler";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { StatusPill } from "@/components/ui/StatusPill";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { ExclusionsModal } from "@/components/cleaner/ExclusionsModal";
import { HistoryPanel } from "@/components/cleaner/HistoryPanel";
import { RestoreInfoModal } from "@/components/cleaner/RestoreInfoModal";
import { CleanupPreviewModal } from "@/components/cleaner/CleanupPreviewModal";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { formatBytes } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { ScanCategory, CleanupReport } from "@/types";

// ── Category icon map ──────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "temp-files": <Trash2 className="w-4 h-4" />,
  "browser-cache": <Globe className="w-4 h-4" />,
  "recycle-bin": <Trash2 className="w-4 h-4" />,
  "thumbnail-cache": <Image className="w-4 h-4" />,
  "gpu-cache": <Cpu className="w-4 h-4" />,
  "crash-dumps": <AlertTriangle className="w-4 h-4" />,
  "windows-logs": <FileText className="w-4 h-4" />,
  "win-update-cache": <HardDrive className="w-4 h-4" />,
  "prefetch": <Zap className="w-4 h-4" />,
  "delivery-opt": <Globe className="w-4 h-4" />,
};

type Phase = "idle" | "scanning" | "results" | "cleaning" | "pending-permission" | "complete";

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

const PermissionBatchModal: React.FC<{
  count: number;
  paths?: string[];
  onContinue: () => void;
  onSkip: () => void;
}> = ({ count, paths, onContinue, onSkip }) => (
  <Modal
    open
    onOpenChange={() => {}}
    dismissible={false}
    tone="warning"
    icon={<Shield />}
    title="Some Files Need Administrator Permission"
    description={
      <>
        {count} {count === 1 ? "file couldn't" : "files couldn't"} be cleaned without administrator
        permission. Would you like to try cleaning them with administrator permission?
      </>
    }
    footer={
      <>
        <Button variant="secondary" onClick={onSkip}>
          Skip
        </Button>
        <Button variant="primary" onClick={onContinue} autoFocus>
          Allow &amp; Clean
        </Button>
      </>
    }
  >
    {paths && paths.length > 0 && (
      <div className="overflow-hidden rounded-card border border-line-subtle bg-surface-inset">
        <p className="border-b border-line-subtle px-3.5 py-2 text-caption font-semibold text-fg-2 tabular">
          {count} {count === 1 ? "file" : "files"} affected
        </p>
        <ul className="max-h-48 divide-y divide-line-subtle overflow-y-auto">
          {paths.map((p) => (
            <li key={p} className="truncate px-3.5 py-1.5 font-mono text-[11px] text-fg-2" title={p}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    )}
  </Modal>
);

// ── CategoryCard ──────────────────────────────────────────────────────────
export const CategoryCard: React.FC<{
  cat: ScanCategory;
  selected: boolean;
  scanning?: boolean;
  onToggle: () => void;
}> = ({ cat, selected, scanning, onToggle }) => {
  const pct =
    cat.totalSize > 0 ? Math.min(100, (cat.fileCount / 500) * 100) : 0;

  return (
    <motion.div
      variants={staggerItem}
      layout
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "relative cursor-pointer rounded-card border p-4 transition-[border-color,box-shadow,background-color] duration-base ease-out focus-visible:shadow-ring",
        selected
          ? "border-brand/40 bg-surface-raised shadow-[var(--shadow-1),inset_0_0_0_1px_rgb(var(--c-brand)/.25)]"
          : "border-line bg-surface-raised shadow-[var(--shadow-1),var(--highlight-top)] hover:border-line-strong",
        scanning && "pointer-events-none opacity-50",
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-fast",
            selected ? "border-transparent bg-brand-solid text-fg-on-brand" : "border-line-strong bg-surface-raised",
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3.2} />}
        </span>

        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-control transition-colors duration-fast",
            selected ? "bg-brand-soft text-brand-fg" : "bg-surface-inset text-fg-2",
          )}
        >
          {CATEGORY_ICONS[cat.id] ?? <HardDrive className="w-4 h-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-body font-semibold text-fg-1">{cat.name}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold tabular",
                cat.totalSize > 0 ? "bg-brand-soft text-brand-fg" : "bg-surface-inset text-fg-3",
              )}
            >
              {formatBytes(cat.totalSize)}
            </span>
          </div>
          {cat.description && (
            <p className="mt-0.5 truncate text-caption text-fg-3">{cat.description}</p>
          )}
          <div className="mt-2.5 flex items-center gap-3">
            <Progress value={pct} tone="brand" size="xs" className="flex-1" aria-label={`${cat.name} file volume`} />
            <span className="shrink-0 text-[10.5px] text-fg-3 tabular">
              {cat.isCapped ? "5,000+ files" : `${cat.fileCount.toLocaleString()} files`}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-success-fg">
              <ShieldCheck className="h-3 w-3" />
              Safe to remove
            </span>
            {cat.isCapped && (
              <span className="flex items-center gap-1 text-[10.5px] text-warning-fg">
                <AlertTriangle className="h-3 w-3" />
                Scan limit reached — actual space may be larger
              </span>
            )}
            {cat.id === "gpu-cache" && (
              <span className="text-[10.5px] text-fg-3">
                Apps may take slightly longer to launch next time.
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── ShimmerCard ───────────────────────────────────────────────────────────
const ShimmerCard: React.FC = () => (
  <div className="rounded-card border border-line-subtle bg-surface-raised p-4">
    <div className="flex items-start gap-3">
      <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
      <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-14" />
        </div>
        <Skeleton className="h-2.5 w-48" />
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
    </div>
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
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card level="feature" className="p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-success)/.12),transparent)]"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-success-soft text-success-fg shadow-[var(--highlight-top)]">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-[22px] font-semibold leading-7 tracking-[-.02em] text-fg-1">
              Cleanup Complete!
            </p>
            <p className="text-body text-fg-2">Your system has been optimized</p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
          {[
            { label: "Space Freed", value: formatBytes(report.totalFreed), icon: <HardDrive className="h-4 w-4" /> },
            { label: "Files Removed", value: report.filesRemoved.toLocaleString(), icon: <Files className="h-4 w-4" /> },
            { label: "Duration", value: durationLabel, icon: <Clock className="h-4 w-4" /> },
            { label: "Categories", value: `${report.categories.length} cleaned`, icon: <BarChart3 className="h-4 w-4" /> },
          ].map((item) => (
            <div key={item.label} className="rounded-control border border-line-subtle bg-surface-inset px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-caption text-fg-3">
                {item.icon}
                {item.label}
              </p>
              <p className="mt-1 font-display text-[20px] font-semibold leading-6 text-fg-1 tabular">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {(report.errors > 0 || (report.adminRequiredSkipped ?? 0) > 0) && (
          <div className="relative mt-4 space-y-2">
            {report.errors > 0 && (
              <Callout tone="warning" compact>
                {report.errors} files were in use and skipped — they can be removed after a restart.
              </Callout>
            )}
            {(report.adminRequiredSkipped ?? 0) > 0 && (
              <Callout tone="warning" compact icon={<Shield />}>
                {report.adminRequiredSkipped} files skipped because administrator permission was required.
              </Callout>
            )}
          </div>
        )}

        <div className="relative mt-5 flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Search />} onClick={onRescan}>
            Scan Again
          </Button>
          <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={onViewRestore}>
            View Recovery Info
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

// ── Safety badge ──────────────────────────────────────────────────────────
const SafetyBadge: React.FC<{ safe: boolean }> = ({ safe }) => (
  <StatusPill tone={safe ? "healthy" : "warning"}>
    {safe ? "Safe Mode Enabled" : "Permanent Delete Mode"}
  </StatusPill>
);

const UtilityCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}> = ({ icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-3 rounded-card border border-line bg-surface-raised p-4 text-left shadow-[var(--shadow-1),var(--highlight-top)] transition-[border-color,box-shadow,transform] duration-base ease-out hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-2),var(--highlight-top)] focus-visible:shadow-ring"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-inset text-fg-2 [&>svg]:h-4 [&>svg]:w-4">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-body font-semibold text-fg-1">{title}</span>
      <span className="block text-caption text-fg-3">{desc}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-fg-4 transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-fg-2" />
  </button>
);

/** Start Clean, confirmed through the Cleanup Preview (lists every selected category). */
const StartCleanButton: React.FC<{
  categories: ScanCategory[];
  selectedIds: Set<string>;
  totalSize: number;
  onConfirm: () => void;
}> = ({ categories, selectedIds, totalSize, onConfirm }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Zap />} onClick={() => setOpen(true)} disabled={selectedIds.size === 0}>
        Start Clean
      </Button>
      <CleanupPreviewModal
        open={open}
        categories={categories}
        selectedIds={selectedIds}
        selectedSize={totalSize}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────
export const CleanerPage: React.FC = () => {
  const { setScanResults, setIsScanning, setIsCleaning, addToast, setHasScanned } =
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
  const [showRestore, setShowRestore] = useState(false);
  const [permissionBatch, setPermissionBatch] = useState<{ report: CleanupReport; count: number; token: string } | null>(null);
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
    "win-update-cache",
    "prefetch",
    "delivery-opt",
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
    "win-update-cache": "Scanning Update Cache…",
    "prefetch": "Scanning Prefetch Files…",
    "delivery-opt": "Scanning Delivery Optimization…",
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
    elapsedRef.current = setInterval(() => setElapsedSec((s) => {
      if (useAppStore.getState().activePage !== "cleaner") return s;
      return s + 1;
    }), 1000);

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
                      isCapped: evt.isCapped ?? c.isCapped,
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
                  isCapped: evt.isCapped ?? false,
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
      setHasScanned(true);
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

  // ── Clean ───────────────────────────────────────────────────────────────
  const handleClean = useCallback(async () => {
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
      setCategories([]);
      setScanResults([]);
      setSelected(new Set());
      if (result.permissionBatchToken && result.permissionDeniedCount) {
        setPhase("pending-permission");
        setPermissionBatch({
          report: result,
          count: result.permissionDeniedCount,
          token: result.permissionBatchToken,
        });
      } else {
        setPhase("complete");
        addHistoryReport(result);
        addToast({
          type: "success",
          title: "Cleanup Complete!",
          description: `Freed ${formatBytes(result.totalFreed)} from ${result.filesRemoved.toLocaleString()} files`,
        });
      }
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

  const finishPermissionBatch = useCallback(async (action: "continue" | "skip") => {
    if (!permissionBatch || !cleanerRef.current) return;
    const firstPass = permissionBatch.report;
    setPermissionBatch(null);
    if (action === "skip") {
      void cleanerRef.current.discardAdminBatch(permissionBatch.token);
    }
    let finalReport: CleanupReport = {
      ...firstPass,
      filesSkipped: action === "skip" ? permissionBatch.count : 0,
      adminRequiredSkipped: action === "skip" ? permissionBatch.count : 0,
    };
    if (action === "continue") {
      try {
        const elevated = await cleanerRef.current.cleanAdminBatch(permissionBatch.token);
        finalReport = {
          ...firstPass,
          totalFreed: firstPass.totalFreed + elevated.totalFreed,
          filesRemoved: firstPass.filesRemoved + elevated.filesRemoved,
          errors: firstPass.errors - permissionBatch.count + elevated.errors,
          errorDetails: (firstPass.errorDetails ?? []).filter(
            error => !(firstPass.permissionDeniedPaths ?? []).includes(error.path),
          ).concat(elevated.errorDetails ?? []),
          filesSkipped: elevated.filesSkipped ?? elevated.errors,
          adminRequiredSkipped: elevated.adminRequiredSkipped ?? 0,
          permissionDeniedPaths: [],
        };
      } catch {
        finalReport.filesSkipped = permissionBatch.count;
        finalReport.adminRequiredSkipped = permissionBatch.count;
      }
    }
    setReport(finalReport);
    addHistoryReport(finalReport);
    setCategories([]);
    setScanResults([]);
    setSelected(new Set());
    setPhase("complete");
    addToast({
      type: "success",
      title: "Cleanup Complete!",
      description: `Freed ${formatBytes(finalReport.totalFreed)} from ${finalReport.filesRemoved.toLocaleString()} files`,
    });
  }, [permissionBatch, addHistoryReport, setScanResults, addToast]);

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

  const stageName = (id: string) =>
    STAGE_LABELS[id]?.replace("…", "").replace("Scanning ", "") ?? id;

  const headerAction =
    phase === "idle" ? (
      <Button icon={<Search />} onClick={handleScan}>
        Scan this PC
      </Button>
    ) : phase === "scanning" ? (
      <Button loading>Scanning…</Button>
    ) : phase === "cleaning" || phase === "pending-permission" ? (
      <Button loading>Cleaning…</Button>
    ) : undefined;

  return (
    <>
      {permissionBatch && (
        <PermissionBatchModal
          count={permissionBatch.count}
          paths={permissionBatch.report.permissionDeniedPaths}
          onContinue={() => void finishPermissionBatch("continue")}
          onSkip={() => void finishPermissionBatch("skip")}
        />
      )}
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
      <div className="page-shell">
        <div className="mx-auto w-full max-w-6xl">
          <PageHeader
            eyebrow="Storage care"
            title="System Cleaner"
            subtitle={
              <>
                {phase === "idle" && "Scan and safely remove junk files from your PC"}
                {phase === "scanning" && `Scanning — ${formatBytes(scanLive.totalSize)} found so far`}
                {phase === "results" && "Review scan results and select categories to clean"}
                {(phase === "cleaning" || phase === "pending-permission") &&
                  `Cleaning — freed ${formatBytes(cleanLive.freed)} so far`}
                {phase === "complete" && "System successfully optimized"}
              </>
            }
            meta={phase === "idle" ? "Usually 5 to 10 seconds" : undefined}
            action={headerAction}
          />

          <AnimatePresence mode="wait">
            {/* ── IDLE ── */}
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-4"
              >
                <Card level="feature" className="p-0">
                  <div className="grid grid-cols-[1.4fr_1fr] max-[900px]:grid-cols-1">
                    <div className="relative p-7">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-brand-glow)/.1),transparent)]"
                      />
                      <div className="relative">
                        <StatusPill tone="healthy">Cleaner ready</StatusPill>
                        <h2 className="mt-4 font-display text-[24px] font-semibold leading-[30px] tracking-[-.025em] text-fg-1">
                          Find space you can safely reclaim
                        </h2>
                        <p className="mt-2 max-w-[52ch] text-body text-fg-2">
                          Propel checks temporary data, browser caches, Windows leftovers and other
                          non-essential files while respecting your exclusions.
                        </p>
                        <div className="mt-6 flex items-center gap-2.5 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-2.5">
                          <ShieldCheck
                            className={cn("h-4 w-4 shrink-0", safeCleaningMode ? "text-success-fg" : "text-warning-fg")}
                          />
                          <p className="flex-1 text-body-sm text-fg-2">
                            {safeCleaningMode
                              ? "Deleted files go to Recycle Bin, not permanently removed"
                              : "Safe cleaning is disabled"}
                          </p>
                          <SafetyBadge safe={safeCleaningMode} />
                        </div>
                      </div>
                    </div>
                    <div className="border-l border-line-subtle bg-surface-inset/60 p-6 max-[900px]:border-l-0 max-[900px]:border-t">
                      <CardEyebrow>Scan overview</CardEyebrow>
                      <h3 className="mt-1 text-title font-semibold text-fg-1">What Propel will check</h3>
                      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
                        {SCAN_ORDER.map((id) => (
                          <li key={id} className="flex items-center gap-2 text-body-sm text-fg-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-tiny bg-surface-raised text-fg-3 shadow-[var(--shadow-1)] [&>svg]:h-3 [&>svg]:w-3">
                              {CATEGORY_ICONS[id] ?? <HardDrive />}
                            </span>
                            <span className="truncate">{stageName(id)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-3 gap-4 max-[800px]:grid-cols-1">
                  <UtilityCard
                    icon={<ShieldCheck />}
                    title="Exclusions"
                    desc="Protected paths"
                    onClick={() => setShowExclusions(true)}
                  />
                  <UtilityCard
                    icon={<History />}
                    title="Cleanup History"
                    desc="Previous scans"
                    onClick={() => setShowHistory(true)}
                  />
                  <div className="flex items-center gap-3 rounded-card border border-line-subtle bg-surface-raised p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-inset text-fg-2">
                      <Shield className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold text-fg-1">Safe Cleaning</span>
                      <span className="block truncate text-caption text-fg-3">
                        {safeCleaningMode ? "Recycle Bin first" : "Disabled"}
                      </span>
                    </span>
                    <StatusPill tone={safeCleaningMode ? "healthy" : "warning"}>
                      {safeCleaningMode ? "Protected" : "Unprotected"}
                    </StatusPill>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── SCANNING ── */}
            {phase === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-4"
              >
                <Card level="feature" className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-title font-semibold text-fg-1">Scanning Your System</p>
                      <p className="text-body-sm text-fg-3">
                        Analyzing temporary files, browser cache and Windows junk…
                      </p>
                    </div>
                    <StatusPill tone="neutral" className="max-w-[45%] truncate">
                      {STAGE_LABELS[scanLive.activeCategory] ?? STAGE_LABELS[""]}
                    </StatusPill>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-4">
                    <span className="font-display text-display font-semibold text-fg-1 tabular" aria-live="polite">
                      {scanPct}
                      <span className="text-[22px] font-medium text-fg-3">%</span>
                    </span>
                    <span className="pb-1.5 text-caption text-fg-3">
                      Current Stage:{" "}
                      <span className="font-medium text-fg-1">
                        {STAGE_LABELS[scanLive.activeCategory] ?? STAGE_LABELS[""]}
                      </span>
                    </span>
                  </div>
                  <Progress value={scanPct} tone="brand" size="md" className="mt-3" aria-label="Scan progress" />
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Files Scanned", value: scanLive.totalFiles.toLocaleString(), icon: <Files className="h-4 w-4" /> },
                    { label: "Junk Found", value: formatBytes(scanLive.totalSize), icon: <HardDrive className="h-4 w-4" /> },
                    {
                      label: "Elapsed",
                      value: `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`,
                      icon: <Clock className="h-4 w-4" />,
                    },
                  ].map((m) => (
                    <Card key={m.label} className="p-4">
                      <p className="flex items-center gap-1.5 text-caption text-fg-3">
                        {m.icon}
                        {m.label}
                      </p>
                      <p className="mt-2 font-display text-metric font-semibold text-fg-1 tabular">{m.value}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-5">
                  <CardEyebrow>Scan progress</CardEyebrow>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 max-[800px]:grid-cols-1">
                    {SCAN_ORDER.map((id) => {
                      const done = categories.some((c) => c.id === id);
                      const active = scanLive.activeCategory === id && !done;
                      const pending = !done && !active;
                      const cat = categories.find((c) => c.id === id);
                      return (
                        <li key={id} className="flex items-center justify-between gap-3 py-1">
                          <span className="flex min-w-0 items-center gap-2.5">
                            {done ? (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-fg-on-brand">
                                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                              </span>
                            ) : active ? (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                              </span>
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded-full border border-line-strong" />
                            )}
                            <span
                              className={cn(
                                "truncate text-body-sm",
                                done ? "text-fg-2" : active ? "font-semibold text-fg-1" : "text-fg-3",
                              )}
                            >
                              {stageName(id)}
                            </span>
                            {active && (
                              <span className="rounded-tiny bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-fg">
                                scanning
                              </span>
                            )}
                          </span>
                          {done && cat && (
                            <span className="shrink-0 text-caption font-medium text-fg-2 tabular">
                              {formatBytes(cat.totalSize)}
                            </span>
                          )}
                          {pending && <span className="shrink-0 text-caption text-fg-4">next</span>}
                        </li>
                      );
                    })}
                  </ul>
                </Card>

                <AnimatePresence>
                  {scanPct === 100 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Callout tone="success" title="Scan Complete">
                        {formatBytes(scanLive.totalSize)} Recoverable — loading results…
                      </Callout>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── RESULTS ── */}
            {phase === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="sticky top-0 z-10 -mx-1 bg-surface-base px-1 pb-1 pt-1">
                  <Card level="elevated" className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-fg">
                        <HardDrive className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-[18px] font-semibold leading-6 text-fg-1 tabular">
                          {formatBytes(selectedSize)} selected
                        </p>
                        <p className="text-caption text-fg-3 tabular">
                          {selected.size} of {categories.length} categories · {formatBytes(totalJunk)} found
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 max-[560px]:w-full max-[560px]:justify-between">
                      <div className="flex items-center rounded-control border border-line-subtle bg-surface-inset p-[3px]">
                        <button
                          onClick={selectAll}
                          className="h-7 rounded-[7px] px-2.5 text-caption font-medium text-fg-2 transition-colors hover:bg-surface-raised hover:text-fg-1 focus-visible:shadow-ring"
                        >
                          All
                        </button>
                        <button
                          onClick={clearAll}
                          className="h-7 rounded-[7px] px-2.5 text-caption font-medium text-fg-2 transition-colors hover:bg-surface-raised hover:text-fg-1 focus-visible:shadow-ring"
                        >
                          None
                        </button>
                      </div>
                      <StartCleanButton
                        categories={categories}
                        selectedIds={selected}
                        totalSize={selectedSize}
                        onConfirm={() => void handleClean()}
                      />
                    </div>
                  </Card>
                </div>

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
              </motion.div>
            )}

            {/* ── CLEANING ── */}
            {phase === "cleaning" && (
              <motion.div
                key="cleaning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card level="feature" className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-fg">
                        <Zap className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-title font-semibold text-fg-1">Cleaning Your System</p>
                        <p className="max-w-[420px] truncate font-mono text-[11px] text-fg-3">
                          {cleanLive.currentFile || "Preparing…"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-[20px] font-semibold text-success-fg tabular">
                        {formatBytes(cleanLive.freed)}
                      </p>
                      <p className="text-caption text-fg-3">freed so far</p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end justify-between">
                    <span className="font-display text-display font-semibold text-fg-1 tabular" aria-live="polite">
                      {cleanPct}
                      <span className="text-[22px] font-medium text-fg-3">%</span>
                    </span>
                    <span className="pb-1.5 text-caption text-fg-3 tabular">
                      {cleanLive.current.toLocaleString()} / {cleanLive.total.toLocaleString()} files
                    </span>
                  </div>
                  <Progress value={cleanPct} tone="brand" size="md" className="mt-3" aria-label="Cleaning progress" />
                  <p className="mt-3 text-body-sm text-fg-3">
                    {cleanPct < 100 ? "Removing junk files safely…" : "Finalizing…"}
                  </p>

                  <div className="mt-4 flex items-center gap-6 border-t border-line-subtle pt-4 text-caption text-fg-3">
                    <span className="flex items-center gap-1.5">
                      <Files className="h-3.5 w-3.5" />
                      <span className="font-semibold text-fg-1 tabular">{cleanLive.current.toLocaleString()}</span>
                      files removed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span className="font-semibold text-fg-1 tabular">{formatBytes(cleanLive.freed)}</span>
                      reclaimed
                    </span>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── COMPLETE ── */}
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
