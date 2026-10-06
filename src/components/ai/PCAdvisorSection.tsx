import React, { useState } from 'react';
import { Brain, Shield, AlertTriangle, AlertCircle, CheckCircle, ChevronRight, Play, Loader2, ArrowRight, Info, Cpu, Activity, HardDrive, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { formatBytes, getHealthScore } from '@/utils/format';

interface Action {
  priority: number;
  title: string;
  detail: string;
  relatedMetric: string;
}

interface DiagnosisResult {
  overallAssessment: string;
  healthImpact: 'critical' | 'moderate' | 'minor';
  actions: Action[];
}

export const PCAdvisorSection: React.FC = () => {
  const aiAdvisorConsent = useSettingsStore(s => s.aiAdvisorConsent);
  const setAiAdvisorConsent = useSettingsStore(s => s.setAiAdvisorConsent);
  const stats = useAppStore(s => s.stats);
  const cleanerResult = useAppStore(s => s.scanResults);
  const hasScanned = useAppStore(s => s.hasScanned);
  const session = useAppStore(s => s.session);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const setActivePage = useAppStore(s => s.setActivePage);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    if (!stats) {
      setError('System diagnostics are currently unavailable.');
      setLoading(false);
      return;
    }

    const payload = {
      cpuUsage: stats.cpu,
      memoryUsagePercent: (stats.ram.used / stats.ram.total) * 100,
      memoryUsedGB: stats.ram.used / (1024 ** 3),
      memoryTotalGB: stats.ram.total / (1024 ** 3),
      diskUsagePercent: stats.disk.percent,
      processCount: stats.processes,
      junkSizeCachedBytes: cleanerResult ? cleanerResult.reduce((acc: number, curr: any) => acc + curr.totalSize, 0) : null,
      hasScanned,
      healthScore: getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent),
      uptimeSeconds: stats.uptime
    };

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com';

      const res = await fetch(`${API_URL}/api/ai/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include auth headers if existing system uses them
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Unable to reach PC Advisor right now. Check your connection and try again.');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'moderate': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'minor': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'moderate': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'minor': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getRouteForMetric = (metric: string | undefined): any => {
    if (!metric) return null;
    const text = metric.toLowerCase();
    
    if (text.includes('memory') || text.includes('ram')) return 'memory';
    if (text.includes('disk') || text.includes('storage') || text.includes('junk') || text.includes('clean') || text.includes('temp')) return 'cleaner';
    if (text.includes('startup')) return 'maintenance';
    if (text.includes('process') || text.includes('cpu')) return 'performance';
    
    return null;
  };

  if (!aiAdvisorConsent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-6">
          <Brain className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-black text-text-primary mb-3">Welcome to PC Advisor</h2>
        <p className="text-text-secondary max-w-md mb-8">
          PC Advisor uses Google Gemini to analyze your system's health metrics and provide prioritized, plain-language recommendations.
          <br /><br />
          We only send aggregate system diagnostics (like CPU usage, memory stats, and top processes). Personal files, file paths, and file contents are <strong>never</strong> sent.
        </p>
        <button
          onClick={() => setAiAdvisorConsent(true)}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl shadow-glow-md transition-all"
        >
          Allow & Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Persistent Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-black text-text-primary flex items-center gap-2">
          <Brain className="w-6 h-6 text-brand-primary" />
          PC Advisor
        </h2>
        <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
          Analyzes your current system metrics and explains important health and performance issues.
        </p>
      </div>

      {/* Initial / Empty State */}
      {!result && !loading && !error && (
        <motion.div
          key="hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-6 md:p-8 rounded-2xl bg-surface-card border border-white/[0.05]"
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-5">
            Diagnostic Scope
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {/* CPU */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-text-secondary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">CPU</span>
            </div>
            {/* Memory */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-text-secondary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Memory</span>
            </div>
            {/* Disk */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4 text-text-secondary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Disk</span>
            </div>
            {/* Security */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-text-secondary" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Security</span>
            </div>
          </div>

          <div className="flex flex-col items-center pt-8 border-t border-white/[0.05]">
            <button
              onClick={handleAnalyze}
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold transition-all hover:-translate-y-0.5 shadow-glow-sm"
            >
              Explain my PC's health <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <p className="mt-4 text-[11px] text-text-muted/60 flex items-center gap-1.5">
              <Lock className="w-3 h-3 opacity-70" />
              Uses your current system metrics • No files or personal content
            </p>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={handleAnalyze} className="ml-auto text-xs font-bold underline hover:text-red-300">
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && !result && (
        <div className="p-12 md:p-16 mt-4 flex flex-col items-center justify-center text-center rounded-3xl bg-brand-primary/[0.02] border border-brand-primary/[0.1] relative overflow-hidden shadow-[0_8px_32px_-12px_rgba(90,166,60,0.1)]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-primary/10 rounded-full blur-[80px] pointer-events-none animate-pulse" />
          
          <div className="relative z-10 w-20 h-20 mb-8">
            <div className="absolute inset-0 rounded-full border-[3px] border-brand-primary/10" />
            <div className="absolute inset-0 rounded-full border-[3px] border-brand-primary border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-[2px] border-brand-primary/40 border-r-transparent border-l-transparent animate-[spin_2s_linear_reverse_infinite]" />
            <Brain className="absolute inset-0 m-auto w-8 h-8 text-brand-primary animate-pulse" />
          </div>
          <h3 className="relative z-10 text-xl font-black text-text-primary mb-3">Analyzing System Diagnostics...</h3>
          <p className="relative z-10 text-base text-text-secondary max-w-md">
            PC Advisor is evaluating your CPU, Memory, Disk, and background processes using AI.
          </p>
        </div>
      )}

      {/* Results State */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Overall Assessment */}
            <div className="p-6 rounded-2xl bg-surface-card border border-white/[0.05] relative overflow-hidden">
              <div className="flex items-start gap-4 relative z-10">
                <div className={cn("p-3 rounded-xl border", getImpactColor(result.healthImpact))}>
                  {getImpactIcon(result.healthImpact)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Overall Assessment</h3>
                  <p className="text-lg text-text-primary leading-relaxed">
                    {result.overallAssessment}
                  </p>
                </div>
              </div>
            </div>

            {/* Prioritized Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider pl-2">Prioritized Action Plan</h3>
              {result.actions.map((action, idx) => (
                <div key={idx} className="flex gap-4 p-5 rounded-2xl bg-surface-card border border-white/[0.02] hover:border-white/[0.08] transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center font-black text-text-secondary group-hover:text-brand-primary transition-colors">
                    {action.priority || idx + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-text-primary mb-1">{action.title}</h4>
                    <p className="text-sm text-text-secondary mb-3">{action.detail}</p>
                    {action.relatedMetric && (
                      <div className="inline-block px-2.5 py-1 rounded-lg bg-white/[0.04] text-xs font-medium text-text-muted mb-4">
                        Metric: {action.relatedMetric}
                      </div>
                    )}
                    {getRouteForMetric(action.relatedMetric) && (
                      <div>
                        <button 
                          onClick={() => setActivePage(getRouteForMetric(action.relatedMetric))}
                          className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:text-brand-secondary transition-colors"
                        >
                          Resolve Issue <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setResult(null)}
                className="rounded-lg bg-white/[0.06] px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.1]"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
