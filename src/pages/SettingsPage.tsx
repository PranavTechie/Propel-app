import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Lock,
  ExternalLink,
  CheckCircle2,
  Clock,
  Palette,
  Volume2,
  VolumeX,
  Bell,
  Sparkles,
  Radio,
  LogOut,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { THEMES, type ThemeId } from "@/theme/themes";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { PROPEL_ACCOUNT_URL, PROPEL_PRICING_URL } from "@/constants/appConstants";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Toggle as UiToggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import { StatusPill } from "@/components/ui/StatusPill";
import { PlanIcon, AccountAvatar } from "@/components/ui/PlanIcon";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { cn } from "@/utils/cn";

// ── Toggle (same props as before, design-system switch) ────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <UiToggle checked={checked} onCheckedChange={onChange} aria-label={label} />
);

// ── Section header ───────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="mb-1 flex items-center gap-2">
    <span className="text-fg-3">{icon}</span>
    <p className="section-label">{label}</p>
  </div>
);

function EntitlementBadge({ plan, trial_active }: { plan: string; trial_active: boolean }) {
  // Trial keeps the PRO icon (display only).
  const glyph = (p: string) => <PlanIcon plan={p} variant="glyph" size={11} />;
  if (trial_active) return <StatusPill tone="healthy" icon={glyph("PRO")}>PRO Trial</StatusPill>;
  if (plan === "MAX") return <StatusPill tone="healthy" icon={glyph("MAX")}>MAX Plan</StatusPill>;
  if (plan === "PRO") return <StatusPill tone="healthy" icon={glyph("PRO")}>PRO Plan</StatusPill>;
  return <StatusPill tone="neutral" icon={glyph("FREE")}>FREE Plan</StatusPill>;
}

const SettingsCard: React.FC<{
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ id, icon, title, children }) => (
  <motion.section id={`settings-${id}`} variants={staggerItem} className="scroll-mt-6">
    <Card>
      <div className="flex items-center gap-2.5 border-b border-line-subtle px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-surface-inset text-fg-2 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h2 className="text-title font-semibold text-fg-1">{title}</h2>
      </div>
      <div className="px-5 py-2">{children}</div>
    </Card>
  </motion.section>
);

const ProLock: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-5 items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-2 text-[10.5px] font-semibold text-brand-fg transition-colors hover:border-brand/45 focus-visible:shadow-ring"
  >
    <Lock className="h-2.5 w-2.5" /> PRO
  </button>
);

const SETTINGS_SECTIONS: [string, string][] = [
  ["account", "Account"],
  ["appearance", "Appearance"],
  ["notifications", "Notifications"],
  ["privacy", "Privacy"],
];

const UPGRADE_FEATURES = [
  {
    title: "Custom Alert Thresholds",
    desc: "Customize your RAM, Disk, and Junk file alert triggers to match your workflow.",
  },
  {
    title: "Always-On Maintenance",
    desc: "Automatic scheduled system cleanup even when Propel is completely closed.",
  },
  {
    title: "PC Advisor AI & Multi-Device",
    desc: "Up to 50 AI diagnostic checks per month and multi-device workstation support.",
  },
];

export const SettingsPage: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const resetUserSession = useAppStore((s) => s.resetUserSession);
  const setPhase = useAppStore((s) => s.setPhase);
  const addToast = useAppStore((s) => s.addToast);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const hasCustomThresholds = Boolean(
    entitlement.features?.customThresholds ?? (entitlement.plan !== "FREE")
  );

  const expiryRaw = entitlement.expiresAt || entitlement.trial_expires_at;
  let planExpiryLabel = `${entitlement.plan} Plan`;
  if (expiryRaw) {
    const dateObj = new Date(expiryRaw);
    if (!isNaN(dateObj.getTime())) {
      const formatted = dateObj.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      planExpiryLabel = `${entitlement.plan}${entitlement.trial_active ? " Trial" : ""} until ${formatted}`;
    }
  }

  // ── Settings store ──────────────────────────────────────────────────────
  const {
    soundEnabled,
    setSoundEnabled, // sound enabled state
    crashReporting,
    setCrashReporting, // crash reporting state
  } = useSettingsStore();



  const [maintenanceSettings, setMaintenanceSettings] = useState<any | null>(null);

  useEffect(() => {
    window.propel.maintenance.getSettings()
      .then((s: any) => {
        setMaintenanceSettings(s);
      })
      .catch(() => {});
  }, []);

  const handleMaintenanceToggle = async (key: string, v: boolean | number) => {
    if (!maintenanceSettings) return;
    const patch = { [key]: v };
    setMaintenanceSettings((prev: any) => ({ ...prev, ...patch }));
    try {
      const updated = await window.propel.maintenance.updateSettings(patch);
      setMaintenanceSettings(updated);
    } catch {
      // revert on error via a simple refetch for safety
      window.propel.maintenance.getSettings().then(setMaintenanceSettings).catch(()=>{});
    }
  };

  const handleSignOut = async () => {
    if (!confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    setSigningOut(true);
    try {
      try {
        const { device_id } = await window.electronAPI.system.getDeviceUUID();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token && device_id) {
          const rawBase = import.meta.env.VITE_API_BASE_URL || "https://cleanmasterpro-backend-server.onrender.com";
          const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`;
          await fetch(`${apiBase}/devices/${device_id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
        }
      } catch (e) {
        console.warn("Best-effort device deletion failed:", e);
      }
      
      try {
        await window.electronAPI.system.clearDeviceRegistration();
      } catch (e) {
        console.warn("Failed to clear local device registration:", e);
      }

      // Clear local state immediately to ensure no stale token or user state remains,
      // even if the network request to Supabase fails.
      resetUserSession();
      await supabase.auth.signOut({ scope: "local" });
      addToast({
        type: "info",
        title: "Signed Out",
        description: "Redirecting to login.",
      });
      setTimeout(() => setPhase("login"), 1400);
    } catch {
      // Even if network fails, we've cleared local state.
      // Force redirect to login anyway.
      resetUserSession();
      addToast({
        type: "info",
        title: "Signed Out (Local)",
        description: "Redirecting to login.",
      });
      setTimeout(() => setPhase("login"), 1400);
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  const thresholdRows = maintenanceSettings
    ? [
        {
          key: "ramAlertThreshold",
          title: "High RAM Usage Threshold",
          min: 70,
          max: 95,
          value: !hasCustomThresholds ? 85 : (maintenanceSettings.ramAlertThreshold ?? 85),
          desc: `Alert when RAM usage exceeds ${!hasCustomThresholds ? 85 : (maintenanceSettings.ramAlertThreshold ?? 85)}% (5 min cooldown)`,
          unit: "%",
        },
        {
          key: "diskAlertThreshold",
          title: "High Disk Usage Threshold",
          min: 70,
          max: 95,
          value: !hasCustomThresholds ? 90 : (maintenanceSettings.diskAlertThreshold ?? 90),
          desc: `Alert when disk usage exceeds ${!hasCustomThresholds ? 90 : (maintenanceSettings.diskAlertThreshold ?? 90)}%`,
          unit: "%",
        },
        {
          key: "junkAlertThreshold",
          title: "Junk File Threshold",
          min: 1,
          max: 10,
          value: !hasCustomThresholds ? 2 : (maintenanceSettings.junkAlertThreshold ?? 2),
          desc: `Alert when junk files exceed ${!hasCustomThresholds ? 2 : (maintenanceSettings.junkAlertThreshold ?? 2)} GB`,
          unit: " GB",
        },
      ]
    : [];

  return (
    <div className="page-shell">
      <PageHeader eyebrow="System" title="Settings" subtitle="Configure Propel" />

      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
        <nav aria-label="Settings categories" className="sticky top-0 max-[900px]:static">
          <p className="section-label mb-2 px-3 max-[900px]:hidden">Categories</p>
          <div className="flex flex-col gap-0.5 max-[900px]:flex-row max-[900px]:overflow-x-auto">
            {SETTINGS_SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  document
                    .getElementById(`settings-${id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="h-8 whitespace-nowrap rounded-control px-3 text-left text-body font-medium text-fg-2 transition-colors duration-fast hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="min-w-0 space-y-4"
        >
          {/* ── Account ── */}
          <SettingsCard id="account" icon={<Shield />} title="Account & Entitlement">
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AccountAvatar
                  identity={session?.user?.email}
                  plan={entitlement.trial_active ? "PRO" : entitlement.plan}
                  size={40}
                  ringClassName="ring-surface-raised"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-body font-semibold text-fg-1">
                    <CheckCircle2 className="h-4 w-4 text-success-fg" />
                    {planExpiryLabel}
                  </p>
                  <p className="truncate text-caption text-fg-3">
                    {session?.user?.email || "Authenticated Account"}
                  </p>
                </div>
              </div>
              <EntitlementBadge plan={entitlement.plan} trial_active={entitlement.trial_active} />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle py-3">
              <Button
                size="sm"
                icon={<ExternalLink />}
                onClick={() => window.electronAPI.shell.openExternal(PROPEL_ACCOUNT_URL)}
              >
                Manage Account & Upgrade
              </Button>
              <div className="flex-1" />
              {confirmSignOut && !signingOut && (
                <span className="text-caption text-danger-fg">Click again to sign out</span>
              )}
              <Button
                variant={confirmSignOut ? "danger" : "secondary"}
                size="sm"
                icon={signingOut ? <Clock className="animate-spin" /> : <LogOut />}
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {confirmSignOut ? "Click to Confirm" : "Sign Out"}
              </Button>
            </div>
          </SettingsCard>

          {/* ── Appearance ── */}
          <SettingsCard id="appearance" icon={<Palette />} title="Appearance">
            <div className="py-3">
              <SectionTitle
                icon={soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                label="Sound Effects"
              />
              <div className="flex items-center justify-between gap-4 py-1.5">
                <div>
                  <p className="text-body font-medium text-fg-1">Enable Sound Effects</p>
                  <p className="mt-0.5 text-caption text-fg-3">
                    Subtle audio feedback for cleanup, alerts &amp; notifications
                  </p>
                </div>
                <Toggle label="Enable Sound Effects" checked={soundEnabled} onChange={setSoundEnabled} />
              </div>
            </div>
          </SettingsCard>

          {/* ── Notifications ── */}
          <SettingsCard id="notifications" icon={<Bell />} title="Notifications">
            {maintenanceSettings ? (
              <div className="divide-y divide-line-subtle">
                {thresholdRows.map((row) => (
                  <div key={row.key} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-body font-medium text-fg-1">{row.title}</p>
                        {!hasCustomThresholds && <ProLock onClick={() => setShowUpgradeModal(true)} />}
                      </div>
                      <span className="rounded-chip bg-surface-inset px-2 py-0.5 text-caption font-semibold text-fg-1 tabular">
                        {row.value}
                        {row.unit}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption text-fg-3">{row.desc}</p>
                    <div
                      className={cn("mt-3", !hasCustomThresholds && "cursor-pointer opacity-60")}
                      onClick={() => {
                        if (!hasCustomThresholds) setShowUpgradeModal(true);
                      }}
                    >
                      <Slider
                        min={row.min}
                        max={row.max}
                        disabled={!hasCustomThresholds}
                        value={row.value}
                        aria-label={row.title}
                        onChange={(e) =>
                          hasCustomThresholds &&
                          handleMaintenanceToggle(row.key, parseInt(e.target.value, 10))
                        }
                        className={cn(!hasCustomThresholds && "pointer-events-none")}
                      />
                      <div className="mt-1 flex justify-between text-[10.5px] text-fg-4 tabular">
                        <span>
                          {row.min}
                          {row.unit}
                        </span>
                        <span>
                          {row.max}
                          {row.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 py-4" role="status" aria-label="Loading notification settings">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-2.5 w-64" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            )}
          </SettingsCard>

          {/* ── Privacy & Crash Reporting ── */}
          <SettingsCard id="privacy" icon={<Radio />} title="Privacy & Crash Reporting">
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-fg-1">Send Anonymous Crash Reports</p>
                <p className="mt-1 text-caption text-fg-3">
                  Helps improve stability by sending anonymous crash diagnostics to GlitchTip. No
                  personal files, license keys, file paths, or HWID are ever uploaded. Only crash type,
                  component name, and app version are sent.
                </p>
                {!crashReporting && (
                  <Callout tone="warning" compact className="mt-2.5">
                    Crash reporting is disabled. Bugs may be harder to detect and fix.
                  </Callout>
                )}
              </div>
              <Toggle label="Send Anonymous Crash Reports" checked={crashReporting} onChange={setCrashReporting} />
            </div>
          </SettingsCard>
        </motion.div>
      </div>

      {/* ── Upgrade Modal ── */}
      <Modal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        tone="brand"
        icon={<Sparkles />}
        title="Upgrade to PRO or MAX"
        description="Unlock advanced performance & customization"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUpgradeModal(false)}>
              Cancel
            </Button>
            <Button
              icon={<ExternalLink />}
              onClick={() => {
                window.electronAPI.shell.openExternal(PROPEL_PRICING_URL);
                setShowUpgradeModal(false);
              }}
            >
              View Pricing & Upgrade
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {UPGRADE_FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-2.5 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" />
              <div>
                <p className="text-body-sm font-semibold text-fg-1">{f.title}</p>
                <p className="mt-0.5 text-caption text-fg-3">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};
