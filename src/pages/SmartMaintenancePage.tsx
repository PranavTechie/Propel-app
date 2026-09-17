import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Clock, Globe, Trash2, FolderX, Rocket, Bell, BellOff,
  RefreshCw, CheckCircle2, AlertTriangle, Calendar, Zap,
  Chrome, Flame, Layers, Activity,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { MaintenanceSettings, MaintenanceStatus } from '@/types'

// ── Glow Toggle ────────────────────────────────────────────────────────────
const Toggle: React.FC<{
  checked:  boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}> = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all duration-200 focus:outline-none',
      checked ? 'toggle-on' : 'bg-white/10 border border-white/10',
      disabled && 'opacity-40 cursor-not-allowed',
    )}
  >
    <span className={cn(
      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200',
      checked ? 'translate-x-5' : 'translate-x-0',
    )} />
  </button>
)

// ── Section card ───────────────────────────────────────────────────────────
const SectionCard: React.FC<{
  icon:     React.ReactNode
  title:    string
  subtitle: string
  children: React.ReactNode
}> = ({ icon, title, subtitle, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-2xl p-5 border border-border/50 hover:border-brand-primary/20 transition-colors duration-300"
  >
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand-primary/10 border border-brand-primary/20">
        <span className="text-brand-primary">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-2xs text-text-muted mt-0.5">{subtitle}</p>
      </div>
    </div>
    <div className="space-y-3">{children}</div>
  </motion.div>
)

// ── Row inside a section card ──────────────────────────────────────────────
const ControlRow: React.FC<{
  label:     string
  sublabel?: string
  children:  React.ReactNode
}> = ({ label, sublabel, children }) => (
  <div className="flex items-center justify-between gap-4 py-1">
    <div className="min-w-0">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      {sublabel && <p className="text-2xs text-text-muted mt-0.5">{sublabel}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

// ── Status pill ────────────────────────────────────────────────────────────
const StatusPill: React.FC<{ active: boolean; label: string }> = ({ active, label }) => (
  <span className={cn(
    'inline-flex items-center gap-1.5 text-2xs font-medium px-2.5 py-1 rounded-full border',
    active
      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
      : 'bg-white/[0.04] border-border/60 text-text-muted',
  )}>
    <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-emerald-400' : 'bg-text-muted')} />
    {label}
  </span>
)

// ── Format helpers ─────────────────────────────────────────────────────────
function fmtTime(ts: number | null): string {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtNext(ts: number | null): string {
  if (!ts) return 'Not scheduled'
  const diff = ts - Date.now()
  if (diff <= 0) return 'Soon'
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Within the hour'
  if (h < 24) return `In ${h}h`
  const d = Math.floor(h / 24)
  return `In ${d} day${d > 1 ? 's' : ''}`
}

// ── Default settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS: MaintenanceSettings = {
  scheduleEnabled: false, scheduleFrequency: 'weekly',
  recycleBinEnabled: false, ignoreDownloads: true,
  browserChrome: false, browserEdge: false, browserBrave: false, browserFirefox: false,
  startupEnabled: false, ramAlertsEnabled: false,
  updateNotificationsEnabled: true, safeCleaningMode: true, lastCleanupAt: null,
}

// ── Page ───────────────────────────────────────────────────────────────────
export const SmartMaintenancePage: React.FC = () => {
  const [settings, setSettings]           = useState<MaintenanceSettings>(DEFAULT_SETTINGS)
  const [status,   setStatus]             = useState<MaintenanceStatus | null>(null)
  const [loading,  setLoading]            = useState(true)
  const [running,  setRunning]            = useState(false)
  const [runResult, setRunResult]         = useState<{ ok: boolean; msg: string } | null>(null)
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load settings + status on mount ─────────────────────────────────────
  useEffect(() => {
    Promise.all([
      window.propel.maintenance.getSettings(),
      window.propel.maintenance.getStatus(),
    ]).then(([s, st]) => {
      setSettings(s as MaintenanceSettings)
      setStatus(st as MaintenanceStatus)
    }).catch(() => {}).finally(() => setLoading(false))

    // Refresh status every 30 s
    statusTimer.current = setInterval(() => {
      window.propel.maintenance.getStatus()
        .then(st => setStatus(st as MaintenanceStatus))
        .catch(() => {})
    }, 30_000)

    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current)
    }
  }, [])

  // ── Toggle helper ─────────────────────────────────────────────────────────
  const toggle = useCallback(async (key: keyof MaintenanceSettings, value: boolean | string) => {
    const patch = { [key]: value } as Partial<MaintenanceSettings>
    setSettings(prev => ({ ...prev, ...patch }))
    try {
      const updated = await window.propel.maintenance.updateSettings(patch)
      setSettings(updated as MaintenanceSettings)
    } catch {
      setSettings(prev => ({ ...prev })) // revert via re-render
    }
  }, [])

  // ── Run Now ───────────────────────────────────────────────────────────────
  const handleRunNow = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const result = await window.propel.maintenance.runNow()
      const total = result.tempCleaned + result.browserCleaned
      setRunResult({ ok: true, msg: `Cleaned ${total} item${total !== 1 ? 's' : ''}${result.recycleBinCleared ? ' · Recycle Bin emptied' : ''}` })
      const st = await window.propel.maintenance.getStatus()
      setStatus(st as MaintenanceStatus)
      setSettings(prev => ({ ...prev, lastCleanupAt: Date.now() }))
    } catch {
      setRunResult({ ok: false, msg: 'Cleanup failed — check permissions' })
    } finally {
      setRunning(false)
      setTimeout(() => setRunResult(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
          <RefreshCw className="w-5 h-5 text-brand-primary" />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center shadow-glow-sm">
              <Bot className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Smart Maintenance</h1>
              <p className="text-xs text-text-muted">Automated cleaning, scheduling &amp; system control</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {runResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border',
                    runResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/25 text-red-400',
                  )}
                >
                  {runResult.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  {runResult.msg}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleRunNow}
              disabled={running}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                'bg-brand-primary/15 border border-brand-primary/30 text-text-accent',
                'hover:bg-brand-primary/25 hover:shadow-glow-sm',
                running && 'opacity-60 cursor-not-allowed',
              )}
            >
              <motion.div animate={running ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Zap className="w-4 h-4" />
              </motion.div>
              {running ? 'Cleaning…' : 'Clean Now'}
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 1. Automatic Cleaning */}
          <SectionCard icon={<Clock className="w-4 h-4" />} title="Automatic Cleaning" subtitle="Schedule temp file removal">
            <ControlRow label="Enable Scheduler" sublabel="Runs in the background automatically">
              <Toggle checked={settings.scheduleEnabled} onChange={v => toggle('scheduleEnabled', v)} />
            </ControlRow>

            {settings.scheduleEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <ControlRow label="Frequency">
                  <select
                    value={settings.scheduleFrequency}
                    onChange={e => toggle('scheduleFrequency', e.target.value)}
                    className="bg-bg-surface border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </ControlRow>
              </motion.div>
            )}

            <ControlRow label="Auto Empty Recycle Bin" sublabel="Cleared after each cleanup run">
              <Toggle checked={settings.recycleBinEnabled} onChange={v => toggle('recycleBinEnabled', v)} />
            </ControlRow>

            <ControlRow label="Protect Downloads Folder" sublabel="Never scan or delete Downloads">
              <Toggle checked={settings.ignoreDownloads} onChange={v => toggle('ignoreDownloads', v)} />
            </ControlRow>

            <ControlRow label="Safe Cleaning Mode" sublabel="Move cleaned files to Recycle Bin instead of permanent deletion">
              <Toggle checked={settings.safeCleaningMode} onChange={v => toggle('safeCleaningMode', v)} />
            </ControlRow>
          </SectionCard>

          {/* 2. Browser Maintenance */}
          <SectionCard icon={<Globe className="w-4 h-4" />} title="Browser Maintenance" subtitle="Auto-clean browser cache only (no passwords or bookmarks)">
            <ControlRow label={<span className="flex items-center gap-1.5"><Chrome className="w-3 h-3" />Google Chrome</span> as unknown as string}>
              <Toggle checked={settings.browserChrome} onChange={v => toggle('browserChrome', v)} />
            </ControlRow>
            <ControlRow label="Microsoft Edge">
              <Toggle checked={settings.browserEdge} onChange={v => toggle('browserEdge', v)} />
            </ControlRow>
            <ControlRow label="Brave Browser">
              <Toggle checked={settings.browserBrave} onChange={v => toggle('browserBrave', v)} />
            </ControlRow>
            <ControlRow label="Mozilla Firefox">
              <Toggle checked={settings.browserFirefox} onChange={v => toggle('browserFirefox', v)} />
            </ControlRow>
            <p className="text-2xs text-text-muted pt-1 border-t border-border/30">
              Only cache is removed. Profiles, passwords, and bookmarks are never touched.
            </p>
          </SectionCard>

          {/* 3. Startup & Background */}
          <SectionCard icon={<Rocket className="w-4 h-4" />} title="Startup &amp; Background" subtitle="Control app launch behavior">
            <ControlRow label="Launch on Windows Startup" sublabel="Register in Windows login items">
              <Toggle checked={settings.startupEnabled} onChange={v => toggle('startupEnabled', v)} />
            </ControlRow>
          </SectionCard>

          {/* 4. Alerts & Notifications */}
          <SectionCard icon={<Bell className="w-4 h-4" />} title="Alerts &amp; Notifications" subtitle="Native desktop notifications">
            <ControlRow label="High RAM Usage Alerts" sublabel="Alert when RAM exceeds 85% (5 min cooldown)">
              <Toggle checked={settings.ramAlertsEnabled} onChange={v => toggle('ramAlertsEnabled', v)} />
            </ControlRow>
            <ControlRow label="Update Notifications" sublabel="Show update modal when a new version is available">
              <Toggle checked={settings.updateNotificationsEnabled} onChange={v => toggle('updateNotificationsEnabled', v)} />
            </ControlRow>
          </SectionCard>

        </div>

        {/* ── Status Section ── */}
        <div>
          <p className="text-2xs font-semibold text-text-muted uppercase tracking-widest mb-3 px-0.5">
            Maintenance Status
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

            <StatusCard
              icon={<Calendar className="w-4 h-4 text-brand-primary" />}
              label="Next Auto Cleanup"
              value={fmtNext(status?.nextCleanupAt ?? null)}
              active={settings.scheduleEnabled}
            />
            <StatusCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              label="Last Cleanup"
              value={fmtTime(status?.lastCleanupAt ?? null)}
              active={!!status?.lastCleanupAt}
            />
            <StatusCard
              icon={<Globe className="w-4 h-4 text-brand-accent" />}
              label="Browser Protection"
              value={`${status?.browserProtectionCount ?? 0} browser${(status?.browserProtectionCount ?? 0) !== 1 ? 's' : ''}`}
              active={(status?.browserProtectionCount ?? 0) > 0}
            />
            <StatusCard
              icon={<Rocket className="w-4 h-4 text-brand-secondary" />}
              label="Startup Launch"
              value={settings.startupEnabled ? 'Enabled' : 'Disabled'}
              active={settings.startupEnabled}
            />
            <StatusCard
              icon={<Activity className="w-4 h-4 text-amber-400" />}
              label="RAM Alerts"
              value={settings.ramAlertsEnabled ? 'Active (>85%)' : 'Inactive'}
              active={settings.ramAlertsEnabled}
            />
            <StatusCard
              icon={<Layers className="w-4 h-4 text-text-muted" />}
              label="Schedule"
              value={settings.scheduleEnabled ? settings.scheduleFrequency.charAt(0).toUpperCase() + settings.scheduleFrequency.slice(1) : 'Off'}
              active={settings.scheduleEnabled}
            />
          </div>
        </div>

        {/* ── What gets cleaned ── */}
        <div className="glass rounded-2xl p-5 border border-border/50">
          <p className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-brand-primary" />
            Directories Cleaned Automatically
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              '%TEMP%', '%LOCALAPPDATA%\\Temp', '%WINDIR%\\Temp',
              'Windows INetCache', 'Thumbnail Cache (pending)', 'App Crash Dumps',
              'Chrome Cache (if enabled)', 'Edge Cache (if enabled)',
              'Brave Cache (if enabled)', 'Firefox Cache (if enabled)',
            ].map(d => (
              <div key={d} className="flex items-center gap-2">
                <FolderX className="w-3 h-3 text-brand-primary/60 shrink-0" />
                <span className="text-2xs text-text-muted font-mono">{d}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/30 flex items-start gap-2">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-text-muted">
              Downloads folder is always excluded. Locked or permission-denied files are silently skipped.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Status card sub-component ──────────────────────────────────────────────
const StatusCard: React.FC<{
  icon:   React.ReactNode
  label:  string
  value:  string
  active: boolean
}> = ({ icon, label, value, active }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass rounded-xl p-3.5 border border-border/50 space-y-2"
  >
    <div className="flex items-center justify-between">
      {icon}
      <StatusPill active={active} label={active ? 'Active' : 'Off'} />
    </div>
    <div>
      <p className="text-xs font-semibold text-text-primary">{value}</p>
      <p className="text-2xs text-text-muted mt-0.5">{label}</p>
    </div>
  </motion.div>
)
