import React, { memo } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { motion } from "framer-motion";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Activity,
  Clock3,
  Layers3,
  ArrowRight,
  Wrench,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { LiveChart } from "@/components/charts/LiveChart";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/Progress";
import { Skeleton, SkeletonStatCard } from "@/components/ui/Skeleton";
import { useGatedStore } from "@/components/ui/hooks/useGatedStore";
import type { UsageMetric } from "@/theme/thresholds";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { formatBytes, formatMbps, formatUptime } from "@/utils/format";
import { cn } from "@/utils/cn";
interface MeterProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  metric: UsageMetric;
}
const Meter: React.FC<MeterProps> = memo(
  ({ label, value, max = 100, unit = "%", metric }) => {
    const pct = Math.min(100, (value / max) * 100);
    return (
      <Progress
        value={pct}
        metric={metric}
        size="md"
        label={label}
        showValue
        valueLabel={unit === "%" ? `${Math.round(value)}%` : `${value} ${unit}`}
      />
    );
  },
);

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <dt className="text-body-sm text-fg-3">{label}</dt>
    <dd className="text-body-sm font-semibold text-fg-1 tabular">{value}</dd>
  </div>
);

const DetailCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, action, children }) => (
  <Card className="flex flex-col p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-control bg-surface-inset text-fg-2 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h3 className="text-title font-semibold text-fg-1">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </Card>
);

export const PerformancePage: React.FC = () => {
  const setActivePage = useAppStore((s) => s.setActivePage);
  // Live data freezes while this page is hidden (perf budget).
  const stats = useGatedStore((s) => s.stats);
  const chartData = useGatedStore((s) => s.chartData);
  const addToast = useAppStore((s) => s.addToast);
  const { isOptimizingDrive } = useSessionStore(s => s.performance);
  const setPerformance = useSessionStore(s => s.setPerformance);

  const handleOptimizeDrive = React.useCallback(async () => {
    setPerformance({ isOptimizingDrive: true });
    try {
      const systemApi = window.api?.system ?? window.electronAPI?.system ?? window.propel?.system;
      const res = await systemApi?.optimizeDrive("C");
      if (res?.success) {
        addToast({
          type: "success",
          title: "Drive Optimized",
          description: res.message || "Drive optimization completed successfully.",
        });
      } else {
        addToast({
          type: "error",
          title: "Optimization Failed",
          description:
            res?.error ||
            "This action requires Administrator privileges. Please restart Propel as Administrator.",
        });
      }
    } catch (e: any) {
      addToast({
        type: "error",
        title: "Optimization Failed",
        description: e?.message || "Drive optimization failed.",
      });
    } finally {
      setPerformance({ isOptimizingDrive: false });
    }
  }, [addToast, setPerformance]);
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Live analytics"
        title="Performance center"
        subtitle="Monitor resource pressure and system activity in real time."
        meta={
          <span className="flex items-center gap-2">
            <span className="status-dot" />
            Live
          </span>
        }
      />

      {stats ? (
        <motion.section
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-4 gap-4 max-[1050px]:grid-cols-2"
        >
          <StatCard
            title="CPU"
            value={`${Math.round(stats.cpu)}%`}
            subtitle={`${stats.cpuSpeed.toFixed(2)} GHz · ${stats.cpuCores} cores`}
            icon={<Cpu className="h-full w-full" />}
            percent={stats.cpu}
            metric="cpu"
          />
          <StatCard
            title="Memory"
            value={`${Math.round(stats.ram.percent)}%`}
            subtitle={`${formatBytes(stats.ram.used)} used`}
            icon={<MemoryStick className="h-full w-full" />}
            percent={stats.ram.percent}
            metric="memory"
          />
          <StatCard
            title="Disk"
            value={`${Math.round(stats.disk.percent)}%`}
            subtitle={`${formatBytes(stats.disk.free)} available`}
            icon={<HardDrive className="h-full w-full" />}
            percent={stats.disk.percent}
            metric="disk"
          />
          <StatCard
            title="Network"
            value={formatMbps(stats.network.download)}
            subtitle={`Upload ${formatMbps(stats.network.upload)}`}
            icon={<Wifi className="h-full w-full" />}
          />
        </motion.section>
      ) : (
        <div className="grid grid-cols-4 gap-4 max-[1050px]:grid-cols-2" role="status" aria-label="Connecting">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1.8fr)_minmax(280px,.7fr)] gap-4 max-[1050px]:grid-cols-1">
        <Card>
          <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4">
            <div>
              <CardEyebrow>60-second window</CardEyebrow>
              <h2 className="mt-1 text-title font-semibold text-fg-1">CPU and memory activity</h2>
            </div>
            <div className="flex items-center gap-4 text-caption text-fg-3">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-[3px] bg-chart-1" />
                CPU
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-[3px] bg-chart-2" />
                Memory
              </span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <LiveChart data={chartData} height={300} />
          </div>
        </Card>

        <Card className="flex flex-col px-5 pb-3 pt-4">
          <CardEyebrow>System</CardEyebrow>
          <h2 className="mt-1 text-title font-semibold text-fg-1">At a glance</h2>
          <dl className="mt-3 divide-y divide-line-subtle">
            <div className="flex items-center gap-3 py-3">
              <Activity className="h-4 w-4 text-fg-3" />
              <div className="flex-1">
                <dt className="text-body-sm text-fg-3">Processes</dt>
                <p className="text-caption text-fg-4">Currently visible to Windows</p>
              </div>
              <dd className="font-display text-[20px] font-semibold text-fg-1 tabular">
                {stats ? stats.processes : <Skeleton className="h-5 w-10" />}
              </dd>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Clock3 className="h-4 w-4 text-fg-3" />
              <dt className="flex-1 text-body-sm text-fg-3">System uptime</dt>
              <dd className="text-body font-semibold text-fg-1 tabular">
                {stats ? formatUptime(stats.uptime) : <Skeleton className="h-4 w-14" />}
              </dd>
            </div>
            <div className="py-3">
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4 text-fg-3" />
                <dt className="text-body-sm text-fg-3">Processor</dt>
              </div>
              <dd className="mt-1.5 pl-7 text-body-sm font-medium text-fg-1">
                {stats?.cpuModel ?? "Reading processor information…"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {stats && (
        <section className="mt-4 grid grid-cols-3 gap-4 max-[1000px]:grid-cols-1">
          <DetailCard title="Processor load" icon={<Cpu />}>
            <Meter label="Overall load" value={stats.cpu} metric="cpu" />
            <dl className="mt-4 divide-y divide-line-subtle">
              <Fact label="Cores" value={stats.cpuCores} />
              <Fact label="Clock" value={`${stats.cpuSpeed.toFixed(2)} GHz`} />
            </dl>
          </DetailCard>
          <DetailCard
            title="Memory allocation"
            icon={<MemoryStick />}
            action={
              <Button variant="secondary" size="sm" iconRight={<ArrowRight />} onClick={() => setActivePage('memory')}>
                Optimize Memory
              </Button>
            }
          >
            <Meter label="RAM usage" value={stats.ram.percent} metric="memory" />
            <dl className="mt-4 divide-y divide-line-subtle">
              <Fact label="Available" value={formatBytes(stats.ram.free)} />
              <Fact label="Total" value={formatBytes(stats.ram.total)} />
            </dl>
          </DetailCard>
          <DetailCard
            title="Storage capacity"
            icon={<HardDrive />}
            action={
              <Button
                id="optimize-storage-drive-btn"
                variant="secondary"
                size="sm"
                icon={<Wrench />}
                loading={isOptimizingDrive}
                onClick={handleOptimizeDrive}
              >
                {isOptimizingDrive ? "Optimizing…" : "Optimize Storage Drive"}
              </Button>
            }
          >
            <Meter label="Disk usage" value={stats.disk.percent} metric="disk" />
            <dl className="mt-4 divide-y divide-line-subtle">
              <Fact label="Used" value={formatBytes(stats.disk.used)} />
              <Fact label="Total" value={formatBytes(stats.disk.total)} />
            </dl>
          </DetailCard>
        </section>
      )}
    </div>
  );
};
