import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ArrowRight,
  Globe,
  UserPlus,
  ShieldCheck,
  Gauge,
  Sparkles,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { supabase } from "@/lib/supabase";
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

export const LoginPage: React.FC = () => {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSession = useAppStore((s) => s.setSession);
  const setEntitlementStatus = useAppStore((s) => s.setEntitlementStatus);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingStateRef = React.useRef<string | null>(null);
  const pendingVerifierRef = React.useRef<string | null>(null);
  const timeoutTimerRef = React.useRef<any>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
  }, []);

  const generateStateNonce = () => {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const startWaitingTimeout = () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
    }
    // 5-minute timeout (300,000 ms)
    timeoutTimerRef.current = setTimeout(() => {
      setWaiting(false);
      setLoading(false);
      pendingStateRef.current = null;
      pendingVerifierRef.current = null;
      setError("Sign-in session timed out after 5 minutes. Please try again.");
    }, 5 * 60 * 1000);
  };

  const cancelWaiting = () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    pendingStateRef.current = null;
    pendingVerifierRef.current = null;
    setWaiting(false);
    setError(null);
  };

  useEffect(() => {
    window.electronAPI.auth.onCallback(async (url: string) => {
      try {
        setLoading(true);
        setError(null);
        setWaiting(false);

        if (timeoutTimerRef.current) {
          clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }

        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get("code");
        const returnedState = parsedUrl.searchParams.get("state");

        if (!code) throw new Error("Authentication code not found.");

        // Security check: verify state/nonce binding if desktop app generated one
        const expectedState = pendingStateRef.current;
        if (expectedState && returnedState && expectedState !== returnedState) {
          throw new Error("Security verification failed: state parameter mismatch. Please try signing in again.");
        }

        // Consume pending state and verifier
        const stateToExchange = expectedState || returnedState || undefined;
        const verifierToExchange = pendingVerifierRef.current || undefined;
        pendingStateRef.current = null;
        pendingVerifierRef.current = null;

        const data = await (window as any).electronAPI.auth.exchangeAuthCode(
          code,
          stateToExchange,
          verifierToExchange
        );
        if (!data.ok || !data.session) {
          throw new Error(
            data.message ||
              (data.status
                ? `Authentication exchange failed (HTTP ${data.status})`
                : "Unable to reach authentication server. Please check your network and try again.")
          );
        }

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

  const logIn = async () => {
    setError(null);
    setWaiting(true);
    const state = generateStateNonce();
    const verifier = generateCodeVerifier();
    pendingStateRef.current = state;
    pendingVerifierRef.current = verifier;
    startWaitingTimeout();

    try {
      const challenge = await computeCodeChallenge(verifier);
      const baseUrl = "https://cleanmasterpro.in/login";
      window.electronAPI.shell.openExternal(
        `${baseUrl}?source=desktop&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`,
      );
    } catch {
      cancelWaiting();
      setError("Failed to generate secure authentication challenge. Please try again.");
    }
  };

  const signUp = async () => {
    setError(null);
    setWaiting(true);
    const state = generateStateNonce();
    const verifier = generateCodeVerifier();
    pendingStateRef.current = state;
    pendingVerifierRef.current = verifier;
    startWaitingTimeout();

    try {
      const challenge = await computeCodeChallenge(verifier);
      const baseUrl = "https://cleanmasterpro.in/signup";
      window.electronAPI.shell.openExternal(
        `${baseUrl}?source=desktop&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`,
      );
    } catch {
      cancelWaiting();
      setError("Failed to generate secure authentication challenge. Please try again.");
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid grid-cols-[1.1fr_.9fr] overflow-hidden bg-surface-base max-[900px]:grid-cols-1">
      {/* Brand panel: deep brand green in both themes, built from primitive tokens */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-[rgb(var(--green-950))] p-10 text-[rgb(var(--neutral-0))] max-[900px]:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgb(var(--green-500)/.22),transparent_42%)]"
        />
        <svg aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] opacity-[.12]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="60" fill="none" stroke="rgb(var(--green-300))" strokeWidth=".6" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgb(var(--green-300))" strokeWidth=".6" strokeDasharray="1.5 4" />
          <circle cx="100" cy="100" r="98" fill="none" stroke="rgb(var(--green-300))" strokeWidth=".6" />
        </svg>
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-[linear-gradient(180deg,rgb(var(--green-500)),rgb(var(--green-700)))] shadow-[var(--highlight-brand)]">
            <Leaf className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-[.08em]">PROPEL</p>
            <p className="text-[10px] uppercase tracking-[.18em] text-[rgb(var(--green-200)/.6)]">System care</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[rgb(var(--green-300))]">
            Premium Windows optimization
          </p>
          <h1 className="mt-4 font-display text-[44px] font-semibold leading-[1.05] tracking-[-.045em]">
            A calmer, faster PC starts here.
          </h1>
          <p className="mt-5 max-w-md text-body text-[rgb(var(--green-100)/.72)]">
            Monitor health, remove clutter and keep performance in shape from one trusted workspace.
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
                  className="rounded-card border border-[rgb(var(--green-200)/.14)] bg-[rgb(var(--green-200)/.06)] p-4"
                >
                  <I className="h-4 w-4 text-[rgb(var(--green-300))]" />
                  <p className="mt-3 text-body-sm font-medium text-[rgb(var(--green-50)/.85)]">{label as string}</p>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-[10.5px] text-[rgb(var(--green-100)/.45)]">Propel 1.4 · Built for Windows</p>
      </section>

      <section className="relative flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-[390px]"
        >
          <div className="mb-7">
            <p className="section-label">Welcome back</p>
            <h2 className="mt-2 font-display text-[30px] font-semibold leading-9 tracking-[-.035em] text-fg-1">
              Sign in to Propel
            </h2>
            <p className="mt-2 text-body text-fg-2">
              Continue securely in your browser. Propel will return here automatically.
            </p>
          </div>
          <div className="rounded-panel border border-line bg-surface-raised p-6 shadow-[var(--shadow-2),var(--highlight-top)]">
            <AnimatePresence mode="wait">
              {waiting ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                  role="status"
                >
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-[3px] border-brand/15" />
                    <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
                    <Globe className="h-5 w-5 text-brand-fg" />
                  </div>
                  <h3 className="mt-5 text-title font-semibold text-fg-1">Waiting for your browser</h3>
                  <p className="mt-1.5 text-body text-fg-2">
                    Complete sign in there. This window will continue automatically.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Button variant="ghost" onClick={cancelWaiting} icon={<X />}>
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
                  className="space-y-2.5"
                >
                  <Button
                    id="desktop-login-btn"
                    size="lg"
                    onClick={logIn}
                    loading={loading}
                    className="w-full"
                    iconRight={<ArrowRight />}
                  >
                    {error ? "Retry sign in" : "Log in securely"}
                  </Button>
                  <Button
                    id="desktop-signup-btn"
                    size="lg"
                    onClick={signUp}
                    variant="secondary"
                    disabled={loading}
                    className="w-full"
                    icon={<UserPlus />}
                  >
                    Create an account
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <Callout tone="danger" title="Sign-in didn't complete">
                  Please try again. If it keeps happening, check your internet connection.
                </Callout>
              </motion.div>
            )}
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-caption text-fg-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Authentication is completed through Propel's secure web flow.
          </p>
        </motion.div>
      </section>
    </div>
  );
};
