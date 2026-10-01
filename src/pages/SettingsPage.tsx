import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Trash2,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  WifiOff,
  Cpu,
  Key,
  Palette,
  Volume2,
  VolumeX,
  Bell,
  MonitorPlay,
  Check,
  Sparkles,
  Bug,
  Zap,
  Radio,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { THEMES, type ThemeId } from "@/theme/themes";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

import {
  MotionCard,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/Card";
import { staggerContainer, staggerItem } from "@/animations/variants";
import { cn } from "@/utils/cn";

// ── Glow Toggle ─────────────────────────────────────────────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all duration-200",
      checked
        ? "bg-[rgb(var(--c-accent))] shadow-[0_0_14px_rgb(var(--c-accent)/0.45)]"
        : "bg-white/10 border border-white/10",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0",
      )}
    />
  </button>
);

// ── Section header ───────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-[rgb(var(--c-accent))] opacity-80">{icon}</span>
    <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
      {label}
    </p>
  </div>
);

function EntitlementBadge({
  plan,
  trial_active,
}: {
  plan: string;
  trial_active: boolean;
}) {
  if (trial_active)
    return (
      <span className="text-2xs font-semibold px-2.5 py-1 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/20">
        PRO Trial
      </span>
    );
  if (plan === "MAX")
    return (
      <span className="text-2xs font-semibold px-2.5 py-1 rounded-full border bg-purple-500/15 text-purple-400 border-purple-500/20">
        MAX Plan
      </span>
    );
  if (plan === "PRO")
    return (
      <span className="text-2xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
        PRO Plan
      </span>
    );
  return (
    <span className="text-2xs font-semibold px-2.5 py-1 rounded-full border bg-white/5 text-text-muted border-border">
      FREE Plan
    </span>
  );
}

// settings page
export const SettingsPage: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const resetUserSession = useAppStore((s) => s.resetUserSession);
  const setPhase = useAppStore((s) => s.setPhase);
  const addToast = useAppStore((s) => s.addToast);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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

  return (
    <div className="settings-workspace page-shell h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Configure Propel</p>
      </motion.div>

      <nav className="settings-index" aria-label="Settings categories">
        <p className="section-label px-3 pb-2">Categories</p>
        {[
          ["account", "Account"],
          ["appearance", "Appearance"],
          ["notifications", "Notifications"],
          ["privacy", "Privacy"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() =>
              document
                .getElementById(`settings-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-text-secondary hover:bg-brand-primary/[.06] hover:text-text-primary"
          >
            {label}
          </button>
        ))}
      </nav>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="settings-content space-y-4"
      >
        {/* ── Account Card ── */}
        <motion.div
          id="settings-account"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-primary" />
                Account & Entitlement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex items-center justify-between py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-sm text-text-primary">Current Plan</p>
                    <p className="text-xs text-text-muted">
                      {session?.user?.email || "Authenticated Account"}
                    </p>
                  </div>
                </div>
                <EntitlementBadge
                  plan={entitlement.plan}
                  trial_active={entitlement.trial_active}
                />
              </div>

              {entitlement.trial_active && entitlement.trial_expires_at && (
                <div className="flex items-center justify-between py-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-muted" />
                    <p className="text-sm text-text-primary">Trial Expiry</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-amber-400">
                    {new Date(
                      entitlement.trial_expires_at,
                    ).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="pt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() =>
                    window.electronAPI.shell.openExternal(
                      "https://cleanmasterpro.in/account",
                    )
                  }
                >
                  Manage Account & Upgrade
                </Button>

                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  icon={
                    signingOut ? (
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={
                    confirmSignOut
                      ? "!text-red-400 !border-red-400/20"
                      : "text-text-muted"
                  }
                >
                  {confirmSignOut ? "Click to Confirm" : "Sign Out"}
                </Button>
              </div>
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* ── Appearance ── */}
        <motion.div
          id="settings-appearance"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">


              {/* Sound Effects */}
              <div>
                <SectionTitle
                  icon={
                    soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )
                  }
                  label="Sound Effects"
                />
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm text-text-primary">
                      Enable Sound Effects
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Subtle audio feedback for cleanup, alerts &amp;
                      notifications
                    </p>
                  </div>
                  <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
                </div>
              </div>
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* ── Notifications ── */}

        {/* ── Notifications ── */}
        <motion.div
          id="settings-notifications"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2.5 mb-4 border-b border-border/40 pb-4">
                <div>
                  <p className="text-sm text-text-primary">
                    Update Notifications
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Show update modal when a new version is available
                  </p>
                </div>
                <Toggle
                  checked={maintenanceSettings?.updateNotificationsEnabled ?? true}
                  onChange={(v) => handleMaintenanceToggle("updateNotificationsEnabled", v)}
                />
              </div>

              {maintenanceSettings && (
                <>
                  <div className="py-2.5 mb-4 border-b border-border/40 pb-4">
                    <p className="text-sm text-text-primary">High RAM Usage Threshold</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Alert when RAM usage exceeds {maintenanceSettings.ramAlertThreshold ?? 85}% (5 min cooldown)
                    </p>
                    <div className="mt-3">
                      <input 
                        type="range" 
                        min="70" 
                        max="95" 
                        value={maintenanceSettings.ramAlertThreshold ?? 85}
                        onChange={(e) => handleMaintenanceToggle("ramAlertThreshold", parseInt(e.target.value, 10))}
                        className="w-full h-1 bg-border/50 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--c-accent))]"
                      />
                    </div>
                  </div>

                  <div className="py-2.5 mb-4 border-b border-border/40 pb-4">
                    <p className="text-sm text-text-primary">High Disk Usage Threshold</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Alert when disk usage exceeds {maintenanceSettings.diskAlertThreshold}%
                    </p>
                    <div className="mt-3">
                      <input 
                        type="range" 
                        min="70" 
                        max="95" 
                        value={maintenanceSettings.diskAlertThreshold}
                        onChange={(e) => handleMaintenanceToggle("diskAlertThreshold", parseInt(e.target.value, 10))}
                        className="w-full h-1 bg-border/50 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--c-accent))]"
                      />
                    </div>
                  </div>

                  <div className="py-2.5 mb-4 pb-4">
                    <p className="text-sm text-text-primary">Junk File Threshold</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Alert when junk files exceed {maintenanceSettings.junkAlertThreshold} GB
                    </p>
                    <div className="mt-3">
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={maintenanceSettings.junkAlertThreshold}
                        onChange={(e) => handleMaintenanceToggle("junkAlertThreshold", parseInt(e.target.value, 10))}
                        className="w-full h-1 bg-border/50 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--c-accent))]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2.5 mb-4 border-b border-border/40 pb-4">
                    <div>
                      <p className="text-sm text-text-primary">Run in Background</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        Keep Propel running in the system tray when you close the window, so alerts and scheduled maintenance can continue.
                      </p>
                    </div>
                    <Toggle
                      checked={maintenanceSettings.runInBackground ?? false}
                      onChange={(v) => handleMaintenanceToggle("runInBackground", v)}
                    />
                  </div>
                </>
              )}

            </CardContent>
          </MotionCard>
        </motion.div>

        {/* ── Privacy & Crash Reporting ── */}
        <motion.div
          id="settings-privacy"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                Privacy &amp; Crash Reporting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">
                    Send Anonymous Crash Reports
                  </p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Helps improve stability by sending anonymous crash
                    diagnostics to GlitchTip. No personal files, license keys,
                    file paths, or HWID are ever uploaded. Only crash type,
                    component name, and app version are sent.
                  </p>
                  {!crashReporting && (
                    <p className="text-2xs text-amber-400/80 mt-1.5">
                      Crash reporting is disabled. Bugs may be harder to detect
                      and fix.
                    </p>
                  )}
                </div>
                <Toggle checked={crashReporting} onChange={setCrashReporting} />
              </div>
            </CardContent>
          </MotionCard>
        </motion.div>
      </motion.div>
    </div>
  );
};
