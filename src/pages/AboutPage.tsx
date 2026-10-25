import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Globe,
  CheckCircle2,
  RefreshCw,
  Shield,
  WifiOff,
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
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Callout } from "@/components/ui/Callout";
import { staggerContainer, staggerItem } from "@/animations/variants";
import appIconUrl from "@/assets/icons/propel.ico";
import { PROPEL_ACCOUNT_URL, PROPEL_PRICING_URL, PROPEL_WEBSITE_URL } from "@/constants/appConstants";



export const AboutPage: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);

  const {
    manualChecking,
    manualCheckResult,
    triggerManualCheck,
    clearManualResult,
    updateState,
  } = useManualUpdateCheck();

  return (
    <div className="page-shell flex min-h-full flex-col">
      <PageHeader
        eyebrow="System"
        title="About"
        subtitle="Propel information"
        action={
          <Button
            variant="secondary"
            loading={manualChecking}
            icon={<RefreshCw />}
            onClick={() => {
              clearManualResult();
              triggerManualCheck();
            }}
          >
            {manualChecking ? "Checking…" : "Check for Updates"}
          </Button>
        }
      />

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1"
      >
        {/* App info */}
        <MotionCard variants={staggerItem} level="feature" className="col-span-2 p-6 max-[900px]:col-span-1">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-brand-glow)/.1),transparent)]"
          />
          <div className="relative flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-surface-raised shadow-[var(--shadow-1),var(--highlight-top)]">
              <img src={appIconUrl} alt="Propel" className="h-11 w-11 object-contain" draggable={false} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[22px] font-semibold leading-7 tracking-[-.02em] text-fg-1">Propel</h2>
              <p className="text-body text-fg-2">Advanced Windows System Optimizer</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full border border-line-subtle bg-surface-inset px-2.5 py-0.5 text-caption font-medium text-fg-2 tabular">
                  1.4
                </span>
                <span className="rounded-full border border-brand/20 bg-brand-soft px-2.5 py-0.5 text-caption font-medium text-brand-fg">
                  Software
                </span>
              </div>
            </div>
          </div>
          <p className="relative mt-4 max-w-[70ch] text-body text-fg-2">
            Propel is a premium Windows system optimization suite designed to keep your PC running at
            peak performance. Built with modern technology for the best experience.
          </p>
        </MotionCard>

        {/* License */}
        <MotionCard variants={staggerItem} className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-fg-3" />
              License Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            <AnimatePresence mode="wait">
              {entitlement.plan === "PRO" || entitlement.plan === "MAX" ? (
                <motion.div
                  key="licensed"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="flex items-center gap-3.5 rounded-control border border-success/25 bg-success-soft px-4 py-3.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-raised text-success-fg shadow-[var(--shadow-1)]">
                    <Crown className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-body font-semibold text-fg-1">Premium Active</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] font-semibold text-success-fg">
                        <Sparkles className="h-2.5 w-2.5" />
                        {entitlement.plan}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption text-success-fg">
                      {entitlement.trial_active && entitlement.trial_expires_at
                        ? `Trial Expires ${new Date(entitlement.trial_expires_at).toLocaleDateString()}`
                        : "Full access to all premium features"}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="unlicensed"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-fg-4" />
                    <p className="text-body font-semibold text-fg-1">FREE Plan</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      icon={<ExternalLink />}
                      onClick={() => window.electronAPI.shell.openExternal(PROPEL_ACCOUNT_URL)}
                    >
                      Upgrade Account
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<ExternalLink />}
                      onClick={() => window.electronAPI.shell.openExternal(PROPEL_PRICING_URL)}
                    >
                      Buy
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </MotionCard>

        {/* Updates & Links */}
        <MotionCard variants={staggerItem} className="flex flex-col">
          <CardHeader>
            <CardTitle>Updates & Support</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center gap-3">
            <AnimatePresence mode="wait">
              {manualCheckResult === "upToDate" && (
                <motion.div key="up-to-date" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <Callout tone="success" icon={<CheckCircle2 />} title="You're up to date">
                    Propel 1.4 is the latest version.
                  </Callout>
                </motion.div>
              )}
              {manualCheckResult === "downloading" && (
                <motion.div key="downloading" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <Callout
                    tone="brand"
                    icon={<RefreshCw className="animate-spin" />}
                    title={`Downloading update v${updateState?.latestVersion ?? ""}...`}
                  >
                    {updateState?.progress?.percent ? `${updateState.progress.percent}% complete` : "Downloading in background"}
                  </Callout>
                </motion.div>
              )}
              {manualCheckResult === "ready" && (
                <motion.div key="ready" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <Callout tone="success" icon={<CheckCircle2 />} title={`Update Ready — v${updateState?.latestVersion ?? ""}`}>
                    Download verified. Restart Propel to apply.
                  </Callout>
                </motion.div>
              )}
              {manualCheckResult === "error" && (
                <motion.div key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <Callout tone="danger" icon={<WifiOff />} title="Unable to check for updates">
                    Check your internet connection and try again.
                  </Callout>
                </motion.div>
              )}
              {!manualCheckResult && (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-body-sm text-fg-3">
                  {manualChecking
                    ? "Checking for a newer version…"
                    : "Use Check for Updates at the top right to look for a newer version."}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              onClick={() => window.electronAPI.shell.openExternal(PROPEL_WEBSITE_URL)}
              className="group flex items-center gap-2.5 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-2.5 text-left text-body font-medium text-fg-2 transition-colors duration-fast hover:border-line hover:text-fg-1 focus-visible:shadow-ring"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1">Visit Website</span>
              <ExternalLink className="h-3.5 w-3.5 text-fg-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </CardContent>
        </MotionCard>
      </motion.div>
      <p className="mt-auto py-6 text-center text-caption text-fg-4">© 2024 Propel. All rights reserved.</p>
    </div>
  );
};
