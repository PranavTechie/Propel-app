import React, { useState } from 'react';
import { Brain, Shield, AlertTriangle, AlertCircle, CheckCircle, ArrowRight, Info, Cpu, Activity, HardDrive, Lock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/store/settingsStore';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { formatBytes, getHealthScore } from '@/utils/format';
import { PROPEL_PRICING_URL } from '@/constants/appConstants';
import {
  getQuotaCardContent,
  cleanTechnicalError,
  isQuotaExceededError,
  parseQuotaFromErrorMessage,
  type QuotaPayload,
} from '@/utils/pcAdvisorQuota';
import { Button } from '@/components/ui/Button';
import { Card, CardEyebrow } from '@/components/ui/Card';
import { RingGauge } from '@/components/ui/RingGauge';
import { CountUp } from '@/components/ui/CountUp';
import { Progress } from '@/components/ui/Progress';
import { Callout } from '@/components/ui/Callout';
import type { Tone } from '@/theme/thresholds';

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

/** Score ring for the assessment (same 80 / 60 cut-offs as before). */
function HealthRing({ score }: { score: number }) {
  const tone: Tone = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical';
  return (
    <RingGauge value={score} tone={tone} size={104} thickness={8} aria-label={`Live health score ${score}`}>
      <CountUp value={score} className="font-display text-[28px] font-semibold leading-none text-fg-1" />
      <span className="mt-0.5 text-[10.5px] text-fg-3">of 100</span>
    </RingGauge>
  );
}

const SCOPE = [
  { label: 'CPU', icon: <Cpu className="h-4 w-4" /> },
  { label: 'Memory', icon: <Activity className="h-4 w-4" /> },
  { label: 'Disk', icon: <HardDrive className="h-4 w-4" /> },
  { label: 'Security', icon: <Shield className="h-4 w-4" /> },
];

function getFriendlyErrorMessage(code?: string, rawMsg?: string): string {
  switch (code) {
    case 'AI_TIMEOUT':
      return 'Analysis took longer than expected. Please try again.';
    case 'AI_RATE_LIMITED':
    case 'AI_COOLDOWN':
    case 'TOO_MANY_REQUESTS':
      return 'PC Advisor is experiencing high demand. Please wait a few seconds and try again.';
    case 'AI_SERVICE_BUSY':
    case 'AI_SERVICE_UNAVAILABLE':
      return 'PC Advisor is temporarily busy. Please try again in a few seconds.';
    case 'AI_INVALID_RESPONSE':
      return 'Diagnostic service returned an unexpected format. Please try again.';
    case 'DAILY_CAP_REACHED':
      return 'Daily AI diagnostic limit reached. Please try again tomorrow.';
    case 'AI_DISABLED':
      return 'PC Advisor is temporarily disabled.';
    case 'AI_NOT_CONFIGURED':
      return 'PC Advisor service is not configured.';
    default: {
      const cleaned = cleanTechnicalError(rawMsg);
      if (cleaned.toLowerCase().includes('timeout') || cleaned.toLowerCase().includes('abort')) {
        return 'Analysis took longer than expected. Please try again.';
      }
      return cleaned || 'PC Advisor is temporarily unavailable. Please try again in a few seconds.';
    }
  }
}

export const PCAdvisorSection: React.FC = () => {
  const aiAdvisorConsent = useSettingsStore(s => s.aiAdvisorConsent);
  const setAiAdvisorConsent = useSettingsStore(s => s.setAiAdvisorConsent);
  const stats = useAppStore(s => s.stats);
  const cleanerResult = useAppStore(s => s.scanResults);
  const hasScanned = useAppStore(s => s.hasScanned);
  const session = useAppStore(s => s.session);
  const entitlement = useAppStore(s => s.entitlementStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [quotaInfo, setQuotaInfo] = useState<QuotaPayload | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const setActivePage = useAppStore(s => s.setActivePage);

  // Wake up Render backend if cold (fire-and-forget)
  React.useEffect(() => {
    window.propel?.ai?.pingHealth?.();
  }, []);

  // 3-second disabled countdown on Retry button
  React.useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => {
      setRetryCountdown(c => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  const handleAnalyze = async () => {
    if (retryCountdown > 0) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setQuotaInfo(null);

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
      const token = session?.access_token || '';
      const response = await window.propel.ai.getPCAdvisorDiagnosis(payload, token);

      if (response && typeof response === 'object') {
        if (response.ok === false) {
          console.warn(`[PC Advisor] Diagnosis error received: status=${response.status ?? 'unknown'}, code=${response.code ?? response.error ?? 'unknown'}`);

          if (response.quotaExceeded) {
            setQuotaInfo({
              limit: response.limit,
              used: response.used,
              resetsAt: response.resetsAt,
              plan: response.limit === 50 ? 'MAX' : response.limit === 10 ? 'PRO' : response.limit === 1 ? 'FREE' : entitlement.plan,
            });
            return;
          }
          setError(getFriendlyErrorMessage(response.code, response.message));
          setRetryCountdown(3);
          return;
        }

        const diagnosisData = response.data ?? response;
        setResult(diagnosisData);
        return;
      }

      setResult(response);
    } catch (err: any) {
      const rawMessage = err?.message || String(err);
      console.warn(`[PC Advisor] Diagnosis exception received: ${cleanTechnicalError(rawMessage)}`);

      if (isQuotaExceededError(rawMessage)) {
        const parsed = parseQuotaFromErrorMessage(rawMessage);
        const limit = parsed.limit ?? (entitlement.plan === 'MAX' ? 50 : entitlement.plan === 'PRO' ? 10 : 1);
        setQuotaInfo({
          limit,
          resetsAt: parsed.resetsAt,
          plan: limit === 50 ? 'MAX' : limit === 10 ? 'PRO' : limit === 1 ? 'FREE' : entitlement.plan,
        });
      } else {
        setError(getFriendlyErrorMessage(undefined, rawMessage));
        setRetryCountdown(3);
      }
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-danger-soft text-danger-fg';
      case 'moderate': return 'bg-warning-soft text-warning-fg';
      case 'minor': return 'bg-success-soft text-success-fg';
      default: return 'bg-brand-soft text-brand-fg';
    }
  };

  const getCardBgColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'before:bg-[linear-gradient(90deg,transparent,rgb(var(--c-danger)/.6),transparent)]';
      case 'moderate': return 'before:bg-[linear-gradient(90deg,transparent,rgb(var(--c-warning)/.6),transparent)]';
      default: return '';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-danger text-danger-fg';
    if (priority === 2) return 'bg-warning text-warning-fg';
    return 'bg-brand text-brand-fg';
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return <AlertCircle className="h-5 w-5" />;
      case 'moderate': return <AlertTriangle className="h-5 w-5" />;
      case 'minor': return <CheckCircle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getRouteForMetric = (metric: string | undefined): any => {
    if (!metric) return null;
    const text = metric.toLowerCase();
    
    if (text.includes('duplicate')) return 'duplicates';
    if (text.includes('startup')) return 'startup';
    if (text.includes('memory') || text.includes('ram')) return 'memory';
    if (text.includes('disk') || text.includes('storage') || text.includes('junk') || text.includes('clean') || text.includes('temp')) return 'cleaner';
    if (text.includes('process') || text.includes('cpu')) return 'performance';
    
    return null;
  };

  if (!aiAdvisorConsent) {
    return (
      <Card level="feature" className="mt-2 px-8 py-12">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-card bg-brand-soft text-brand-fg shadow-[var(--highlight-top)]">
            <Brain className="h-7 w-7" />
          </span>
          <h2 className="mt-5 font-display text-[24px] font-semibold leading-[30px] tracking-[-.025em] text-fg-1">
            Welcome to PC Advisor
          </h2>
          <p className="mt-3 text-body text-fg-2">
            PC Advisor uses Google Gemini to analyze your system's health metrics and provide
            prioritized, plain-language recommendations.
          </p>
          <div className="mt-4 flex items-start gap-2.5 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-3 text-left">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" />
            <p className="text-body-sm text-fg-2">
              We only send aggregate system diagnostics (like CPU usage, memory stats, and top
              processes). Personal files, file paths, and file contents are{' '}
              <strong className="font-semibold text-fg-1">never</strong> sent.
            </p>
          </div>
          <Button size="lg" className="mt-6" onClick={() => setAiAdvisorConsent(true)}>
            Allow & Continue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div>
        <h2 className="flex items-center gap-2 text-title font-semibold text-fg-1">
          <Brain className="h-4 w-4 text-brand" />
          PC Advisor
        </h2>
        <p className="mt-0.5 max-w-2xl text-body-sm text-fg-3">
          Analyzes your current system metrics and explains important health and performance issues.
        </p>
      </div>

      {/* Quota notice */}
      <AnimatePresence>
        {quotaInfo && !loading && !result && (
          <motion.div
            key="quota-notice"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {(() => {
              const card = getQuotaCardContent(quotaInfo, entitlement.plan);
              return (
                <Callout
                  tone="info"
                  title={card.heading}
                  action={
                    card.showCta && card.ctaText ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        iconRight={<ArrowRight />}
                        onClick={() => window.electronAPI?.shell?.openExternal(PROPEL_PRICING_URL)}
                      >
                        {card.ctaText}
                      </Button>
                    ) : undefined
                  }
                >
                  {card.message} <span className="text-fg-3">{card.supportingText}</span>
                </Callout>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial state */}
      {!result && !loading && !error && !quotaInfo && (
        <motion.div
          key="hero"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Card level="feature" className="p-6">
            <CardEyebrow>Diagnostic Scope</CardEyebrow>
            <div className="mt-3 grid grid-cols-4 gap-3 max-[760px]:grid-cols-2">
              {SCOPE.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-control border border-line-subtle bg-surface-inset px-3.5 py-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-surface-raised text-fg-2 shadow-[var(--shadow-1)]">
                    {s.icon}
                  </span>
                  <span className="text-body font-semibold text-fg-1">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col items-center border-t border-line-subtle pt-6">
              <Button size="lg" onClick={handleAnalyze} iconRight={<ArrowRight />}>
                Explain my PC's health
              </Button>
              <p className="mt-3 flex items-center gap-1.5 text-caption text-fg-3">
                <Lock className="h-3 w-3" />
                Uses your current system metrics • No files or personal content
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Error state */}
      <AnimatePresence>
        {error && !quotaInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Callout
              tone="danger"
              title={error}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={retryCountdown > 0 || loading}
                >
                  {retryCountdown > 0 ? `Retry in ${retryCountdown}s` : 'Retry'}
                </Button>
              }
            >
              {retryCountdown > 0 ? 'Please wait a moment before trying again.' : undefined}
            </Callout>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && !result && (
        <Card level="feature" className="px-8 py-12" role="status">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="relative h-16 w-16">
              <span className="absolute inset-0 rounded-full border-[3px] border-brand/15" />
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
              <Brain className="absolute inset-0 m-auto h-6 w-6 text-brand" />
            </div>
            <h3 className="mt-6 text-title font-semibold text-fg-1">Analyzing System Diagnostics...</h3>
            <p className="mt-1.5 text-body text-fg-2">
              PC Advisor is evaluating your CPU, Memory, Disk, and background processes using AI.
            </p>
            <Progress value={null} indeterminate className="mt-6 max-w-[220px]" aria-label="Analyzing" />
          </div>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-4"
          >
            <Card level="feature" className={cn('p-6', getCardBgColor(result.healthImpact))}>
              <Sparkles className="pointer-events-none absolute right-5 top-5 h-4 w-4 text-fg-4" />
              <div className="flex items-start gap-6 max-[760px]:flex-col max-[760px]:items-center">
                <div className="shrink-0">
                  <HealthRing score={stats ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent) : 0} />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-control', getImpactColor(result.healthImpact))}>
                      {getImpactIcon(result.healthImpact)}
                    </span>
                    <CardEyebrow>Overall Assessment</CardEyebrow>
                  </div>
                  <p className="text-[15px] font-medium leading-6 text-fg-1">{result.overallAssessment}</p>
                </div>
              </div>
            </Card>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-title font-semibold text-fg-1">
                <Brain className="h-4 w-4 text-brand" /> Prioritized Action Plan
              </h3>
              <div className="space-y-3">
                {result.actions.map((action, idx) => {
                  const pc = getPriorityColor(action.priority).split(' ');
                  const route = getRouteForMetric(action.relatedMetric);
                  return (
                    <Card key={idx} className="flex gap-4 overflow-hidden p-5">
                      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', pc[0])} />
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-inset font-display text-title font-semibold tabular',
                          pc[1],
                        )}
                      >
                        {action.priority || idx + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h4 className="text-body font-semibold text-fg-1">{action.title}</h4>
                        <p className="mt-1 text-body-sm text-fg-2">{action.detail}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          {action.relatedMetric ? (
                            <span className="rounded-full border border-line-subtle bg-surface-inset px-2.5 py-0.5 text-caption font-medium text-fg-3">
                              {action.relatedMetric}
                            </span>
                          ) : (
                            <span />
                          )}
                          {route && (
                            <Button
                              variant="secondary"
                              size="sm"
                              iconRight={<ArrowRight />}
                              onClick={() => setActivePage(route)}
                            >
                              Resolve Issue
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => setResult(null)}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
