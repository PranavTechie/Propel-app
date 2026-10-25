import React, { useEffect, useState } from 'react'
import '../../styles/globals.css'
import { toneColor, type Tone } from '@/theme/thresholds'
export interface OverlayMetrics {
  cpu:     number
  ram:     number
  netDown: number
  netUp:   number
}

// ── Format helpers ─────────────────────────────────────────────────────────
function fmtNet(bps: number): string {
  if (bps < 1_000)         return `${bps}B`
  if (bps < 1_000_000)     return `${(bps / 1_000).toFixed(1)}K`
  return                     `${(bps / 1_000_000).toFixed(1)}M`
}

/** Same 65 / 85 cut-offs as before, expressed as design-system tones. */
function toneFor(pct: number): Tone {
  if (pct > 85) return 'critical'
  if (pct > 65) return 'warning'
  return 'healthy'
}

function accentFor(pct: number): string {
  return toneColor(toneFor(pct))
}

// ── Bar ────────────────────────────────────────────────────────────────────
const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[rgb(var(--c-line)/.12)]">
    <div
      className="h-full rounded-full transition-[width] duration-slow ease-out"
      style={{ width: `${Math.min(pct, 100)}%`, background: color }}
    />
  </div>
)

// ── Row ────────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value: string; sub?: string; bar?: number; barColor?: string }> = ({
  label,
  value,
  sub,
  bar,
  barColor = 'rgb(var(--c-chart-2))',
}) => (
  <div className="mb-2.5">
    <div className="flex items-baseline justify-between">
      <span className="text-[9px] uppercase tracking-[.08em] text-fg-3">{label}</span>
      <span className="text-right">
        <span className="text-[15px] font-bold text-fg-1 tabular" style={bar !== undefined ? { color: barColor } : undefined}>
          {value}
        </span>
        {sub && <span className="ml-0.5 text-[8px] text-fg-4">{sub}</span>}
      </span>
    </div>
    {bar !== undefined && <Bar pct={bar} color={barColor} />}
  </div>
)

export const OverlayApp: React.FC = () => {
  const [m, setM]     = useState<OverlayMetrics | null>(null)

  useEffect(() => {
    const cleanup = window.propel.overlay.onMetrics(setM)
    return cleanup
  }, [])

  const cpu    = m?.cpu    ?? 0
  const ram    = m?.ram    ?? 0

  const cpuColor = accentFor(cpu)
  const ramColor = accentFor(ram)

  return (
    // The HUD floats over other apps, so it always uses the dark token set.
    <div
      data-theme="dark"
      className="drag-region h-[148px] w-[224px] select-none overflow-hidden rounded-card border border-line bg-[rgb(var(--c-surface-overlay)/.94)] font-mono shadow-[var(--shadow-3)]"
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-3 pb-1.5 pt-2">
        <span className="text-[8.5px] uppercase tracking-[.12em] text-fg-3">Propel</span>
        <span className={m ? 'text-[7.5px] tracking-[.1em] text-success' : 'text-[7.5px] tracking-[.1em] text-fg-4'}>
          {m ? '● LIVE' : '○ --'}
        </span>
      </div>

      <div className="px-3 pt-2.5">
        <Row label="CPU"   value={`${cpu}%`}              bar={cpu} barColor={cpuColor} />
        <Row label="RAM"   value={`${ram}%`}              bar={ram} barColor={ramColor} />
        <Row label="↓ NET" value={fmtNet(m?.netDown ?? 0)} sub="/s" />
        <Row label="↑ NET" value={fmtNet(m?.netUp   ?? 0)} sub="/s" />
      </div>
    </div>
  )
}
