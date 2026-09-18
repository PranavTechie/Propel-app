import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Leaf, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { applyTheme } from "@/theme/themes";
import { supabase } from "@/lib/supabase";

const BOOT_STEPS = ["", "", "", ""];

export const SplashScreen: React.FC = () => {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSession = useAppStore((s) => s.setSession);
  const setEntitlementStatus = useAppStore((s) => s.setEntitlementStatus);
  const themeId = useSettingsStore((s) => s.themeId);
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Visual-only theme sync. Startup and authentication behavior remain unchanged.
  useEffect(() => applyTheme(themeId), [themeId]);

  useEffect(() => {
    // Cycle through steps every 550ms up to step 2 while we wait for the API
    const intervals: ReturnType<typeof setTimeout>[] = [];
    intervals.push(setTimeout(() => setStepIndex(1), 550));
    intervals.push(setTimeout(() => setStepIndex(2), 1100));

    const MIN_DISPLAY_MS = 1500; // prevents flicker on fast connections

    const bootstrap = async () => {
      const startedAt = Date.now();
      try {
        setEntitlementStatus({
          status: "checking",
          plan: "FREE",
          source: "plan",
          trial_active: false,
          trial_expires_at: null,
          subscription_status: "",
        });

        // getSession() auto-refreshes the access token if expired.
        // If the stored refresh_token is also invalid/revoked it returns null — handled below.
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        setStepIndex(3);

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
        await new Promise((r) => setTimeout(r, remaining));
        setDone(true);
        await new Promise((r) => setTimeout(r, 300));

        if (error || !session) {
          // This covers TEST F: expired/revoked refresh token — getSession returns null.
          // Show login cleanly; no loop because LoginPage does not call getSession.
          setPhase("login");
          return;
        }

        setSession(session);
        const result = await (window as any).propel.entitlements.fetch(
          session.access_token,
        );

        if (result.ok) {
          setEntitlementStatus({
            status: "active",
            plan: result.data.plan,
            source: result.data.source,
            trial_active: result.data.trial_active,
            trial_expires_at: result.data.trial_expires_at,
            subscription_status: result.data.subscription_status,
          });
          setPhase("main");
        } else {
          if (result.networkError) {
            setPhase("no_internet");
          } else {
            setEntitlementStatus({
              status: "error",
              plan: "FREE",
              source: "plan",
              trial_active: false,
              trial_expires_at: null,
              subscription_status: "",
            });
            setPhase("login");
          }
        }
      } catch {
        setEntitlementStatus({
          status: "error",
          plan: "FREE",
          source: "plan",
          trial_active: false,
          trial_expires_at: null,
          subscription_status: "",
        });
        const elapsed = Date.now() - startedAt;
        await new Promise((r) =>
          setTimeout(r, Math.max(0, MIN_DISPLAY_MS - elapsed)),
        );
        setPhase("login");
      }
    };

    const timer = setTimeout(bootstrap, 700);
    intervals.push(timer);
    return () => intervals.forEach(clearTimeout);
  }, [setPhase, setEntitlementStatus, setSession]);

  const progress = Math.min(100, ((stepIndex + 1) / BOOT_STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-bg-base"
      style={{ background: "var(--t-app-bg)" }}
      role="status"
      aria-live="polite"
      aria-label={done ? "Propel is ready" : "Propel is loading"}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      >
        <div className="absolute inset-0 grid-bg opacity-45" />
        <div className="absolute left-1/2 top-[42%] h-[460px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/[.06] blur-[110px]" />
        <div
          className="absolute inset-0"
          style={{ boxShadow: "inset 0 0 140px rgb(var(--t-bg-base) / .65)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.5,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="relative z-10 flex w-full max-w-[360px] flex-col items-center select-none px-6 text-center"
      >
        {/* Existing Propel leaf icon — unchanged, with only presentation around it. */}
        <motion.div
          className="relative mb-8 flex h-[86px] w-[86px] items-center justify-center rounded-[26px] border border-brand-primary/25 bg-brand-primary/[.09]"
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            boxShadow:
              "0 18px 40px rgb(var(--t-accent2) / .14), inset 0 1px 0 rgb(255 255 255 / .45)",
          }}
        >
          <motion.div
            className="absolute -inset-4 rounded-[32px] border border-brand-primary/10"
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.05, 1], opacity: [0.45, 0.15, 0.45] }
            }
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-2 rounded-[20px] bg-gradient-brand opacity-95 shadow-[inset_8px_8px_18px_rgb(255_255_255/.18),inset_-8px_-10px_18px_rgb(0_0_0/.14)]" />
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="relative z-10 text-white"
              >
                <CheckCircle2 className="h-9 w-9" strokeWidth={1.8} />
              </motion.div>
            ) : (
              <motion.div
                key="leaf"
                initial={{ opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: reduceMotion ? 0 : 0.16,
                  duration: reduceMotion ? 0 : 0.42,
                }}
                className="relative z-10 text-white"
              >
                <Leaf className="h-9 w-9" strokeWidth={1.8} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 7, letterSpacing: "0.28em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
          transition={{
            duration: reduceMotion ? 0 : 0.52,
            delay: 0.2,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          className="text-[30px] font-semibold leading-none text-text-primary"
        >
          PROPEL
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, delay: 0.36 }}
          className="mt-3 text-[13px] text-text-secondary"
        >
          Advanced Windows System Optimizer
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, delay: 0.58 }}
          className="mt-9 w-full"
        >
          <div className="mb-3 flex h-4 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stepIndex}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
                className="text-xs text-text-muted"
              >
                {BOOT_STEPS[stepIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="relative h-1 overflow-hidden rounded-full bg-brand-primary/10">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-primary"
              animate={{ width: `${progress}%` }}
              transition={{
                duration: reduceMotion ? 0 : 0.5,
                ease: [0.2, 0.8, 0.2, 1],
              }}
            >
              {!done && !reduceMotion && (
                <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-primary/40 blur-[5px]" />
              )}
            </motion.div>
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {BOOT_STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${index <= stepIndex ? "w-5 bg-brand-primary" : "w-1.5 bg-border/70"}`}
              />
            ))}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.72 }}
          className="mt-8 text-[10px] text-text-muted"
        >
          Version 3.2.0
        </motion.p>
      </motion.div>
    </div>
  );
};
