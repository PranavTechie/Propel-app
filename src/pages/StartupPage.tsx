import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Scan,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/utils/cn";
import type { StartupAnalysis, StartupEntry } from "@/types";

function impactColor(impact: StartupEntry["impact"]): string {
  if (impact === "critical") return "text-red-400";
  if (impact === "high") return "text-orange-400";
  if (impact === "medium") return "text-amber-400";
  return "text-emerald-400";
}

export const StartupPage: React.FC = () => {
  const { suAnalysis: analysis, suEntries: entries } = useSessionStore(
    (s) => s.ai
  ) as { suAnalysis: StartupAnalysis | null; suEntries: StartupEntry[] };
  const setAi = useSessionStore((s) => s.setAi);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.propel.ai.analyzeStartup();
      setAi({ suAnalysis: data, suEntries: data.entries });
    } catch {
      setError("Startup analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [setAi]);

  const toggleEntry = useCallback(
    async (entry: StartupEntry) => {
      setTogglingId(entry.id);
      setError(null);
      try {
        await window.propel.ai.setStartupEntryEnabled(entry, !entry.enabled);
        setAi((s) => ({
          suEntries: s.suEntries.map((item) =>
            item.id === entry.id ? { ...item, enabled: !item.enabled } : item
          ),
        }));
      } catch (err: any) {
        setError(
          err?.message === "RequiresAdmin"
            ? "This item requires administrator privileges to modify."
            : "Failed to modify startup entry."
        );
      } finally {
        setTogglingId(null);
      }
    },
    [setAi]
  );

  const enabledCount = entries.filter((entry) => entry.enabled).length;
  const impact = analysis
    ? `${analysis.totalEstimatedDelaySec.toFixed(1)}s`
    : "Not scanned";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Page Header ── */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow-md">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">
                Startup Manager
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Windows startup entries &amp; estimated boot impact
              </p>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#4f9635] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Scan className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Scanning..." : "Scan Startup"}
          </button>
        </motion.div>
      </div>

      {/* ── Page Content ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto w-full space-y-5">
          {analysis && !loading && (
            <div className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2">
              {[
                ["Startup Items", entries.length],
                ["Enabled", enabledCount],
                ["Disabled", entries.length - enabledCount],
                ["Estimated Impact", impact],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border border-border/50 bg-white/[0.025] px-4 py-3 rounded-xl"
                >
                  <p className="text-2xs text-text-muted">{label}</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!analysis && !loading && (
            <div className="border border-border/60 bg-white/[0.025] rounded-2xl p-7">
              <div className="flex items-start gap-4">
                <Rocket className="mt-1 h-7 w-7 text-brand-primary shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Startup Health
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Keep your Windows startup lean and responsive.
                  </p>
                  <p className="mt-5 text-sm font-semibold text-text-primary">
                    No startup analysis yet
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-muted">
                    Press{" "}
                    <span className="font-semibold text-text-primary">
                      Scan Startup
                    </span>{" "}
                    at top right to see which apps launch with Windows and identify
                    entries with higher estimated impact.
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/[0.025] p-5 text-sm text-text-secondary">
              <RefreshCw className="h-4 w-4 animate-spin text-brand-primary" />
              Scanning startup entries...
            </div>
          )}

          {analysis &&
            !loading &&
            (entries.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-10 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
                <h3 className="mt-3 text-base font-bold text-text-primary">
                  Your startup is clean
                </h3>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary">
                  Startup Applications
                </h3>
                <div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">
                  <div className="grid grid-cols-[minmax(0,1fr)_100px_110px] items-center gap-4 px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-text-muted bg-white/[0.02]">
                    <span>Startup applications</span>
                    <span>Estimated impact</span>
                    <span className="text-right">Controls</span>
                  </div>
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[minmax(0,1fr)_100px_110px] items-center gap-4 p-4 hover:bg-white/[0.025]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {entry.displayName}
                        </p>
                        <p className="truncate text-2xs text-text-muted">
                          {entry.publisher || entry.location}
                        </p>
                      </div>
                      <div>
                        <span
                          className={cn(
                            "text-2xs font-semibold",
                            entry.enabled
                              ? "text-emerald-400"
                              : "text-text-muted"
                          )}
                        >
                          {entry.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <p className={cn("text-2xs mt-1", impactColor(entry.impact))}>
                          {entry.impactLabel}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleEntry(entry)}
                        disabled={togglingId === entry.id}
                        className={cn(
                          "justify-self-end rounded-lg border px-2.5 py-1.5 text-2xs font-semibold",
                          entry.enabled
                            ? "border-red-500/20 text-red-300 hover:bg-red-500/10"
                            : "border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10"
                        )}
                      >
                        {togglingId === entry.id
                          ? "Saving..."
                          : entry.enabled
                          ? "Disable"
                          : "Enable"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
