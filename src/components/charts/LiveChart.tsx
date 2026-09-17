import React, { memo, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ChartDataPoint } from '@/types'

/** Read a CSS variable from the document root — called once per mount, not per render. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

interface LiveChartProps {
  data: ChartDataPoint[]
  showCPU?: boolean
  showRAM?: boolean
  height?: number
}

const CustomTooltip = memo(({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs border border-border">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  )
})
CustomTooltip.displayName = 'CustomTooltip'

export const LiveChart = memo<LiveChartProps>(({
  data,
  showCPU = true,
  showRAM = true,
  height = 200,
}) => {
  // Read CSS vars once on mount — these don't change without a full theme switch
  const c1 = useMemo(() => cssVar('--graph-1', '#6366f1'), [])
  const c2 = useMemo(() => cssVar('--graph-2', '#8b5cf6'), [])
  const mutedTick = useMemo(() => `rgb(${cssVar('--t-text-muted', '74 85 104')})`, [])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={c1} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c1} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={c2} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c2} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="time"
          tick={{ fill: mutedTick, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: mutedTick, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        {showCPU && (
          <Area
            type="monotone"
            dataKey="cpu"
            name="CPU"
            stroke={c1}
            strokeWidth={2}
            fill="url(#cpuGrad)"
            dot={false}
            activeDot={{ r: 4, fill: c1, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        )}
        {showRAM && (
          <Area
            type="monotone"
            dataKey="ram"
            name="RAM"
            stroke={c2}
            strokeWidth={2}
            fill="url(#ramGrad)"
            dot={false}
            activeDot={{ r: 4, fill: c2, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        )}
        {(showCPU && showRAM) && (
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            iconType="circle"
            iconSize={8}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
})

LiveChart.displayName = 'LiveChart'
