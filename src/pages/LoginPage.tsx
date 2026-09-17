import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ArrowRight,
  Loader2,
  Globe,
  UserPlus,
  ShieldCheck,
  Gauge,
  Sparkles,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
export const LoginPage: React.FC = () => {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSession = useAppStore((s) => s.setSession);
  const setEntitlementStatus = useAppStore((s) => s.setEntitlementStatus);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    window.electronAPI.auth.onCallback(async (url: string) => {
      try {
        setLoading(true);
        setError(null);
        setWaiting(false);
        const code = new URL(url).searchParams.get("code");
        if (!code) throw new Error("Authentication code not found.");
        const data = await (window as any).electronAPI.auth.exchangeAuthCode(
          code,
        );
        if (!data.ok || !data.session)
          throw new Error(
            data.status
              ? `Authentication exchange failed (HTTP ${data.status})`
              : "Unable to reach authentication server",
          );
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
        setSession(data.session);
        setEntitlementStatus({
          status: "checking",
          plan: "FREE",
          source: "plan",
          trial_active: false,
          trial_expires_at: null,
          subscription_status: "",
        });
        const result = await (window as any).propel.entitlements.fetch(
          data.session.access_token,
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
          setError(result.message || "Failed to fetch account status.");
          setEntitlementStatus({
            status: "error",
            plan: "FREE",
            source: "plan",
            trial_active: false,
            trial_expires_at: null,
            subscription_status: "",
          });
        }
      } catch (err: any) {
        setError(err.message || "Authentication failed. Please try again.");
      } finally {
        setLoading(false);
      }
    });
  }, [setPhase, setSession, setEntitlementStatus]);
  const logIn = () => {
    setError(null);
    setWaiting(true);
    window.electronAPI.shell.openExternal(
      "https://cleanmasterpro.in/auth/desktop",
    );
  };
  const signUp = () => {
    setError(null);
    window.electronAPI.shell.openExternal(
      "https://cleanmasterpro.in/signup?source=desktop",
    );
  };
  return (
    <div className="fixed inset-0 z-40 grid grid-cols-[1.1fr_.9fr] overflow-hidden bg-bg-base max-[900px]:grid-cols-1">
      <section className="relative flex flex-col justify-between overflow-hidden border-r border-border/60 bg-[#1d241b] p-10 text-white max-[900px]:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(114,188,88,.16),transparent_38%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5AA63C]">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-[.08em]">PROPEL</p>
            <p className="text-[10px] uppercase tracking-[.18em] text-white/45">
              System care
            </p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9bd287]">
            Premium Windows optimization
          </p>
          <h1 className="mt-4 text-[44px] font-semibold leading-[1.05] tracking-[-.05em]">
            A calmer, faster PC starts here.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/62">
            Monitor health, remove clutter and keep performance in shape from
            one trusted workspace.
          </p>
          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              [Gauge, "Live health"],
              [ShieldCheck, "Safe cleanup"],
              [Sparkles, "Smart care"],
            ].map(([Icon, label]) => {
              const I = Icon as React.ComponentType<{ className?: string }>;
              return (
                <div
                  key={label as string}
                  className="rounded-xl border border-white/10 bg-white/[.045] p-4"
                >
                  <I className="h-4 w-4 text-[#9bd287]" />
                  <p className="mt-3 text-xs font-medium text-white/75">
                    {label as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-[10px] text-white/35">
          Propel 3.2 · Built for Windows
        </p>
      </section>
      <section className="relative flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="w-full max-w-[390px]"
        >
          <div className="mb-8">
            <p className="section-label">Welcome back</p>
            <h2 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-text-primary">
              Sign in to Propel
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Continue securely in your browser. Propel will return here
              automatically.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-bg-elevated p-6 shadow-[var(--t-card-elevated-shadow)]">
            <AnimatePresence mode="wait">
              {waiting ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-secondary">
                    <Globe className="h-6 w-6" />
                    <Loader2 className="absolute h-10 w-10 animate-spin text-brand-primary/35" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-text-primary">
                    Waiting for your browser
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    Complete sign in there. This window will continue
                    automatically.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setWaiting(false);
                        setError(null);
                      }}
                      icon={<X className="h-4 w-4" />}
                    >
                      Cancel
                    </Button>
                    <Button variant="secondary" onClick={logIn}>
                      Open again
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <Button
                    id="desktop-login-btn"
                    onClick={logIn}
                    disabled={loading}
                    className="w-full"
                    iconRight={
                      loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )
                    }
                  >
                    Log in securely
                  </Button>
                  <Button
                    id="desktop-signup-btn"
                    onClick={signUp}
                    variant="secondary"
                    disabled={loading}
                    className="w-full"
                    icon={<UserPlus className="h-4 w-4" />}
                  >
                    Create an account
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[.07] px-3 py-2.5 text-xs leading-5 text-red-600"
              >
                {error}
              </motion.div>
            )}
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-text-muted">
            Authentication is completed through Propel's secure web flow.
          </p>
        </motion.div>
      </section>
    </div>
  );
};
