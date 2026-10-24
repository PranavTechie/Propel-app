import React, { useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import type { SmartBoostAnalysis, SmartBoostResult } from "@/types";
import { PCAdvisorSection } from "@/components/ai/PCAdvisorSection";

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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-12 text-center">
      <AnimatePresence mode="wait">
        {!optimizing && !result && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center"
          >
            <h2 className="text-3xl font-black text-text-primary tracking-tight">
              Quick Boost
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
              Optimize your PC with one quick scan.
              <br />
              Safely improve system responsiveness by cleaning temporary files
              and optimizing memory.
            </p>
            <Zap className="mt-8 h-10 w-10 text-[#5AA63C]" strokeWidth={1.8} />
            <button
              onClick={analysis ? runOptimize : runAnalysis}
              disabled={analyzing}
              className={cn(
                "mt-7 inline-flex items-center gap-2 px-7 py-3 rounded-lg text-base font-bold text-white transition-all duration-200",
                analyzing
                  ? "bg-white/[0.08] text-text-muted cursor-not-allowed"
                  : "bg-[#5AA63C] hover:bg-[#4f9635] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {analyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {analyzing ? "Scanning..." : "Scan & Boost"}
            </button>
          </motion.div>
        )}

        {optimizing && (
          <motion.div
            key="optimizing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <RefreshCw className="h-8 w-8 text-[#5AA63C] animate-spin" />
            <p className="mt-4 text-base font-semibold text-text-primary">
              Optimizing your PC...
            </p>
            <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full w-1/3 rounded-full bg-[#5AA63C]"
                animate={{ x: ["-100%", "300%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  ease: "linear",
                }}
              />
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <CheckCircle
              className="h-9 w-9 text-[#5AA63C]"
              strokeWidth={1.8}
            />
            <h2 className="mt-4 text-2xl font-black text-text-primary">
              Boost Complete
            </h2>
            <div className="mt-5 space-y-1 text-sm text-text-secondary">
              <p>
                Memory recovered:{" "}
                <span className="font-semibold text-text-primary">
                  {formatBytes(result.ramFreedBytes)}
                </span>
              </p>
              <p>
                Storage cleaned:{" "}
                <span className="font-semibold text-text-primary">
                  {formatBytes(result.storageFreedBytes)}
                </span>
              </p>
              <p>
                Processes optimized:{" "}
                <span className="font-semibold text-text-primary">
                  {result.processesOptimized}
                </span>
              </p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="mt-7 rounded-lg bg-white/[0.06] px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.1]"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 max-w-md text-xs text-red-400"
          >
            {error}
          </motion.p>
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* -- Header & Tabs -- */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">
                AI Features
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Intelligent system diagnostics & Quick Boost
              </p>
            </div>
            {activeTab === "advisor" && (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/15 border border-brand-primary/25">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                <span className="text-xs font-bold text-brand-primary tracking-wider">
                  AI ADVISOR
                </span>
              </div>
            )}
          </div>

          {/* Horizontal Selector */}
          <div className="mt-6 flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border",
                    isActive
                      ? "bg-brand-primary/15 border-brand-primary/30 text-brand-primary shadow-glow-sm"
                      : "bg-white/[0.02] border-white/[0.05] text-text-muted hover:text-text-secondary hover:bg-white/[0.05]"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge && (
                    <span
                      className={cn(
                        "text-2xs font-black px-1.5 py-0.5 rounded ml-1",
                        isActive
                          ? "bg-brand-primary/20 text-brand-primary"
                          : "bg-white/10 text-text-muted"
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* -- Content -- */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto w-full">
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
