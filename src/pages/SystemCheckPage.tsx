import React, { useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Cpu,
  HardDrive,
  Thermometer,
  Wifi,
  Lock,
  Battery,
  Settings,
  Activity,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { useSettingsStore } from "@/store/settingsStore";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { RingGauge } from "@/components/ui/RingGauge";
import { CountUp } from "@/components/ui/CountUp";
import { Progress } from "@/components/ui/Progress";
import { StatusPill } from "@/components/ui/StatusPill";
import { Callout } from "@/components/ui/Callout";
import { Tooltip } from "@/components/ui/Tooltip";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Tone } from "@/theme/thresholds";

// ── Types ──────────────────────────────────────────────────────────────────
interface FullScanData {
  hardware: any;
  gpu: any;
  disk: any;
  thermal: any;
  network: any;
  security: any;
  battery: any;
  optimization: any;
  healthScore: any;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Diagnostic score tone (same 80 / 60 cut-offs this page always used). */
function diagTone(score: number | null | undefined): Tone {
  if (score == null) return "neutral";
  if (score >= 80) return "healthy";
  if (score >= 60) return "warning";
  return "critical";
}

function StatusBadge({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null) return <StatusPill tone="neutral">Unknown</StatusPill>;
  return (
    <StatusPill tone={ok ? "healthy" : "critical"}>
      {label ?? (ok ? "Good" : "Issue")}
    </StatusPill>
  );
}

function SectionCard({
  icon,
  title,
  score,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  score?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = diagTone(score);

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        "overflow-hidden rounded-card border bg-surface-raised transition-[border-color,box-shadow] duration-base",
        open
          ? "border-line shadow-[var(--shadow-1),var(--highlight-top)]"
          : "border-line-subtle hover:border-line",
      )}
    >
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-state/[var(--a-hover)] focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--c-brand)/.45)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-inset text-fg-2">
            {icon}
          </span>
          <span className="truncate text-body font-semibold text-fg-1">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {score != null && <StatusPill tone={tone}>{score}/100</StatusPill>}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-fg-3 transition-transform duration-base ease-out",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-line-subtle px-4 pb-4 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | number | null;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-subtle py-1.5 last:border-0">
      <span className="text-body-sm text-fg-3">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {value != null && (
          <span className="truncate text-body-sm font-medium text-fg-1 tabular">{value}</span>
        )}
        {badge}
      </div>
    </div>
  );
}

function Subhead({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return <p className={cn("section-label mb-1", !first && "mt-4")}>{children}</p>;
}

function NoData({ children = "No data available" }: { children?: React.ReactNode }) {
  return <p className="text-body-sm text-fg-3">{children}</p>;
}

// ── Section Renderers ─────────────────────────────────────────────────────
function HardwareSection({ data }: { data: any }) {
  if (!data) return <NoData />;
  return (
    <>
      <Subhead first>CPU</Subhead>
      <Row label="Model" value={data.cpu?.model} />
      <Row
        label="Cores / Threads"
        value={`${data.cpu?.cores ?? "?"} / ${data.cpu?.threads ?? data.cpu?.cores ?? "?"}`}
      />
      <Row label="Current Load" value={`${data.cpu?.load ?? 0}%`} />
      <Row label="Base Speed" value={data.cpu?.speed ? `${data.cpu.speed} GHz` : undefined} />

      <Subhead>Memory</Subhead>
      <Row label="Total RAM" value={formatBytes(data.ram?.total)} />
      <Row
        label="Used"
        value={`${formatBytes(data.ram?.used)} (${data.ram?.pressurePercent ?? 0}%)`}
      />
      <Row
        label="Slots Used"
        value={`${data.ram?.slots ? `${data.ram.slots.filter((s: any) => s.size > 0).length} / ${data.ram.slots.length}` : (data.ram?.slotsUsed != null ? `${data.ram.slotsUsed} / ${data.ram.totalSlots}` : "?")}`}
      />

      <Subhead>System</Subhead>
      <Row
        label="Motherboard"
        value={`${data.motherboard?.manufacturer ?? ""} ${data.motherboard?.model ?? ""}`}
      />
      <Row
        label="BIOS"
        value={`${data.motherboard?.biosVersion ?? ""} (${data.motherboard?.biosDate ?? ""})`}
      />
      <Row label="OS" value={`${data.os?.distro ?? ""} ${data.os?.release ?? ""}`} />
    </>
  );
}

function GpuSection({ data }: { data: any }) {
  if (!data) return <NoData />;
  return (
    <>
      {data.controllers?.map((c: any, i: number) => (
        <div key={i} className={i > 0 ? "mt-3 border-t border-line-subtle pt-3" : ""}>
          <Row label="GPU" value={c.model} />
          <Row label="VRAM" value={c.vram ? `${c.vram} MB` : "Unknown"} />
          <Row label="Driver" value={c.driverVersion} />
          <Row
            label="Driver Status"
            badge={
              <StatusBadge ok={data.driverStatus === "ok"} label={data.driverStatus ?? "unknown"} />
            }
          />
          {c.temperatureGpu != null && <Row label="Temperature" value={`${c.temperatureGpu}°C`} />}
        </div>
      ))}
      <Subhead>APIs</Subhead>
      <Row
        label="DirectX"
        value={data.directX?.version}
        badge={<StatusBadge ok={!!data.directX?.version} />}
      />
      <Row
        label="Vulkan"
        badge={
          <StatusBadge
            ok={data.vulkanSupported}
            label={data.vulkanSupported ? "Supported" : "Not Found"}
          />
        }
      />
    </>
  );
}

function DiskSection({ data }: { data: any }) {
  if (!data) return <NoData />;
  return (
    <>
      {data.drives?.map((d: any, i: number) => (
        <div key={i} className={i > 0 ? "mt-3 border-t border-line-subtle pt-3" : ""}>
          <Row label="Drive" value={d.name} />
          <Row label="Type" value={d.type} />
          <Row label="Capacity" value={formatBytes(d.totalBytes)} />
          <Row label="Used" value={`${formatBytes(d.usedBytes)} (${d.usedPercent}%)`} />
          <Row
            label="Health"
            badge={<StatusBadge ok={d.healthPercent >= 70} label={`${d.healthPercent}%`} />}
          />
          <Row
            label="SMART"
            badge={
              <StatusBadge
                ok={
                  d.smartStatus?.toLowerCase() === "ok" ||
                  d.smartStatus?.toLowerCase() === "good"
                }
                label={d.smartStatus}
              />
            }
          />
          {d.temperature != null && <Row label="Temperature" value={`${d.temperature}°C`} />}
          {d.warnings?.length > 0 &&
            d.warnings.map((w: string, j: number) => (
              <Callout key={j} tone="warning" compact className="mt-2">
                {w}
              </Callout>
            ))}
        </div>
      ))}
    </>
  );
}

function ThermalSection({ data }: { data: any }) {
  if (!data) return <NoData>No temperature data available</NoData>;
  return (
    <>
      <Row
        label="Status"
        badge={
          <StatusBadge
            ok={data.status === "cool" || data.status === "warm"}
            label={data.statusLabel}
          />
        }
      />
      {data.cpuTemp != null && <Row label="CPU Temperature" value={`${data.cpuTemp}°C`} />}
      {data.gpuTemp != null && <Row label="GPU Temperature" value={`${data.gpuTemp}°C`} />}
      {data.maxTemp != null && <Row label="Max Sensor" value={`${data.maxTemp}°C`} />}
      <Row
        label="Throttling"
        badge={
          <StatusBadge ok={!data.throttling} label={data.throttling ? "Detected" : "None"} />
        }
      />
      {data.allTemps
        ?.filter((t: any) => !["cpu", "gpu"].includes(t.label.toLowerCase()))
        .slice(0, 6)
        .map((t: any, i: number) => (
          <Row key={i} label={t.label} value={`${t.temp}°C`} />
        ))}
      {data.recommendation && (
        <Callout tone="warning" compact className="mt-2">
          {data.recommendation}
        </Callout>
      )}
    </>
  );
}

function NetworkSection({ data }: { data: any }) {
  if (!data) return <NoData />;
  return (
    <>
      <Row label="Adapter" value={data.activeAdapter} />
      <Row label="Type" value={data.type} />
      <Row label="Local IP" value={data.localIP} />
      <Row label="Public IP" value={data.publicIP} />
      <Row label="Link Speed" value={data.speed ? `${data.speed} Mbps` : "Unknown"} />
      <Row
        label="Latency"
        value={data.latencyMs >= 0 ? `${data.latencyMs} ms` : "Unreachable"}
        badge={<StatusBadge ok={data.latencyMs >= 0 && data.latencyMs < 100} />}
      />
      <Row
        label="DNS Response"
        value={data.dnsResponseMs >= 0 ? `${data.dnsResponseMs} ms` : "Failed"}
      />
      {data.wifiSSID && <Row label="WiFi SSID" value={data.wifiSSID} />}
      {data.wifiSignal != null && (
        <Row
          label="WiFi Signal"
          value={`${data.wifiSignal}%`}
          badge={<StatusBadge ok={data.wifiSignal >= 60} />}
        />
      )}
      {data.issues?.map((issue: string, i: number) => (
        <Callout key={i} tone="warning" compact className="mt-2">
          {issue}
        </Callout>
      ))}
    </>
  );
}

function SecuritySection({ data }: { data: any }) {
  if (!data) return <NoData />;
  return (
    <>
      <Row
        label="Windows Defender"
        badge={
          <StatusBadge
            ok={data.defenderEnabled}
            label={data.defenderEnabled ? "Enabled" : "Disabled"}
          />
        }
      />
      <Row
        label="Defender Signatures"
        badge={
          <StatusBadge
            ok={data.defenderUpToDate}
            label={data.defenderUpToDate ? "Up to date" : "Outdated"}
          />
        }
      />
      <Row label="Firewall" badge={<StatusBadge ok={data.firewallEnabled} />} />
      <Row label="Secure Boot" badge={<StatusBadge ok={data.secureBootEnabled} />} />
      <Row
        label="TPM"
        value={data.tpmAvailable ? `v${data.tpmVersion}` : undefined}
        badge={<StatusBadge ok={data.tpmAvailable} />}
      />
      <Row
        label="BitLocker"
        badge={
          <StatusBadge ok={data.bitLockerEnabled} label={data.bitLockerEnabled ? "On" : "Off"} />
        }
      />
      <Row label="UAC" badge={<StatusBadge ok={data.uacEnabled} />} />
      <Row
        label="Pending Updates"
        badge={
          <StatusBadge
            ok={!data.windowsUpdatePending}
            label={data.windowsUpdatePending ? "Yes" : "None"}
          />
        }
      />
      {data.lastUpdateDays != null && (
        <Row label="Last Update" value={`${data.lastUpdateDays} days ago`} />
      )}
      {data.recommendations?.map((r: string, i: number) => (
        <Callout key={i} tone="info" compact className="mt-2">
          {r}
        </Callout>
      ))}
    </>
  );
}

function BatterySection({ data }: { data: any }) {
  if (!data) return <NoData />;
  if (!data.hasBattery) {
    return (
      <div className="flex items-center gap-2 text-body-sm text-fg-3">
        <Info className="h-4 w-4" />
        No battery detected (desktop or server system)
      </div>
    );
  }
  return (
    <>
      <Row label="Charge" value={`${data.percent}%`} />
      <Row
        label="Status"
        badge={
          <StatusBadge ok={data.isCharging} label={data.isCharging ? "Charging" : "On Battery"} />
        }
      />
      {data.healthPercent != null && (
        <Row
          label="Battery Health"
          value={`${data.healthPercent}%`}
          badge={<StatusBadge ok={data.healthPercent >= 80} />}
        />
      )}
      {data.wearLevel != null && <Row label="Wear Level" value={`${data.wearLevel}%`} />}
      {data.cycleCount != null && <Row label="Cycle Count" value={data.cycleCount} />}
      {data.designCapacity != null && (
        <Row label="Design Capacity" value={`${data.designCapacity} mWh`} />
      )}
      {data.currentCapacity != null && (
        <Row label="Current Capacity" value={`${data.currentCapacity} mWh`} />
      )}
      {data.timeRemaining != null && data.timeRemaining > 0 && (
        <Row label="Time Remaining" value={`${Math.round(data.timeRemaining)} min`} />
      )}
      {data.recommendation && (
        <Callout tone="warning" compact className="mt-2">
          {data.recommendation}
        </Callout>
      )}
    </>
  );
}

function OptimizationSection({ data }: { data: any }) {
  if (!data) return <NoData />;
  if (data.findings?.length === 0) {
    return (
      <Callout tone="success" compact icon={<CheckCircle />}>
        No optimization issues found. System is well tuned.
      </Callout>
    );
  }
  const severityTone: Record<string, "danger" | "warning" | "info"> = {
    critical: "danger",
    high: "danger",
    medium: "warning",
    low: "info",
  };
  return (
    <div className="space-y-2">
      {data.findings?.map((f: any, i: number) => (
        <Callout
          key={i}
          tone={severityTone[f.severity] ?? "info"}
          compact
          icon={<AlertTriangle />}
          title={
            <>
              {f.title} <span className="font-normal text-fg-3">({f.category})</span>
            </>
          }
        >
          {f.detail}
        </Callout>
      ))}
    </div>
  );
}

// ── Mini Score Card ────────────────────────────────────────────────────────
function MiniScore({ label, score }: { label: string; score: number | undefined }) {
  const tone = diagTone(score);
  return (
    <div className="rounded-control border border-line-subtle bg-surface-inset px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-caption text-fg-3">{label}</span>
        <span className="text-body font-semibold text-fg-1 tabular">{score ?? "–"}</span>
      </div>
      <Progress
        value={score ?? null}
        tone={tone}
        size="xs"
        className="mt-2"
        aria-label={`${label} score`}
      />
    </div>
  );
}

const COVERAGE = [
  "Hardware",
  "Drivers",
  "Storage",
  "Thermals",
  "Network",
  "Security",
  "Battery",
  "Optimization",
];

// ── Main Page ─────────────────────────────────────────────────────────────
export function SystemCheckPage() {
  const { data, lastScanTime, error, scanning } = useSessionStore(s => s.systemCheck);
  const setSystemCheck = useSessionStore(s => s.setSystemCheck);
  
  
  
    const runScan = useCallback(async () => {
    setSystemCheck({ scanning: true, error: null });
    try {
      const result = await window.propel.systemCheck.runFull();
      if (result.ok) {
        setSystemCheck({ data: result.data, lastScanTime: new Date() });
      } else {
        setSystemCheck({ error: result.error ?? "Scan failed" });
      }
    } catch (e: any) {
      setSystemCheck({ error: e?.message ?? "Unexpected error" });
    } finally {
      setSystemCheck({ scanning: false });
    }
  }, [setSystemCheck]);

  const hs = data?.healthScore?.breakdown;
  const sections = [
    {
      icon: <Cpu className="w-4 h-4" />,
      title: "Hardware",
      score: hs?.cpu,
      children: <HardwareSection data={data?.hardware} />,
    },
    {
      icon: <Activity className="w-4 h-4" />,
      title: "GPU & Drivers",
      score: hs?.gpu,
      children: <GpuSection data={data?.gpu} />,
    },
    {
      icon: <HardDrive className="w-4 h-4" />,
      title: "Disk Health",
      score: hs?.disk,
      children: <DiskSection data={data?.disk} />,
    },
    {
      icon: <Thermometer className="w-4 h-4" />,
      title: "Thermal Status",
      score: hs?.thermal,
      children: <ThermalSection data={data?.thermal} />,
    },
    {
      icon: <Wifi className="w-4 h-4" />,
      title: "Network",
      score: hs?.network,
      children: <NetworkSection data={data?.network} />,
    },
    {
      icon: <Lock className="w-4 h-4" />,
      title: "Security",
      score: hs?.security,
      children: <SecuritySection data={data?.security} />,
    },
    {
      icon: <Battery className="w-4 h-4" />,
      title: "Battery",
      score: data?.battery?.hasBattery ? hs?.battery : undefined,
      children: <BatterySection data={data?.battery} />,
    },
    {
      icon: <Settings className="w-4 h-4" />,
      title: "Windows Optimization",
      score: hs?.optimization,
      children: <OptimizationSection data={data?.optimization} />,
    },
  ];

  const validSections = sections.filter(s => s.score !== undefined);
  const lowest4 = [...validSections].sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 4);

  const ATTENTION_THRESHOLD = 60;
  const attentionItems = [...(hs?.criticalIssues || [])];
  
  if (data) {
    const getKeywords = (title: string) => {
      if (title.includes("Hardware")) return ["cpu", "ram", "hardware", "memory"];
      if (title.includes("GPU")) return ["gpu", "driver", "graphics"];
      if (title.includes("Disk")) return ["disk", "drive", "storage"];
      if (title.includes("Thermal")) return ["thermal", "temperature", "heat"];
      if (title.includes("Network")) return ["network", "internet", "connection"];
      if (title.includes("Security")) return ["security", "firewall", "defender", "virus", "antivirus", "tamper"];
      if (title.includes("Battery")) return ["battery", "power"];
      if (title.includes("Windows")) return ["windows", "optimization", "update", "startup"];
      return [];
    };

    validSections.forEach(s => {
      if ((s.score as number) < ATTENTION_THRESHOLD) {
        const keywords = getKeywords(s.title);
        const hasSpecific = attentionItems.some(i => keywords.some(k => i.toLowerCase().includes(k)));
        if (!hasSpecific) {
          attentionItems.push(`${s.title} requires attention (Score: ${s.score}/100). Review the detailed results.`);
        }
      }
    });
  }

  const overall = hs?.overall ?? 0;
  const overallTone = diagTone(data ? overall : null);

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-6xl pb-8">
        <PageHeader
          eyebrow="Diagnostics workspace"
          title="System check"
          subtitle={
            lastScanTime
              ? `Last completed ${lastScanTime.toLocaleTimeString()}`
              : "Inspect hardware, security, storage and Windows health."
          }
          action={
            <Button onClick={runScan} loading={scanning} icon={<RefreshCw />}>
              {scanning ? "Scanning system…" : data ? "Run again" : "Run full system check"}
            </Button>
          }
        />

        {error && (
          <Callout tone="danger" title="The system check could not finish" className="mb-4">
            Some Windows signals could not be read. Use Run again to retry.
          </Callout>
        )}

        <div className="grid grid-cols-[minmax(300px,1fr)_1.6fr] items-start gap-4 max-[1000px]:grid-cols-1">
          <aside className="flex flex-col gap-4">
            <Card level="feature" className="p-6">
              {data ? (
                <>
                  <div className="flex items-center gap-5">
                    <RingGauge
                      value={overall}
                      tone={overallTone}
                      size={128}
                      thickness={10}
                      ticks
                      aria-label={`Full diagnostic score ${overall} out of 100`}
                    >
                      <CountUp
                        value={overall}
                        className="font-display text-[34px] font-semibold leading-none text-fg-1"
                      />
                      <span className="mt-1 text-caption text-fg-3">of 100</span>
                    </RingGauge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CardEyebrow>Full diagnostic score</CardEyebrow>
                        <Tooltip
                          content="Your authoritative score from a complete scan across 8 system categories."
                          side="bottom"
                        >
                          <button
                            aria-label="About the diagnostic score"
                            className="rounded-full p-0.5 text-fg-3 hover:text-fg-1 focus-visible:shadow-ring"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <h2 className="mt-1.5 font-display text-[22px] font-semibold leading-7 tracking-[-.02em] text-fg-1">
                        {hs?.label ?? "Checked"}
                      </h2>
                      <StatusPill tone={overallTone} className="mt-2">
                        Grade {hs?.grade ?? "—"}
                      </StatusPill>
                    </div>
                  </div>
                  {lowest4.length > 0 && (
                    <>
                      <p className="section-label mb-2 mt-6">Lowest categories</p>
                      <div className="grid grid-cols-2 gap-2">
                        {lowest4.map((s) => (
                          <MiniScore key={s.title} label={s.title} score={s.score} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : scanning ? (
                <div role="status">
                  <div className="flex items-center gap-4">
                    <RingGauge value={null} size={72} thickness={7}>
                      <Shield className="h-6 w-6 text-brand" />
                    </RingGauge>
                    <div>
                      <h2 className="text-title font-semibold text-fg-1">Analyzing your PC</h2>
                      <p className="text-body-sm text-fg-3">Collecting live diagnostic data…</p>
                    </div>
                  </div>
                  <Progress value={null} indeterminate className="mt-5" aria-label="Scanning" />
                  <ul className="mt-5 space-y-2.5">
                    {sections.slice(0, 5).map((s) => (
                      <li key={s.title} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-chip bg-surface-inset text-fg-3 [&>svg]:h-3.5 [&>svg]:w-3.5">
                          {s.icon}
                        </span>
                        <span className="flex-1 text-body-sm text-fg-2">{s.title}</span>
                        <Skeleton className="h-2 w-16" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-col">
                  <span className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-fg">
                    <Shield className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-display text-[22px] font-semibold leading-7 tracking-[-.02em] text-fg-1">
                    Ready for a complete assessment
                  </h2>
                  <p className="mt-2 text-body text-fg-2">
                    The check reads existing Windows and hardware signals, then organizes them
                    into clear health categories.
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 pt-8">
                    {COVERAGE.map((x) => (
                      <span key={x} className="flex items-center gap-2 text-body-sm text-fg-2">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-brand" />
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {attentionItems.length > 0 && (
              <Card className="overflow-hidden p-4">
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-danger" />
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger-fg" />
                  <p className="text-body font-semibold text-fg-1">Needs attention</p>
                  <StatusPill tone="critical" className="ml-auto">
                    {attentionItems.length}
                  </StatusPill>
                </div>
                <ul className="mt-3 space-y-2">
                  {attentionItems.map((issue: string, i: number) => (
                    <li key={i} className="flex gap-2 text-body-sm text-fg-2">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                      />
                      {issue}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <CardEyebrow>Diagnostic categories</CardEyebrow>
                <h2 className="mt-1 text-title font-semibold text-fg-1">
                  {data ? "Detailed results" : "Coverage"}
                </h2>
              </div>
              {data && <span className="text-caption text-fg-3">Select a category to inspect</span>}
            </div>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-2 items-start gap-3 max-[760px]:grid-cols-1"
            >
              {sections.map((section, i) => (
                <SectionCard
                  key={section.title}
                  icon={section.icon}
                  title={section.title}
                  score={section.score}
                  defaultOpen={!!data && i === 0}
                >
                  {data ? (
                    section.children
                  ) : (
                    <p className="text-body-sm text-fg-3">Included in the next full system check.</p>
                  )}
                </SectionCard>
              ))}
            </motion.div>
          </Card>
        </div>
      </div>
    </div>
  );
}
