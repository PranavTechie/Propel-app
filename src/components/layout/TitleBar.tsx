import React, { memo } from 'react'
import { Minus, Square, X, Shield } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/utils/cn'

// ── Live stat pill ─────────────────────────────────────────────────────────

const StatPill = memo<{ label: string; value: string; warn: boolean }>(({ label, value, warn }) => (
  <div className={cn(
    'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium tabular-nums',
    warn
      ? 'text-amber-400 bg-amber-400/10'
      : 'text-text-muted bg-white/[0.04]',
  )}>
    <span className="text-text-muted/60">{label}</span>
    <span>{value}</span>
  </div>
))
StatPill.displayName = 'StatPill'

export const TitleBar: React.FC = () => {
  const entitlement = useAppStore(s => s.entitlementStatus)
  const stats = useAppStore(s => s.stats)

  const handleMinimize = () => window.electronAPI?.window.minimize()
  const handleMaximize = () => window.electronAPI?.window.maximize()
  const handleClose = () => window.electronAPI?.window.close()

  const badgeText = 
    entitlement.plan === 'PRO' || entitlement.plan === 'MAX'
      ? entitlement.trial_active 
        ? `Trial · PRO`
        : entitlement.plan
      : null

  const badgeColor =
    entitlement.trial_active
      ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
      : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'

  return (
    <div
      className={cn(
        'drag-region flex items-center justify-between h-10 px-4',
        'border-b border-border/50',
        'bg-bg-base/80 backdrop-blur-xl',
        'shrink-0',
      )}
    >
      {/* Left: Logo + license */}
      <div className="no-drag flex items-center gap-2.5">
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-brand rounded-lg opacity-20 blur-sm" />
          <Shield className="w-4 h-4 text-brand-primary relative z-10" />
        </div>
        <span className="text-sm font-semibold text-text-primary">Propel</span>
        {badgeText && (
          <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full border', badgeColor)}>
            {badgeText}
          </span>
        )}
      </div>

      {/* Center: Live stats (drag region passes through) */}
      <div className="no-drag flex items-center gap-1.5">
        {stats && (
          <>
            <StatPill label="CPU" value={`${Math.round(stats.cpu)}%`} warn={stats.cpu >= 75} />
            <StatPill label="RAM" value={`${Math.round(stats.ram.percent)}%`} warn={stats.ram.percent >= 80} />
            <StatPill label="Disk" value={`${Math.round(stats.disk.percent)}%`} warn={stats.disk.percent >= 85} />
          </>
        )}
      </div>

      {/* Right: Window Controls */}
      <div className="no-drag flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
