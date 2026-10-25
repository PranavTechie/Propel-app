import React, { useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Cpu, MemoryStick, HardDrive, Activity, Wifi, ArrowRight, Zap,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { useGatedStore } from '@/components/ui/hooks/useGatedStore'
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
  badge: string
}> = {
  critical: {
    bar:   'bg-danger',
    icon:  'bg-danger-soft text-danger-fg',
    badge: 'bg-danger-soft text-danger-fg',
  },
  warning: {
    bar:   'bg-warning',
    icon:  'bg-warning-soft text-warning-fg',
    badge: 'bg-warning-soft text-warning-fg',
  },
  info: {
    bar:   'bg-fg-4',
    icon:  'bg-info-soft text-info-fg',
    badge: 'bg-info-soft text-info-fg',
  },
  ok: {
    bar:   'bg-success',
    icon:  'bg-success-soft text-success-fg',
    badge: 'bg-success-soft text-success-fg',
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
      action: { label: 'View Performance', page: 'performance' },
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
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1], delay: index * 0.04 }}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-card border border-line bg-surface-raised py-3 pl-4 pr-3 shadow-[var(--shadow-1),var(--highlight-top)]"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', cfg.bar)} />

      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-control', cfg.icon)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-body font-semibold text-fg-1">{insight.title}</p>
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none', cfg.badge)}>
            {SEV_LABEL[insight.severity]}
          </span>
        </div>
        <p className="mt-0.5 text-body-sm text-fg-3">{insight.description}</p>
      </div>

      {insight.action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAction(insight.action!.page)}
          iconRight={<ArrowRight />}
          className="shrink-0"
        >
          {insight.action.label}
        </Button>
      )}
    </motion.div>
  )
})

InsightCard.displayName = 'InsightCard'

// ── Main panel ─────────────────────────────────────────────────────────────

export const InsightsPanel = memo(() => {
  const stats = useGatedStore(s => s.stats)
  const setActivePage = useAppStore(s => s.setActivePage)

  const insights = useMemo(() => deriveInsights(stats), [stats])

  if (!stats) {
    return (
      <div className="grid gap-2" role="status" aria-label="Loading insights">
        <SkeletonRow className="rounded-card border border-line-subtle bg-surface-raised" />
        <SkeletonRow className="rounded-card border border-line-subtle bg-surface-raised" />
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {insights.length === 0 ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-3.5 overflow-hidden rounded-card border border-line bg-surface-raised py-3 pl-4 pr-3 shadow-[var(--shadow-1),var(--highlight-top)]"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-success" />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-success-soft text-success-fg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-body font-semibold text-fg-1">System Healthy</p>
              <p className="text-body-sm text-fg-3">All metrics are within normal range.</p>
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
