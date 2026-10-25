import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Scan,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle } from "@/components/ui/Toggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/Skeleton";
import type { Tone } from "@/theme/thresholds";
import type { StartupAnalysis, StartupEntry } from "@/types";

function impactTone(impact: StartupEntry["impact"]): Tone {
  if (impact === "critical" || impact === "high") return "critical";
  if (impact === "medium") return "warning";
  return "healthy";
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
    <div className="page-shell">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <PageHeader
          eyebrow="Workspace"
          title="Startup Manager"
          subtitle="Windows startup entries & estimated boot impact"
          action={
            <Button onClick={runAnalysis} loading={loading} icon={<Scan />}>
              {loading ? "Scanning..." : "Scan Startup"}
            </Button>
          }
        />

        {analysis && !loading && (
          <div className="grid grid-cols-4 gap-4 max-[760px]:grid-cols-2">
            {[
              ["Startup Items", entries.length],
              ["Enabled", enabledCount],
              ["Disabled", entries.length - enabledCount],
              ["Estimated Impact", impact],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-caption text-fg-3">{label}</p>
                <p className="mt-1.5 font-display text-metric font-semibold text-fg-1 tabular">{value}</p>
              </Card>
            ))}
          </div>
        )}

        {error && <Callout tone="danger">{error}</Callout>}

        {!analysis && !loading && (
          <Card level="feature">
            <EmptyState
              icon={<Rocket />}
              tone="brand"
              title="No startup analysis yet"
              description={
                <>
                  Press <span className="font-semibold text-fg-1">Scan Startup</span> at top right to
                  see which apps launch with Windows and identify entries with higher estimated impact.
                </>
              }
            />
          </Card>
        )}

        {loading && (
          <Card className="p-2" role="status" aria-label="Scanning startup entries">
            <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-body-sm text-fg-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              Scanning startup entries...
            </div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {analysis &&
          !loading &&
          (entries.length === 0 ? (
            <Card>
              <EmptyState icon={<CheckCircle />} tone="brand" title="Your startup is clean" />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <div>
                  <CardEyebrow>Launch with Windows</CardEyebrow>
                  <h3 className="mt-1 text-title font-semibold text-fg-1">Startup Applications</h3>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-4 border-y border-line-subtle bg-surface-inset/70 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-fg-3">
                <span>Application</span>
                <span>Estimated impact</span>
                <span className="text-right">Enabled</span>
              </div>
              <ul className="divide-y divide-line-subtle">
                {entries.map((entry) => {
                  const busy = togglingId === entry.id;
                  return (
                    <motion.li
                      key={entry.id}
                      layout="position"
                      className="grid grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-4 px-5 py-3 transition-colors duration-fast hover:bg-state/[var(--a-hover)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-body-sm font-bold",
                            entry.enabled ? "bg-surface-inset text-fg-2" : "bg-surface-inset text-fg-4",
                          )}
                        >
                          {(entry.displayName?.[0] ?? "?").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className={cn("truncate text-body font-semibold", entry.enabled ? "text-fg-1" : "text-fg-3")}>
                            {entry.displayName}
                          </p>
                          <p className="truncate text-caption text-fg-3">{entry.publisher || entry.location}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill tone={entry.enabled ? impactTone(entry.impact) : "neutral"}>
                          {entry.impactLabel}
                        </StatusPill>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-caption text-fg-3">
                          {busy ? "Saving..." : entry.enabled ? "On" : "Off"}
                        </span>
                        <Toggle
                          checked={entry.enabled}
                          disabled={busy}
                          onCheckedChange={() => toggleEntry(entry)}
                          aria-label={`${entry.enabled ? "Disable" : "Enable"} ${entry.displayName} at startup`}
                        />
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </Card>
          ))}
      </div>
    </div>
  );
};
