import React, { useState } from 'react';
import { Brain, Shield, AlertTriangle, AlertCircle, CheckCircle, ChevronRight, Play, Loader2, ArrowRight, Info } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface-card border border-white/[0.05]">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-brand-primary" />
            PC Advisor
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Get an AI-powered explanation of your PC's health and performance.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Explain my PC's health
        </button>
      </div>

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
        <div className="p-12 flex flex-col items-center justify-center text-center rounded-2xl bg-surface-card border border-white/[0.05]">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
            <Brain className="absolute inset-0 m-auto w-6 h-6 text-brand-primary animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">Analyzing System Diagnostics</h3>
          <p className="text-sm text-text-muted">PC Advisor is evaluating your CPU, Memory, and background processes...</p>
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
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <Brain className="w-32 h-32" />
              </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
