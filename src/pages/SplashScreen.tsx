import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Leaf, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";

import { supabase } from "@/lib/supabase";

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

        // getSession() auto-refreshes the access token if expired.
        // If the stored refresh_token is also invalid/revoked it returns null — handled below.
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !session) {
          setDone(true);
          setPhase("login");
          return;
        }

        setSession(session);
        const result = await (window as any).propel.entitlements.fetch(
          session.access_token,
        );
        if (cancelled) return;

        if (result.ok) {
          setEntitlementStatus({
            status: "active",
            plan: result.data.plan,
            source: result.data.source,
            trial_active: result.data.trial_active,
            trial_expires_at: result.data.trial_expires_at,
            subscription_status: result.data.subscription_status,
          });
          setDone(true);
          setPhase("main");
        } else if (result.networkError) {
          setDone(true);
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
          setDone(true);
          setPhase("login");
        }
      } catch {
        if (cancelled) return;
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
    };

    const timer = setTimeout(bootstrap, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setPhase, setEntitlementStatus, setSession]);

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
          className="mt-9 flex w-full items-center justify-center"
          aria-label="Loading"
        >
          <style>{`
            .propel-square-loader {
              display: inline-block;
              width: 30px;
              height: 30px;
              position: relative;
              border: 4px solid rgb(var(--t-accent));
              animation: propel-loader 2s infinite ease;
              box-shadow: 0 0 14px rgb(var(--t-accent) / .14);
            }

            .propel-square-loader-inner {
              vertical-align: top;
              display: inline-block;
              width: 100%;
              background-color: rgb(var(--t-accent));
              animation: propel-loader-inner 2s infinite ease-in;
            }

            @keyframes propel-loader {
              0% { transform: rotate(0deg); }
              25% { transform: rotate(180deg); }
              50% { transform: rotate(180deg); }
              75% { transform: rotate(360deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes propel-loader-inner {
              0% { height: 0%; }
              25% { height: 0%; }
              50% { height: 100%; }
              75% { height: 100%; }
              100% { height: 0%; }
            }

            .propel-square-loader--reduced,
            .propel-square-loader--reduced .propel-square-loader-inner {
              animation: none;
            }

            .propel-square-loader--reduced .propel-square-loader-inner {
              height: 100%;
            }
          `}</style>
          <span
            className={`propel-square-loader${reduceMotion ? " propel-square-loader--reduced" : ""}`}
            aria-hidden="true"
          >
            <span className="propel-square-loader-inner" />
          </span>
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
