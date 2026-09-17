import React, { useEffect, useRef, memo } from 'react'
import { motion, animate } from 'framer-motion'
import { cn } from '@/utils/cn'
import { staggerItem } from '@/animations/variants'

// Animated numeric value — smoothly counts to target
function useAnimatedValue(target: number, duration = 0.6): number {
  const [display, setDisplay] = React.useState(target)
  const prevRef = useRef(target)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = target
    if (from === target) return
    const ctrl = animate(from, target, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: v => setDisplay(Math.round(v * 10) / 10),
    })
    return ctrl.stop
  }, [target, duration])

  return display
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  percent?: number
  color?: 'blue' | 'purple' | 'emerald' | 'orange' | 'red'
  trend?: 'up' | 'down' | 'stable'
  className?: string
}

const colorMap = {
  blue: {
    bar: 'from-brand-accent to-brand-primary',
    icon: 'bg-brand-accent/10 text-brand-accent',
    glow: 'hover:shadow-glow-blue',
  },
  purple: {
    bar: 'from-brand-primary to-brand-secondary',
    icon: 'bg-brand-primary/10 text-brand-primary',
    glow: 'hover:shadow-glow-sm',
  },
  emerald: {
    bar: 'from-emerald-500 to-teal-400',
    icon: 'bg-emerald-500/10 text-emerald-400',
    glow: '',
  },
  orange: {
    bar: 'from-orange-500 to-amber-400',
    icon: 'bg-orange-500/10 text-orange-400',
    glow: '',
  },
  red: {
    bar: 'from-red-500 to-rose-400',
    icon: 'bg-red-500/10 text-red-400',
    glow: '',
  },
}

export const StatCard = memo<StatCardProps>(function StatCard({
  title,
  value,
  subtitle,
  icon,
  percent,
  color = 'blue',
  className,
}) {
  const colors = colorMap[color]
  const safePercent = Math.min(100, Math.max(0, percent ?? 0))
  // Animate the percentage bar smoothly
  const animPercent = useAnimatedValue(safePercent)

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        'glass glass-hover rounded-2xl p-5 cursor-default gpu-layer',
        colors.glow,
        className,
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-xl shrink-0', colors.icon)}>
            <span className="block w-5 h-5">{icon}</span>
          </div>
        )}
      </div>

      {percent !== undefined && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">Usage</span>
            <span className="text-xs font-semibold text-text-secondary tabular-nums">{Math.round(animPercent)}%</span>
          </div>
          <div className="stat-bar">
            <div
              className={cn('stat-bar-fill bg-gradient-to-r', colors.bar)}
              style={{ width: `${animPercent}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
})
