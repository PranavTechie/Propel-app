import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  Wifi,
  Lock,
  Battery,
  Settings,
  Activity,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { useSettingsStore } from "@/store/settingsStore";

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

function StatusBadge({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null)
    return <span className="text-xs text-text-muted">Unknown</span>;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        ok
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-red-500/15 text-red-400",
      )}
    >
      {ok ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {label ?? (ok ? "Good" : "Issue")}
    </span>
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
  const scoreColor =
    score == null
      ? ""
      : score >= 80
        ? "text-emerald-400"
        : score >= 60
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden"
    >
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-white/[0.05]", "text-brand-primary")}>
            {icon}
          </div>
          <span className="font-semibold text-text-primary text-sm">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {score != null && (
            <span className={cn("text-sm font-bold", scoreColor)}>
              {score}/100
            </span>
          )}
          {open ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">{children}</div>
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
    <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {value != null && (
          <span className="text-xs text-text-primary font-medium">{value}</span>
        )}
        {badge}
      </div>
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────
function HealthRing({
  score,
  grade,
  label,
}: {
  score: number;
  grade: string;
  label: string;
}) {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        <motion.circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-black text-text-primary leading-none">
          {score}
        </div>
        <div className="text-xs text-text-muted mt-1">
          {grade} · {label}
        </div>
      </div>
    </div>
  );
}

// ── Section Renderers ─────────────────────────────────────────────────────
function HardwareSection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  return (
    <>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
        CPU
      </p>
      <Row label="Model" value={data.cpu?.brand} />
      <Row
        label="Cores / Threads"
        value={`${data.cpu?.physicalCores ?? "?"} / ${data.cpu?.cores ?? "?"}`}
      />
      <Row
        label="Current Load"
        value={`${data.cpu?.currentLoadPercent ?? 0}%`}
      />
      <Row
        label="Base Speed"
        value={data.cpu?.speed ? `${data.cpu.speed} GHz` : undefined}
      />

      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-4 mb-2">
        Memory
      </p>
      <Row label="Total RAM" value={formatBytes(data.ram?.total)} />
      <Row
        label="Used"
        value={`${formatBytes(data.ram?.used)} (${data.ram?.usedPercent}%)`}
      />
      <Row
        label="Slots Used"
        value={`${data.ram?.slotsUsed ?? "?"} / ${data.ram?.totalSlots ?? "?"}`}
      />

      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-4 mb-2">
        System
      </p>
      <Row
        label="Motherboard"
        value={`${data.motherboard?.manufacturer ?? ""} ${data.motherboard?.model ?? ""}`}
      />
      <Row
        label="BIOS"
        value={`${data.motherboard?.biosVersion ?? ""} (${data.motherboard?.biosDate ?? ""})`}
      />
      <Row
        label="OS"
        value={`${data.os?.distro ?? ""} ${data.os?.release ?? ""}`}
      />
    </>
  );
}

function GpuSection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  return (
    <>
      {data.controllers?.map((c: any, i: number) => (
        <div
          key={i}
          className={i > 0 ? "mt-3 pt-3 border-t border-white/[0.06]" : ""}
        >
          <Row label="GPU" value={c.model} />
          <Row label="VRAM" value={c.vram ? `${c.vram} MB` : "Unknown"} />
          <Row label="Driver" value={c.driverVersion} />
          <Row
            label="Driver Status"
            badge={
              <StatusBadge
                ok={c.driverStatus === "ok"}
                label={c.driverStatus ?? "unknown"}
              />
            }
          />
          {c.temperatureGpu != null && (
            <Row label="Temperature" value={`${c.temperatureGpu}°C`} />
          )}
        </div>
      ))}
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-4 mb-2">
        APIs
      </p>
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
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  return (
    <>
      {data.drives?.map((d: any, i: number) => (
        <div
          key={i}
          className={i > 0 ? "mt-3 pt-3 border-t border-white/[0.06]" : ""}
        >
          <Row label="Drive" value={d.name} />
          <Row label="Type" value={d.type} />
          <Row label="Capacity" value={formatBytes(d.totalBytes)} />
          <Row
            label="Used"
            value={`${formatBytes(d.usedBytes)} (${d.usedPercent}%)`}
          />
          <Row
            label="Health"
            badge={
              <StatusBadge
                ok={d.healthPercent >= 70}
                label={`${d.healthPercent}%`}
              />
            }
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
          {d.temperature != null && (
            <Row label="Temperature" value={`${d.temperature}°C`} />
          )}
          {d.warnings?.length > 0 &&
            d.warnings.map((w: string, j: number) => (
              <div
                key={j}
                className="flex items-center gap-1.5 mt-1 text-xs text-yellow-400"
              >
                <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
              </div>
            ))}
        </div>
      ))}
    </>
  );
}

function ThermalSection({ data }: { data: any }) {
  if (!data)
    return (
      <p className="text-xs text-text-muted">No temperature data available</p>
    );
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
      {data.cpuTemp != null && (
        <Row label="CPU Temperature" value={`${data.cpuTemp}°C`} />
      )}
      {data.gpuTemp != null && (
        <Row label="GPU Temperature" value={`${data.gpuTemp}°C`} />
      )}
      {data.maxTemp != null && (
        <Row label="Max Sensor" value={`${data.maxTemp}°C`} />
      )}
      <Row
        label="Throttling"
        badge={
          <StatusBadge
            ok={!data.throttling}
            label={data.throttling ? "Detected" : "None"}
          />
        }
      />
      {data.allTemps
        ?.filter((t: any) => !["cpu", "gpu"].includes(t.label.toLowerCase()))
        .slice(0, 6)
        .map((t: any, i: number) => (
          <Row key={i} label={t.label} value={`${t.temp}°C`} />
        ))}
      {data.recommendation && (
        <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {data.recommendation}
        </div>
      )}
    </>
  );
}

function NetworkSection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  return (
    <>
      <Row label="Adapter" value={data.activeAdapter} />
      <Row label="Type" value={data.type} />
      <Row label="Local IP" value={data.localIP} />
      <Row label="Public IP" value={data.publicIP} />
      <Row
        label="Link Speed"
        value={data.speed ? `${data.speed} Mbps` : "Unknown"}
      />
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
        <div
          key={i}
          className="flex items-center gap-1.5 mt-1 text-xs text-yellow-400"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" /> {issue}
        </div>
      ))}
    </>
  );
}

function SecuritySection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
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
      <Row
        label="Secure Boot"
        badge={<StatusBadge ok={data.secureBootEnabled} />}
      />
      <Row
        label="TPM"
        value={data.tpmAvailable ? `v${data.tpmVersion}` : undefined}
        badge={<StatusBadge ok={data.tpmAvailable} />}
      />
      <Row
        label="BitLocker"
        badge={
          <StatusBadge
            ok={data.bitLockerEnabled}
            label={data.bitLockerEnabled ? "On" : "Off"}
          />
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
        <div
          key={i}
          className="flex items-start gap-1.5 mt-1 text-xs text-blue-300"
        >
          <Info className="w-3 h-3 mt-0.5 shrink-0" /> {r}
        </div>
      ))}
    </>
  );
}

function BatterySection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  if (!data.hasBattery) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Info className="w-4 h-4" />
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
          <StatusBadge
            ok={data.isCharging}
            label={data.isCharging ? "Charging" : "On Battery"}
          />
        }
      />
      {data.healthPercent != null && (
        <Row
          label="Battery Health"
          value={`${data.healthPercent}%`}
          badge={<StatusBadge ok={data.healthPercent >= 80} />}
        />
      )}
      {data.wearLevel != null && (
        <Row label="Wear Level" value={`${data.wearLevel}%`} />
      )}
      {data.cycleCount != null && (
        <Row label="Cycle Count" value={data.cycleCount} />
      )}
      {data.designCapacity != null && (
        <Row label="Design Capacity" value={`${data.designCapacity} mWh`} />
      )}
      {data.currentCapacity != null && (
        <Row label="Current Capacity" value={`${data.currentCapacity} mWh`} />
      )}
      {data.timeRemaining != null && data.timeRemaining > 0 && (
        <Row
          label="Time Remaining"
          value={`${Math.round(data.timeRemaining)} min`}
        />
      )}
      {data.recommendation && (
        <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {data.recommendation}
        </div>
      )}
    </>
  );
}

function OptimizationSection({ data }: { data: any }) {
  if (!data)
    return <p className="text-xs text-text-muted">No data available</p>;
  if (data.findings?.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1">
        <CheckCircle className="w-4 h-4" /> No optimization issues found. System
        is well tuned.
      </div>
    );
  }
  const severityColor: Record<string, string> = {
    critical: "bg-red-500/15 border-red-500/20 text-red-300",
    high: "bg-orange-500/15 border-orange-500/20 text-orange-300",
    medium: "bg-yellow-500/15 border-yellow-500/20 text-yellow-300",
    low: "bg-blue-500/15 border-blue-500/20 text-blue-300",
  };
  return (
    <div className="space-y-2">
      {data.findings?.map((f: any, i: number) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 p-2 rounded-lg border text-xs",
            severityColor[f.severity] ?? severityColor.low,
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {f.title}{" "}
              <span className="opacity-60 font-normal">({f.category})</span>
            </div>
            <div className="opacity-80 mt-0.5">{f.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mini Score Card ────────────────────────────────────────────────────────
function MiniScore({
  label,
  score,
}: {
  label: string;
  score: number | undefined;
}) {
  const color =
    score == null
      ? "text-text-muted"
      : score >= 80
        ? "text-emerald-400"
        : score >= 60
          ? "text-yellow-400"
          : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className={cn("text-xl font-black", color)}>{score ?? "–"}</span>
      <span className="text-[10px] text-text-muted text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export function SystemCheckPage() {
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState<FullScanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await window.propel.systemCheck.runFull();
      if (result.ok) {
        setData(result.data);
        setLastScanTime(new Date());
      } else {
        setError(result.error ?? "Scan failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error");
    } finally {
      setScanning(false);
    }
  }, []);

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

  return (
    <div className="page-shell space-y-5">
      <header className="flex items-end justify-between gap-5">
        <div>
          <p className="section-label">Diagnostics workspace</p>
          <h1 className="mt-1 text-[25px] font-semibold tracking-[-.035em] text-text-primary">
            System check
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {lastScanTime
              ? `Last completed ${lastScanTime.toLocaleTimeString()}`
              : "Inspect hardware, security, storage and Windows health."}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-[var(--t-btn-shadow)]",
            scanning
              ? "cursor-not-allowed bg-brand-primary/60"
              : "bg-brand-primary hover:bg-brand-secondary",
          )}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {scanning
            ? "Scanning system…"
            : data
              ? "Run again"
              : "Run full system check"}
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[.07] px-4 py-3 text-xs text-red-500"
        >
          <XCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-[minmax(300px,.72fr)_minmax(0,1.55fr)] gap-5 max-[1000px]:grid-cols-1">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-brand-primary/20 bg-bg-elevated p-5">
            {data ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="section-label">Overall status</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-text-primary">
                      {hs?.label ?? "Checked"}
                    </h2>
                    <p className="mt-1 text-xs text-text-secondary">
                      Grade {hs?.grade ?? "—"}
                    </p>
                  </div>
                  <HealthRing
                    score={hs?.overall ?? 0}
                    grade={hs?.grade ?? "?"}
                    label=""
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniScore label="Memory" score={hs?.memory} />
                  <MiniScore label="Thermal" score={hs?.thermal} />
                  <MiniScore label="Security" score={hs?.security} />
                  <MiniScore label="Optimization" score={hs?.optimization} />
                </div>
              </>
            ) : scanning ? (
              <div className="py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">
                      Analyzing your PC
                    </h2>
                    <p className="text-xs text-text-muted">
                      Collecting live diagnostic data…
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {sections.slice(0, 5).map((s) => (
                    <div key={s.title} className="flex items-center gap-3">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-primary" />
                      <span className="text-xs text-text-secondary">
                        {s.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Shield className="h-7 w-7 text-brand-primary" />
                <h2 className="mt-5 text-xl font-semibold tracking-[-.03em] text-text-primary">
                  Ready for a complete assessment
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  The check reads existing Windows and hardware signals, then
                  organizes them into clear health categories.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                  {[
                    "Hardware",
                    "Drivers",
                    "Storage",
                    "Thermals",
                    "Network",
                    "Security",
                    "Battery",
                    "Optimization",
                  ].map((x) => (
                    <span key={x} className="border-b border-border/50 pb-2">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
          {hs?.criticalIssues?.length > 0 && (
            <section className="rounded-xl border border-red-500/20 bg-red-500/[.05] p-4">
              <p className="text-xs font-semibold text-red-500">
                Needs attention
              </p>
              <div className="mt-2 space-y-2">
                {hs.criticalIssues.map((issue: string, i: number) => (
                  <p
                    key={i}
                    className="flex gap-2 text-xs leading-5 text-text-secondary"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    {issue}
                  </p>
                ))}
              </div>
            </section>
          )}
        </aside>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="section-label">Diagnostic categories</p>
              <h2 className="mt-1 text-base font-semibold text-text-primary">
                {data ? "Detailed results" : "Coverage"}
              </h2>
            </div>
            {data && (
              <span className="text-[11px] text-text-muted">
                Select a category to inspect
              </span>
            )}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1"
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
                  <p className="text-xs leading-5 text-text-muted">
                    Included in the next full system check.
                  </p>
                )}
              </SectionCard>
            ))}
          </motion.div>
        </section>
      </div>
    </div>
  );
}
