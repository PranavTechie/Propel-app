import React, { useState, useEffect, memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Cpu, MemoryStick, HardDrive, Wifi, Zap, Trash2, Activity, Shield, Lightbulb } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { StatCard } from '@/components/common/StatCard'
import { LiveChart } from '@/components/charts/LiveChart'
import { MotionCard, CardHeader, CardContent, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InsightsPanel } from '@/components/common/InsightsPanel'
import { staggerContainer, staggerItem } from '@/animations/variants'
import { formatBytes, formatMbps, formatUptime, getHealthScore, getHealthLabel } from '@/utils/format'

// ── Live clock ────────────────────────────────────────────────────────────

const LiveClock = memo(() => {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="tabular-nums text-text-muted text-xs">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
})
LiveClock.displayName = 'LiveClock'

export const Dashboard = memo(function Dashboard() {
  const stats = useAppStore(s => s.stats)
  const chartData = useAppStore(s => s.chartData)
  const setActivePage = useAppStore(s => s.setActivePage)
  const entitlementStatus = useAppStore(s => s.entitlementStatus)

  const healthScore = stats
    ? getHealthScore(stats.cpu, stats.ram.percent, stats.disk.percent)
    : 0
  const { label: healthLabel, color: healthColor } = getHealthLabel(healthScore)

  const quickActions = useMemo(() => [
    { label: 'Deep Clean',   desc: 'Scan & remove junk',   icon: <Trash2 className="w-4 h-4" />,   page: 'cleaner' as const,     color: 'from-brand-primary to-brand-secondary' },
    { label: 'Performance',  desc: 'View live stats',       icon: <Activity className="w-4 h-4" />, page: 'performance' as const, color: 'from-brand-accent to-brand-primary'   },
    { label: 'Manage Account', desc: 'Subscription details',     icon: <Shield className="w-4 h-4" />,   page: 'settings' as const,       color: 'from-emerald-500 to-teal-500'  },
  ], [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-text-primary">System Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-text-secondary">
              {stats ? `${stats.cpuModel} · ${stats.cpuCores} cores` : 'Loading system info...'}
            </p>
            <span className="text-text-muted/30 select-none">·</span>
            <LiveClock />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="glass rounded-xl px-4 py-2 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: healthColor }} />
              <span className="text-sm font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
              <span className="text-xs text-text-muted">{healthScore}/100</span>
            </motion.div>
          )}
          <Button variant="primary" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setActivePage('cleaner')}>
            Quick Clean
          </Button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-4 gap-4"
      >
        <StatCard
          title="CPU Usage"
          value={stats ? `${Math.round(stats.cpu)}%` : '—'}
          subtitle={stats ? `${stats.cpuSpeed.toFixed(1)} GHz` : undefined}
          icon={<Cpu className="w-full h-full" />}
          percent={stats?.cpu}
          color="purple"
        />
        <StatCard
          title="Memory"
          value={stats ? `${Math.round(stats.ram.percent)}%` : '—'}
          subtitle={stats ? `${formatBytes(stats.ram.used)} / ${formatBytes(stats.ram.total)}` : undefined}
          icon={<MemoryStick className="w-full h-full" />}
          percent={stats?.ram.percent}
          color="blue"
        />
        <StatCard
          title="Disk Usage"
          value={stats ? `${Math.round(stats.disk.percent)}%` : '—'}
          subtitle={stats ? `${formatBytes(stats.disk.free)} free` : undefined}
          icon={<HardDrive className="w-full h-full" />}
          percent={stats?.disk.percent}
          color="emerald"
        />
        <StatCard
          title="Network"
          value={stats ? formatMbps(stats.network.download) : '—'}
          subtitle={stats ? `↑ ${formatMbps(stats.network.upload)}` : undefined}
          icon={<Wifi className="w-full h-full" />}
          color="orange"
        />
      </motion.div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <MotionCard
          variants={staggerItem}
          initial="initial"
          animate="animate"
          className="col-span-2"
        >
          <CardHeader>
            <CardTitle>Live Performance</CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-brand-primary inline-block" />CPU
              <span className="w-2 h-2 rounded-full bg-brand-accent inline-block ml-2" />RAM
            </div>
          </CardHeader>
          <CardContent>
            <LiveChart data={chartData} height={180} />
          </CardContent>
        </MotionCard>

        <MotionCard
          variants={staggerItem}
          initial="initial"
          animate="animate"
        >
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {quickActions.map(item => (
              <motion.button
                key={item.label}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActivePage(item.page)}
                className="w-full flex items-center gap-3 p-3 rounded-xl glass-hover text-left group"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white shrink-0`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-muted">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </CardContent>
        </MotionCard>
      </div>

      {/* System Info row — plain divs, no motion needed here */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: 'Uptime',
            value: stats ? formatUptime(stats.uptime) : '—',
            icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
          },
          {
            title: 'Processes',
            value: stats ? stats.processes.toString() : '—',
            icon: <Activity className="w-3.5 h-3.5 text-brand-accent" />,
          },
          {
            title: 'Account',
            value: entitlementStatus.plan === 'FREE' 
              ? 'FREE Plan'
              : entitlementStatus.trial_active ? 'PRO Trial' : 'Active Plan',
            icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
          },
        ].map(item => (
          <div
            key={item.title}
            className="glass rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-xs text-text-muted">{item.title}</p>
              <p className="text-sm font-semibold text-text-primary tabular-nums">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Smart Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-text-primary">Smart Insights</h2>
          <span className="text-xs text-text-muted/50">— real-time system analysis</span>
        </div>
        <InsightsPanel />
      </div>
    </div>
  )
})

Dashboard.displayName = 'Dashboard'
