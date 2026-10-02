import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  Rocket,
  Files,
  Activity,
  Cpu,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Play,
  StopCircle,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Scan,
  Monitor,
  ToggleLeft,
  ToggleRight,
  Info,
  X,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import { staggerContainer, staggerItem } from "@/animations/variants";
import type {
  SmartBoostAnalysis,
  SmartBoostResult,
  Recommendation,
  StartupAnalysis,
  StartupEntry,
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateScanProgress,
} from "@/types";
import { PCAdvisorSection } from "@/components/ai/PCAdvisorSection";

// -- Helpers ----------------------------------------------------------------
function healthColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

function priorityColor(priority: Recommendation["priority"]): string {
  if (priority === "critical")
    return "text-red-400 bg-red-500/10 border-red-500/20";
  if (priority === "high")
    return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  if (priority === "medium")
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-text-secondary bg-white/[0.05] border-white/[0.08]";
}

function impactColor(impact: StartupEntry["impact"]): string {
  if (impact === "critical") return "text-red-400";
  if (impact === "high") return "text-orange-400";
  if (impact === "medium") return "text-amber-400";
  return "text-emerald-400";
}

// -- Health Ring ------------------------------------------------------------
const HealthRing: React.FC<{ score: number }> = ({ score }) => {
  const R = 70;
  const C = Math.PI * 2 * R;
  const offset = C * (1 - Math.min(100, score) / 100);
  const color = healthColor(score);

  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-2xl transition-colors duration-700"
        style={{ background: color }}
      />
      {/* Outer decorative ring */}
      <div className="absolute inset-0 rounded-full border border-white/5" />
      <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="10"
        />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="14"
        />
        <motion.circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <motion.span
          key={score}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-black tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">
          Health
        </span>
        <span className="text-sm font-bold" style={{ color }}>
          {healthLabel(score)}
        </span>
      </div>
    </div>
  );
};

// -- Mini Metric ------------------------------------------------------------
const MiniMetric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = "text-brand-primary" }) => (
  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
    <div className={cn("w-6 h-6", color)}>{icon}</div>
    <div className="text-lg font-bold text-text-primary tabular-nums leading-tight">
      {value}
    </div>
    <div className="text-2xs text-text-muted leading-tight">{label}</div>
    {sub && <div className="text-2xs text-text-muted/60">{sub}</div>}
  </div>
);

// -- Progress Step ---------------------------------------------------------
const ProgressStep: React.FC<{ step: string; pct: number }> = ({
  step,
  pct,
}) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs">
      <span className="text-text-secondary">{step}</span>
      <span className="text-text-accent font-semibold tabular-nums">
        {Math.round(pct)}%
      </span>
    </div>
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  </div>
);

// SECTION 1 AI SMART BOOST
const SmartBoostSection: React.FC = () => {
  const { sbAnalysis: analysis, sbResult: result, sbProgress: progress } = useSessionStore(s => s.ai) as { sbAnalysis: SmartBoostAnalysis | null, sbResult: SmartBoostResult | null, sbProgress: { step: string; pct: number } | null };
  const setAi = useSessionStore(s => s.setAi);
  const setAnalysis = (a: any) => setAi({ sbAnalysis: a });
  const setResult = (r: any) => setAi({ sbResult: r });
  const setProgress = (p: any) => setAi({ sbProgress: p });
  
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await window.propel.ai.smartBoostAnalyze();
      setAnalysis(data);
    } catch (e) {
      setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const runOptimize = useCallback(async () => {
    if (!analysis) return;
    setOptimizing(true);
    setProgress({ step: "Starting optimization...", pct: 0 });
    setResult(null);

    window.propel.ai.onSmartBoostProgress((data) => {
      setProgress(data);
    });

    try {
      const res = await window.propel.ai.smartBoostOptimize();
      setResult(res);
      setProgress(null);
      // Re-analyze to refresh scores
      const fresh = await window.propel.ai.smartBoostAnalyze();
      setAnalysis(fresh);
    } catch {
      setError("Optimization failed. Some processes or files could not be cleared safely.");
      setProgress(null);
    } finally {
      setOptimizing(false);
      window.propel.ai.removeListeners();
    }
  }, [analysis]);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-12 text-center">
      <AnimatePresence mode="wait">
        {!optimizing && !result && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center"
          >
            <h2 className="text-3xl font-black text-text-primary tracking-tight">Quick Boost</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
              Optimize your PC with one quick scan.<br />
              Safely improve system responsiveness by cleaning temporary files and optimizing memory.
            </p>
            <Zap className="mt-8 h-10 w-10 text-[#5AA63C]" strokeWidth={1.8} />
            <button
              onClick={analysis ? runOptimize : runAnalysis}
              disabled={analyzing}
              className={cn(
                "mt-7 inline-flex items-center gap-2 px-7 py-3 rounded-lg text-base font-bold text-white transition-all duration-200",
                analyzing
                  ? "bg-white/[0.08] text-text-muted cursor-not-allowed"
                  : "bg-[#5AA63C] hover:bg-[#4f9635] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {analyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {analyzing ? "Scanning..." : "Scan & Boost"}
            </button>
          </motion.div>
        )}

        {optimizing && (
          <motion.div
            key="optimizing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <RefreshCw className="h-8 w-8 text-[#5AA63C] animate-spin" />
            <p className="mt-4 text-base font-semibold text-text-primary">Optimizing your PC...</p>
            <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full w-1/3 rounded-full bg-[#5AA63C]"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <CheckCircle className="h-9 w-9 text-[#5AA63C]" strokeWidth={1.8} />
            <h2 className="mt-4 text-2xl font-black text-text-primary">Boost Complete</h2>
            <div className="mt-5 space-y-1 text-sm text-text-secondary">
              <p>Memory recovered: <span className="font-semibold text-text-primary">{formatBytes(result.ramFreedBytes)}</span></p>
              <p>Storage cleaned: <span className="font-semibold text-text-primary">{formatBytes(result.storageFreedBytes)}</span></p>
              <p>Processes optimized: <span className="font-semibold text-text-primary">{result.processesOptimized}</span></p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="mt-7 rounded-lg bg-white/[0.06] px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.1]"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 max-w-md text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

// SECTION 3 - AI STARTUP ANALYZER
// =========================================================================
const StartupAnalyzerSection: React.FC = () => {
  const { suAnalysis: analysis, suEntries: entries } = useSessionStore(s => s.ai) as { suAnalysis: StartupAnalysis | null, suEntries: StartupEntry[] };
  const setAi = useSessionStore(s => s.setAi);
  const setAnalysis = (a: StartupAnalysis | null) => setAi({ suAnalysis: a });
  const setEntries = (e: StartupEntry[] | ((prev: StartupEntry[]) => StartupEntry[])) => setAi(s => ({ suEntries: typeof e === 'function' ? e(s.suEntries) : e }));
  
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.propel.ai.analyzeStartup();
      setAnalysis(data);
      setEntries(data.entries);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleEntry = useCallback(async (entry: StartupEntry) => {
    setTogglingId(entry.id);
    const newEnabled = !entry.enabled;
    try {
      await window.propel.ai.setStartupEntryEnabled(entry, newEnabled);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, enabled: newEnabled } : e,
        ),
      );
    } catch (err: any) {
      if (err.message === 'RequiresAdmin') {
        setError("This item requires administrator privileges to modify — restart Propel as administrator to change it.");
      } else {
        setError("Failed to modify startup entry.");
      }
    } finally {
      setTogglingId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Startup Manager
            </h2>
            <p className="text-2xs text-text-muted">
              Windows startup entries & estimated impact
            </p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
            loading
              ? "bg-white/[0.06] text-text-muted cursor-not-allowed"
              : "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300",
          )}
        >
          <Scan className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Scanning..." : analysis ? "Re-scan" : "Scan Startup"}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-2 mt-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm font-medium">
                {error}
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!analysis && !loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-dashed border-white/10">
          <Rocket className="w-10 h-10 text-amber-400/50" />
          <p className="text-text-muted text-sm text-center">
            Analyzes Windows registry startup entries
            <br />
            and startup folders to identify estimated impact
          </p>
          <button
            onClick={runAnalysis}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-bold shadow-lg shadow-amber-500/20 hover:scale-105 transition-all"
          >
            Analyze Startup
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 animate-spin border-t-amber-500" />
            <Rocket className="w-5 h-5 text-amber-400 absolute inset-0 m-auto" />
          </div>
          <div>
            <p className="text-text-secondary font-medium text-sm">
              Scanning startup entries
            </p>
            <p className="text-2xs text-text-muted">
              Reading registry & startup folders
            </p>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {/* Boot score */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div
                className="text-2xl font-black"
                style={{ color: healthColor(analysis.bootScore) }}
              >
                {analysis.bootScore}
              </div>
              <div className="text-2xs text-text-muted">Boot Score</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="text-2xl font-black text-text-primary">
                {entries.length}
              </div>
              <div className="text-2xs text-text-muted">Total Entries</div>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <div className="text-2xl font-black text-red-400">
                {analysis.highImpactCount}
              </div>
              <div className="text-2xs text-text-muted">High Impact</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">
              Estimated startup delay:{" "}
              <strong>{analysis.totalEstimatedDelaySec.toFixed(1)}s</strong>{" "}
              total from {entries.length} entries
              <span className="opacity-70 text-2xs block mt-0.5">
                (Estimated based on app type — not measured boot time)
              </span>
            </span>
          </div>

          {/* Startup entries */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {entry.displayName}
                    </span>
                    {(entry.impact === "critical" ||
                      entry.impact === "high") && (
                      <span
                        className={cn(
                          "text-2xs font-bold px-1.5 py-0.5 rounded-md",
                          impactColor(entry.impact),
                          "bg-current/10",
                        )}
                      >
                        {entry.impactLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    {entry.publisher}
                  </div>
                  <div
                    className={cn("text-2xs mt-0.5", impactColor(entry.impact))}
                  >
                    Estimated impact: +{entry.estimatedDelaySec}s
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <button
                    onClick={() => toggleEntry(entry)}
                    disabled={togglingId === entry.id}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                      togglingId === entry.id
                        ? "opacity-50 cursor-not-allowed"
                        : entry.enabled
                          ? "bg-red-500/15 border-red-500/25 text-red-400 hover:bg-red-500/25"
                          : "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25",
                    )}
                  >
                    {togglingId === entry.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : entry.enabled ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Disable
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Enable
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// =========================================================================
// SECTION 4 - AI DUPLICATE FINDER
// =========================================================================
const DuplicateFinderSection: React.FC = () => {
  const { dupScanResult: scanResult, dupProgress: progress, dupSelected: selected, dupExpandedGroups: expandedGroups, dupDeleteResult: deleteResult, dupFilterCategory: filterCategory } = useSessionStore(s => s.ai) as { dupScanResult: DuplicateScanResult | null, dupProgress: DuplicateScanProgress | null, dupSelected: Set<string>, dupExpandedGroups: Set<string>, dupDeleteResult: { freedBytes: number; deletedCount: number; } | null, dupFilterCategory: string };
  const setAi = useSessionStore(s => s.setAi);
  const setScanResult = (r: DuplicateScanResult | null) => setAi({ dupScanResult: r });
  const setProgress = (p: DuplicateScanProgress | null) => setAi({ dupProgress: p });
  const setSelected = (s: Set<string> | ((prev: Set<string>) => Set<string>)) => setAi(st => ({ dupSelected: typeof s === 'function' ? s(st.dupSelected) : s }));
  const setExpandedGroups = (s: Set<string> | ((prev: Set<string>) => Set<string>)) => setAi(st => ({ dupExpandedGroups: typeof s === 'function' ? s(st.dupExpandedGroups) : s }));
  const setDeleteResult = (r: { freedBytes: number; deletedCount: number; } | null) => setAi({ dupDeleteResult: r });
  const setFilterCategory = (c: string) => setAi({ dupFilterCategory: c });

  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    setSelected(new Set());
    setDeleteResult(null);
    setProgress({
      phase: "scanning",
      scannedFiles: 0,
      hashedFiles: 0,
      totalFiles: 0,
      currentPath: "",
      duplicatesFound: 0,
    });

    window.propel.ai.onDuplicateScanProgress((p) => setProgress(p));

    try {
      const result = await window.propel.ai.scanDuplicates(null, []);
      setScanResult(result);
    } catch {
      /* non-critical */
    } finally {
      setScanning(false);
      setProgress(null);
      window.propel.ai.removeListeners();
    }
  }, []);

  const autoSelectDuplicates = useCallback(() => {
    if (!scanResult) return;
    const newSelected = new Set<string>();
    for (const group of scanResult.groups) {
      // Select all except original (first file)
      for (const f of group.files) {
        if (!f.isOriginal) newSelected.add(f.path);
      }
    }
    setSelected(newSelected);
  }, [scanResult]);

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await window.propel.ai.deleteDuplicates([...selected]);
      setDeleteResult({
        freedBytes: res.freedBytes,
        deletedCount: res.deletedCount,
      });
      // Remove deleted files from result
      setSelected(new Set());
      if (scanResult) {
        const remainingGroups = scanResult.groups
          .map((g) => ({
            ...g,
            files: g.files.filter((f) => !selected.has(f.path)),
          }))
          .filter((g) => g.files.length > 1);
        setScanResult({ ...scanResult, groups: remainingGroups });
      }
    } catch {
      /* non-critical */
    } finally {
      setDeleting(false);
    }
  }, [selected, scanResult]);

  const filteredGroups =
    scanResult?.groups.filter(
      (g) => filterCategory === "all" || g.category === filterCategory,
    ) ?? [];

  const CATEGORIES = [
    "all",
    "images",
    "videos",
    "documents",
    "archives",
    "installers",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Files className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">
              AI Duplicate Finder
            </h2>
            <p className="text-2xs text-text-muted">
              Hash-based duplicate detection & safe removal
            </p>
          </div>
        </div>
        <button
          onClick={startScan}
          disabled={scanning}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
            scanning
              ? "bg-white/[0.06] text-text-muted cursor-not-allowed"
              : "bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300",
          )}
        >
          <Scan className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
          {scanning ? "Scanning..." : scanResult ? "Re-scan" : "Scan Files"}
        </button>
      </div>

      {/* Scan progress */}
      {scanning && progress && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-xs font-semibold text-text-secondary capitalize">
              {progress.phase}...
            </span>
            {progress.duplicatesFound > 0 && (
              <span className="ml-auto text-xs text-rose-400 font-semibold">
                {progress.duplicatesFound} duplicates found
              </span>
            )}
          </div>
          <ProgressStep
            step={
              progress.phase === "scanning"
                ? `Collecting files (${progress.scannedFiles} found)...`
                : progress.phase === "hashing"
                  ? `Hashing candidates (${progress.hashedFiles}/${progress.totalFiles})...`
                  : "Grouping duplicates..."
            }
            pct={
              progress.phase === "scanning"
                ? 30
                : progress.phase === "hashing"
                  ? 30 +
                    Math.round(
                      (progress.hashedFiles /
                        Math.max(1, progress.totalFiles)) *
                        50,
                    )
                  : 90
            }
          />
          {progress.currentPath && (
            <p className="text-2xs text-text-muted truncate">
              {progress.currentPath.split("\\").slice(-2).join("\\")}
            </p>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {!scanResult && !scanning && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-dashed border-white/10">
          <Files className="w-10 h-10 text-rose-400/50" />
          <p className="text-text-muted text-sm text-center">
            Scans Documents, Pictures, Videos & Desktop
            <br />
            using MD5 hash-based detection
          </p>
          <button
            onClick={startScan}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-bold shadow-lg shadow-rose-500/20 hover:scale-105 transition-all"
          >
            Start Scan
          </button>
        </div>
      )}

      {/* Results */}
      {scanResult && !scanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="text-xl font-black text-rose-400">
                {scanResult.totalDuplicates}
              </div>
              <div className="text-2xs text-text-muted">Duplicates</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="text-xl font-black text-orange-400">
                {formatBytes(scanResult.totalWastedBytes)}
              </div>
              <div className="text-2xs text-text-muted">Wasted Space</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="text-xl font-black text-text-primary">
                {scanResult.groups.length}
              </div>
              <div className="text-2xs text-text-muted">Groups</div>
            </div>
          </div>

          {/* Delete result */}
          {deleteResult && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300">
                Deleted {deleteResult.deletedCount} files | Freed{" "}
                {formatBytes(deleteResult.freedBytes)}
              </span>
            </div>
          )}

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-2xs font-semibold capitalize transition-all",
                  filterCategory === cat
                    ? "bg-rose-500/25 border border-rose-500/40 text-rose-300"
                    : "bg-white/[0.04] border border-white/[0.08] text-text-muted hover:text-text-secondary",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={autoSelectDuplicates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-text-secondary hover:text-text-primary transition-all"
            >
              <Target className="w-3.5 h-3.5" /> Auto-Select Duplicates
            </button>
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  deleting
                    ? "bg-white/[0.04] text-text-muted cursor-not-allowed"
                    : "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30",
                )}
              >
                {deleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete {selected.size} selected
              </button>
            )}
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs text-text-muted hover:text-text-secondary transition-all"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Duplicate groups */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredGroups.length === 0 && (
              <div className="text-center py-6 text-text-muted text-sm">
                No duplicates found in this category.
              </div>
            )}
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.hash);
              const duplicates = group.files.filter((f) => !f.isOriginal);
              const allDupsSelected = duplicates.every((f) =>
                selected.has(f.path),
              );
              return (
                <div
                  key={group.hash}
                  className="rounded-xl border border-white/[0.06] overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() =>
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.hash)) next.delete(group.hash);
                        else next.add(group.hash);
                        return next;
                      })
                    }
                  >
                    <input
                      type="checkbox"
                      checked={allDupsSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const f of duplicates) {
                            if (allDupsSelected) next.delete(f.path);
                            else next.add(f.path);
                          }
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded accent-rose-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate">
                        {group.files[0].name}
                      </div>
                      <div className="text-2xs text-text-muted capitalize">
                        {group.category} | {group.count} copies |{" "}
                        {formatBytes(group.size)} each
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-rose-400">
                        {formatBytes(group.totalWasted)} wasted
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 text-text-muted transition-transform shrink-0",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                          {group.files.map((file) => (
                            <div
                              key={file.path}
                              className="flex items-center gap-2.5 px-3 py-2"
                            >
                              {file.isOriginal ? (
                                <Shield
                                  className="w-3.5 h-3.5 text-emerald-400/70 shrink-0"
                                  aria-label="Original"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selected.has(file.path)}
                                  onChange={() =>
                                    setSelected((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(file.path))
                                        next.delete(file.path);
                                      else next.add(file.path);
                                      return next;
                                    })
                                  }
                                  className="w-3 h-3 rounded accent-rose-500 shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-2xs text-text-secondary truncate"
                                  title={file.path}
                                >
                                  {file.path}
                                </div>
                              </div>
                              {file.isOriginal && (
                                <span className="text-2xs text-emerald-400/70 font-semibold shrink-0">
                                  Original
                                </span>
                              )}
                              <span className="text-2xs text-text-muted shrink-0">
                                {formatBytes(file.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// =========================================================================
const StartupManagerPremium: React.FC = () => {
  const { suAnalysis: analysis, suEntries: entries } = useSessionStore(s => s.ai) as { suAnalysis: StartupAnalysis | null; suEntries: StartupEntry[] };
  const setAi = useSessionStore(s => s.setAi);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await window.propel.ai.analyzeStartup();
      setAi({ suAnalysis: data, suEntries: data.entries });
    } catch { setError("Startup analysis failed. Please try again."); }
    finally { setLoading(false); }
  }, [setAi]);

  const toggleEntry = useCallback(async (entry: StartupEntry) => {
    setTogglingId(entry.id); setError(null);
    try {
      await window.propel.ai.setStartupEntryEnabled(entry, !entry.enabled);
      setAi(s => ({ suEntries: s.suEntries.map(item => item.id === entry.id ? { ...item, enabled: !item.enabled } : item) }));
    } catch (err: any) {
      setError(err?.message === "RequiresAdmin" ? "This item requires administrator privileges to modify." : "Failed to modify startup entry.");
    } finally { setTogglingId(null); }
  }, [setAi]);

  const enabledCount = entries.filter(entry => entry.enabled).length;
  const impact = analysis ? `${analysis.totalEstimatedDelaySec.toFixed(1)}s` : "Not scanned";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Startup Manager</h2>
          <p className="text-xs text-text-muted mt-1">Windows startup entries &amp; estimated impact</p>
        </div>
        <button onClick={runAnalysis} disabled={loading} className="flex items-center gap-2 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#4f9635] disabled:cursor-not-allowed disabled:opacity-60">
          <Scan className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Scanning..." : "Scan Startup"}
        </button>
      </div>

      {analysis && !loading && (
        <div className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2">
          {[
            ["Startup Items", entries.length],
            ["Enabled", enabledCount],
            ["Disabled", entries.length - enabledCount],
            ["Estimated Impact", impact],
          ].map(([label, value]) => <div key={label} className="border border-border/50 bg-white/[0.025] px-4 py-3 rounded-xl"><p className="text-2xs text-text-muted">{label}</p><p className="mt-1 text-lg font-bold text-text-primary">{value}</p></div>)}
        </div>
      )}

      {error && <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle className="h-4 w-4" />{error}</div>}

      {!analysis && !loading && (
        <div className="border border-border/60 bg-white/[0.025] rounded-2xl p-7">
          <div className="flex items-start gap-4">
            <Rocket className="mt-1 h-7 w-7 text-brand-primary" />
            <div><h3 className="text-base font-bold text-text-primary">Startup Health</h3><p className="mt-1 text-xs text-text-muted">Keep your Windows startup lean and responsive.</p><p className="mt-5 text-sm font-semibold text-text-primary">No startup analysis yet</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-text-muted">Scan your startup entries to see which applications launch with Windows and identify entries with higher estimated impact.</p><button onClick={runAnalysis} className="mt-5 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4f9635]">Scan Startup</button></div>
          </div>
          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border/40 pt-4 text-xs text-text-muted"><span>Startup applications</span><span>Estimated impact</span><span>Enable / disable controls</span></div>
        </div>
      )}

      {loading && <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/[0.025] p-5 text-sm text-text-secondary"><RefreshCw className="h-4 w-4 animate-spin text-brand-primary" />Scanning startup entries...</div>}

      {analysis && !loading && (entries.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-10 text-center"><CheckCircle className="h-8 w-8 text-emerald-400" /><h3 className="mt-3 text-base font-bold text-text-primary">Your startup is clean</h3></div> : <div className="space-y-3"><h3 className="text-sm font-bold text-text-primary">Startup Applications</h3><div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">{entries.map(entry => <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_100px_110px] items-center gap-4 p-4 hover:bg-white/[0.025]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{entry.displayName}</p><p className="truncate text-2xs text-text-muted">{entry.publisher || entry.location}</p></div><div><span className={cn("text-2xs font-semibold", entry.enabled ? "text-emerald-400" : "text-text-muted")}>{entry.enabled ? "Enabled" : "Disabled"}</span><p className={cn("text-2xs mt-1", impactColor(entry.impact))}>{entry.impactLabel}</p></div><button onClick={() => toggleEntry(entry)} disabled={togglingId === entry.id} className={cn("justify-self-end rounded-lg border px-2.5 py-1.5 text-2xs font-semibold", entry.enabled ? "border-red-500/20 text-red-300 hover:bg-red-500/10" : "border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10")}>{togglingId === entry.id ? "Saving..." : entry.enabled ? "Disable" : "Enable"}</button></div>)}</div></div>)}
    </div>
  );
};

const DuplicateFinderPremium: React.FC = () => {
  const { dupScanResult: scanResult, dupProgress: progress, dupSelected: selected, dupExpandedGroups: expandedGroups, dupDeleteResult: deleteResult, dupFilterCategory: filterCategory } = useSessionStore(s => s.ai) as { dupScanResult: DuplicateScanResult | null; dupProgress: DuplicateScanProgress | null; dupSelected: Set<string>; dupExpandedGroups: Set<string>; dupDeleteResult: { freedBytes: number; deletedCount: number } | null; dupFilterCategory: string };
  const setAi = useSessionStore(s => s.setAi); const [scanning, setScanning] = useState(false); const [deleting, setDeleting] = useState(false);
  const startScan = useCallback(async () => { setScanning(true); setAi({ dupScanResult: null, dupSelected: new Set(), dupDeleteResult: null, dupProgress: { phase: "scanning", scannedFiles: 0, hashedFiles: 0, totalFiles: 0, currentPath: "", duplicatesFound: 0 } }); window.propel.ai.onDuplicateScanProgress(p => setAi({ dupProgress: p })); try { setAi({ dupScanResult: await window.propel.ai.scanDuplicates(null, []) }); } finally { setScanning(false); setAi({ dupProgress: null }); window.propel.ai.removeListeners(); } }, [setAi]);
  const toggleGroup = (hash: string) => setAi(s => { const next = new Set<string>(s.dupExpandedGroups); next.has(hash) ? next.delete(hash) : next.add(hash); return { dupExpandedGroups: next }; });
  const selectFiles = (paths: string[]) => setAi(s => { const next = new Set<string>(s.dupSelected); paths.forEach(path => next.has(path) ? next.delete(path) : next.add(path)); return { dupSelected: next }; });
  const deleteSelected = useCallback(async () => { if (!selected.size) return; setDeleting(true); try { const res = await window.propel.ai.deleteDuplicates([...selected]); setAi(s => ({ dupDeleteResult: { freedBytes: res.freedBytes, deletedCount: res.deletedCount }, dupSelected: new Set<string>(), dupScanResult: s.dupScanResult ? { ...s.dupScanResult, groups: s.dupScanResult.groups.map((g: DuplicateGroup) => ({ ...g, files: g.files.filter(f => !selected.has(f.path)) })).filter((g: DuplicateGroup) => g.files.length > 1) } : null })); } finally { setDeleting(false); } }, [selected, setAi]);
  useEffect(() => {
    const onDeleteSelected = () => { void deleteSelected(); };
    window.addEventListener("propel:duplicate-delete-selected", onDeleteSelected);
    return () => window.removeEventListener("propel:duplicate-delete-selected", onDeleteSelected);
  }, [deleteSelected]);
  const selectedSpace = scanResult?.groups.flatMap(group => group.files).filter(file => selected.has(file.path)).reduce((total, file) => total + file.size, 0) ?? 0;
  const groups = scanResult?.groups.filter(g => filterCategory === "all" || g.category === filterCategory) ?? [];
  return <div className="space-y-5"><div className="flex items-center justify-between border-b border-white/[0.06] pb-4"><div><h2 className="text-xl font-bold text-text-primary">AI Duplicate Finder</h2><p className="text-xs text-text-muted mt-1">Hash-based duplicate detection &amp; safe removal</p></div><button onClick={startScan} disabled={scanning} className="flex items-center gap-2 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4f9635] disabled:opacity-60"><Scan className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />{scanning ? "Scanning..." : "Scan Files"}</button></div>{!scanResult && !scanning && <div className="grid gap-5 rounded-2xl border border-border/60 bg-white/[0.025] p-7 md:grid-cols-[1.3fr_1fr]"><div><h3 className="text-lg font-bold text-text-primary">Find duplicate files safely</h3><p className="mt-2 text-sm text-text-secondary">Scan selected locations for identical files using hash-based detection.</p><p className="mt-5 text-xs text-text-muted">Files are only removed after review.</p><button onClick={startScan} className="mt-5 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4f9635]">Scan Files</button></div><div className="border-l border-border/40 pl-5 text-xs text-text-muted"><p className="font-semibold text-text-primary">How it works</p><div className="mt-4 space-y-4"><p><b className="mr-2 text-brand-primary">01</b>Scan<br /><span className="ml-7">Find potential duplicate files.</span></p><p><b className="mr-2 text-brand-primary">02</b>Review<br /><span className="ml-7">Compare duplicate groups and choose what to keep.</span></p><p><b className="mr-2 text-brand-primary">03</b>Clean<br /><span className="ml-7">Safely remove selected duplicates.</span></p></div></div></div>}{scanning && progress && <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/[0.025] p-5 text-sm text-text-secondary"><RefreshCw className="h-4 w-4 animate-spin text-brand-primary" />{progress.phase === "hashing" ? "Hashing files..." : "Scanning files..."}</div>}{scanResult && !scanning && <div className="space-y-4"><div className="grid grid-cols-3 gap-3">{[["Duplicate Groups", scanResult.groups.length], ["Duplicate Files", scanResult.totalDuplicates], ["Recoverable Space", formatBytes(scanResult.totalWastedBytes)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border/50 bg-white/[0.025] p-3"><p className="text-2xs text-text-muted">{label}</p><p className="mt-1 text-lg font-bold text-text-primary">{value}</p></div>)}</div>{deleteResult && <p className="text-xs text-emerald-400">Removed {deleteResult.deletedCount} files and freed {formatBytes(deleteResult.freedBytes)}.</p>}{groups.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-10 text-center"><CheckCircle className="h-8 w-8 text-emerald-400" /><h3 className="mt-3 text-base font-bold text-text-primary">No duplicates found</h3><p className="mt-1 text-xs text-text-muted">Your selected locations don't contain identical files.</p></div> : <><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-text-primary">Duplicate Groups</h3><span className="text-xs text-text-muted">Selected: {selected.size} files · Potential space: {formatBytes([...selected].reduce((sum, path) => sum + (scanResult.groups.flatMap(g => g.files).find(f => f.path === path)?.size ?? 0), 0))}</span></div><div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">{groups.map(group => { const duplicates = group.files.filter(f => !f.isOriginal); const allSelected = duplicates.every(f => selected.has(f.path)); return <div key={group.hash}><div className="flex items-center gap-3 p-4 hover:bg-white/[0.025]"><input type="checkbox" checked={allSelected} onChange={() => selectFiles(duplicates.map(f => f.path))} className="accent-[rgb(var(--c-accent))]" /><button onClick={() => toggleGroup(group.hash)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Files className="h-4 w-4 shrink-0 text-brand-primary" /><span className="truncate text-sm font-semibold text-text-primary">{group.files[0]?.name}</span><span className="text-2xs text-text-muted">{group.count} copies · {formatBytes(group.size)} each</span><ChevronRight className={cn("ml-auto h-4 w-4 text-text-muted", expandedGroups.has(group.hash) && "rotate-90")} /></button></div>{expandedGroups.has(group.hash) && <div className="border-t border-border/40 bg-white/[0.015] px-4 py-2">{group.files.map(file => <div key={file.path} className="flex items-center gap-3 py-2 text-xs"><span className="w-4 shrink-0">{file.isOriginal ? <Shield className="h-3.5 w-3.5 text-emerald-400" /> : <input type="checkbox" checked={selected.has(file.path)} onChange={() => selectFiles([file.path])} className="accent-[rgb(var(--c-accent))]" />}</span><span className="min-w-0 flex-1 truncate text-text-secondary" title={file.path}>{file.path}</span><span className="shrink-0 text-text-muted">{formatBytes(file.size)}</span></div>)}</div>}</div>})}</div>{selected.size > 0 && <button onClick={deleteSelected} disabled={deleting} className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-60">{deleting ? "Deleting..." : `Delete ${selected.size} selected`}</button>}</>}</div>}</div>;
};

const DuplicateSelectionBar: React.FC = () => {
  const { dupScanResult, dupSelected } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const selectedSpace = dupScanResult?.groups.flatMap((group: DuplicateGroup) => group.files)
    .filter((file: { path: string; size: number }) => dupSelected.has(file.path))
    .reduce((total: number, file: { path: string; size: number }) => total + file.size, 0) ?? 0;

  if (dupSelected.size === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(100%-2rem,42rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-border/70 bg-bg-elevated/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{dupSelected.size} files selected</p>
        <p className="text-xs text-text-muted">Recoverable space: {formatBytes(selectedSpace)}</p>
      </div>
      <button
        onClick={() => setAi({ dupSelected: new Set<string>() })}
        className="text-xs font-semibold text-text-muted hover:text-text-primary"
      >
        Clear Selection
      </button>
      <button
        onClick={() => window.dispatchEvent(new Event("propel:duplicate-delete-selected"))}
        className="rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#4f9635]"
      >
        Delete Selected
      </button>
    </div>
  );
};

// MAIN PAGE
// =========================================================================
type Tab = "advisor" | "boost" | "startup" | "duplicates";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}[] = [
  {
    id: "advisor",
    label: "PC Advisor",
    icon: <Brain className="w-4 h-4" />,
    badge: "AI",
  },
  {
    id: "boost",
    label: "Quick Boost",
    icon: <Zap className="w-4 h-4" />,
  },

  {
    id: "startup",
    label: "Startup",
    icon: <Rocket className="w-4 h-4" />,
  },
  {
    id: "duplicates",
    label: "Duplicate Finder",
    icon: <Files className="w-4 h-4" />,
  },
];

export const AIFeaturesPage: React.FC = () => {
  const { activeTab } = useSessionStore(s => s.ai);
  const setAi = useSessionStore(s => s.setAi);
  const setActiveTab = (t: any) => setAi({ activeTab: t });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* -- Header & Tabs -- */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">
                AI Features
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Real intelligent system analysis & optimization
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/15 border border-brand-primary/25">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <span className="text-xs font-bold text-brand-primary tracking-wider">
                PREMIUM
              </span>
            </div>
          </div>

          {/* Horizontal Selector */}
          <div className="mt-6 flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border",
                    isActive
                      ? "bg-brand-primary/15 border-brand-primary/30 text-brand-primary shadow-glow-sm"
                      : "bg-white/[0.02] border-white/[0.05] text-text-muted hover:text-text-secondary hover:bg-white/[0.05]"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge && (
                    <span className={cn(
                      "text-2xs font-black px-1.5 py-0.5 rounded ml-1",
                      isActive ? "bg-brand-primary/20 text-brand-primary" : "bg-white/10 text-text-muted"
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* -- Content -- */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === "advisor" && (
              <motion.div
                key="advisor"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <PCAdvisorSection />
              </motion.div>
            )}
            {activeTab === "boost" && (
              <motion.div
                key="boost"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <SmartBoostSection />
              </motion.div>
            )}
            {activeTab === "startup" && (
              <motion.div
                key="startup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <StartupManagerPremium />
              </motion.div>
            )}
            {activeTab === "duplicates" && (
              <motion.div
                key="duplicates"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <DuplicateFinderPremium />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {activeTab === "duplicates" && <DuplicateSelectionBar />}
    </div>
  );
};
