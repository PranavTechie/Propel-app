import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ShieldCheck, FolderOpen, FileText, Hash, Globe, Tag,
  Plus, Trash2, Search, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { ExclusionEntry, ExclusionType } from '@/types'

interface ExclusionsModalProps {
  open:     boolean
  onClose:  () => void
}

const TYPE_META: Record<ExclusionType, { label: string; icon: React.ReactNode; placeholder: string; hint: string }> = {
  folder:    { label: 'Folder',    icon: <FolderOpen className="w-3.5 h-3.5" />, placeholder: 'C:\\Users\\John\\Downloads', hint: 'Exclude all files inside this folder' },
  file:      { label: 'File',      icon: <FileText className="w-3.5 h-3.5" />,   placeholder: 'C:\\Users\\John\\file.log',    hint: 'Exclude one specific file path' },
  extension: { label: 'Extension', icon: <Hash className="w-3.5 h-3.5" />,       placeholder: '.zip',                        hint: 'Exclude all files with this extension' },
  browser:   { label: 'Browser',   icon: <Globe className="w-3.5 h-3.5" />,      placeholder: '',                            hint: 'Skip browser cache for all browsers' },
  category:  { label: 'Category',  icon: <Tag className="w-3.5 h-3.5" />,        placeholder: '',                            hint: 'Skip an entire scan category' },
}

const BROWSER_OPTIONS = [
  { value: 'chrome',  label: 'Google Chrome' },
  { value: 'edge',    label: 'Microsoft Edge' },
  { value: 'firefox', label: 'Mozilla Firefox' },
  { value: 'brave',   label: 'Brave Browser' },
]

const CATEGORY_OPTIONS = [
  { value: 'temp-files',      label: 'Temporary Files' },
  { value: 'browser-cache',   label: 'Browser Cache' },
  { value: 'thumbnail-cache', label: 'Thumbnail Cache' },
  { value: 'gpu-cache',       label: 'GPU Shader Cache' },
  { value: 'crash-dumps',     label: 'Crash Dumps' },
  { value: 'windows-logs',    label: 'Windows Log Files' },
]

export const ExclusionsModal: React.FC<ExclusionsModalProps> = ({ open, onClose }) => {
  const [entries, setEntries]     = useState<ExclusionEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving,  setSaving]      = useState(false)
  const [search,  setSearch]      = useState('')
  const [addType, setAddType]     = useState<ExclusionType>('folder')
  const [addValue, setAddValue]   = useState('')
  const [feedback, setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null)

  useEscapeKey(onClose, open)

  const loadEntries = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const config = await window.propel.exclusions.load()
      setEntries(config.entries)
    } catch {
      // silently handle - unlikely but safe
    } finally {
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      loadEntries()
      setFeedback(null)
      setAddValue('')
    }
  }, [open, loadEntries])

  const resolveLabel = (): string => {
    if (addType === 'browser') {
      const opt = BROWSER_OPTIONS.find(o => o.value === addValue)
      return opt?.label ?? addValue
    }
    if (addType === 'category') {
      const opt = CATEGORY_OPTIONS.find(o => o.value === addValue)
      return opt?.label ?? addValue
    }
    return addValue.trim()
  }

  const handleAdd = async () => {
    const val = addType === 'extension'
      ? (addValue.trim().startsWith('.') ? addValue.trim() : '.' + addValue.trim())
      : addValue.trim()

    if (!val) {
      setFeedback({ ok: false, msg: 'Please enter a value.' })
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const result = await window.propel.exclusions.add(addType, val, resolveLabel())
      if (result.duplicate) {
        setFeedback({ ok: false, msg: 'This exclusion already exists.' })
      } else {
        setEntries(result.config.entries)
        setAddValue('')
        setFeedback({ ok: true, msg: 'Exclusion added — will apply on next scan.' })
      }
    } catch {
      setFeedback({ ok: false, msg: 'Failed to save exclusion. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      const updated = await window.propel.exclusions.remove(id)
      setEntries(updated.entries)
    } catch {
      setFeedback({ ok: false, msg: 'Failed to remove exclusion.' })
    }
  }

  const filtered = entries.filter(e =>
    e.label.toLowerCase().includes(search.toLowerCase()) ||
    e.value.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase()),
  )

  const typeEntries = Object.entries(TYPE_META) as [ExclusionType, typeof TYPE_META[ExclusionType]][]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(10px)' }}
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0,   scale: 0.95,  y: 8  }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[600px] max-h-[88vh] flex flex-col bg-bg-surface border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Glow */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand-primary/[0.06] rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 shrink-0 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Exclusions Manager</h2>
                <p className="text-2xs text-text-muted">Paths, extensions & categories never cleaned</p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add row */}
            <div className="px-5 py-4 border-b border-border/30 space-y-3 shrink-0">
              {/* Type picker */}
              <div className="flex gap-1.5 flex-wrap">
                {typeEntries.map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => { setAddType(type); setAddValue('') }}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium border transition-all',
                      addType === type
                        ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
                        : 'border-border/50 text-text-muted hover:text-text-secondary hover:bg-white/[0.03]',
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </button>
                ))}
              </div>

              {/* Value input */}
              <div className="flex gap-2">
                {addType === 'browser' ? (
                  <select
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-bg-surface border border-border/60 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50 transition-colors"
                  >
                    <option value="">Select browser…</option>
                    {BROWSER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : addType === 'category' ? (
                  <select
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-bg-surface border border-border/60 text-xs text-text-primary focus:outline-none focus:border-brand-primary/50 transition-colors"
                  >
                    <option value="">Select category…</option>
                    {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={TYPE_META[addType].placeholder}
                    className="flex-1 px-3 py-2 rounded-xl bg-bg-surface border border-border/60 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-primary/50 transition-colors"
                  />
                )}
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white [background:var(--t-btn-bg)] hover:brightness-105 disabled:opacity-50 transition-all shrink-0"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add
                </button>
              </div>

              {/* Hint + feedback */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xs text-text-muted">{TYPE_META[addType].hint}</p>
                <AnimatePresence mode="wait">
                  {feedback && (
                    <motion.div
                      key={feedback.msg}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'flex items-center gap-1.5 text-2xs font-medium shrink-0',
                        feedback.ok ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {feedback.ok
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <AlertCircle className="w-3 h-3" />
                      }
                      {feedback.msg}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-border/40">
                <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${entries.length} exclusion${entries.length !== 1 ? 's' : ''}…`}
                  className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-secondary">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-brand-primary/60" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-secondary">
                      {search ? 'No matching exclusions' : 'No exclusions yet'}
                    </p>
                    <p className="text-2xs text-text-muted mt-1">
                      {search ? 'Try a different search term.' : 'Add folders, extensions or categories to always skip during scans.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {filtered.map(entry => (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] group transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                        {TYPE_META[entry.type].icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{entry.label}</p>
                        <p className="text-2xs text-text-muted truncate font-mono">{entry.value}</p>
                      </div>
                      <span className="text-2xs text-text-muted/60 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0 capitalize">
                        {entry.type}
                      </span>
                      <button
                        onClick={() => handleRemove(entry.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/30 bg-white/[0.01] shrink-0">
              <p className="text-2xs text-text-muted">
                {entries.length} exclusion{entries.length !== 1 ? 's' : ''} active — applied on every scan
              </p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
