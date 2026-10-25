import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Leaf, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";

import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/Progress";

export const SplashScreen: React.FC = () => {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSession = useAppStore((s) => s.setSession);
  const setEntitlementStatus = useAppStore((s) => s.setEntitlementStatus);
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.electronAPI?.splash.ready();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setEntitlementStatus({
          status: "checking",
          plan: "FREE",
          source: "plan",
          trial_active: false,
          trial_expires_at: null,
          subscription_status: "",
        });

        const cached = await (window as any).propel.entitlements.getCached();
        if (cancelled) return;

        let session = null;
        try {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session) {
            session = data.session;
          }
        } catch {
          // Network / auth error
        }

        if (cancelled) return;

        if (!session) {
          // If no active session, but cache exists, use cache and go to main
          if (cached && !cached.isFallback) {
            setEntitlementStatus({
              status: "active",
              plan: cached.plan,
              source: (cached.source as any) || "plan",
              trial_active: cached.trial_active || false,
              trial_expires_at: cached.trial_expires_at || null,
              subscription_status: cached.subscription_status || "",
              limits: cached.limits,
              features: cached.features,
              expiresAt: cached.expiresAt,
              serverTime: cached.serverTime,
              fetchedAt: cached.fetchedAt,
              isOffline: true,
            });
            setDone(true);
            setPhase("main");
            return;
          }

          // No cache AND no session
          if (!navigator.onLine) {
            setDone(true);
            setPhase("no_internet");
            return;
          }

          setDone(true);
          setPhase("login");
          return;
        }

        setSession(session);

        try {
          const result = await (window as any).propel.entitlements.fetch(
            session.access_token,
          );
          if (cancelled) return;

          if (result.ok && result.data) {
            setEntitlementStatus({
              status: "active",
              plan: result.data.plan,
              source: result.data.source,
              trial_active: result.data.trial_active,
              trial_expires_at: result.data.trial_expires_at,
              subscription_status: result.data.subscription_status,
              limits: result.data.limits,
              features: result.data.features,
              expiresAt: result.data.expiresAt,
              serverTime: result.data.serverTime,
              fetchedAt: Date.now(),
              isOffline: false,
            });
            window.propel?.maintenance?.syncScheduler?.().catch(() => {});
            setDone(true);
            setPhase("main");
          } else if (result.networkError || !navigator.onLine) {
            if (cached && !cached.isFallback) {
              setEntitlementStatus({
                status: "active",
                plan: cached.plan,
                source: (cached.source as any) || "plan",
                trial_active: cached.trial_active || false,
                trial_expires_at: cached.trial_expires_at || null,
                subscription_status: cached.subscription_status || "",
                limits: cached.limits,
                features: cached.features,
                expiresAt: cached.expiresAt,
                serverTime: cached.serverTime,
                fetchedAt: cached.fetchedAt,
                isOffline: true,
              });
            } else {
              setEntitlementStatus({
                status: "active",
                plan: "FREE",
                source: "plan",
                trial_active: false,
                trial_expires_at: null,
                subscription_status: "",
                limits: { devices: 10, aiChecksPerMonth: 1 },
                features: { customThresholds: false, alwaysOnMaintenance: false },
                isOffline: true,
              });
            }
            setDone(true);
            setPhase("main");
          } else {
            setEntitlementStatus({
              status: "error",
              plan: "FREE",
              source: "plan",
              trial_active: false,
              trial_expires_at: null,
              subscription_status: "",
            });
            setDone(true);
            setPhase("login");
          }
        } catch {
          if (cancelled) return;
          if (cached && !cached.isFallback) {
            setEntitlementStatus({
              status: "active",
              plan: cached.plan,
              source: (cached.source as any) || "plan",
              trial_active: cached.trial_active || false,
              trial_expires_at: cached.trial_expires_at || null,
              subscription_status: cached.subscription_status || "",
              limits: cached.limits,
              features: cached.features,
              expiresAt: cached.expiresAt,
              serverTime: cached.serverTime,
              fetchedAt: cached.fetchedAt,
              isOffline: true,
            });
          } else {
            setEntitlementStatus({
              status: "active",
              plan: "FREE",
              source: "plan",
              trial_active: false,
              trial_expires_at: null,
              subscription_status: "",
              limits: { devices: 10, aiChecksPerMonth: 1 },
              features: { customThresholds: false, alwaysOnMaintenance: false },
              isOffline: true,
            });
          }
          setDone(true);
          setPhase("main");
        }
      } catch {
        if (cancelled) return;
        setDone(true);
        setPhase("login");
      }
    };

    const timer = setTimeout(bootstrap, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setPhase, setEntitlementStatus, setSession]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-surface-base"
      role="status"
      aria-live="polite"
      aria-label={done ? "Propel is ready" : "Propel is loading"}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 grid-bg opacity-70 [mask-image:radial-gradient(circle_at_50%_42%,black,transparent_62%)]" />
        <div className="absolute left-1/2 top-[42%] h-[460px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-brand-glow)/.12),transparent)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.32,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="relative z-10 flex w-full max-w-[360px] select-none flex-col items-center px-6 text-center"
      >
        {/* Existing Propel leaf icon, presented on the brand tile */}
        <div className="relative mb-8 flex h-[84px] w-[84px] items-center justify-center rounded-[24px] border border-brand/25 bg-brand-soft p-2 shadow-[var(--shadow-2),var(--highlight-top)]">
          <span
            aria-hidden
            className="absolute -inset-3 rounded-[30px] border border-dashed border-brand/20"
          />
          <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))] text-fg-on-brand shadow-[var(--shadow-brand),var(--highlight-brand)]">
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <CheckCircle2 className="h-9 w-9" strokeWidth={1.8} />
                </motion.div>
              ) : (
                <motion.div
                  key="leaf"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.12,
                    duration: reduceMotion ? 0 : 0.32,
                  }}
                >
                  <Leaf className="h-9 w-9" strokeWidth={1.8} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.32, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="font-display text-[30px] font-semibold leading-none tracking-[.18em] text-fg-1"
        >
          PROPEL
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.32, delay: 0.2 }}
          className="mt-3 text-body text-fg-2"
        >
          Advanced Windows System Optimizer
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.32, delay: 0.3 }}
          className="mt-9 w-40"
          aria-label="Loading"
        >
          <Progress value={done ? 100 : null} indeterminate={!done} tone="brand" size="xs" aria-label="Loading Propel" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.4 }}
          className="mt-8 text-[10.5px] text-fg-3"
        >
          Version 1.4
        </motion.p>
      </motion.div>
    </div>
  );
};
