import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Activity,
  Clock3,
  Layers3,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { LiveChart } from "@/components/charts/LiveChart";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { formatBytes, formatMbps, formatUptime } from "@/utils/format";
import { cn } from "@/utils/cn";
interface MeterProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color: string;
}
const Meter: React.FC<MeterProps> = memo(
  ({ label, value, max = 100, unit = "%", color }) => {
    const pct = Math.min(100, (value / max) * 100);
    return (
      <div>
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span className="text-text-secondary">{label}</span>
          <span className="font-semibold tabular-nums text-text-primary">
            {unit === "%" ? `${Math.round(value)}%` : `${value} ${unit}`}
          </span>
        </div>
        <div className="stat-bar">
          <div
            className={cn("stat-bar-fill", color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  },
);
const Summary = ({
  label,
  value,
  detail,
  icon: Icon,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  percent?: number;
}) => (
  <motion.div
    variants={staggerItem}
    className="border-r border-border/60 px-5 last:border-0 max-[1050px]:border-b max-[1050px]:border-r-0 max-[1050px]:py-4"
  >
    <div className="flex items-center justify-between">
      <p className="section-label">{label}</p>
      <Icon className="h-4 w-4 text-text-muted" />
    </div>
    <p className="mt-3 text-[25px] font-semibold tracking-[-.04em] tabular-nums text-text-primary">
      {value}
    </p>
    <p className="mt-1 text-[11px] text-text-muted">{detail}</p>
    {percent !== undefined && (
      <div className="mt-3 stat-bar">
        <div className="stat-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    )}
  </motion.div>
);
export const PerformancePage: React.FC = () => {
  const setActivePage = useAppStore((s) => s.setActivePage);
  const stats = useAppStore((s) => s.stats);
  const chartData = useAppStore((s) => s.chartData);
  const addToast = useAppStore((s) => s.addToast);
  const [isOptimizingDrive, setIsOptimizingDrive] = React.useState(false);

  const handleOptimizeDrive = React.useCallback(async () => {
    setIsOptimizingDrive(true);
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
      setIsOptimizingDrive(false);
    }
  }, [addToast]);
  return (
    <div className="page-shell space-y-5">
      <header>
        <p className="section-label">Live analytics</p>
        <h1 className="mt-1 text-[25px] font-semibold tracking-[-.035em] text-text-primary">
          Performance center
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monitor resource pressure and system activity in real time.
        </p>
      </header>
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-4 rounded-xl border border-border/70 bg-bg-elevated py-5 max-[1050px]:grid-cols-2 max-[760px]:grid-cols-1"
      >
        <Summary
          label="CPU"
          value={stats ? `${Math.round(stats.cpu)}%` : "—"}
          detail={
            stats
              ? `${stats.cpuSpeed.toFixed(2)} GHz · ${stats.cpuCores} cores`
              : "Connecting…"
          }
          icon={Cpu}
          percent={stats?.cpu}
        />
        <Summary
          label="Memory"
          value={stats ? `${Math.round(stats.ram.percent)}%` : "—"}
          detail={stats ? `${formatBytes(stats.ram.used)} used` : "Connecting…"}
          icon={MemoryStick}
          percent={stats?.ram.percent}
        />
        <Summary
          label="Disk"
          value={stats ? `${Math.round(stats.disk.percent)}%` : "—"}
          detail={
            stats ? `${formatBytes(stats.disk.free)} available` : "Connecting…"
          }
          icon={HardDrive}
          percent={stats?.disk.percent}
        />
        <Summary
          label="Network"
          value={stats ? formatMbps(stats.network.download) : "—"}
          detail={
            stats ? `Upload ${formatMbps(stats.network.upload)}` : "Connecting…"
          }
          icon={Wifi}
        />
      </motion.section>
      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(280px,.7fr)] gap-5 max-[1050px]:grid-cols-1">
        <section className="rounded-xl border border-border/70 bg-bg-elevated p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="section-label">60-second window</p>
              <h2 className="mt-1 text-base font-semibold text-text-primary">
                CPU and memory activity
              </h2>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-4 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-sm bg-brand-primary" />
                  CPU
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-sm bg-[#9a7b45]" />
                  Memory
                </span>
              </div>
              <span className="flex items-center gap-2 text-[11px] text-text-muted">
                <span className="status-dot" />
                Live
              </span>
            </div>
          </div>
          <LiveChart data={chartData} height={300} />
        </section>
        <aside className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-5">
            <Activity className="h-4 w-4 text-brand-primary" />
            <p className="mt-4 section-label">Processes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
              {stats?.processes ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              Currently visible to Windows
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-5">
            <Clock3 className="h-4 w-4 text-text-muted" />
            <p className="mt-4 section-label">System uptime</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">
              {stats ? formatUptime(stats.uptime) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-5">
            <Layers3 className="h-4 w-4 text-text-muted" />
            <p className="mt-4 section-label">Processor</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-text-primary">
              {stats?.cpuModel ?? "Reading processor information…"}
            </p>
          </div>
        </aside>
      </div>
      {stats && (
        <section className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-1">
          <div className="rounded-xl border border-border/70 bg-bg-surface/55 p-5">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">
              Processor load
            </h3>
            <Meter
              label="Overall load"
              value={stats.cpu}
              color="bg-brand-primary"
            />
            <div className="mt-5 grid grid-cols-2 gap-y-3 text-xs">
              <span className="text-text-muted">Cores</span>
              <b className="text-right text-text-primary">{stats.cpuCores}</b>
              <span className="text-text-muted">Clock</span>
              <b className="text-right text-text-primary">
                {stats.cpuSpeed.toFixed(2)} GHz
              </b>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/55 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Memory allocation
              </h3>
              <button
                onClick={() => setActivePage('memory')}
                className="rounded-lg border border-border/70 px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:border-brand-primary/30 hover:text-text-primary transition-all cursor-pointer"
              >
                Optimize Memory
              </button>
            </div>
            <Meter
              label="RAM usage"
              value={stats.ram.percent}
              color="bg-brand-primary"
            />
            <div className="mt-5 grid grid-cols-2 gap-y-3 text-xs">
              <span className="text-text-muted">Available</span>
              <b className="text-right text-text-primary">
                {formatBytes(stats.ram.free)}
              </b>
              <span className="text-text-muted">Total</span>
              <b className="text-right text-text-primary">
                {formatBytes(stats.ram.total)}
              </b>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/55 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Storage capacity
              </h3>
              <button
                id="optimize-storage-drive-btn"
                onClick={handleOptimizeDrive}
                disabled={isOptimizingDrive}
                className="rounded-lg border border-border/70 px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:border-brand-primary/30 hover:text-text-primary disabled:opacity-50 transition-all cursor-pointer"
              >
                {isOptimizingDrive ? "Optimizing…" : "Optimize Storage Drive"}
              </button>
            </div>
            <Meter
              label="Disk usage"
              value={stats.disk.percent}
              color="bg-brand-primary"
            />
            <div className="mt-5 grid grid-cols-2 gap-y-3 text-xs">
              <span className="text-text-muted">Used</span>
              <b className="text-right text-text-primary">
                {formatBytes(stats.disk.used)}
              </b>
              <span className="text-text-muted">Total</span>
              <b className="text-right text-text-primary">
                {formatBytes(stats.disk.total)}
              </b>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
