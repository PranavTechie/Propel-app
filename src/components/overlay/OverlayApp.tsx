import React, { useEffect, useState } from 'react'
import '../../styles/globals.css'
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

function accentFor(pct: number): string {
  if (pct > 85) return '#ff4455'
  if (pct > 65) return '#ffaa33'
  return '#00e87a'
}

// ── Bar ────────────────────────────────────────────────────────────────────
const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 999, transition: 'width 0.8s cubic-bezier(.25,.46,.45,.94)' }} />
  </div>
)

// ── Row ────────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value: string; sub?: string; bar?: number; barColor?: string }> = ({ label, value, sub, bar, barColor = '#6366f1' }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ color: barColor, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {sub && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, marginLeft: 3 }}>{sub}</span>}
      </div>
    </div>
    {bar !== undefined && <Bar pct={bar} color={barColor} />}
  </div>
)

// ── Overlay App ─────────────────────────────────────────────────────────────
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
    <div
      className="drag-region"
      style={{
        width:          '224px',
        height:         '148px',
        background:     'var(--overlay-bg, rgba(4,4,12,0.88))',
        border:         `1px solid rgb(var(--t-border, 255 255 255) / 0.08)`,
        borderRadius:   12,
        fontFamily:     '"JetBrains Mono", "Fira Code", monospace',
        userSelect:     'none',
        overflow:       'hidden',
        backdropFilter: 'blur(14px)',
        boxShadow:      '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.08)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Propel</span>
        <span style={{ color: m ? '#00e87a' : 'rgba(255,255,255,0.2)', fontSize: 7.5, letterSpacing: '0.1em' }}>
          {m ? '● LIVE' : '○ --'}
        </span>
      </div>

      {/* Metrics */}
      <div style={{ padding: '10px 12px 0' }}>
        <Row label="CPU"   value={`${cpu}%`}              bar={cpu} barColor={cpuColor} />
        <Row label="RAM"   value={`${ram}%`}              bar={ram} barColor={ramColor} />
        <Row label="↓ NET" value={fmtNet(m?.netDown ?? 0)} sub="/s" barColor="rgba(139,92,246,0.9)" />
        <Row label="↑ NET" value={fmtNet(m?.netUp   ?? 0)} sub="/s" barColor="rgba(139,92,246,0.6)" />
      </div>
    </div>
  )
}
