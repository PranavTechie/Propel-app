import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Globe,
  CheckCircle2,
  RefreshCw,
  Shield,
  WifiOff,
  Loader2,
  Key,
  ExternalLink,
  Sparkles,
  Crown,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useManualUpdateCheck } from "@/hooks/useUpdateCheck";
import {
  MotionCard,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/Card";
import { staggerContainer, staggerItem } from "@/animations/variants";
import appIconUrl from "@/assets/app_icon.ico";

const FEATURES = [
  "Advanced junk file scanner",
  "Safe browser cache cleaner",
  "Real-time performance monitor",
  "Live CPU, RAM & disk stats",
  "License management system",
  "Premium glassmorphic UI",
];

export const AboutPage: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);

  const {
    manualChecking,
    manualCheckResult,
    triggerManualCheck,
    clearManualResult,
  } = useManualUpdateCheck();

  return (
    <div className="page-shell space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-text-primary">About</h1>
        <p className="text-sm text-text-secondary mt-0.5">Propel information</p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="about-layout grid grid-cols-12 gap-4"
      >
        {/* App info */}
        <motion.div variants={staggerItem}>
          <MotionCard elevated>
            <CardContent className="pt-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border/40 shadow-card flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={appIconUrl}
                    alt="Propel"
                    className="w-12 h-12 object-contain"
                    draggable={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold gradient-text">Propel</h2>
                  <p className="text-sm text-text-secondary">
                    Advanced Windows System Optimizer
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs bg-white/5 border border-border rounded-full px-2.5 py-0.5 text-text-muted">
                      v3.2.0
                    </span>
                    <span className="text-xs bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-0.5 text-brand-primary">
                      Software
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-text-secondary mt-4 leading-relaxed">
                Propel is a premium Windows system optimization suite designed
                to keep your PC running at peak performance. Built with modern
                technology for the best experience.
              </p>
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* License */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-primary" />
                License Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {entitlement.plan === "PRO" || entitlement.plan === "MAX" ? (
                  /* ── Premium active state ── */
                  <motion.div
                    key="licensed"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(var(--c-accent),0.06) 100%)",
                      border: "1px solid rgba(16,185,129,0.22)",
                    }}
                  >
                    <div className="flex items-center gap-3.5 px-4 pt-3.5 pb-3">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 rounded-xl blur-sm bg-emerald-500/30" />
                        <div className="relative w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                          <Crown className="w-4 h-4 text-emerald-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-text-primary">
                            Premium Active
                          </p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] font-semibold text-emerald-400">
                            <Sparkles className="w-2.5 h-2.5" />
                            {entitlement.plan}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400/70 mt-0.5">
                          {entitlement.trial_active &&
                          entitlement.trial_expires_at
                            ? `Trial Expires ${new Date(entitlement.trial_expires_at).toLocaleDateString()}`
                            : "Full access to all premium features"}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Free state ── */
                  <motion.div
                    key="unlicensed"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-border/50">
                      <div className="w-2 h-2 rounded-full shrink-0 bg-text-muted/30 shadow-none" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          FREE Plan
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          window.electronAPI.shell.openExternal(
                            "https://cleanmasterpro.in/account",
                          )
                        }
                        className="flex-1 flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-gradient-brand text-white text-xs font-semibold shadow-[0_3px_12px_rgb(var(--c-accent)/0.28)] hover:shadow-[0_4px_16px_rgb(var(--c-accent)/0.38)] hover:-translate-y-px transition-all duration-150"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        Upgrade Account
                      </button>
                      <button
                        onClick={() =>
                          window.electronAPI.shell.openExternal(
                            "https://cleanmasterpro.in/pricing",
                          )
                        }
                        className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-border bg-bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        Buy
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* Features */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* Updates & Links */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle>Updates & Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Check button */}
              <button
                onClick={() => {
                  clearManualResult();
                  triggerManualCheck();
                }}
                disabled={manualChecking}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-bg-surface text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border/80 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {manualChecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                )}
                {manualChecking ? "Checking…" : "Check for Updates"}
              </button>

              {/* Inline result state */}
              <AnimatePresence mode="wait">
                {manualCheckResult === "upToDate" && (
                  <motion.div
                    key="up-to-date"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-400">
                        You're up to date
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Propel v3.2.0 is the latest version.
                      </p>
                    </div>
                  </motion.div>
                )}
                {manualCheckResult === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20"
                  >
                    <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-400">
                        Unable to check for updates
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Check your internet connection and try again.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() =>
                  window.electronAPI.shell.openExternal(
                    "https://cleanmasterpro.in",
                  )
                }
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-bg-surface text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                Visit Website
              </button>
            </CardContent>
          </MotionCard>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="text-center text-xs text-text-muted py-2"
        >
          © 2024 Propel. All rights reserved.
        </motion.div>
      </motion.div>
    </div>
  );
};
