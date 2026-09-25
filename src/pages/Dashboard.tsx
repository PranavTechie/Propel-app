import React, { useState, useEffect, memo, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Trash2,
  Activity,
  ShieldCheck,
  Lightbulb,
  ArrowRight,
  ScanLine,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { StatCard } from "@/components/common/StatCard";
import { LiveChart } from "@/components/charts/LiveChart";
import {
  MotionCard,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InsightsPanel } from "@/components/common/InsightsPanel";
import { staggerContainer, staggerItem } from "@/animations/variants";
import {
  formatBytes,
  formatMbps,
  formatUptime,
  getHealthScore,
  getHealthLabel,
} from "@/utils/format";
const LiveClock = memo(() => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-xs tabular-nums text-text-muted">
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
});
LiveClock.displayName = "LiveClock";
export const Dashboard = memo(function Dashboard() {
  const stats = useAppStore((s) => s.stats);
  const chartData = useAppStore((s) => s.chartData);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const score = stats
    ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent)
    : 0;
  const { label } = getHealthLabel(score);
  const actions = useMemo(
    () => [
      {
        label: "Run system check",
        desc: "Inspect health and security",
        icon: ScanLine,
        page: "systemcheck" as const,
      },
      {
        label: "Clean unnecessary files",
        desc: "Review safe cleanup options",
        icon: Trash2,
        page: "cleaner" as const,
      },
      {
        label: "Open performance center",
        desc: "Explore live resource data",
        icon: Activity,
        page: "performance" as const,
      },
    ],
    [],
  );
  return (
    <div className="page-shell space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-5"
      >
        <div>
          <p className="section-label">System overview</p>
          <h1 className="mt-1 text-[25px] font-semibold tracking-[-.035em] text-text-primary">
            Your PC, at a glance
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {stats
              ? `${stats.cpuModel} · ${stats.cpuCores} cores`
              : "Connecting to system services…"}
          </p>
        </div>
        <LiveClock />
      </motion.header>
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-[minmax(340px,1.2fr)_minmax(320px,.8fr)] gap-5 max-[1050px]:grid-cols-1"
      >
        <motion.div
          variants={staggerItem}
          className="relative overflow-hidden rounded-2xl border border-brand-primary/20 bg-bg-elevated p-6 shadow-[0_12px_38px_rgba(42,72,32,.07)]"
        >
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgb(var(--t-accent)/.10),transparent_68%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="text-xs font-semibold text-brand-secondary">
                    Live system health
                  </span>
                </div>
                <h2 className="mt-4 text-[34px] font-semibold leading-none tracking-[-.045em] text-text-primary">
                  {stats ? label : "Assessing"}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary">
                  {stats
                    ? score >= 75
                      ? "Core resources are operating within a healthy range. Keep maintenance current for the best experience."
                      : score >= 45
                        ? "Your system is usable, but one or more resources would benefit from attention."
                        : "Propel found resource pressure that deserves attention. Run a check for clear next steps."
                    : "Propel is reading live CPU, memory and disk signals."}
                </p>
              </div>
              <div className="text-right flex flex-col items-end group relative cursor-help">
                <p className="text-[44px] font-semibold leading-none tracking-[-.06em] text-brand-secondary tabular-nums">
                  {stats ? score : "—"}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-text-muted">
                  Quick health score
                </p>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all absolute top-full right-0 mt-3 w-56 bg-bg-elevated border border-border shadow-2xl rounded-lg p-3 text-xs text-text-secondary normal-case tracking-normal z-50 text-left pointer-events-none">
                  This is a live estimate based on current CPU, memory, and disk utilization. Run a System Check to see your <b>Full Diagnostic Score</b>.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setActivePage("systemcheck")}
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                Run system check
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActivePage("cleaner")}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Quick clean
              </Button>
            </div>
          </div>
        </motion.div>
        <motion.div
          variants={staggerItem}
          className="rounded-2xl border border-border/70 bg-bg-surface/65 p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Recommended</p>
              <h2 className="mt-1 text-base font-semibold text-text-primary">
                Next best actions
              </h2>
            </div>
            <CheckCircle2 className="h-5 w-5 text-brand-primary" />
          </div>
          <div className="mt-4 divide-y divide-border/50">
            {actions.map(({ label: actionLabel, desc, icon: Icon, page }) => (
              <button
                key={actionLabel}
                onClick={() => setActivePage(page)}
                className="group flex w-full items-center gap-3 py-3 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-bg-elevated text-text-secondary group-hover:border-brand-primary/30 group-hover:text-brand-secondary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-text-primary">
                    {actionLabel}
                  </p>
                  <p className="text-[11px] text-text-muted">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </motion.div>
      </motion.section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="section-label">Live resources</p>
            <h2 className="mt-1 text-base font-semibold text-text-primary">
              Current workload
            </h2>
          </div>
          <span className="flex items-center gap-2 text-[11px] text-text-muted">
            <span className="status-dot" />
            Updating now
          </span>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2"
        >
          <StatCard
            title="CPU"
            value={stats ? `${Math.round(stats.cpu)}%` : "—"}
            subtitle={stats ? `${stats.cpuSpeed.toFixed(1)} GHz` : undefined}
            icon={<Cpu className="h-full w-full" />}
            percent={stats?.cpu}
          />
          <StatCard
            title="Memory"
            value={stats ? `${Math.round(stats.ram.percent)}%` : "—"}
            subtitle={
              stats
                ? `${formatBytes(stats.ram.used)} of ${formatBytes(stats.ram.total)}`
                : undefined
            }
            icon={<MemoryStick className="h-full w-full" />}
            percent={stats?.ram.percent}
          />
          <StatCard
            title="Disk"
            value={stats ? `${Math.round(stats.disk.percent)}%` : "—"}
            subtitle={
              stats ? `${formatBytes(stats.disk.free)} available` : undefined
            }
            icon={<HardDrive className="h-full w-full" />}
            percent={stats?.disk.percent}
          />
          <StatCard
            title="Current Network Activity"
            value={stats ? formatMbps(stats.network.download) : "—"}
            subtitle={
              stats ? `Upload ${formatMbps(stats.network.upload)}` : undefined
            }
            icon={<Wifi className="h-full w-full" />}
          />
        </motion.div>
      </section>
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(260px,.7fr)] gap-5 max-[1050px]:grid-cols-1">
        <MotionCard variants={staggerItem} initial="initial" animate="animate">
          <CardHeader>
            <div>
              <p className="section-label">Performance</p>
              <CardTitle className="mt-1 text-base">
                Resource activity
              </CardTitle>
            </div>
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
          </CardHeader>
          <CardContent>
            <LiveChart data={chartData} height={210} />
          </CardContent>
        </MotionCard>
        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-4">
            <Clock3 className="h-4 w-4 text-text-muted" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[.13em] text-text-muted">
              Uptime
            </p>
            <p className="mt-1 text-base font-semibold text-text-primary tabular-nums">
              {stats ? formatUptime(stats.uptime) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-4">
            <Activity className="h-4 w-4 text-text-muted" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[.13em] text-text-muted">
              Processes
            </p>
            <p className="mt-1 text-base font-semibold text-text-primary tabular-nums">
              {stats ? stats.processes : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-bg-surface/65 p-4">
            <ShieldCheck className="h-4 w-4 text-text-muted" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[.13em] text-text-muted">
              Account
            </p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              {entitlement.trial_active
                ? "PRO trial"
                : `${entitlement.plan} plan`}
            </p>
          </div>
        </div>
      </div>
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#9a7b45]" />
          <div>
            <p className="section-label">Propel intelligence</p>
            <h2 className="mt-1 text-base font-semibold text-text-primary">
              Smart insights
            </h2>
          </div>
        </div>
        <InsightsPanel />
      </section>
    </div>
  );
});
Dashboard.displayName = "Dashboard";
