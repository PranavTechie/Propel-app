import React, { useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, CheckCircle, HardDrive, MemoryStick, Cpu } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import type { SmartBoostAnalysis, SmartBoostResult } from "@/types";
import { PCAdvisorSection } from "@/components/ai/PCAdvisorSection";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { Callout } from "@/components/ui/Callout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";

/** Scan & Boost. After an analysis, boosting asks first and lists what is affected. */
const BoostButton: React.FC<{
  analysis: SmartBoostAnalysis | null;
  analyzing: boolean;
  onAnalyze: () => void;
  onOptimize: () => void;
}> = ({ analysis, analyzing, onAnalyze, onOptimize }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="lg"
        icon={<Zap />}
        loading={analyzing}
        onClick={analysis ? () => setOpen(true) : onAnalyze}
        className="mt-7 px-7"
      >
        {analyzing ? "Scanning..." : "Scan & Boost"}
      </Button>
      {analysis && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          tone="brand"
          icon={<Zap />}
          title="Run Quick Boost?"
          description="Quick Boost cleans temporary files and trims memory. No apps are closed."
          items={[
            {
              id: "storage",
              icon: <HardDrive />,
              label: "Temporary files",
              meta: `about ${formatBytes(analysis.reclaimableStorage)}`,
            },
            {
              id: "ram",
              icon: <MemoryStick />,
              label: "Memory working sets",
              meta: `about ${formatBytes(analysis.reclaimableRam)}`,
            },
          ]}
          confirmLabel="Boost now"
          onConfirm={() => {
            setOpen(false);
            onOptimize();
          }}
        />
      )}
    </>
  );
};

const SmartBoostSection: React.FC = () => {
  const { sbAnalysis: analysis, sbResult: result } = useSessionStore(
    (s) => s.ai
  ) as {
    sbAnalysis: SmartBoostAnalysis | null;
    sbResult: SmartBoostResult | null;
    sbProgress: { step: string; pct: number } | null;
  };
  const setAi = useSessionStore((s) => s.setAi);
  const setAnalysis = (a: any) => setAi({ sbAnalysis: a });
  const setResult = (r: any) => setAi({ sbResult: r });
  const setProgress = (p: any) => setAi({ sbProgress: p });

  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await window.propel.ai.smartBoostAnalyze();
      setAnalysis(data);
    } catch (e) {
      setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const runOptimize = useCallback(async () => {
    if (!analysis) return;
    setOptimizing(true);
    setProgress({ step: "Starting optimization...", pct: 0 });
    setResult(null);

    window.propel.ai.onSmartBoostProgress((data) => {
      setProgress(data);
    });

    try {
      const res = await window.propel.ai.smartBoostOptimize();
      setResult(res);
      setProgress(null);
      // Re-analyze to refresh scores
      const fresh = await window.propel.ai.smartBoostAnalyze();
      setAnalysis(fresh);
    } catch {
      setError(
        "Optimization failed. Some processes or files could not be cleared safely."
      );
      setProgress(null);
    } finally {
      setOptimizing(false);
      window.propel.ai.removeListeners();
    }
  }, [analysis]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-6 text-center">
      <AnimatePresence mode="wait">
        {!optimizing && !result && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full"
          >
            <Card level="feature" className="flex flex-col items-center px-8 py-10">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-brand-glow)/.12),transparent)]"
              />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-card bg-brand-soft text-brand-fg shadow-[var(--highlight-top)]">
                <Zap className="h-7 w-7" strokeWidth={1.9} />
              </span>
              <h2 className="relative mt-5 font-display text-[26px] font-semibold leading-8 tracking-[-.025em] text-fg-1">
                Quick Boost
              </h2>
              <p className="relative mt-2 max-w-md text-body text-fg-2">
                Optimize your PC with one quick scan.
                <br />
                Safely improve system responsiveness by cleaning temporary files and optimizing memory.
              </p>
              {analysis && (
                <div className="relative mt-6 grid w-full max-w-sm grid-cols-2 gap-3 text-left">
                  <div className="rounded-control border border-line-subtle bg-surface-inset px-3.5 py-2.5">
                    <p className="text-caption text-fg-3">Reclaimable storage</p>
                    <p className="text-title font-semibold text-fg-1 tabular">{formatBytes(analysis.reclaimableStorage)}</p>
                  </div>
                  <div className="rounded-control border border-line-subtle bg-surface-inset px-3.5 py-2.5">
                    <p className="text-caption text-fg-3">Reclaimable memory</p>
                    <p className="text-title font-semibold text-fg-1 tabular">{formatBytes(analysis.reclaimableRam)}</p>
                  </div>
                </div>
              )}
              <BoostButton
                analysis={analysis}
                analyzing={analyzing}
                onAnalyze={runAnalysis}
                onOptimize={runOptimize}
              />
            </Card>
          </motion.div>
        )}

        {optimizing && (
          <motion.div
            key="optimizing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <Card level="feature" className="flex flex-col items-center px-8 py-12" role="status">
              <div className="relative h-14 w-14">
                <span className="absolute inset-0 rounded-full border-[3px] border-brand/15" />
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
                <Zap className="absolute inset-0 m-auto h-5 w-5 text-brand" />
              </div>
              <p className="mt-5 text-title font-semibold text-fg-1">Optimizing your PC...</p>
              <Progress value={null} indeterminate className="mt-5 max-w-[200px]" aria-label="Optimizing" />
            </Card>
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full"
          >
            <Card level="feature" className="flex flex-col items-center px-8 py-10">
              <span className="flex h-14 w-14 items-center justify-center rounded-card bg-success-soft text-success-fg">
                <CheckCircle className="h-7 w-7" strokeWidth={1.9} />
              </span>
              <h2 className="mt-5 font-display text-[24px] font-semibold leading-[30px] tracking-[-.025em] text-fg-1">
                Boost Complete
              </h2>
              <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3 text-left">
                {[
                  { label: "Memory recovered", value: formatBytes(result.ramFreedBytes), icon: <MemoryStick className="h-3.5 w-3.5" /> },
                  { label: "Storage cleaned", value: formatBytes(result.storageFreedBytes), icon: <HardDrive className="h-3.5 w-3.5" /> },
                  { label: "Processes optimized", value: String(result.processesOptimized), icon: <Cpu className="h-3.5 w-3.5" /> },
                ].map((m) => (
                  <div key={m.label} className="rounded-control border border-line-subtle bg-surface-inset px-3 py-2.5">
                    <p className="flex items-center gap-1 text-[10.5px] text-fg-3">
                      {m.icon}
                      {m.label}
                    </p>
                    <p className="mt-0.5 text-title font-semibold text-fg-1 tabular">{m.value}</p>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="mt-7" onClick={() => setResult(null)}>
                Done
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 w-full text-left"
          >
            <Callout tone="danger">{error}</Callout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

type Tab = "advisor" | "boost";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}[] = [
  {
    id: "advisor",
    label: "PC Advisor",
    icon: <Brain className="w-4 h-4" />,
    badge: "AI",
  },
  {
    id: "boost",
    label: "Quick Boost",
    icon: <Zap className="w-4 h-4" />,
  },
];

export const AIFeaturesPage: React.FC = () => {
  const { activeTab: rawActiveTab } = useSessionStore((s) => s.ai);
  const setAi = useSessionStore((s) => s.setAi);
  const setActiveTab = (t: Tab) => setAi({ activeTab: t });
  const activeTab: Tab = rawActiveTab === "boost" ? "boost" : "advisor";

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader
          eyebrow="System"
          title="AI Features"
          subtitle="Intelligent system diagnostics & Quick Boost"
          meta={
            activeTab === "advisor" ? (
              <span className="flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-[10.5px] font-semibold tracking-[.08em] text-brand-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                AI ADVISOR
              </span>
            ) : undefined
          }
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <TabsList aria-label="AI features">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="h-8 px-3.5 text-body">
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span
                    className={cn(
                      "ml-0.5 rounded-tiny px-1.5 py-px text-[10px] font-bold",
                      activeTab === tab.id ? "bg-brand-soft text-brand-fg" : "bg-surface-raised text-fg-3"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-5">
          <AnimatePresence mode="wait">
            {activeTab === "advisor" && (
              <motion.div
                key="advisor"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <PCAdvisorSection />
              </motion.div>
            )}
            {activeTab === "boost" && (
              <motion.div
                key="boost"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <SmartBoostSection />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
