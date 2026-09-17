import React, { useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  Cpu, MemoryStick, HardDrive, Activity, Wifi, ArrowRight, Zap,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'
import type { NavPage, SystemStats } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info' | 'ok'

interface Insight {
  id: string
  severity: Severity
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; page: NavPage }
}

// ── Config ─────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, {
  bar: string
  icon: string
  bg: string
  border: string
  badge: string
}> = {
  critical: {
    bar:    'bg-red-500',
    icon:   'text-red-400',
    bg:     'bg-red-500/[0.06]',
    border: 'border-red-500/20',
    badge:  'bg-red-500/15 text-red-400 border-red-500/25',
  },
  warning: {
    bar:    'bg-amber-500',
    icon:   'text-amber-400',
    bg:     'bg-amber-500/[0.06]',
    border: 'border-amber-500/20',
    badge:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  },
  info: {
    bar:    'bg-blue-500',
    icon:   'text-blue-400',
    bg:     'bg-blue-500/[0.04]',
    border: 'border-blue-500/15',
    badge:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
  },
  ok: {
    bar:    'bg-emerald-500',
    icon:   'text-emerald-400',
    bg:     'bg-emerald-500/[0.04]',
    border: 'border-emerald-500/15',
    badge:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  },
}

const SEV_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning:  'Warning',
  info:     'Info',
  ok:       'Good',
}

// ── Insight derivation from real stats ────────────────────────────────────

function deriveInsights(stats: SystemStats | null): Insight[] {
  if (!stats) return []

  const insights: Insight[] = []

  // ── CPU ──
  if (stats.cpu >= 85) {
    insights.push({
      id: 'cpu-critical',
      severity: 'critical',
      icon: Cpu,
      title: 'CPU Overloaded',
      description: `Processor at ${Math.round(stats.cpu)}% — close background apps to restore performance.`,
      action: { label: 'View Performance', page: 'performance' },
    })
  } else if (stats.cpu >= 65) {
    insights.push({
      id: 'cpu-warning',
      severity: 'warning',
      icon: Cpu,
      title: 'High CPU Usage',
      description: `Processor running at ${Math.round(stats.cpu)}% — some background tasks are intensive.`,
      action: { label: 'View Performance', page: 'performance' },
    })
  }

  // ── RAM ──
  if (stats.ram.percent >= 88) {
    insights.push({
      id: 'ram-critical',
      severity: 'critical',
      icon: MemoryStick,
      title: 'Memory Pressure',
      description: `${formatBytes(stats.ram.used)} of ${formatBytes(stats.ram.total)} in use (${Math.round(stats.ram.percent)}%). System may slow down.`,
      action: { label: 'Optimize Memory', page: 'memory' },
    })
  } else if (stats.ram.percent >= 72) {
    insights.push({
      id: 'ram-warning',
      severity: 'warning',
      icon: MemoryStick,
      title: 'Memory Running Low',
      description: `${formatBytes(stats.ram.free)} free of ${formatBytes(stats.ram.total)} total RAM.`,
      action: { label: 'Free Up Memory', page: 'memory' },
    })
  }

  // ── Disk ──
  if (stats.disk.percent >= 90) {
    insights.push({
      id: 'disk-critical',
      severity: 'critical',
      icon: HardDrive,
      title: 'Disk Space Critical',
      description: `Only ${formatBytes(stats.disk.free)} remaining on disk. Clean up files now.`,
      action: { label: 'Run Cleaner', page: 'cleaner' },
    })
  } else if (stats.disk.percent >= 75) {
    insights.push({
      id: 'disk-warning',
      severity: 'warning',
      icon: HardDrive,
      title: 'Disk Space Low',
      description: `${formatBytes(stats.disk.free)} free — ${Math.round(100 - stats.disk.percent)}% available. Consider cleaning junk files.`,
      action: { label: 'Clean Disk', page: 'cleaner' },
    })
  }

  // ── Processes ──
  if (stats.processes >= 280) {
    insights.push({
      id: 'procs-warning',
      severity: 'warning',
      icon: Activity,
      title: 'Too Many Processes',
      description: `${stats.processes} active processes detected. Excess background tasks may be slowing your system.`,
      action: { label: 'View Performance', page: 'performance' },
    })
  }

  // ── Network ──
  if (stats.network.download >= 50) {
    insights.push({
      id: 'net-info',
      severity: 'info',
      icon: Wifi,
      title: 'High Network Activity',
      description: `Downloading at ${stats.network.download.toFixed(1)} Mbps. A background app may be using bandwidth.`,
      action: { label: 'Check Permissions', page: 'permissions' },
    })
  }

  // ── Uptime ──
  const uptimeDays = stats.uptime / 86400
  if (uptimeDays >= 7) {
    insights.push({
      id: 'uptime-info',
      severity: 'info',
      icon: Zap,
      title: 'Long Uptime Detected',
      description: `System has been running for ${Math.floor(uptimeDays)} days. A restart may improve performance.`,
    })
  }

  return insights
}

// ── Insight Card ───────────────────────────────────────────────────────────

const InsightCard = memo<{
  insight: Insight
  index: number
  onAction: (page: NavPage) => void
}>(({ insight, index, onAction }) => {
  const cfg = SEV_CONFIG[insight.severity]
  const Icon = insight.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        'relative flex items-start gap-3.5 px-4 py-3.5 rounded-2xl border overflow-hidden',
        cfg.bg, cfg.border,
      )}
    >
      {/* Left severity bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-0.5', cfg.bar)} />

      {/* Icon */}
      <div className={cn('shrink-0 mt-0.5', cfg.icon)}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-semibold text-text-primary">{insight.title}</p>
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
            cfg.badge
          )}>
            {SEV_LABEL[insight.severity]}
          </span>
        </div>
        <p className="text-[11px] text-text-muted leading-relaxed">{insight.description}</p>
      </div>

      {/* Action */}
      {insight.action && (
        <button
          onClick={() => onAction(insight.action!.page)}
          className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-secondary transition-colors mt-0.5 whitespace-nowrap"
        >
          {insight.action.label}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  )
})

InsightCard.displayName = 'InsightCard'

// ── Main panel ─────────────────────────────────────────────────────────────

export const InsightsPanel = memo(() => {
  const stats = useAppStore(s => s.stats)
  const setActivePage = useAppStore(s => s.setActivePage)

  const insights = useMemo(() => deriveInsights(stats), [stats])

  if (!stats) return null

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {insights.length === 0 ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-emerald-500/[0.04] border-emerald-500/15"
          >
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 rounded-full" />
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-text-primary">System Healthy</p>
              <p className="text-[11px] text-text-muted">All metrics are within normal range.</p>
            </div>
          </motion.div>
        ) : (
          insights.map((insight, i) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              index={i}
              onAction={setActivePage}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  )
})

InsightsPanel.displayName = 'InsightsPanel'
