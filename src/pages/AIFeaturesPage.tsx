import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  Gamepad2,
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
  GameDetectionResult,
  GameModeStatus,
  StartupAnalysis,
  StartupEntry,
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateScanProgress,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Health Ring ────────────────────────────────────────────────────────────
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

// ── Mini Metric ────────────────────────────────────────────────────────────
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

// ── Progress Step ─────────────────────────────────────────────────────────
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1 — AI SMART BOOST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    setProgress({ step: "Starting optimization…", pct: 0 });
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-glow-sm">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">
              AI Smart Boost
            </h2>
            <p className="text-2xs text-text-muted">
              Real system analysis & safe optimization
            </p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing || optimizing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
            analyzing
              ? "bg-white/[0.06] text-text-muted cursor-not-allowed"
              : "bg-brand-primary/20 hover:bg-brand-primary/30 text-text-accent border border-brand-primary/30",
          )}
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", analyzing && "animate-spin")}
          />
          {analyzing
            ? "Analyzing…"
            : analysis
              ? "Re-analyze"
              : "Analyze & Boost"}
        </button>
      </div>

      {/* Initial state */}
      {!analysis && !analyzing && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 rounded-2xl border border-dashed border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center">
            <Brain className="w-8 h-8 text-brand-primary" />
          </div>
          <div className="text-center">
            <p className="text-text-secondary font-medium">
              Run a full system analysis
            </p>
            <p className="text-xs text-text-muted mt-1">
              Scans RAM, CPU, temp files, startup load & processes
            </p>
          </div>
          <button
            onClick={runAnalysis}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white text-sm font-bold shadow-glow-sm hover:shadow-glow-md transition-all duration-200 hover:scale-105"
          >
            Start Analysis
          </button>
        </div>
      )}

      {/* Loading */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-brand-primary/20 animate-spin border-t-brand-primary" />
            <Brain className="w-6 h-6 text-brand-primary absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <p className="text-text-secondary font-medium">Analyzing system…</p>
            <p className="text-xs text-text-muted mt-1">
              Scanning processes, RAM, disk, temp files
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && !analyzing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Main dashboard */}
          <div className="grid grid-cols-[auto_1fr] gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <HealthRing score={analysis.health.overall} />
            <div className="grid grid-cols-3 gap-2 content-center">
              <MiniMetric
                icon={<Cpu className="w-full h-full" />}
                label="CPU Load"
                value={`${analysis.systemData.cpuLoad}%`}
                color="text-brand-accent"
              />
              <MiniMetric
                icon={<MemoryStick className="w-full h-full" />}
                label="RAM Pressure"
                value={`${analysis.systemData.ramPressure}%`}
                sub={formatBytes(analysis.systemData.freeRam) + " free"}
                color="text-brand-secondary"
              />
              <MiniMetric
                icon={<HardDrive className="w-full h-full" />}
                label="Disk Usage"
                value={`${analysis.systemData.diskUsage}%`}
                sub={formatBytes(analysis.systemData.freeDisk) + " free"}
                color="text-brand-primary"
              />
              <MiniMetric
                icon={<Trash2 className="w-full h-full" />}
                label="Temp Junk"
                value={formatBytes(analysis.systemData.tempJunkBytes)}
                color="text-orange-400"
              />
              <MiniMetric
                icon={<Activity className="w-full h-full" />}
                label="Background"
                value={`${analysis.systemData.backgroundProcessCount}`}
                sub="low-activity procs"
                color="text-amber-400"
              />
              <MiniMetric
                icon={<Clock className="w-full h-full" />}
                label="Uptime"
                value={`${Math.round(analysis.systemData.uptimeSeconds / 3600)}h`}
                sub={`${Math.round((analysis.systemData.uptimeSeconds / 60) % 60)}m`}
                color="text-teal-400"
              />
            </div>
          </div>

          {/* Reclaimable summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20">
              <div className="flex items-center gap-2 mb-1">
                <MemoryStick className="w-4 h-4 text-brand-secondary" />
                <span className="text-xs font-semibold text-brand-secondary">
                  Reclaimable RAM
                </span>
              </div>
              <div className="text-xl font-black text-brand-secondary">
                {formatBytes(analysis.reclaimableRam)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-semibold text-brand-primary">
                  Reclaimable Storage
                </span>
              </div>
              <div className="text-xl font-black text-brand-primary">
                {formatBytes(analysis.reclaimableStorage)}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Recommendations
              </p>
              {analysis.recommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border",
                    priorityColor(rec.priority),
                  )}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">
                      {rec.title}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {rec.detail}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Optimize button & progress */}
          <AnimatePresence mode="wait">
            {progress && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3"
              >
                <ProgressStep step={progress.step} pct={progress.pct} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result banner */}
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-emerald-300">
                  Optimization Complete
                </span>
                <span className="text-xs text-text-muted ml-auto">
                  {(result.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-text-muted">RAM Freed: </span>
                  <span className="font-bold text-emerald-300">
                    {formatBytes(result.ramFreedBytes)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Storage Freed: </span>
                  <span className="font-bold text-emerald-300">
                    {formatBytes(result.storageFreedBytes)}
                  </span>
                </div>
              </div>
              {result.actionsApplied.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-emerald-400/80"
                >
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  {action}
                </div>
              ))}
            </motion.div>
          )}

          <button
            onClick={runOptimize}
            disabled={optimizing}
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-bold transition-all duration-200",
              optimizing
                ? "bg-white/[0.06] text-text-muted cursor-not-allowed"
                : "bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-glow-sm hover:shadow-glow-md hover:scale-[1.01]",
            )}
          >
            {optimizing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Optimizing
                System…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> Apply AI Optimizations
              </span>
            )}
          </button>
        </motion.div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2 — AI GAME MODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GameModeSection: React.FC = () => {
  const [detection, setDetection] = useState<GameDetectionResult | null>(null);
  const [status, setStatus] = useState<GameModeStatus | null>(null);
  const [gameModeActive, setGameModeActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const autoDetectTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    window.propel.ai
      .getGameModeState()
      .then(setGameModeActive)
      .catch(() => {});
    return () => {
      if (autoDetectTimer.current) clearInterval(autoDetectTimer.current);
    };
  }, []);

  const detectGames = useCallback(async () => {
    setDetecting(true);
    try {
      const res = await window.propel.ai.detectGames();
      setDetection(res);
    } catch {
      /* non-critical */
    } finally {
      setDetecting(false);
    }
  }, []);

  const toggleGameMode = useCallback(async () => {
    setToggling(true);
    try {
      if (gameModeActive) {
        const res = await window.propel.ai.disableGameMode();
        setStatus(res);
        setGameModeActive(false);
      } else {
        const res = await window.propel.ai.enableGameMode();
        setStatus(res);
        setGameModeActive(true);
      }
    } catch {
      /* non-critical */
    } finally {
      setToggling(false);
    }
  }, [gameModeActive]);

  useEffect(() => {
    if (autoDetect) {
      detectGames();
      autoDetectTimer.current = setInterval(detectGames, 10000);
    } else {
      if (autoDetectTimer.current) {
        clearInterval(autoDetectTimer.current);
        autoDetectTimer.current = null;
      }
    }
  }, [autoDetect, detectGames]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Gamepad2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text-primary">
            AI Game Mode
          </h2>
          <p className="text-2xs text-text-muted">
            Detect games & boost performance safely
          </p>
        </div>
      </div>

      {/* Active banner */}
      <AnimatePresence>
        {gameModeActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-emerald-300">
                Performance Mode Active
              </span>
              <span className="text-xs text-emerald-400/70 ml-auto">
                System optimized for gaming
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        {/* Auto detect toggle */}
        <button
          onClick={() => setAutoDetect((v) => !v)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
            autoDetect
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
              : "bg-white/[0.04] border-white/[0.08] text-text-muted hover:text-text-secondary",
          )}
        >
          {autoDetect ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          Auto Detect Games
        </button>

        <button
          onClick={detectGames}
          disabled={detecting}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-text-secondary hover:text-text-primary transition-all"
        >
          <Scan className={cn("w-3.5 h-3.5", detecting && "animate-spin")} />
          {detecting ? "Scanning…" : "Scan Now"}
        </button>

        <button
          onClick={toggleGameMode}
          disabled={toggling}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
            toggling
              ? "bg-white/[0.06] text-text-muted cursor-not-allowed"
              : gameModeActive
                ? "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:scale-105",
          )}
        >
          {toggling ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : gameModeActive ? (
            <>
              <StopCircle className="w-3.5 h-3.5" /> Disable
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" /> Activate
            </>
          )}
        </button>
      </div>

      {/* Detected games */}
      {detection && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          {detection.games.length > 0 ? (
            detection.games.map((g) => (
              <div
                key={g.pid}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary truncate">
                    {g.displayName}
                  </div>
                  <div className="text-2xs text-text-muted">PID {g.pid}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-blue-400">
                    {g.cpuPercent}% CPU
                  </div>
                  <div className="text-2xs text-text-muted">
                    {formatBytes(g.memBytes)} RAM
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-text-muted text-sm">
              <Info className="w-4 h-4 shrink-0" />
              No high-resource applications detected. You can still manually
              activate Game Mode.
            </div>
          )}
        </motion.div>
      )}

      {/* Status details */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-2xl border space-y-2",
            status.active
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-white/[0.03] border-white/[0.06]",
          )}
        >
          {status.active && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-text-muted">RAM Freed: </span>
                <span className="font-bold text-emerald-300">
                  {formatBytes(status.ramFreedBytes)}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Processes: </span>
                <span className="font-bold text-emerald-300">
                  {status.processesAffected} adjusted
                </span>
              </div>
            </div>
          )}
          {status.actionsApplied.map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 text-xs",
                status.active ? "text-emerald-400/80" : "text-text-muted",
              )}
            >
              <CheckCircle className="w-3 h-3 shrink-0" /> {a}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3 — AI STARTUP ANALYZER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const StartupAnalyzerSection: React.FC = () => {
  const [analysis, setAnalysis] = useState<StartupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StartupEntry[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
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
    } catch {
      /* non-critical */
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
              AI Startup Analyzer
            </h2>
            <p className="text-2xs text-text-muted">
              Windows startup entries & boot impact
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
          {loading ? "Scanning…" : analysis ? "Re-scan" : "Scan Startup"}
        </button>
      </div>

      {!analysis && !loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-dashed border-white/10">
          <Rocket className="w-10 h-10 text-amber-400/50" />
          <p className="text-text-muted text-sm text-center">
            Analyzes Windows registry startup entries
            <br />
            and startup folders to identify boot impact
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
              Scanning startup entries…
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
                    +{entry.estimatedDelaySec}s boot delay
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4 — AI DUPLICATE FINDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
          {scanning ? "Scanning…" : scanResult ? "Re-scan" : "Scan Files"}
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
              {progress.phase}…
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
                ? `Collecting files (${progress.scannedFiles} found)…`
                : progress.phase === "hashing"
                  ? `Hashing candidates (${progress.hashedFiles}/${progress.totalFiles})…`
                  : "Grouping duplicates…"
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
                Deleted {deleteResult.deletedCount} files · Freed{" "}
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
                        {group.category} · {group.count} copies ·{" "}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type Tab = "boost" | "gamemode" | "startup" | "duplicates";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}[] = [
  {
    id: "boost",
    label: "Smart Boost",
    icon: <Brain className="w-3.5 h-3.5" />,
    color: "indigo",
    badge: "AI",
  },
  {
    id: "gamemode",
    label: "Game Mode",
    icon: <Gamepad2 className="w-3.5 h-3.5" />,
    color: "emerald",
  },
  {
    id: "startup",
    label: "Startup",
    icon: <Rocket className="w-3.5 h-3.5" />,
    color: "amber",
  },
  {
    id: "duplicates",
    label: "Duplicates",
    icon: <Files className="w-3.5 h-3.5" />,
    color: "rose",
  },
];

const TAB_COLOR_MAP: Record<string, string> = {
  indigo:
    "data-[active=true]:bg-brand-primary/20 data-[active=true]:border-brand-primary/40 data-[active=true]:text-brand-primary",
  emerald:
    "data-[active=true]:bg-emerald-500/20 data-[active=true]:border-emerald-500/40 data-[active=true]:text-emerald-300",
  amber:
    "data-[active=true]:bg-amber-500/20 data-[active=true]:border-amber-500/40 data-[active=true]:text-amber-300",
  rose: "data-[active=true]:bg-rose-500/20 data-[active=true]:border-rose-500/40 data-[active=true]:text-rose-300",
};

export const AIFeaturesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("boost");

  return (
    <div className="page-shell grid h-full grid-cols-[210px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-5 gap-y-4 max-[900px]:grid-cols-1">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-2 max-[900px]:col-span-1"
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
            <span className="text-xs font-bold text-brand-primary">
              PREMIUM
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-1 rounded-xl border border-border/60 bg-bg-surface/55 p-2 self-start max-[900px]:flex-row max-[900px]:overflow-x-auto"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-left",
              "border border-transparent text-text-muted transition-all duration-200",
              TAB_COLOR_MAP[tab.color],
              activeTab !== tab.id &&
                "hover:text-text-secondary hover:bg-white/[0.03]",
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span className="text-2xs font-black px-1 rounded bg-brand-primary/30 text-brand-primary">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="min-w-0 overflow-y-auto"
      >
        <div className="min-h-full">
          <AnimatePresence mode="wait">
            {activeTab === "boost" && (
              <motion.div
                key="boost"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <SmartBoostSection />
              </motion.div>
            )}
            {activeTab === "gamemode" && (
              <motion.div
                key="gamemode"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <GameModeSection />
              </motion.div>
            )}
            {activeTab === "startup" && (
              <motion.div
                key="startup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
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
              >
                <DuplicateFinderSection />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
