import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ShieldCheck, FolderOpen, FileText, Hash, Globe, Tag,
  Plus, Trash2, Search, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
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
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title="Exclusions Manager"
      description="Paths, extensions & categories never cleaned"
      icon={<ShieldCheck />}
      tone="brand"
      size="lg"
      footer={
        <>
          <p className="mr-auto text-caption text-fg-3">
            {entries.length} exclusion{entries.length !== 1 ? 's' : ''} active — applied on every scan
          </p>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {/* Add row */}
      <div className="space-y-3 rounded-card border border-line-subtle bg-surface-inset p-3.5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Exclusion type">
          {typeEntries.map(([type, meta]) => (
            <button
              key={type}
              role="radio"
              aria-checked={addType === type}
              onClick={() => { setAddType(type); setAddValue('') }}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-chip border px-2.5 text-caption font-medium transition-colors duration-fast focus-visible:shadow-ring',
                addType === type
                  ? 'border-brand/30 bg-brand-soft text-brand-fg'
                  : 'border-line-subtle bg-surface-raised text-fg-2 hover:border-line hover:text-fg-1',
              )}
            >
              {meta.icon}
              {meta.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {addType === 'browser' ? (
            <Select value={addValue} onChange={e => setAddValue(e.target.value)} aria-label="Browser">
              <option value="">Select browser…</option>
              {BROWSER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : addType === 'category' ? (
            <Select value={addValue} onChange={e => setAddValue(e.target.value)} aria-label="Category">
              <option value="">Select category…</option>
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Input
              type="text"
              value={addValue}
              onChange={e => setAddValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={TYPE_META[addType].placeholder}
              aria-label={`${TYPE_META[addType].label} to exclude`}
              invalid={feedback ? !feedback.ok : false}
              className={addType === 'folder' || addType === 'file' ? 'font-mono text-body-sm' : undefined}
            />
          )}
          <Button onClick={handleAdd} loading={saving} icon={<Plus />} className="shrink-0">
            Add
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <p className="text-caption text-fg-3">{TYPE_META[addType].hint}</p>
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.p
                key={feedback.msg}
                role={feedback.ok ? 'status' : 'alert'}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 text-caption font-medium',
                  feedback.ok ? 'text-success-fg' : 'text-danger-fg',
                )}
              >
                {feedback.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {feedback.msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${entries.length} exclusion${entries.length !== 1 ? 's' : ''}…`}
          aria-label="Search exclusions"
          icon={<Search />}
          className="pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-chip text-fg-3 hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="mt-3">
        {loading ? (
          <div className="space-y-1" role="status" aria-label="Loading exclusions">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={search ? <Search /> : <ShieldCheck />}
            tone={search ? 'neutral' : 'brand'}
            title={search ? 'No matching exclusions' : 'No exclusions yet'}
            description={search ? 'Try a different search term.' : 'Add folders, extensions or categories to always skip during scans.'}
          />
        ) : (
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-card border border-line-subtle">
            {filtered.map(entry => (
              <motion.li
                key={entry.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group flex items-center gap-3 bg-surface-raised px-3 py-2.5 transition-colors duration-fast hover:bg-state/[var(--a-hover)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-surface-inset text-fg-2">
                  {TYPE_META[entry.type].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-fg-1">{entry.label}</p>
                  <p className="truncate font-mono text-[11px] text-fg-3">{entry.value}</p>
                </div>
                <span className="shrink-0 rounded-chip bg-surface-inset px-1.5 py-0.5 text-[10.5px] font-medium capitalize text-fg-3">
                  {entry.type}
                </span>
                <button
                  onClick={() => handleRemove(entry.id)}
                  aria-label={`Remove exclusion ${entry.label}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-fg-3 opacity-0 transition-[opacity,background-color,color] duration-fast hover:bg-danger-soft hover:text-danger-fg focus-visible:opacity-100 focus-visible:shadow-ring group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
