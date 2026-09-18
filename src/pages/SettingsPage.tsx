import React, { useState } from "react";
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
import {
  useSettingsStore,
  ACCENT_DEFS,
  type AccentColor,
  type ToastPosition,
} from "@/store/settingsStore";
import { THEMES, THEME_ORDER, type ThemeId } from "@/theme/themes";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { DiagnosticsPanel } from "@/components/settings/DiagnosticsPanel";
import { PerfPanel } from "@/components/settings/PerfPanel";
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
    accentColor,
    setAccentColor, // accent color state
    soundEnabled,
    setSoundEnabled, // sound enabled state
    toastPosition,
    setToastPosition, // toast position state
    overlayEnabled,
    setOverlayEnabled, // overlay enabled state
    themeId,
    setThemeId, // theme id state
    crashReporting,
    setCrashReporting, // crash reporting state
  } = useSettingsStore();

  const [overlayBusy, setOverlayBusy] = useState(false); // overlay busy state

  const handleOverlayToggle = async (v: boolean) => {
    setOverlayBusy(true);
    try {
      if (v) await window.propel.overlay.open();
      else await window.propel.overlay.close();
      setOverlayEnabled(v);
    } catch {
      addToast({
        type: "error",
        title: "Overlay error",
        description: "Could not open overlay window",
      });
    } finally {
      setOverlayBusy(false);
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
          ["themes", "Themes"],
          ["notifications", "Notifications"],
          ["privacy", "Privacy"],
          ["diagnostics", "Diagnostics"],
          ["performance-tools", "Performance"],
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
              {/* Accent Color */}
              <div>
                <SectionTitle
                  icon={<Palette className="w-3.5 h-3.5" />}
                  label="Accent Color"
                />
                <div className="grid grid-cols-5 gap-2">
                  {(
                    Object.entries(ACCENT_DEFS) as [
                      AccentColor,
                      (typeof ACCENT_DEFS)[AccentColor],
                    ][]
                  ).map(([key, def]) => (
                    <button
                      key={key}
                      onClick={() => setAccentColor(key)}
                      title={def.label}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200",
                        accentColor === key
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-border/40 bg-transparent hover:bg-white/[0.04] hover:border-white/10",
                      )}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{
                          background: def.hex,
                          boxShadow:
                            accentColor === key
                              ? `0 0 14px ${def.hex}66`
                              : "none",
                        }}
                      >
                        {accentColor === key && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-2xs font-medium transition-colors",
                          accentColor === key
                            ? "text-text-primary"
                            : "text-text-muted",
                        )}
                      >
                        {def.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

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

        {/* ── UI Themes ── */}
        <motion.div
          id="settings-themes"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                UI Themes
              </CardTitle>
              <p className="text-xs text-text-muted">
                Complete visual system — backgrounds, cards, borders, charts
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                {THEME_ORDER.map((id: ThemeId) => {
                  const t = THEMES[id];
                  const active = themeId === id;
                  return (
                    <motion.button
                      key={id}
                      onClick={() => setThemeId(id)}
                      whileHover={{ scale: 1.012 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 32,
                      }}
                      className={cn(
                        "relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-200",
                        active
                          ? "border-[rgb(var(--c-accent)/0.5)] shadow-[0_0_18px_rgb(var(--c-accent)/0.18)]"
                          : "border-border/40 hover:border-white/12",
                      )}
                      style={{
                        background: active
                          ? `${t.preview.bg}ee`
                          : `${t.preview.bg}99`,
                      }}
                    >
                      {/* Selected glow ring */}
                      {active && (
                        <motion.div
                          layoutId="theme-ring"
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{
                            boxShadow: `inset 0 0 0 1.5px ${t.preview.accent}55`,
                          }}
                        />
                      )}

                      <div className="flex items-center gap-4 p-4">
                        {/* Mini visual preview */}
                        <div
                          className="shrink-0 w-24 h-16 rounded-xl overflow-hidden relative"
                          style={{
                            background: t.preview.bg,
                            border: `1px solid ${t.preview.accent}33`,
                          }}
                        >
                          {/* Fake sidebar */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-6"
                            style={{
                              background: `${t.preview.card}cc`,
                              borderRight: `1px solid ${t.preview.accent}22`,
                            }}
                          >
                            {[0, 1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="mx-1 my-1 h-1.5 rounded-sm"
                                style={{
                                  background:
                                    i === 1
                                      ? t.preview.accent
                                      : `${t.preview.text}22`,
                                  width: i === 1 ? "80%" : "60%",
                                }}
                              />
                            ))}
                          </div>
                          {/* Fake main content */}
                          <div className="absolute left-7 right-1 top-1 bottom-1 flex flex-col gap-1">
                            <div
                              className="h-2 rounded-sm"
                              style={{
                                background: t.preview.accent,
                                opacity: 0.8,
                                width: "60%",
                              }}
                            />
                            <div className="flex gap-1">
                              {[1, 0.6, 0.4].map((o, i) => (
                                <div
                                  key={i}
                                  className="flex-1 h-5 rounded"
                                  style={{
                                    background: `${t.preview.card}dd`,
                                    border: `1px solid ${t.preview.accent}${Math.round(
                                      o * 64,
                                    )
                                      .toString(16)
                                      .padStart(2, "0")}`,
                                  }}
                                />
                              ))}
                            </div>
                            <div
                              className="h-1 rounded-sm"
                              style={{
                                background: `${t.preview.text}30`,
                                width: "80%",
                              }}
                            />
                            <div
                              className="h-1 rounded-sm"
                              style={{
                                background: `${t.preview.text}18`,
                                width: "55%",
                              }}
                            />
                          </div>
                        </div>

                        {/* Theme info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-sm font-semibold"
                              style={{
                                color: active
                                  ? t.preview.accent
                                  : t.preview.text,
                              }}
                            >
                              {t.name}
                            </span>
                            {active && (
                              <span
                                className="text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: `${t.preview.accent}22`,
                                  color: t.preview.accent,
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: `${t.preview.text}80` }}
                          >
                            {t.description}
                          </p>
                          {/* Colour palette dots */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {[
                              t.preview.bg,
                              t.preview.card,
                              t.preview.accent,
                              t.preview.text,
                            ].map((c, i) => (
                              <div
                                key={i}
                                className="w-3 h-3 rounded-full border border-white/10"
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Active check */}
                        <div
                          className={cn(
                            "shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                            active
                              ? "border-[var(--check-col)]"
                              : "border-white/10",
                          )}
                          style={{
                            ["--check-col" as string]: t.preview.accent,
                            background: active
                              ? `${t.preview.accent}22`
                              : "transparent",
                          }}
                        >
                          {active && (
                            <Check
                              className="w-3 h-3"
                              style={{ color: t.preview.accent }}
                            />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </MotionCard>
        </motion.div>

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
              <SectionTitle
                icon={<Bell className="w-3.5 h-3.5" />}
                label="Notification Position"
              />
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: "bottom-right",
                      label: "Bottom Right",
                      desc: "Default",
                    },
                    {
                      id: "top-right",
                      label: "Top Right",
                      desc: "= Bottom Left",
                    },
                    {
                      id: "system-default",
                      label: "System Default",
                      desc: "= Bottom Right",
                    },
                  ] as { id: ToastPosition; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setToastPosition(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200",
                      toastPosition === opt.id
                        ? "border-[rgb(var(--c-accent)/0.4)] bg-[rgb(var(--c-accent)/0.06)] text-text-primary"
                        : "border-border/40 text-text-muted hover:border-white/10 hover:bg-white/[0.03]",
                    )}
                  >
                    {toastPosition === opt.id && (
                      <Check className="w-3 h-3 text-[rgb(var(--c-accent))]" />
                    )}
                    <span className="text-xs font-medium">{opt.label}</span>
                    {opt.desc && (
                      <span className="text-2xs opacity-50">{opt.desc}</span>
                    )}
                  </button>
                ))}
              </div>
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

        {/* ── Diagnostics ── */}
        <motion.div
          id="settings-diagnostics"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-text-muted mb-4">
                Locally stored error and warning log — useful for
                troubleshooting. Never uploaded.
              </p>
              <DiagnosticsPanel />
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* ── Performance Tools ── */}
        <motion.div
          id="settings-performance-tools"
          variants={staggerItem}
          className="scroll-mt-5"
        >
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-[rgb(var(--c-accent))]" />
                Performance Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTitle
                icon={<MonitorPlay className="w-3.5 h-3.5" />}
                label="Floating Performance Overlay"
              />
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-text-primary">
                    Enable Floating Overlay
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Always-on-top compact window: CPU, RAM &amp; network —
                    updates every second
                  </p>
                </div>
                <Toggle
                  checked={overlayEnabled}
                  onChange={overlayBusy ? () => {} : handleOverlayToggle}
                />
              </div>
              {overlayEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-border/40"
                >
                  <p className="text-2xs text-text-muted">
                    Overlay is{" "}
                    <span className="text-emerald-400 font-semibold">
                      active
                    </span>{" "}
                    — drag to reposition it anywhere on screen. Closes
                    automatically when you quit the app.
                  </p>
                </motion.div>
              )}
            </CardContent>
          </MotionCard>
        </motion.div>
      </motion.div>

      {/* ── Perf Diagnostics (developer timing panel) ── */}
      <motion.div className="settings-diagnostics mt-4" variants={staggerItem}>
        <MotionCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[rgb(var(--c-accent))]" />
              Performance Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted mb-4">
              Timing data for scan, IPC, and render operations. Refresh after
              running a scan to see results.
            </p>
            <PerfPanel />
          </CardContent>
        </MotionCard>
      </motion.div>
    </div>
  );
};
