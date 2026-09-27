import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Gauge,
  Sparkles,
  ChevronUp,
  Clock,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  Power,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/utils/format";
import { cn } from "@/utils/cn";
import { staggerContainer, staggerItem } from "@/animations/variants";
import type {
  MemoryDetails,
  ProcessMemInfo,
  OptimizationResult,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function pressureColor(pct: number): string {
  if (pct < 50) return "rgb(16,185,129)"; // green
  if (pct < 70) return "rgb(245,158,11)"; // yellow
  if (pct < 85) return "rgb(249,115,22)"; // orange
  return "rgb(239,68,68)"; // red
}

function pressureLabel(pct: number): string {
  if (pct < 50) return "Low";
  if (pct < 70) return "Moderate";
  if (pct < 85) return "High";
  return "Critical";
}

// ── Memory Ring ────────────────────────────────────────────────────────────
const MemoryRing: React.FC<{ percent: number; label: string; sub: string }> = ({
  percent,
  label,
  sub,
}) => {
  const R = 56;
  const C = Math.PI * 2 * R;
  const offset = C * (1 - Math.min(100, percent) / 100);
  const color = pressureColor(percent);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-lg transition-colors duration-700"
        style={{ background: color }}
      />
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        {/* Progress */}
        <motion.circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      {/* Inner text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={percent}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-2xl font-bold text-text-primary tabular-nums"
          style={{ color }}
        >
          {percent}%
        </motion.span>
        <span className="text-xs text-text-muted mt-0.5">{label}</span>
        <span className="text-2xs text-text-muted">{sub}</span>
      </div>
    </div>
  );
};

// ── Stat Tile ──────────────────────────────────────────────────────────────
const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, color, icon }) => (
  <div className="glass rounded-xl p-3 flex items-start gap-2.5">
    <div
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        color,
      )}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-2xs text-text-muted">{label}</p>
      <p className="text-sm font-bold text-text-primary tabular-nums">
        {value}
      </p>
      {sub && <p className="text-2xs text-text-muted tabular-nums">{sub}</p>}
    </div>
  </div>
);

// ── Process Row ────────────────────────────────────────────────────────────
const ProcessRow: React.FC<{
  proc: ProcessMemInfo & { count?: number };
  max: number;
  rank: number;
}> = ({ proc, max, rank }) => {
  const pct = max > 0 ? (proc.memBytes / max) * 100 : 0;
  const hue =
    rank < 3
      ? "bg-brand-primary"
      : rank < 6
        ? "bg-brand-accent"
        : "bg-white/20";

  return (
    <motion.div
      variants={staggerItem}
      layout
      className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
    >
      <span className="text-2xs text-text-muted w-4 tabular-nums shrink-0">
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate flex items-baseline gap-1">
          {proc.name}
          {proc.count && proc.count > 1 && (
            <span className="text-[10px] text-text-muted font-normal">
              ({proc.count} processes)
            </span>
          )}
        </p>
        <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", hue)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: rank * 0.03 }}
          />
        </div>
      </div>
      <span className="text-xs font-semibold text-text-secondary tabular-nums shrink-0">
        {formatBytes(proc.memBytes)}
      </span>
    </motion.div>
  );
};

// ── Optimization Report ───────────────────────────────────────────────────
const OptimizeReport: React.FC<{
  result: OptimizationResult;
  onDismiss: () => void;
}> = ({ result, onDismiss }) => {
  const secs = (result.durationMs / 1000).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="glass rounded-2xl overflow-hidden border border-emerald-500/25"
    >
      <div className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-400">
            Optimization Complete
          </p>
          <p className="text-xs text-text-secondary">
            Memory working sets trimmed safely
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-text-muted hover:text-text-secondary transition-colors text-xs"
        >
          Dismiss
        </button>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {[
          {
            label: "RAM Freed",
            value: formatBytes(result.recoveredBytes),
            icon: <HardDrive className="w-3.5 h-3.5 text-emerald-400" />,
          },
          {
            label: "Processes",
            value: `${result.processesOptimized}`,
            icon: <Cpu className="w-3.5 h-3.5 text-blue-400" />,
          },
          {
            label: "Duration",
            value: `${secs}s`,
            icon: <Clock className="w-3.5 h-3.5 text-brand-secondary" />,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="glass rounded-lg p-2.5 flex items-center gap-2"
          >
            {item.icon}
            <div>
              <p className="text-2xs text-text-muted">{item.label}</p>
              <p className="text-xs font-bold text-text-primary">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
      {result.optimizedProcesses.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-2xs text-text-muted mb-1.5">Optimized processes</p>
          <div className="flex flex-wrap gap-1.5">
            {result.optimizedProcesses.slice(0, 10).map((name) => (
              <span
                key={name}
                className="text-2xs bg-white/5 text-text-secondary px-1.5 py-0.5 rounded-md"
              >
                {name}
              </span>
            ))}
            {result.optimizedProcesses.length > 10 && (
              <span className="text-2xs text-text-muted">
                +{result.optimizedProcesses.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────
export const MemoryPage: React.FC = () => {
  const { addToast } = useAppStore();

  const { memStats, processes, lastOptimization, perfMode, isOptimizing, perfModeLoading } = useSessionStore(s => s.memory);
  const setMemory = useSessionStore(s => s.setMemory);





  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memApi = useRef(window.propel?.memory);

  // ── Fetch memory stats ──────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (useAppStore.getState().activePage !== "memory") return;
    if (!memApi.current) return;
    try {
      const [stats, procs] = await Promise.all([
        memApi.current.getStats(),
        memApi.current.getProcesses(12),
      ]);
      setMemory({ memStats: stats });
      setMemory({ processes: procs });
    } catch {
      // silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    memApi.current = window.propel?.memory;
    fetchStats();
    pollRef.current = setInterval(fetchStats, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      memApi.current?.removeListeners();
    };
  }, [fetchStats]);

  // ── Manual refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStats();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [fetchStats]);

  // ── Optimize ────────────────────────────────────────────────────────────
  const handleOptimize = useCallback(async () => {
    if (!memApi.current || isOptimizing) return;

    setMemory({ isOptimizing: true });
    setMemory({ lastOptimization: null });

    memApi.current.removeListeners();

    try {
      const result = await memApi.current.optimize();
      setMemory({ lastOptimization: result });
      await fetchStats();
      addToast({
        type: "success",
        title: "Memory Optimized",
        description:
          result.recoveredBytes > 0
            ? `Recovered ${formatBytes(result.recoveredBytes)} from ${result.processesOptimized} processes`
            : `Trimmed ${result.processesOptimized} working sets`,
      });
    } catch {
      addToast({
        type: "error",
        title: "Optimization Failed",
        description: "Could not run optimizer.",
      });
    } finally {
      setMemory({ isOptimizing: false });
      memApi.current?.removeListeners();
    }
  }, [isOptimizing, fetchStats, addToast]);

  // ── Performance Mode ────────────────────────────────────────────────────
  const handleTogglePerfMode = useCallback(async () => {
    if (!memApi.current || perfModeLoading) return;
    setMemory({ perfModeLoading: true });
    try {
      const result = await memApi.current.setPerformanceMode(!perfMode);
      setMemory({ perfMode: result.enabled });
      addToast({
        type: result.enabled ? "success" : "info",
        title: result.enabled ? "Focus Mode On" : "Focus Mode Off",
        description: result.enabled
          ? `${result.processesAffected} background processes deprioritized`
          : `${result.processesAffected} processes restored to normal priority`,
      });
    } catch {
      addToast({ type: "error", title: "Failed to toggle Focus Mode" });
    } finally {
      setMemory({ perfModeLoading: false });
    }
  }, [perfMode, perfModeLoading, addToast]);

  const groupedProcesses = useMemo(() => {
    const groups: Record<string, ProcessMemInfo & { count: number }> = {};
    for (const p of processes) {
      if (groups[p.name]) {
        groups[p.name].memBytes += p.memBytes;
        groups[p.name].count += 1;
      } else {
        groups[p.name] = { ...p, count: 1 };
      }
    }
    return Object.values(groups).sort((a, b) => b.memBytes - a.memBytes);
  }, [processes]);

  const maxProcMem = groupedProcesses[0]?.memBytes ?? 1;
  const pressure = memStats?.pressurePercent ?? 0;
  const pressColor = pressureColor(pressure);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto w-full flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Memory Optimizer
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {memStats
                ? `${formatBytes(memStats.used)} used of ${formatBytes(memStats.total)} · ${pressureLabel(pressure)} pressure`
                : "Real-time memory analysis and safe optimization"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/5 transition-all"
            title="Refresh"
          >
            <RefreshCw
              className={cn("w-4 h-4", isRefreshing && "animate-spin")}
            />
          </button>
        </motion.div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-[1.6fr_1fr] max-[900px]:grid-cols-1 gap-6 items-start">
          
          {/* ── Left Column ── */}
          <div className="space-y-6 flex flex-col">
            {/* ── Memory Ring + Stats ── */}
            <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="memory-summary glass rounded-2xl p-5"
        >
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="shrink-0">
              {memStats ? (
                <MemoryRing
                  percent={memStats.pressurePercent}
                  label="Memory"
                  sub={pressureLabel(memStats.pressurePercent)}
                />
              ) : (
                <div className="w-36 h-36 rounded-full border-2 border-white/5 flex items-center justify-center animate-pulse">
                  <HardDrive className="w-8 h-8 text-text-muted" />
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="flex-1 grid grid-cols-2 gap-2.5">
              <StatTile
                label="Total RAM"
                value={formatBytes(memStats?.total ?? 0)}
                color="bg-brand-primary/10 text-brand-primary"
                icon={<HardDrive className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="In Use"
                value={formatBytes(memStats?.used ?? 0)}
                sub={`${memStats?.pressurePercent ?? 0}%`}
                color="bg-red-500/10 text-red-400"
                icon={<Activity className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="Available"
                value={formatBytes(memStats?.available ?? 0)}
                sub={`${memStats?.availablePercent ?? 0}% free`}
                color="bg-emerald-500/10 text-emerald-400"
                icon={<CheckCircle className="w-3.5 h-3.5" />}
              />
              <StatTile
                label="Cached"
                value={formatBytes(memStats?.cached ?? 0)}
                sub={`${memStats?.cachedPercent ?? 0}% of total`}
                color="bg-brand-accent/10 text-brand-accent"
                icon={<BarChart3 className="w-3.5 h-3.5" />}
              />
            </div>
          </div>

          {/* Swap bar */}
          {memStats && memStats.swapTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-text-muted flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3" />
                  Page File (Swap)
                </p>
                <p className="text-xs text-text-secondary tabular-nums">
                  {formatBytes(memStats.swapUsed)} /{" "}
                  {formatBytes(memStats.swapTotal)}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r",
                    (() => {
                      const pct = memStats.swapTotal > 0 ? (memStats.swapUsed / memStats.swapTotal) * 100 : 0;
                      if (pct > 80) return "from-red-500 to-rose-600";
                      if (pct > 50) return "from-amber-500 to-orange-500";
                      return "from-emerald-400 to-emerald-500";
                    })()
                  )}
                  animate={{
                    width: `${memStats.swapTotal > 0 ? (memStats.swapUsed / memStats.swapTotal) * 100 : 0}%`,
                  }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Top Memory Consumers ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="memory-processes glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <p className="text-sm font-semibold text-text-primary">
                Top Memory Consumers
              </p>
            </div>
            <span className="text-2xs text-text-muted">
              Live · updates every 3s
            </span>
          </div>

          {processes.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {groupedProcesses.slice(0, 12).map((proc, i) => (
                <ProcessRow
                  key={proc.pid}
                  proc={proc}
                  max={maxProcMem}
                  rank={i}
                />
              ))}
            </motion.div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Activity className="w-8 h-8 text-text-muted mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-text-muted">Loading process data…</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Optimization Report ── */}
        <AnimatePresence>
          {lastOptimization && (
            <OptimizeReport
              result={lastOptimization}
              onDismiss={() => setMemory({ lastOptimization: null })}
            />
          )}
        </AnimatePresence>
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6">
            {/* ── Action Cards ── */}
            <div className="grid grid-cols-1 gap-6">
              {/* Optimize Button */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "glass rounded-2xl p-5 flex flex-col items-center text-center border transition-all duration-300",
              isOptimizing
                ? "border-brand-primary/30"
                : "border-border hover:border-brand-primary/30",
            )}
          >
            {/* Animated glow ring around icon */}
            <div className="relative mb-4">
              <div
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  isOptimizing
                    ? "animate-ping bg-brand-primary/20"
                    : "bg-transparent",
                )}
              />
              <motion.div
                className={cn(
                  "relative w-14 h-14 rounded-full flex items-center justify-center",
                  isOptimizing
                    ? "bg-brand-primary/20 shadow-glow-md"
                    : "bg-brand-primary/10 hover:bg-brand-primary/15",
                )}
                animate={isOptimizing ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Zap
                  className={cn(
                    "w-7 h-7",
                    isOptimizing
                      ? "text-brand-primary/70"
                      : "text-brand-primary",
                  )}
                />
              </motion.div>
            </div>

            <p className="text-sm font-bold text-text-primary mb-1">
              {isOptimizing ? "Optimizing…" : "Optimize Memory"}
            </p>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              {isOptimizing
                ? "This may cause a momentary slowdown in recently-optimized apps as they resume."
                : "Trims memory working sets to reclaim available RAM without killing any processes."}
            </p>

            <Button
              variant="primary"
              size="sm"
              loading={isOptimizing}
              disabled={isOptimizing}
              icon={<Zap className="w-3.5 h-3.5" />}
              onClick={handleOptimize}
            >
              {isOptimizing ? "Running…" : "Optimize Now"}
            </Button>
          </motion.div>

          {/* Optimize Memory Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="flex items-start gap-2.5 px-2 mb-2"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-relaxed text-left">
              Optimization is <span className="text-emerald-400">non-destructive</span>. No processes are terminated. Working sets are trimmed using the standard Windows <code className="text-xs bg-white/5 px-1 rounded">EmptyWorkingSet</code> API.
            </p>
          </motion.div>

          {/* Performance Mode */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className={cn(
              "glass rounded-2xl p-5 flex flex-col items-center text-center border transition-all duration-300",
              perfMode
                ? "border-brand-secondary/30 bg-brand-secondary/5"
                : "border-border hover:border-brand-secondary/30",
            )}
          >
            <div className="relative mb-4">
              {perfMode && (
                <div className="absolute inset-0 rounded-full animate-pulse bg-brand-secondary/15" />
              )}
              <div
                className={cn(
                  "relative w-14 h-14 rounded-full flex items-center justify-center",
                  perfMode
                    ? "bg-brand-secondary/20 shadow-glow-sm"
                    : "bg-brand-secondary/10",
                )}
              >
                <Gauge
                  className={cn(
                    "w-7 h-7",
                    perfMode
                      ? "text-brand-secondary/70"
                      : "text-brand-secondary",
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-text-primary">
                Focus Mode
              </p>
              {perfMode && (
                <span className="text-2xs bg-brand-secondary/15 text-brand-secondary px-1.5 py-0.5 rounded-full font-medium">
                  ON
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              {perfMode
                ? "Background processes deprioritized — more CPU for foreground apps"
                : "Deprioritize background tasks to boost gaming and workload performance"}
            </p>

            <Button
              variant={perfMode ? "danger" : "outline"}
              size="sm"
              loading={perfModeLoading}
              icon={<Power className="w-3.5 h-3.5" />}
              onClick={handleTogglePerfMode}
            >
              {perfMode ? "Disable" : "Enable"}
            </Button>
          </motion.div>

          {/* Performance Mode Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="flex items-start gap-2.5 px-2"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-relaxed text-left">
              Focus Mode temporarily lowers priority of background apps to favor your active app or game. Automatically restores original priorities when disabled.
            </p>
          </motion.div>
        </div>
      </div>

        </div>
      </div>
    </div>
  );
};
