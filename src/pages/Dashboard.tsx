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
  Clock3,
  Rocket,
  Files,
  Gauge,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { LiveChart } from "@/components/charts/LiveChart";
import { MotionCard, CardEyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { RingGauge } from "@/components/ui/RingGauge";
import { CountUp } from "@/components/ui/CountUp";
import { Progress } from "@/components/ui/Progress";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusPill } from "@/components/ui/StatusPill";
import { PlanIcon } from "@/components/ui/PlanIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { Skeleton, SkeletonStatCard } from "@/components/ui/Skeleton";
import { TONE_SOFT } from "@/components/ui/tone";
import { useLiveGate } from "@/components/ui/hooks/useLiveGate";
import { useGatedStore } from "@/components/ui/hooks/useGatedStore";
import { InsightsPanel } from "@/components/common/InsightsPanel";
import { stagger, rise } from "@/theme/motion";
import {
  scoreTone,
  usageTone,
  toneColor,
  type Tone,
  type UsageMetric,
} from "@/theme/thresholds";
import {
  formatBytes,
  formatMbps,
  formatUptime,
  getHealthScore,
  getHealthLabel,
} from "@/utils/format";
import { cn } from "@/utils/cn";
import type { NavPage, SystemStats } from "@/types";

const NET_POINTS = 40;
// chartData is sampled every 3s, so 20 points back is about one minute.
const TREND_LOOKBACK = 20;

const LiveClock = memo(() => {
  const live = useLiveGate();
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    if (!live) return;
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 10_000);
    return () => clearInterval(id);
  }, [live]);
  return (
    <time className="flex items-center gap-1.5 tabular">
      <Clock3 className="h-3.5 w-3.5" />
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
});
LiveClock.displayName = "LiveClock";

/** Rolling download-speed buffer, local to the Dashboard (UI only). */
function useNetworkHistory(stats: SystemStats | null) {
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!stats) return;
    setHistory((h) => [...h.slice(-(NET_POINTS - 1)), stats.network.download]);
  }, [stats]);
  return history;
}

const HEADLINE: Record<Tone, string> = {
  healthy: "Your PC is running well",
  warning: "A few things need attention",
  critical: "Your PC is under pressure",
  neutral: "Reading live signals",
};

const SUMMARY: Record<Tone, string> = {
  healthy:
    "Core resources are operating within a healthy range. Keep maintenance current for the best experience.",
  warning: "Your system is usable, but one or more resources would benefit from attention.",
  critical:
    "Propel found resource pressure that deserves attention. Run a check for clear next steps.",
  neutral: "Propel is reading live CPU, memory and disk signals.",
};

// ── Health hero ──────────────────────────────────────────────────────────
const HealthHero = memo<{
  stats: SystemStats | null;
  score: number | null;
  trend: number | null;
  unavailable: boolean;
}>(
  ({ stats, score, trend, unavailable }) => {
    const tone = scoreTone(score);
    const { label } = getHealthLabel(score ?? 0);
    const headline = unavailable ? "System readings unavailable" : HEADLINE[tone];
    const summary = unavailable
      ? "Propel could not read live system stats yet. It keeps retrying in the background."
      : SUMMARY[tone];
    return (
      <MotionCard variants={rise} level="feature" className="col-span-7 p-6 max-[1180px]:col-span-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-28 h-[360px] w-[360px] rounded-full"
          style={{
            background: `radial-gradient(closest-side, ${toneColor(tone === "neutral" ? "healthy" : tone, 0.11)}, transparent)`,
          }}
        />
        <div className="relative flex items-center gap-7">
          <RingGauge
            value={score}
            tone={tone}
            size={160}
            thickness={12}
            ticks
            aria-label={`Health score ${score ?? "loading"} out of 100`}
          >
            {score === null ? (
              unavailable ? (
                <Gauge className="h-8 w-8 text-fg-4" />
              ) : (
                <Skeleton className="h-10 w-16" />
              )
            ) : (
              <>
                <CountUp value={score} className="font-display text-display font-semibold text-fg-1" />
                <span className="mt-0.5 text-caption font-medium text-fg-3">of 100</span>
              </>
            )}
          </RingGauge>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={tone}>
                {score === null ? (unavailable ? "Waiting for data" : "Assessing") : label}
              </StatusPill>
              {trend !== null && <TrendChip delta={trend} />}
              <Tooltip
                content="A live estimate from current CPU, memory and disk use. Run a System Check for your full diagnostic score."
                side="bottom"
              >
                <button
                  aria-label="About the health score"
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-fg-3 hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
                >
                  <Info className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
            <h2 className="mt-3 font-display text-[24px] font-semibold leading-[30px] tracking-[-.025em] text-fg-1">
              {headline}
            </h2>
            <p className="mt-1.5 max-w-[46ch] text-body text-fg-2">{summary}</p>

            <div className="mt-5 grid grid-cols-3 gap-4">
              {stats || unavailable ? (
                <>
                  <Progress label="CPU" metric="cpu" value={stats?.cpu ?? null} showValue size="xs" />
                  <Progress label="Memory" metric="memory" value={stats?.ram.percent ?? null} showValue size="xs" />
                  <Progress label="Disk" metric="disk" value={stats?.disk.percent ?? null} showValue size="xs" />
                </>
              ) : (
                <>
                  <Skeleton className="h-7" />
                  <Skeleton className="h-7" />
                  <Skeleton className="h-7" />
                </>
              )}
            </div>
          </div>
        </div>
      </MotionCard>
    );
  },
);
HealthHero.displayName = "HealthHero";

const TrendChip = memo<{ delta: number }>(({ delta }) => {
  const steady = Math.abs(delta) < 1;
  const up = delta > 0;
  const Icon = steady ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tabular",
        steady ? "bg-surface-inset text-fg-3" : up ? "bg-success-soft text-success-fg" : "bg-warning-soft text-warning-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {steady ? "Steady" : `${up ? "+" : ""}${Math.round(delta)}`}
      <span className="font-medium opacity-80">· last min</span>
    </span>
  );
});
TrendChip.displayName = "TrendChip";

// ── Recommended actions ──────────────────────────────────────────────────
type Action = {
  id: NavPage;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  pill?: string;
};

const SEVERITY: Record<Tone, number> = { critical: 2, warning: 1, healthy: 0, neutral: 0 };

const Recommended = memo<{ stats: SystemStats | null }>(({ stats }) => {
  const setActivePage = useAppStore((s) => s.setActivePage);
  const actions = useMemo<Action[]>(() => {
    const diskTone = usageTone("disk", stats?.disk.percent);
    const memTone = usageTone("memory", stats?.ram.percent);
    const list: Action[] = [
      {
        id: "cleaner",
        label: "Clean unnecessary files",
        desc: stats
          ? `${formatBytes(stats.disk.free)} free on your system disk`
          : "Review safe cleanup options",
        icon: Trash2,
        tone: diskTone,
        pill: stats && SEVERITY[diskTone] > 0 ? `Disk ${Math.round(stats.disk.percent)}% full` : undefined,
      },
      {
        id: "memory",
        label: "Free up memory",
        desc: stats
          ? `${formatBytes(stats.ram.used)} of ${formatBytes(stats.ram.total)} in use`
          : "Release memory held by idle apps",
        icon: MemoryStick,
        tone: memTone,
        pill: stats && SEVERITY[memTone] > 0 ? `Memory ${Math.round(stats.ram.percent)}%` : undefined,
      },
      {
        id: "startup",
        label: "Review startup apps",
        desc: "Trim what launches with Windows",
        icon: Rocket,
        tone: "neutral",
      },
      {
        id: "duplicates",
        label: "Find duplicate files",
        desc: "Reclaim space from identical copies",
        icon: Files,
        tone: "neutral",
      },
    ];
    return list
      .map((a, i) => ({ a, i }))
      .sort((x, y) => SEVERITY[y.a.tone] - SEVERITY[x.a.tone] || x.i - y.i)
      .map(({ a }) => a);
  }, [stats]);

  const flagged = actions.filter((a) => SEVERITY[a.tone] > 0).length;

  return (
    <MotionCard variants={rise} className="col-span-5 flex flex-col p-2 max-[1180px]:col-span-12">
      <div className="flex items-center justify-between px-3 pb-2 pt-2.5">
        <div>
          <CardEyebrow>Recommended</CardEyebrow>
          <h2 className="mt-1 text-title font-semibold text-fg-1">Next best actions</h2>
        </div>
        {flagged > 0 ? (
          <StatusPill tone="warning">{flagged} need attention</StatusPill>
        ) : (
          <StatusPill tone={stats ? "healthy" : "neutral"}>{stats ? "All clear" : "Reading"}</StatusPill>
        )}
      </div>
      <ul className="flex flex-1 flex-col">
        {actions.map(({ id, label, desc, icon: Icon, tone, pill }) => (
          <li key={id}>
            <button
              onClick={() => setActivePage(id)}
              className="group flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors duration-fast hover:bg-state/[var(--a-hover)] active:bg-state/[var(--a-pressed)] focus-visible:shadow-ring"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                  SEVERITY[tone] > 0 ? TONE_SOFT[tone] : "bg-surface-inset text-fg-2",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-fg-1">{label}</span>
                <span className="block truncate text-caption text-fg-3">{desc}</span>
              </span>
              {pill && <StatusPill tone={tone}>{pill}</StatusPill>}
              <ArrowRight className="h-4 w-4 shrink-0 text-fg-4 transition-transform duration-fast ease-out group-hover:translate-x-0.5 group-hover:text-fg-2" />
            </button>
          </li>
        ))}
      </ul>
    </MotionCard>
  );
});
Recommended.displayName = "Recommended";

// ── Resource cards ───────────────────────────────────────────────────────
const ResourceCard = memo<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  metric?: UsageMetric;
  percent?: number;
  value: number;
  format?: (v: number) => string;
  unit?: string;
  sub: string;
  history?: number[];
  historyMax?: number;
  color?: string;
  footer?: React.ReactNode;
}>(({ label, icon: Icon, metric, percent, value, format, unit, sub, history, historyMax, color, footer }) => {
  const tone = metric ? usageTone(metric, percent) : null;
  const lineColor = color ?? (tone ? toneColor(tone) : "rgb(var(--c-chart-1))");
  return (
    <MotionCard variants={rise} className="col-span-3 flex flex-col p-4 max-[1180px]:col-span-6">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-body-sm font-medium text-fg-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-surface-inset text-fg-2">
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </span>
        {tone ? <StatusPill tone={tone} /> : <span className="text-caption text-fg-3">Live</span>}
      </div>
      <p className="mt-3 flex items-baseline gap-1">
        <CountUp
          value={value}
          format={format}
          className="font-display text-metric font-semibold text-fg-1"
        />
        {unit && <span className="text-body font-medium text-fg-3">{unit}</span>}
      </p>
      <p className="mt-0.5 truncate text-caption text-fg-3">{sub}</p>
      <div className="mt-auto pt-3">
        {history ? (
          <Sparkline
            data={history}
            min={0}
            max={historyMax}
            color={lineColor}
            height={36}
            aria-label={`${label} trend`}
          />
        ) : null}
        {footer}
      </div>
    </MotionCard>
  );
});
ResourceCard.displayName = "ResourceCard";

const FactRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode | null;
}> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-2.5">
    <Icon className="h-4 w-4 shrink-0 text-fg-3" />
    <dt className="flex-1 text-body-sm text-fg-3">{label}</dt>
    <dd className="truncate text-body-sm font-semibold text-fg-1 tabular">
      {value ?? <Skeleton className="h-3.5 w-14" />}
    </dd>
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────
export const Dashboard = memo(function Dashboard() {
  const stats = useGatedStore((s) => s.stats);
  const chartData = useGatedStore((s) => s.chartData);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const netHistory = useNetworkHistory(stats);

  // Designed error state: if no reading arrives within 12s, say so.
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (stats) {
      setUnavailable(false);
      return;
    }
    const id = setTimeout(() => setUnavailable(true), 12_000);
    return () => clearTimeout(id);
  }, [stats]);

  const score = stats ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent) : null;

  const trend = useMemo(() => {
    if (!stats || score === null || chartData.length < 6) return null;
    const past = chartData[Math.max(0, chartData.length - 1 - TREND_LOOKBACK)];
    return score - getHealthScore(past.cpu, past.ram, stats.disk.percent);
  }, [chartData, stats, score]);

  const cpuHistory = useMemo(() => chartData.map((d) => d.cpu), [chartData]);
  const ramHistory = useMemo(() => chartData.map((d) => d.ram), [chartData]);
  const netMax = useMemo(() => Math.max(1, ...netHistory) * 1.15, [netHistory]);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="System overview"
        title="Your PC, at a glance"
        subtitle={stats ? `${stats.cpuModel} · ${stats.cpuCores} cores` : "Connecting to system services…"}
        meta={<LiveClock />}
        action={
          <Button onClick={() => setActivePage("systemcheck")} icon={<ShieldCheck />}>
            Run system check
          </Button>
        }
      />

      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-12 gap-4">
        <HealthHero stats={stats} score={score} trend={trend} unavailable={unavailable} />
        <Recommended stats={stats} />

        {stats ? (
          <>
            <ResourceCard
              label="CPU"
              icon={Cpu}
              metric="cpu"
              percent={stats.cpu}
              value={Math.round(stats.cpu)}
              unit="%"
              sub={`${stats.cpuSpeed.toFixed(1)} GHz · ${stats.cpuCores} cores`}
              history={cpuHistory}
              historyMax={100}
            />
            <ResourceCard
              label="Memory"
              icon={MemoryStick}
              metric="memory"
              percent={stats.ram.percent}
              value={Math.round(stats.ram.percent)}
              unit="%"
              sub={`${formatBytes(stats.ram.used)} of ${formatBytes(stats.ram.total)}`}
              history={ramHistory}
              historyMax={100}
            />
            <ResourceCard
              label="Disk"
              icon={HardDrive}
              metric="disk"
              percent={stats.disk.percent}
              value={Math.round(stats.disk.percent)}
              unit="%"
              sub={`${formatBytes(stats.disk.free)} free of ${formatBytes(stats.disk.total)}`}
              footer={
                <div className="flex h-9 flex-col justify-end gap-1.5">
                  <Progress value={stats.disk.percent} metric="disk" size="md" aria-label="Disk used" />
                  <div className="flex justify-between text-[10.5px] text-fg-3 tabular">
                    <span>{formatBytes(stats.disk.used)} used</span>
                    <span>{formatBytes(stats.disk.total)}</span>
                  </div>
                </div>
              }
            />
            <ResourceCard
              label="Network"
              icon={Wifi}
              value={stats.network.download}
              format={formatMbps}
              sub={`Upload ${formatMbps(stats.network.upload)}`}
              history={netHistory}
              historyMax={netMax}
              color="rgb(var(--c-chart-2))"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <SkeletonStatCard key={i} className="col-span-3 max-[1180px]:col-span-6" />
          ))
        )}

        <MotionCard variants={rise} className="col-span-8 max-[1180px]:col-span-12">
          <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4">
            <div>
              <CardEyebrow>Performance</CardEyebrow>
              <h2 className="mt-1 text-title font-semibold text-fg-1">Resource activity</h2>
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
              <span className="rounded-full border border-line-subtle bg-surface-inset px-2 py-0.5 text-[10.5px] font-medium">
                Last 3 min
              </span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <LiveChart data={chartData} height={232} />
          </div>
        </MotionCard>

        <MotionCard variants={rise} className="col-span-4 flex flex-col px-5 pb-2 pt-4 max-[1180px]:col-span-12">
          <CardEyebrow>System</CardEyebrow>
          <h2 className="mt-1 text-title font-semibold text-fg-1">Session facts</h2>
          <dl className="mt-2 divide-y divide-line-subtle">
            <FactRow icon={Clock3} label="Uptime" value={stats ? formatUptime(stats.uptime) : null} />
            <FactRow icon={Activity} label="Processes" value={stats ? stats.processes : null} />
            <FactRow icon={Gauge} label="Processor speed" value={stats ? `${stats.cpuSpeed.toFixed(1)} GHz` : null} />
            <FactRow icon={MemoryStick} label="Memory free" value={stats ? formatBytes(stats.ram.free) : null} />
            <FactRow
              icon={Sparkles}
              label="Account"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <PlanIcon plan={entitlement.trial_active ? "PRO" : entitlement.plan} size={14} />
                  {entitlement.trial_active ? "PRO trial" : `${entitlement.plan} plan`}
                </span>
              }
            />
          </dl>
        </MotionCard>
      </motion.div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-surface-raised text-fg-2 shadow-1">
            <Lightbulb className="h-4 w-4" />
          </span>
          <div>
            <CardEyebrow>Propel intelligence</CardEyebrow>
            <h2 className="text-title font-semibold text-fg-1">Smart insights</h2>
          </div>
        </div>
        <InsightsPanel />
      </section>
    </div>
  );
});
Dashboard.displayName = "Dashboard";
