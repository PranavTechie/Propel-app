import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Shield, Check, Leaf } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { applyTheme } from "@/theme/themes";
import { supabase } from "@/lib/supabase";

const BOOT_STEPS = [
  "Starting Propel",
  "Preparing workspace",
  "Checking your session",
  "Almost ready",
];

export const SplashScreen: React.FC = () => {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSession = useAppStore((s) => s.setSession);
  const setEntitlementStatus = useAppStore((s) => s.setEntitlementStatus);
  const themeId = useSettingsStore((s) => s.themeId);
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Visual-only theme sync. Startup and authentication behavior remain independent.
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

  const progress = done ? 100 : ((stepIndex + 1) / BOOT_STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-bg-base"
      style={{ background: "var(--t-app-bg)" }}
      role="status"
      aria-live="polite"
      aria-label={done ? "Propel is ready" : BOOT_STEPS[stepIndex]}
    >
      {/* Quiet technical environment */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.55 }}
      >
        <div className="absolute inset-0 splash-grid opacity-60" />
        <div className="absolute left-1/2 top-[42%] h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/[.075] blur-[100px]" />
        <div className="absolute inset-x-[12%] top-[21%] h-px bg-gradient-to-r from-transparent via-brand-primary/10 to-transparent" />
        <div className="absolute inset-x-[22%] bottom-[19%] h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <div className="absolute inset-0 splash-vignette" />
      </motion.div>

      <div className="relative z-10 flex w-full max-w-[720px] flex-col items-center px-8 text-center">
        {/* Dimensional hero */}
        <motion.div
          className="relative mb-8 h-[210px] w-[250px]"
          style={{ perspective: "900px" }}
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.72,
            delay: 0.12,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={
              reduceMotion
                ? undefined
                : { y: [0, -5, 0], rotateX: [3, 1, 3], rotateY: [-5, 5, -5] }
            }
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Fine orbit and depth guides */}
            <div className="absolute left-1/2 top-1/2 h-[172px] w-[172px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-primary/10" />
            <div className="absolute left-1/2 top-1/2 h-[136px] w-[136px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/50" />
            <div className="absolute left-1/2 top-1/2 h-[190px] w-[70px] -translate-x-1/2 -translate-y-1/2 rotate-[58deg] rounded-[50%] border border-brand-primary/[.08]" />

            {/* Layered shield body */}
            <div className="splash-shield-layer splash-shield-layer--back">
              <Shield className="h-full w-full" strokeWidth={1.25} />
            </div>
            <div className="splash-shield-layer splash-shield-layer--middle">
              <Shield className="h-full w-full" strokeWidth={1.35} />
            </div>
            <motion.div
              className="splash-shield-face"
              initial={{ filter: "brightness(.9)", opacity: 0 }}
              animate={{ filter: "brightness(1)", opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.6, delay: 0.34 }}
            >
              <div className="absolute inset-[18px] rounded-[30%_30%_42%_42%] bg-gradient-to-br from-white/20 via-transparent to-black/10" />
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-white shadow-inner"
                  >
                    <Check className="h-7 w-7" strokeWidth={2.25} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mark"
                    initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.46,
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                    }}
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-inner"
                  >
                    <Leaf className="h-7 w-7" strokeWidth={1.8} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
          <motion.div
            className="absolute bottom-2 left-1/2 h-5 w-28 -translate-x-1/2 rounded-full bg-black/15 blur-xl"
            animate={
              reduceMotion
                ? undefined
                : { scaleX: [1, 0.86, 1], opacity: [0.2, 0.12, 0.2] }
            }
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Brand reveal */}
        <motion.div
          initial={{ opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.46 }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[.34em] text-brand-secondary">
            System care
          </p>
          <h1 className="mt-2 text-[36px] font-semibold leading-none tracking-[.16em] text-text-primary">
            PROPEL
          </h1>
          <p className="mt-3 text-[13px] text-text-secondary">
            Advanced Windows System Optimizer
          </p>
        </motion.div>

        {/* Initialization console */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.45, delay: 0.72 }}
          className="mt-9 w-full max-w-[390px]"
        >
          <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[.12em]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={done ? "ready" : stepIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={
                  done ? "text-brand-secondary" : "text-text-secondary"
                }
              >
                {done ? "Ready" : BOOT_STEPS[stepIndex]}
              </motion.span>
            </AnimatePresence>
            <span className="tabular-nums text-text-muted">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative h-1 overflow-hidden rounded-full bg-brand-primary/10">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.48, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {!done && !reduceMotion && (
                <span className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-brand-primary/35 blur-md" />
              )}
            </motion.div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {BOOT_STEPS.map((_, index) => (
              <span key={index} className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${index <= stepIndex || done ? "bg-brand-primary" : "bg-border/70"}`}
                />
                {index < BOOT_STEPS.length - 1 && (
                  <span className="hidden h-px w-14 bg-border/40 sm:block" />
                )}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduceMotion ? 0 : 0.9 }}
        className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[9px] font-medium uppercase tracking-[.16em] text-text-muted/70"
      >
        <span>Propel Desktop</span>
        <span>Version 1.3</span>
      </motion.div>
    </div>
  );
};
