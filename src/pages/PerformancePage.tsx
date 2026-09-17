import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { Cpu, MemoryStick, HardDrive, Wifi, Activity } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { LiveChart } from '@/components/charts/LiveChart'
import { MotionCard, CardHeader, CardContent, CardTitle } from '@/components/ui/Card'
import { staggerContainer, staggerItem } from '@/animations/variants'
import { formatBytes, formatMbps, formatUptime } from '@/utils/format'
import { cn } from '@/utils/cn'

interface MeterProps {
  label: string
  value: number
  max?: number
  unit?: string
  color: string
}

// Use CSS transition on a plain div — avoids Framer animating `width` which triggers layout recalc each frame
const Meter: React.FC<MeterProps> = memo(({ label, value, max = 100, unit = '%', color }) => {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-text-primary tabular-nums">
          {typeof value === 'number' && unit === '%' ? `${Math.round(value)}%` : `${value} ${unit}`}
        </span>
      </div>
      <div className="stat-bar">
        <div
          className={cn('stat-bar-fill', color)}
          style={{
            width: `${pct}%`,
            transition: 'width 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
      </div>
    </div>
  )
})

export const PerformancePage: React.FC = () => {
  const stats = useAppStore(s => s.stats)
  const chartData = useAppStore(s => s.chartData)

  return (
    <div className="p-6 space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-text-primary">Performance Monitor</h1>
        <p className="text-sm text-text-secondary mt-0.5">Live system resource metrics</p>
      </motion.div>

      {/* Live chart */}
      <motion.div variants={staggerItem} initial="initial" animate="animate">
        <MotionCard>
          <CardHeader>
            <CardTitle>CPU &amp; RAM History</CardTitle>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-primary inline-block" />CPU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-accent inline-block" />RAM
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <LiveChart data={chartData} height={200} />
          </CardContent>
        </MotionCard>
      </motion.div>

      {/* Metric panels */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate"
        className="grid grid-cols-2 gap-4">

        {/* CPU */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brand-primary" />Processor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <>
                  <p className="text-xs text-text-muted truncate">{stats.cpuModel}</p>
                  <Meter label="Overall Load" value={stats.cpu} color="bg-gradient-to-r from-brand-primary to-brand-secondary" />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { label: 'Cores', value: stats.cpuCores.toString() },
                      { label: 'Speed', value: `${stats.cpuSpeed.toFixed(2)} GHz` },
                      { label: 'Processes', value: stats.processes.toString() },
                      { label: 'Uptime', value: formatUptime(stats.uptime) },
                    ].map(item => (
                      <div key={item.label} className="glass rounded-xl p-2.5">
                        <p className="text-2xs text-text-muted">{item.label}</p>
                        <p className="text-sm font-semibold text-text-primary mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-text-muted">Loading...</p>}
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* Memory */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4 text-brand-accent" />Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <>
                  <Meter label="RAM Usage" value={stats.ram.percent} color="bg-gradient-to-r from-brand-accent to-brand-primary" />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { label: 'Used', value: formatBytes(stats.ram.used) },
                      { label: 'Free', value: formatBytes(stats.ram.free) },
                      { label: 'Total', value: formatBytes(stats.ram.total) },
                      { label: 'Usage', value: `${Math.round(stats.ram.percent)}%` },
                    ].map(item => (
                      <div key={item.label} className="glass rounded-xl p-2.5">
                        <p className="text-2xs text-text-muted">{item.label}</p>
                        <p className="text-sm font-semibold text-text-primary mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-text-muted">Loading...</p>}
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* Disk */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <>
                  <Meter label="Disk Usage" value={stats.disk.percent} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { label: 'Used', value: formatBytes(stats.disk.used) },
                      { label: 'Free', value: formatBytes(stats.disk.free) },
                      { label: 'Total', value: formatBytes(stats.disk.total) },
                      { label: 'Usage', value: `${Math.round(stats.disk.percent)}%` },
                    ].map(item => (
                      <div key={item.label} className="glass rounded-xl p-2.5">
                        <p className="text-2xs text-text-muted">{item.label}</p>
                        <p className="text-sm font-semibold text-text-primary mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-text-muted">Loading...</p>}
            </CardContent>
          </MotionCard>
        </motion.div>

        {/* Network */}
        <motion.div variants={staggerItem}>
          <MotionCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-orange-400" />Network
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Download', value: formatMbps(stats.network.download), icon: '↓' },
                    { label: 'Upload', value: formatMbps(stats.network.upload), icon: '↑' },
                  ].map(item => (
                    <div key={item.label} className="glass rounded-xl p-3">
                      <p className="text-2xs text-text-muted">{item.label}</p>
                      <p className="text-base font-bold text-text-primary mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-text-muted">Loading...</p>}
            </CardContent>
          </MotionCard>
        </motion.div>
      </motion.div>
    </div>
  )
}
