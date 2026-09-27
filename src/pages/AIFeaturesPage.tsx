import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  Rocket,
  Files,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Health Ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Mini Metric â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Progress Step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// SECTION 1 â€” AI SMART BOOST
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const SmartBoostSection: React.FC = () => {
  const [analysis, setAnalysis] = useState<SmartBoostAnalysis | null>(null);
  const [result, setResult] = useState<SmartBoostResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<{
    step: string;
    pct: number;
  } | null>(null);
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
    setProgress({ step: "Starting optimizationâ€¦", pct: 0 });
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
      setError("Optimization failed.");
      setProgress(null);
    } finally {
      setOptimizing(false);
      window.propel.ai.removeListeners();
    }
  }, [analysis]);

  return (
    <div className="grid grid-cols-[1.2fr_1fr] max-[900px]:grid-cols-1 gap-6 items-start">
      {/* â”€â”€ Left Column: Main Feature Info â”€â”€ */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
            <Brain className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              Quick Boost
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              One-click RAM + temp file cleanup
            </p>
          </div>
        </div>

        <div className="text-sm text-text-secondary leading-relaxed space-y-4">
          <p>
            Analyze your system and identify safe performance improvements to
            reclaim resources and maximize responsiveness.
          </p>
          <p className="font-semibold text-text-primary mb-2">Analysis:</p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-primary" /> Startup load
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-primary" /> Background process count
            </li>
          </ul>
          <p className="font-semibold text-text-primary mb-2">Optimization:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-primary" /> Memory pressure (Working Set trim)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-primary" /> Temporary system data cleanup
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={analysis ? runOptimize : runAnalysis}
            disabled={analyzing || optimizing}
            className={cn(
              "w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200",
              analyzing || optimizing
                ? "bg-white/[0.06] text-text-muted cursor-not-allowed border border-white/10"
                : "bg-brand-primary text-white shadow-glow-sm hover:shadow-glow-md hover:scale-[1.02]"
            )}
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...
              </span>
            ) : optimizing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Optimizing...
              </span>
            ) : analysis ? (
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> Apply AI Optimizations
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Scan className="w-4 h-4" /> Analyze & Boost
              </span>
            )}
          </button>

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Right Column: Status Panel â”€â”€ */}
      <div className="glass rounded-2xl p-5 border border-white/5 space-y-4 flex flex-col min-h-[300px]">
        <h3 className="text-sm font-semibold text-text-primary border-b border-white/5 pb-3">
          System Optimization
        </h3>

        {!analysis && !analyzing && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
            <Brain className="w-10 h-10 text-brand-primary/40 mb-3" />
            <p className="text-sm font-semibold text-text-primary">
              Ready to analyze
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-[200px]">
              Run an analysis to see system health and actionable recommendations.
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
            <div className="relative w-12 h-12 mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20 animate-spin border-t-brand-primary" />
              <Brain className="w-5 h-5 text-brand-primary absolute inset-0 m-auto" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              Analyzing system...
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-[200px]">
              Scanning processes, RAM, disk, temp files
            </p>
          </div>
        )}

        {analysis && !analyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="shrink-0 scale-75 origin-left -my-4">
                <HealthRing score={analysis.health.overall} />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-text-muted uppercase tracking-wider">RAM</span>
                  <span className="text-sm font-bold text-text-primary">{analysis.systemData.ramPressure}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-text-muted uppercase tracking-wider">CPU</span>
                  <span className="text-sm font-bold text-text-primary">{analysis.systemData.cpuLoad}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-text-muted uppercase tracking-wider">Bkgnd</span>
                  <span className="text-sm font-bold text-text-primary">{analysis.systemData.backgroundProcessCount}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-text-muted uppercase tracking-wider">Junk</span>
                  <span className="text-sm font-bold text-text-primary">{formatBytes(analysis.systemData.tempJunkBytes)}</span>
                </div>
              </div>
            </div>

            {/* Reclaimable summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-2xs text-text-muted mb-1 flex items-center gap-1.5">
                  <MemoryStick className="w-3 h-3 text-brand-primary" />
                  Reclaimable RAM
                </div>
                <div className="text-lg font-black text-brand-primary">
                  {formatBytes(analysis.reclaimableRam)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-2xs text-text-muted mb-1 flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-brand-primary" />
                  Reclaimable Disk
                </div>
                <div className="text-lg font-black text-brand-primary">
                  {formatBytes(analysis.reclaimableStorage)}
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {progress && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <ProgressStep step={progress.step} pct={progress.pct} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-auto p-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20 space-y-2"
              >
                <div className="flex items-center gap-2 text-brand-primary font-bold text-sm">
                  <CheckCircle className="w-4 h-4" /> Optimization Complete
                </div>
                <div className="text-xs text-brand-primary/80 space-y-1 mt-1">
                  {result.actionsApplied.map((action, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-brand-primary/60 shrink-0" />
                      {action}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {analysis.recommendations.length > 0 && !result && (
              <div className="mt-auto space-y-2">
                {analysis.recommendations.slice(0, 2).map((rec) => (
                  <div key={rec.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <AlertTriangle className={cn("w-3.5 h-3.5 mt-0.5", priorityColor(rec.priority).split(' ')[0])} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{rec.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// SECTION 3 â€” AI STARTUP ANALYZER
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const StartupAnalyzerSection: React.FC = () => {
  const [analysis, setAnalysis] = useState<StartupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StartupEntry[]>([]);
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
          {loading ? "Scanningâ€¦" : analysis ? "Re-scan" : "Scan Startup"}
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
              Scanning startup entriesâ€¦
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

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// SECTION 4 â€” AI DUPLICATE FINDER
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const DuplicateFinderSection: React.FC = () => {
  const [scanResult, setScanResult] = useState<DuplicateScanResult | null>(
    null,
  );
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteResult, setDeleteResult] = useState<{
    freedBytes: number;
    deletedCount: number;
  } | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

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
          {scanning ? "Scanningâ€¦" : scanResult ? "Re-scan" : "Scan Files"}
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
              {progress.phase}â€¦
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
                ? `Collecting files (${progress.scannedFiles} found)â€¦`
                : progress.phase === "hashing"
                  ? `Hashing candidates (${progress.hashedFiles}/${progress.totalFiles})â€¦`
                  : "Grouping duplicatesâ€¦"
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
                Deleted {deleteResult.deletedCount} files Â· Freed{" "}
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
                        {group.category} Â· {group.count} copies Â·{" "}
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

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// MAIN PAGE
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
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
  const [activeTab, setActiveTab] = useState<Tab>("advisor");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* â”€â”€ Header & Tabs â”€â”€ */}
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

      {/* â”€â”€ Content â”€â”€ */}
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
                <StartupAnalyzerSection />
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
                <DuplicateFinderSection />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
