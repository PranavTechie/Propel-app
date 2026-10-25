import React from 'react'
import {
  RotateCcw, ShieldCheck, AlertTriangle, HardDrive,
  ExternalLink, Trash2, Globe, FileText, Cpu, Image,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { CleanupReport } from '@/types'

interface RestoreInfoModalProps {
  open:    boolean
  report:  CleanupReport
  onClose: () => void
}

const CATEGORY_META: Record<string, {
  label:       string
  icon:        React.ReactNode
  recoverNote: string
  safe:        boolean
}> = {
  'temp-files':      {
    label: 'Temporary Files',
    icon:  <Trash2 className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Apps regenerate these automatically.',
    safe: true,
  },
  'browser-cache':   {
    label: 'Browser Cache',
    icon:  <Globe className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Browsers rebuild cache on next visit.',
    safe: true,
  },
  'recycle-bin':     {
    label: 'Recycle Bin',
    icon:  <Trash2 className="w-3.5 h-3.5" />,
    recoverNote: 'Recycle Bin was emptied via Windows Shell. Files cannot be recovered through Propel. Use a file recovery tool if needed.',
    safe: false,
  },
  'thumbnail-cache': {
    label: 'Thumbnail Cache',
    icon:  <Image className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Windows rebuilds thumbnails automatically on next folder browse.',
    safe: true,
  },
  'gpu-cache':       {
    label: 'GPU Shader Cache',
    icon:  <Cpu className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Your GPU driver regenerates shader caches automatically.',
    safe: true,
  },
  'crash-dumps':     {
    label: 'Crash Dumps',
    icon:  <FileText className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. These were diagnostic files from past crashes.',
    safe: true,
  },
  'windows-logs':    {
    label: 'Windows Log Files',
    icon:  <FileText className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Windows continues generating new logs normally.',
    safe: true,
  },
}

export const RestoreInfoModal: React.FC<RestoreInfoModalProps> = ({ open, report, onClose }) => {
  useEscapeKey(onClose, open)

  const hasUnrecoverable = report.categories.includes('recycle-bin')

  const openRestorePoint = () => {
    try {
      window.electronAPI?.shell?.openExternal('ms-settings:recovery')
    } catch {
      // Fallback — open via systempropertiesprotection.exe path guidance
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title="Cleanup Details & Recovery"
      description={`${formatBytes(report.totalFreed)} freed · ${report.filesRemoved.toLocaleString()} files removed`}
      icon={<RotateCcw />}
      tone="brand"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Callout
        tone={hasUnrecoverable ? 'warning' : 'success'}
        icon={hasUnrecoverable ? <AlertTriangle /> : <ShieldCheck />}
        compact
      >
        {hasUnrecoverable
          ? 'Recycle Bin items cannot be recovered. All other categories regenerate automatically.'
          : 'All cleaned items are safe — apps and Windows regenerate them automatically.'}
      </Callout>

      <ul className="mt-3 divide-y divide-line-subtle overflow-hidden rounded-card border border-line-subtle">
        {report.categories.map(catId => {
          const meta = CATEGORY_META[catId] ?? {
            label: catId,
            icon: <HardDrive className="w-3.5 h-3.5" />,
            recoverNote: 'Files were permanently deleted.',
            safe: true,
          }
          return (
            <li key={catId} className="bg-surface-raised px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-chip',
                    meta.safe ? 'bg-surface-inset text-fg-2' : 'bg-warning-soft text-warning-fg',
                  )}
                >
                  {meta.icon}
                </span>
                <p className="text-body-sm font-semibold text-fg-1">{meta.label}</p>
                <StatusPill tone={meta.safe ? 'healthy' : 'warning'} className="ml-auto">
                  {meta.safe ? 'Auto-regenerates' : 'Not recoverable'}
                </StatusPill>
              </div>
              <p className="mt-1.5 pl-[38px] text-caption text-fg-3">{meta.recoverNote}</p>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center gap-3 rounded-card border border-line-subtle bg-surface-inset px-3.5 py-3">
        <RotateCcw className="h-4 w-4 shrink-0 text-fg-3" />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-medium text-fg-1">Need full system recovery?</p>
          <p className="text-caption text-fg-3">
            Use a Windows System Restore Point created before this cleanup.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openRestorePoint} iconRight={<ExternalLink />}>
          Open
        </Button>
      </div>
    </Modal>
  )
}
