import React, { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Trash2,
  MemoryStick,
  Bot,
  Activity,
  Settings,
  Info,
  Shield,
  ChevronRight,
  Brain,
  ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useSettingsStore, ACCENT_TW } from '@/store/settingsStore'
import { cn } from '@/utils/cn'
import { getHealthScore } from '@/utils/format'
import type { NavPage } from '@/types'

interface NavItem {
  id: NavPage
  label: string
  icon: React.ReactNode
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',       icon: <LayoutDashboard className="w-4 h-4" />, description: 'System overview' },
  { id: 'systemcheck', label: 'System Check',     icon: <Shield className="w-4 h-4" />,          description: 'Full diagnostics' },
  { id: 'cleaner',     label: 'Cleaner',           icon: <Trash2 className="w-4 h-4" />,          description: 'Scan & clean junk' },
  { id: 'memory',      label: 'Memory',            icon: <MemoryStick className="w-4 h-4" />,     description: 'Optimize RAM usage' },
  { id: 'maintenance', label: 'Smart Maintenance', icon: <Bot className="w-4 h-4" />,             description: 'Automation & scheduling' },
  { id: 'performance', label: 'Performance',       icon: <Activity className="w-4 h-4" />,        description: 'Live system stats' },
  { id: 'permissions', label: 'Permissions',       icon: <ShieldCheck className="w-4 h-4" />,    description: 'Privacy & security monitor' },
  { id: 'ai',          label: 'AI Features',       icon: <Brain className="w-4 h-4" />,           description: 'Intelligent optimization' },
  { id: 'settings',    label: 'Settings',          icon: <Settings className="w-4 h-4" />,        description: 'App configuration' },
  { id: 'about',       label: 'About',             icon: <Info className="w-4 h-4" />,            description: 'App info & license' },
]

// Isolated health dot — only rerenders when health category changes (not every stat tick)
const HealthDot = memo(() => {
  const cpu  = useAppStore(s => s.stats?.cpu ?? 0)
  const ram  = useAppStore(s => s.stats?.ram.percent ?? 0)
  const disk = useAppStore(s => s.stats?.disk.percent ?? 0)
  const hasStats = useAppStore(s => s.stats !== null)

  const score = hasStats ? getHealthScore(cpu, ram, disk) : null
  const dot =
    score === null    ? 'bg-text-muted/20'
    : score >= 75     ? 'bg-emerald-400'
    : score >= 45     ? 'bg-amber-400'
    : 'bg-red-400'

  if (score === null) return null
  return (
    <div
      className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)}
      title={`System health: ${score}/100`}
    />
  )
})
HealthDot.displayName = 'HealthDot'

const LicenseBadge = memo(() => {
  const entitlement = useAppStore(s => s.entitlementStatus)
  const session = useAppStore(s => s.session)

  return (
    <div className="px-3 pb-4 shrink-0">
      <div className="glass rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            entitlement.plan === 'MAX' ? 'bg-purple-400'
            : entitlement.plan === 'PRO' && !entitlement.trial_active ? 'bg-emerald-400'
            : entitlement.trial_active ? 'bg-amber-400'
            : 'bg-text-muted/30',
          )} />
          <Shield className="w-3.5 h-3.5 text-text-muted/60 shrink-0" />
          <div className="flex-1 min-w-0">
            {entitlement.trial_active && (
              <p className="text-2xs text-amber-400 font-semibold truncate">
                PRO Trial Active
              </p>
            )}
            {entitlement.plan === 'PRO' && !entitlement.trial_active && (
              <p className="text-2xs text-emerald-400 font-semibold">PRO Active</p>
            )}
            {entitlement.plan === 'MAX' && (
              <p className="text-2xs text-purple-400 font-semibold">MAX Active</p>
            )}
            {entitlement.plan === 'FREE' && (
              <p className="text-2xs text-text-muted font-semibold">FREE Plan</p>
            )}
          </div>
        </div>
        {session?.user?.email && (
          <p className="text-2xs text-text-muted/60 mt-1 truncate">
            {session.user.email}
          </p>
        )}
      </div>
      <p className="text-2xs text-text-muted/40 text-center mt-2">v3.2.0</p>
    </div>
  )
})
LicenseBadge.displayName = 'LicenseBadge'

export const Sidebar = memo(() => {
  const activePage    = useAppStore(s => s.activePage)
  const setActivePage = useAppStore(s => s.setActivePage)
  const accent        = useSettingsStore(s => ACCENT_TW[s.accentColor])

  const navItems = useMemo(() => NAV_ITEMS, [])

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-full border-r border-border/50 bg-bg-base/60 backdrop-blur-[8px] gpu-layer">
      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Section header */}
        <div className="flex items-center gap-2 px-3 mb-3">
          <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest flex-1">
            Navigation
          </p>
          <HealthDot />
        </div>

        {navItems.map(item => {
          const isActive = activePage === item.id
          return (
            <motion.button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className={cn(
                'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                'transition-colors duration-150 group',
                isActive
                  ? accent.active
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className={cn('absolute inset-0 rounded-xl border', accent.indicator)}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className={cn('relative z-10 shrink-0', isActive ? accent.icon : 'text-text-muted group-hover:text-text-secondary')}>
                {item.icon}
              </span>
              <span className="relative z-10 text-sm font-medium flex-1 text-left">{item.label}</span>
              {isActive && (
                <ChevronRight className={cn('relative z-10 w-3 h-3 ml-auto shrink-0', accent.chevron)} />
              )}
            </motion.button>
          )
        })}
      </nav>

      <LicenseBadge />
    </aside>
  )
})

Sidebar.displayName = 'Sidebar'
