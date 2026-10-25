import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Clock,
  Globe,
  Trash2,
  FolderX,
  Rocket,
  Bell,
  AlertTriangle,
  Flame,
  Lock,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useSessionStore } from "@/store/sessionStore";
import { useAppStore } from "@/store/appStore";
import { PROPEL_PRICING_URL } from "@/constants/appConstants";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle as UiToggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Callout } from "@/components/ui/Callout";
import { StatusPill as UiStatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import type { MaintenanceSettings, MaintenanceStatus } from "@/types";

// ── Toggle (same props as before, design-system switch) ────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}> = ({ checked, onChange, disabled, label }) => (
  <UiToggle
    checked={checked}
    disabled={disabled}
    aria-label={label}
    onCheckedChange={(v) => !disabled && onChange(v)}
  />
);

// ── Section card ───────────────────────────────────────────────────────────
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    className="flex h-full flex-col rounded-card border border-line bg-surface-raised shadow-[var(--shadow-1),var(--highlight-top)]"
  >
    <div className="flex items-center gap-3 border-b border-line-subtle px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-inset text-fg-2 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <div>
        <h3 className="text-title font-semibold text-fg-1">{title}</h3>
        <p className="text-caption text-fg-3">{subtitle}</p>
      </div>
    </div>
    <div className="flex flex-1 flex-col divide-y divide-line-subtle px-5 py-1">{children}</div>
  </motion.div>
);

// ── Row inside a section card ──────────────────────────────────────────────
const ControlRow: React.FC<{
  label: React.ReactNode;
  sublabel?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, sublabel, badge, children }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-body font-medium text-fg-1">{label}</p>
        {badge}
      </div>
      {sublabel && <p className="mt-0.5 text-caption text-fg-3">{sublabel}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// ── Status pill ────────────────────────────────────────────────────────────
const StatusPill: React.FC<{ active: boolean; label: string }> = ({ active, label }) => (
  <UiStatusPill tone={active ? "healthy" : "neutral"}>{label}</UiStatusPill>
);

// ── Format helpers ─────────────────────────────────────────────────────────
function fmtTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtNext(ts: number | null): string {
  if (!ts) return "Not scheduled";
  const diff = ts - Date.now();
  if (diff <= 0) return "Soon";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Within the hour";
  if (h < 24) return `In ${h}h`;
  const d = Math.floor(h / 24);
  return `In ${d} day${d > 1 ? "s" : ""}`;
}

// ── Default settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS: MaintenanceSettings = {
  scheduleEnabled: false,
  scheduleFrequency: "weekly",
  recycleBinEnabled: false,
  ignoreDownloads: true,
  browserMasterEnabled: true,
  browserChrome: false,
  browserEdge: false,
  browserBrave: false,
  browserFirefox: false,
  startupEnabled: false,
  ramAlertsEnabled: false,
  ramAlertThreshold: 85,
  diskAlertsEnabled: false,
  diskAlertThreshold: 90,
  junkAlertsEnabled: false,
  junkAlertThreshold: 2,
  startupAlertsEnabled: false,
  permissionAlertsEnabled: false,
  updateNotificationsEnabled: true,
  runInBackground: false,
  safeCleaningMode: true,
  lastCleanupAt: null,
};

export const SmartMaintenancePage: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const addToast = useAppStore((s) => s.addToast);
  const canSchedule = Boolean(entitlement.features?.alwaysOnMaintenance ?? (entitlement.plan !== 'FREE'));

  const { settings, status, loading, running, runResult, isTechnicalDetailsOpen } = useSessionStore(s => s.smartMaintenance);
  const setSmartMaintenance = useSessionStore(s => s.setSmartMaintenance);
  const setSettings = (s: MaintenanceSettings | ((prev: MaintenanceSettings) => MaintenanceSettings)) => setSmartMaintenance(st => ({ settings: typeof s === 'function' ? s(st.settings || DEFAULT_SETTINGS) : s }));
  const setStatus = (st: any) => setSmartMaintenance({ status: st });
  const setLoading = (l: boolean) => setSmartMaintenance({ loading: l });
  const setRunning = (r: boolean) => setSmartMaintenance({ running: r });
  const setRunResult = (rr: any) => setSmartMaintenance({ runResult: rr });
  const setIsTechnicalDetailsOpen = (o: boolean) => setSmartMaintenance({ isTechnicalDetailsOpen: o });
  
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load settings + status on mount ─────────────────────────────────────
  useEffect(() => {
    Promise.all([
      window.propel.maintenance.getSettings(),
      window.propel.maintenance.getStatus(),
    ])
      .then(([s, st]) => {
        setSettings(s as MaintenanceSettings);
        setStatus(st as MaintenanceStatus);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Refresh status every 30 s
    statusTimer.current = setInterval(() => {
      if (useAppStore.getState().activePage !== "maintenance") return;
      window.propel.maintenance
        .getStatus()
        .then((st) => setStatus(st as MaintenanceStatus))
        .catch(() => {});
    }, 30_000);

    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, []);

  // ── Toggle helper ─────────────────────────────────────────────────────────
  const toggle = useCallback(
    async (key: keyof MaintenanceSettings, value: boolean | string) => {
      const patch = { [key]: value } as Partial<MaintenanceSettings>;
      setSettings((prev) => ({ ...prev, ...patch }));
      try {
        const updated = await window.propel.maintenance.updateSettings(patch);
        setSettings(updated as MaintenanceSettings);
      } catch {
        setSettings((prev) => ({ ...prev })); // revert via re-render
      }
    },
    [],
  );

  // ── Run Now ───────────────────────────────────────────────────────────────
  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await window.propel.maintenance.runNow();
      const total = result.tempCleaned + result.browserCleaned;
      setRunResult({
        ok: true,
        msg: `Cleaned ${total} item${total !== 1 ? "s" : ""}${result.recycleBinCleared ? " · Recycle Bin emptied" : ""}`,
      });
      const st = await window.propel.maintenance.getStatus();
      setStatus(st as MaintenanceStatus);
      setSettings((prev) => ({ ...prev, lastCleanupAt: Date.now() }));
    } catch {
      setRunResult({ ok: false, msg: "Cleanup failed — check permissions" });
    } finally {
      setRunning(false);
      setTimeout(() => setRunResult(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="page-shell" role="status" aria-label="Loading maintenance settings">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-4 max-[980px]:grid-cols-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  const upgradeToast = () =>
    addToast({
      type: "warning",
      title: "Upgrade Required",
      description: "Upgrade to PRO or MAX to use the scheduler.",
    });

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Automation"
        title="Smart Maintenance"
        subtitle="Automated cleaning, scheduling & system control"
        meta={
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {canSchedule && settings.scheduleEnabled ? "Scheduler on" : "Scheduler off"}
          </span>
        }
      />

      <div className="grid grid-cols-2 items-stretch gap-4 max-[980px]:grid-cols-1">
        {/* 1. Automatic Cleaning */}
        <SectionCard icon={<Clock />} title="Automatic Cleaning" subtitle="Schedule temp file removal">
          <ControlRow
            label="Enable Scheduler"
            badge={
              !canSchedule ? (
                <button
                  type="button"
                  onClick={upgradeToast}
                  className="inline-flex h-5 items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-2 text-[10.5px] font-semibold text-brand-fg transition-colors hover:border-brand/45 focus-visible:shadow-ring"
                >
                  <Lock className="h-2.5 w-2.5" /> PRO
                </button>
              ) : null
            }
            sublabel="Runs in the background automatically"
          >
            <Toggle
              label="Enable Scheduler"
              checked={Boolean(canSchedule && settings.scheduleEnabled)}
              onChange={(v) => {
                if (!canSchedule) {
                  upgradeToast();
                  return;
                }
                toggle("scheduleEnabled", v);
              }}
            />
          </ControlRow>

          {canSchedule && settings.scheduleEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <ControlRow label="Frequency">
                <Select
                  disabled={!canSchedule}
                  value={settings.scheduleFrequency}
                  onChange={(e) => toggle("scheduleFrequency", e.target.value)}
                  aria-label="Schedule frequency"
                  className="h-8 w-32 text-body-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </ControlRow>
            </motion.div>
          )}

          <ControlRow
            label="Auto Empty Recycle Bin"
            sublabel="Automatically empty the Recycle Bin after each cleanup run."
          >
            <Toggle
              label="Auto Empty Recycle Bin"
              checked={settings.recycleBinEnabled}
              onChange={(v) => toggle("recycleBinEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="Protect Downloads Folder"
            sublabel="Never scan or delete items in your Downloads folder"
          >
            <Toggle
              label="Protect Downloads Folder"
              checked={settings.ignoreDownloads}
              onChange={(v) => toggle("ignoreDownloads", v)}
            />
          </ControlRow>

          <ControlRow
            label="Safe Cleaning Mode"
            sublabel="Move cleaned files to Recycle Bin instead of permanent deletion"
          >
            <Toggle
              label="Safe Cleaning Mode"
              checked={settings.safeCleaningMode}
              onChange={(v) => toggle("safeCleaningMode", v)}
            />
          </ControlRow>
        </SectionCard>

        {/* 2. Alerts & Notifications */}
        <SectionCard icon={<Bell />} title="Alerts & Notifications" subtitle="Native desktop notifications">
          <AnimatePresence initial={false}>
            {(settings.ramAlertsEnabled ||
              settings.diskAlertsEnabled ||
              settings.junkAlertsEnabled ||
              settings.startupAlertsEnabled ||
              settings.permissionAlertsEnabled) &&
              !settings.runInBackground && (
                <motion.div
                  key="alerts-bg-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <Callout tone="warning" icon={<AlertTriangle />} className="my-3">
                    Alerts require Propel to keep running in the background to work when the app window
                    is closed.{" "}
                    <button
                      onClick={() => toggle("runInBackground", true)}
                      className="font-semibold text-warning-fg underline underline-offset-2 hover:text-fg-1 focus-visible:shadow-ring"
                    >
                      Enable Run in Background
                    </button>
                  </Callout>
                </motion.div>
              )}
          </AnimatePresence>

          <ControlRow
            label="High RAM Usage Alerts"
            sublabel={`Alert when RAM exceeds ${settings.ramAlertThreshold ?? 85}% (5 min cooldown)`}
          >
            <Toggle
              label="High RAM Usage Alerts"
              checked={settings.ramAlertsEnabled}
              onChange={(v) => toggle("ramAlertsEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="High Disk Usage Alerts"
            sublabel={`Alert when disk exceeds ${settings.diskAlertThreshold}% (5 min cooldown)`}
          >
            <Toggle
              label="High Disk Usage Alerts"
              checked={settings.diskAlertsEnabled}
              onChange={(v) => toggle("diskAlertsEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="Junk File Alerts"
            sublabel={`Alert when junk files exceed ${settings.junkAlertThreshold} GB`}
          >
            <Toggle
              label="Junk File Alerts"
              checked={settings.junkAlertsEnabled}
              onChange={(v) => toggle("junkAlertsEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="Startup App Alerts"
            sublabel="Notify when a new app adds itself to Windows startup"
          >
            <Toggle
              label="Startup App Alerts"
              checked={settings.startupAlertsEnabled}
              onChange={(v) => toggle("startupAlertsEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="Permission Change Alerts"
            sublabel="Notify when an app requests new sensitive permissions (camera, mic, location)"
          >
            <Toggle
              label="Permission Change Alerts"
              checked={settings.permissionAlertsEnabled}
              onChange={(v) => toggle("permissionAlertsEnabled", v)}
            />
          </ControlRow>
        </SectionCard>

        {/* 3. Startup & Background */}
        <SectionCard icon={<Rocket />} title="Startup & Background" subtitle="Control app launch behavior">
          <ControlRow label="Launch on Windows Startup" sublabel="Register in Windows login items">
            <Toggle
              label="Launch on Windows Startup"
              checked={settings.startupEnabled}
              onChange={(v) => toggle("startupEnabled", v)}
            />
          </ControlRow>

          <ControlRow
            label="Run in Background"
            sublabel="Keep Propel running in the system tray when you close the window, so alerts and scheduled maintenance can continue."
          >
            <Toggle
              label="Run in Background"
              checked={settings.runInBackground}
              onChange={(v) => toggle("runInBackground", v)}
            />
          </ControlRow>
        </SectionCard>

        {/* 4. Browser & Updates */}
        <SectionCard
          icon={<Globe />}
          title="Browser & Updates"
          subtitle="Browser cache cleanup and app update alerts"
        >
          <ControlRow
            label="Auto-clean browser cache"
            sublabel="Automatically clean supported browser caches"
          >
            <Toggle
              label="Auto-clean browser cache"
              checked={settings.browserMasterEnabled}
              onChange={(v) => toggle("browserMasterEnabled", v)}
            />
          </ControlRow>

          <p className="py-3 text-caption text-fg-3">
            Only cache is removed. Profiles, passwords, and bookmarks are never touched.
          </p>

          <ControlRow
            label="Update Notifications"
            sublabel="Show update modal when a new version is available"
          >
            <Toggle
              label="Update Notifications"
              checked={settings.updateNotificationsEnabled ?? true}
              onChange={(v) => toggle("updateNotificationsEnabled", v)}
            />
          </ControlRow>
        </SectionCard>
      </div>

      {/* ── What gets cleaned ── */}
      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-body font-semibold text-fg-1">
            <Trash2 className="h-4 w-4 text-fg-3" />
            Directories Cleaned Automatically
          </p>
          <button
            onClick={() => setIsTechnicalDetailsOpen(!isTechnicalDetailsOpen)}
            aria-expanded={isTechnicalDetailsOpen}
            className="flex items-center gap-1 rounded-chip px-2 py-1 text-caption font-semibold text-fg-3 transition-colors hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
          >
            Technical Details
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-base", isTechnicalDetailsOpen && "rotate-180")}
            />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isTechnicalDetailsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-4 max-[700px]:grid-cols-1">
                {[
                  "%TEMP%",
                  "%LOCALAPPDATA%\\Temp",
                  "%WINDIR%\\Temp",
                  "Windows INetCache",
                  "Thumbnail Cache (pending)",
                  "App Crash Dumps",
                  "Chrome Cache (if enabled)",
                  "Edge Cache (if enabled)",
                  "Brave Cache (if enabled)",
                  "Firefox Cache (if enabled)",
                ].map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <FolderX className="h-3.5 w-3.5 shrink-0 text-fg-4" />
                    <span className="font-mono text-[11px] text-fg-2">{d}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 border-t border-line-subtle pt-3">
                <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-fg" />
                <p className="text-caption text-fg-3">
                  Downloads folder is always excluded. Locked or permission-denied files are silently
                  skipped.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};

// ── Status card sub-component ──────────────────────────────────────────────
const StatusCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}> = ({ icon, label, value, active }) => (
  <div className="space-y-2 rounded-card border border-line-subtle bg-surface-raised p-3.5">
    <div className="flex items-center justify-between">
      {icon}
      <StatusPill active={active} label={active ? "Active" : "Off"} />
    </div>
    <div>
      <p className="text-body-sm font-semibold text-fg-1">{value}</p>
      <p className="mt-0.5 text-caption text-fg-3">{label}</p>
    </div>
  </div>
);
