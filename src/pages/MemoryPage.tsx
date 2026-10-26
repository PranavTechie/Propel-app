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
  Clock,
  BarChart3,
  Shield,
  CheckCircle,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { RingGauge } from "@/components/ui/RingGauge";
import { CountUp } from "@/components/ui/CountUp";
import { Progress } from "@/components/ui/Progress";
import { StatusPill } from "@/components/ui/StatusPill";
import { Toggle } from "@/components/ui/Toggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { SkeletonRow, Skeleton } from "@/components/ui/Skeleton";
import { toneColor, type Tone } from "@/theme/thresholds";
import { formatBytes } from "@/utils/format";
import { cn } from "@/utils/cn";
import { staggerContainer } from "@/animations/variants";
import { useLayoutReady } from "@/components/ui/hooks/useLiveGate";
import type {
  MemoryDetails,
  ProcessMemInfo,
  OptimizationResult,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Pressure tone: Low = healthy, Moderate/High = warning, Critical = critical. */
function memTone(pct: number): Tone {
  if (pct < 50) return "healthy";
  if (pct < 85) return "warning";
  return "critical";
}

function pressureColor(pct: number): string {
  return toneColor(memTone(pct));
}

function pressureLabel(pct: number): string {
  if (pct < 50) return "Low";
  if (pct < 70) return "Moderate";
  if (pct < 85) return "High";
  return "Critical";
}

// ── Stat Tile ──────────────────────────────────────────────────────────────
const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
  <div className="rounded-control border border-line-subtle bg-surface-inset px-2.5 py-2">
    <p className="flex items-center gap-1.5 text-caption text-fg-3">
      {icon}
      {label}
    </p>
    <p className="mt-0.5 text-body font-semibold text-fg-1 tabular">{value}</p>
    {sub && <p className="text-[10px] text-fg-3 tabular leading-tight">{sub}</p>}
  </div>
);

// Rows only fade in (no translate). Mount-only: stable keys mean live
// updates every 3s never replay it.
const rowFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] } },
};

// ── Process Row ────────────────────────────────────────────────────────────
const ProcessRow: React.FC<{
  proc: ProcessMemInfo & { count?: number };
  max: number;
  rank: number;
  animateLayout: boolean;
}> = ({ proc, max, rank, animateLayout }) => {
  const pct = max > 0 ? (proc.memBytes / max) * 100 : 0;

  return (
    <motion.li
      variants={rowFade}
      layout={animateLayout ? "position" : false}
      transition={{ layout: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] } }}
      className="flex items-center gap-3.5 py-2.5"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-[10.5px] font-bold tabular",
          rank < 3 ? "bg-brand-soft text-brand-fg" : "bg-surface-inset text-fg-3",
        )}
      >
        {rank + 1}
      </span>
      <div className="w-44 sm:w-56 md:w-64 shrink-0 truncate">
        <p className="flex items-baseline gap-1.5 truncate text-body-sm font-medium text-fg-1" title={proc.name}>
          <span className="truncate">{proc.name}</span>
          {proc.count && proc.count > 1 && (
            <span className="shrink-0 text-[10.5px] font-normal text-fg-3">
              ({proc.count})
            </span>
          )}
        </p>
      </div>
      <div className="min-w-0 flex-1 px-2">
        <Progress
          value={pct}
          tone={rank < 3 ? "brand" : "neutral"}
          size="xs"
          aria-label={`${proc.name} memory share`}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-body-sm font-semibold text-fg-2 tabular">
        {formatBytes(proc.memBytes)}
      </span>
    </motion.li>
  );
};

/**
 * Process list. Keys are the process name (rows are grouped by name), so a
 * row keeps its identity across polls. Reorder animation only runs while the
 * page is active, visible and settled (see useLayoutReady).
 */
const ProcessList: React.FC<{
  processes: (ProcessMemInfo & { count?: number })[];
  max: number;
}> = ({ processes, max }) => {
  const layoutReady = useLayoutReady();
  return (
    <motion.ul
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="divide-y divide-line-subtle"
    >
      {processes.map((proc, i) => (
        <ProcessRow key={proc.name} proc={proc} max={max} rank={i} animateLayout={layoutReady} />
      ))}
    </motion.ul>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="overflow-hidden">
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-success" />
        <div className="flex items-center gap-3 px-5 pt-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-success-soft text-success-fg">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-title font-semibold text-fg-1">Optimization Complete</p>
            <p className="text-body-sm text-fg-3">Memory working sets trimmed safely</p>
          </div>
          <Button variant="ghost" size="sm" icon={<X />} onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 py-4">
          {[
            { label: "RAM Freed", value: formatBytes(result.recoveredBytes), icon: <HardDrive className="h-3.5 w-3.5" /> },
            { label: "Processes", value: `${result.processesOptimized}`, icon: <Cpu className="h-3.5 w-3.5" /> },
            { label: "Duration", value: `${secs}s`, icon: <Clock className="h-3.5 w-3.5" /> },
          ].map((item) => (
            <StatTile key={item.label} label={item.label} value={item.value} icon={item.icon} />
          ))}
        </div>
        {result.optimizedProcesses.length > 0 && (
          <div className="px-5 pb-4">
            <p className="mb-1.5 text-caption text-fg-3">Optimized processes</p>
            <div className="flex flex-wrap gap-1.5">
              {result.optimizedProcesses.slice(0, 10).map((name) => (
                <span key={name} className="rounded-chip bg-surface-inset px-2 py-0.5 text-caption text-fg-2">
                  {name}
                </span>
              ))}
              {result.optimizedProcesses.length > 10 && (
                <span className="text-caption text-fg-3">
                  +{result.optimizedProcesses.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

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

  const tone = memTone(pressure);
  const swapPct =
    memStats && memStats.swapTotal > 0 ? (memStats.swapUsed / memStats.swapTotal) * 100 : 0;

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader
          eyebrow="Workspace"
          title="Memory Optimizer"
          subtitle={
            memStats
              ? `${formatBytes(memStats.used)} used of ${formatBytes(memStats.total)} · ${pressureLabel(pressure)} pressure`
              : "Real-time memory analysis and safe optimization"
          }
          meta={
            <Tooltip content="Refresh now" side="bottom">
              <Button variant="ghost" size="icon" aria-label="Refresh memory stats" onClick={handleRefresh}>
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </Tooltip>
          }
          action={
            <Button loading={isOptimizing} icon={<Zap />} onClick={handleOptimize}>
              {isOptimizing ? "Running…" : "Optimize Now"}
            </Button>
          }
        />

        <div className="space-y-4">
          {/* ── Top Section: Two Equal-Sized Cards (50/50) ── */}
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1 items-stretch">
            {/* Left: Memory Overview */}
            <Card level="feature" className="p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-5">
                  <div className="shrink-0">
                    <RingGauge
                      value={memStats ? memStats.pressurePercent : null}
                      tone={tone}
                      size={132}
                      thickness={10}
                      ticks
                      aria-label={`Memory pressure ${memStats?.pressurePercent ?? "loading"} percent`}
                    >
                      {memStats ? (
                        <>
                          <span className="flex items-baseline">
                            <CountUp
                              value={memStats.pressurePercent}
                              className="font-display text-[28px] font-semibold leading-none text-fg-1"
                            />
                            <span className="text-body font-medium text-fg-3">%</span>
                          </span>
                          <span className="mt-1 text-caption text-fg-3">Memory</span>
                        </>
                      ) : (
                        <Skeleton className="h-8 w-14" />
                      )}
                    </RingGauge>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <StatusPill tone={memStats ? tone : "neutral"}>
                        {memStats ? `${pressureLabel(memStats.pressurePercent)} pressure` : "Reading"}
                      </StatusPill>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile label="Total RAM" value={formatBytes(memStats?.total ?? 0)} icon={<HardDrive className="h-3.5 w-3.5" />} />
                      <StatTile
                        label="In Use"
                        value={formatBytes(memStats?.used ?? 0)}
                        sub={`${memStats?.pressurePercent ?? 0}%`}
                        icon={<Activity className="h-3.5 w-3.5" />}
                      />
                      <StatTile
                        label="Available"
                        value={formatBytes(memStats?.available ?? 0)}
                        sub={`${memStats?.availablePercent ?? 0}% free`}
                        icon={<CheckCircle className="h-3.5 w-3.5" />}
                      />
                      <StatTile
                        label="Cached"
                        value={formatBytes(memStats?.cached ?? 0)}
                        sub={`${memStats?.cachedPercent ?? 0}% of total`}
                        icon={<BarChart3 className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {memStats && memStats.swapTotal > 0 && (
                <div className="mt-4 border-t border-line-subtle pt-3">
                  <Progress
                    value={swapPct}
                    tone={swapPct > 80 ? "critical" : swapPct > 50 ? "warning" : "healthy"}
                    label={
                      <span className="flex items-center gap-1.5 text-caption">
                        <HardDrive className="h-3 w-3" />
                        Page File (Swap)
                      </span>
                    }
                    showValue
                    valueLabel={`${formatBytes(memStats.swapUsed)} / ${formatBytes(memStats.swapTotal)}`}
                    aria-label="Page file usage"
                  />
                </div>
              )}
            </Card>

            {/* Right: Focus Mode */}
            <Card className={cn("p-5 h-full flex flex-col justify-between transition-colors duration-base", perfMode && "border-brand/30")}>
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-control",
                      perfMode ? "bg-brand-soft text-brand-fg" : "bg-surface-inset text-fg-2",
                    )}
                  >
                    <Gauge className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-title font-semibold text-fg-1">Focus Mode</p>
                      {perfMode && <StatusPill tone="healthy">ON</StatusPill>}
                    </div>
                    <p className="text-caption text-fg-3">
                      {perfModeLoading ? "Applying…" : perfMode ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <Toggle
                    checked={perfMode}
                    disabled={perfModeLoading}
                    onCheckedChange={() => void handleTogglePerfMode()}
                    aria-label={perfMode ? "Disable Focus Mode" : "Enable Focus Mode"}
                  />
                </div>

                <p className="mt-4 text-body-sm text-fg-2 leading-relaxed">
                  {perfMode
                    ? "Background processes deprioritized — more CPU and memory bandwidth for foreground applications."
                    : "Deprioritize background tasks to boost responsiveness, gaming, and heavy workload performance."}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-control bg-surface-inset p-3">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-fg" />
                <p className="text-caption text-fg-3 leading-relaxed">
                  Focus Mode temporarily lowers priority of background apps to favor your active app or
                  game. Automatically restores original priorities when disabled.
                </p>
              </div>
            </Card>
          </div>

          {/* ── Optimization Report Banner ── */}
          <AnimatePresence>
            {lastOptimization && (
              <OptimizeReport
                result={lastOptimization}
                onDismiss={() => setMemory({ lastOptimization: null })}
              />
            )}
          </AnimatePresence>

          {/* ── Top Memory Consumers: Full Width ── */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <CardEyebrow>Processes</CardEyebrow>
                <h2 className="mt-1 text-title font-semibold text-fg-1">Top Memory Consumers</h2>
              </div>
              <span className="flex items-center gap-1.5 text-caption text-fg-3">
                <span className="status-dot" />
                Live · updates every 3s
              </span>
            </div>

            {processes.length > 0 ? (
              <ProcessList processes={groupedProcesses.slice(0, 12)} max={maxProcMem} />
            ) : (
              <div role="status" aria-label="Loading process data">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <p className="pt-1 text-center text-caption text-fg-3">Loading process data…</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
