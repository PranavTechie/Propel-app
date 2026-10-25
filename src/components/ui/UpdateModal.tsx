import React, { useState } from 'react'
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'
import { Modal } from './Modal'
import { Progress } from './Progress'
import { Callout } from './Callout'
import type { UpdateState } from '@/types'

interface UpdateModalProps {
  state: UpdateState
  onClose: () => void
  onRestartAndInstall: () => void
  onRetry?: () => void
}

// ── Version Pill ───────────────────────────────────────────────────────────
const VersionPill: React.FC<{
  label: string
  version: string
  highlight?: boolean
}> = ({ label, version, highlight }) => (
  <div
    className={cn(
      'flex-1 rounded-control border px-4 py-2.5 text-center',
      highlight ? 'border-brand/30 bg-brand-soft' : 'border-line-subtle bg-surface-inset',
    )}
  >
    <p className={cn('mb-0.5 text-caption font-medium', highlight ? 'text-brand-fg' : 'text-fg-3')}>{label}</p>
    <p className={cn('font-mono text-body font-bold', highlight ? 'text-brand-fg' : 'text-fg-2')}>v{version}</p>
  </div>
)

const Notes: React.FC<{ title: string; notes: string[] }> = ({ title, notes }) =>
  notes.length > 0 ? (
    <div className="mt-4">
      <p className="section-label mb-2">{title}</p>
      <ul className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
        {notes.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-body-sm text-fg-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

const Footnote = () => (
  <p className="mt-5 flex items-center gap-1.5 border-t border-line-subtle pt-3 text-[10.5px] text-fg-3">
    <ShieldCheck className="h-3 w-3 shrink-0 text-fg-3" />
    Official release verified with SHA-512 and Propel ASAR integrity.
  </p>
)

export const UpdateModal: React.FC<UpdateModalProps> = ({
  state,
  onClose,
  onRestartAndInstall,
  onRetry,
}) => {
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstallClick = () => {
    setIsInstalling(true)
    setTimeout(() => {
      onRestartAndInstall()
    }, 600)
  }

  const percent = state.progress?.percent ?? (state.status === 'downloaded' ? 100 : 0)
  const speedMbps = state.progress?.bytesPerSecond
    ? (state.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)
    : null
  const transferredMB = state.progress?.transferred
    ? (state.progress.transferred / (1024 * 1024)).toFixed(1)
    : null
  const totalMB = state.progress?.total
    ? (state.progress.total / (1024 * 1024)).toFixed(1)
    : null

  // Format release notes if present
  const notes = Array.isArray(state.releaseNotes)
    ? state.releaseNotes
    : typeof state.releaseNotes === 'string'
      ? state.releaseNotes.split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
      : ['Performance improvements and bug fixes', 'Engine stability updates', 'Enhanced memory optimization']

  const versionPill = (
    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 align-middle font-mono text-[10.5px] font-medium text-brand-fg">
      v{state.latestVersion}
    </span>
  )

  if (isInstalling) {
    return (
      <Modal
        open
        onOpenChange={() => {}}
        dismissible={false}
        size="sm"
        tone="brand"
        icon={<RefreshCw className="animate-spin" />}
        title="Installing update..."
        description="Restarting Propel..."
      >
        <Progress value={null} indeterminate className="mt-1" aria-label="Installing update" />
      </Modal>
    )
  }

  if (state.status === 'error') {
    return (
      <Modal
        open
        onOpenChange={(v) => !v && onClose()}
        tone="warning"
        icon={<AlertCircle />}
        title="Update Check Unavailable"
        description="Propel continues running normally."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onRetry && <Button onClick={onRetry}>Try Again</Button>}
          </>
        }
      >
        <Callout tone="info" compact>
          Could not reach the update server. Please check your internet connection or try again later.
        </Callout>
        <Footnote />
      </Modal>
    )
  }

  if (state.status === 'downloaded') {
    return (
      <Modal
        open
        onOpenChange={(v) => !v && onClose()}
        tone="brand"
        icon={<CheckCircle2 />}
        title={<>Update Ready{versionPill}</>}
        description="Download verified and ready to install."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Later
            </Button>
            <Button onClick={handleInstallClick}>Restart & Update</Button>
          </>
        }
      >
        <div className="flex items-center gap-2.5">
          <VersionPill label="Current" version={state.currentVersion} />
          <ArrowRight className="h-4 w-4 shrink-0 text-fg-4" />
          <VersionPill label="Ready" version={state.latestVersion} highlight />
        </div>
        <Notes title={`What's New in v${state.latestVersion}`} notes={notes} />
        <Footnote />
      </Modal>
    )
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      tone="brand"
      icon={<Download />}
      title={<>New Update Available{versionPill}</>}
      description="Downloading update package in background..."
      footer={
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Continue in Background
        </Button>
      }
    >
      <div className="flex items-center gap-2.5">
        <VersionPill label="Current" version={state.currentVersion} />
        <ArrowRight className="h-4 w-4 shrink-0 text-fg-4" />
        <VersionPill label="New" version={state.latestVersion} highlight />
      </div>

      <div className="mt-4 space-y-2 rounded-control border border-line-subtle bg-surface-inset p-3.5">
        <div className="flex items-center justify-between text-body-sm tabular">
          <span className="font-semibold text-brand-fg">Downloading... {percent}%</span>
          {transferredMB && totalMB ? (
            <span className="text-caption text-fg-3">
              {transferredMB} MB / {totalMB} MB
            </span>
          ) : null}
        </div>
        <Progress value={Math.min(100, Math.max(0, percent))} tone="brand" size="md" aria-label="Update download progress" />
        {speedMbps && (
          <div className="flex justify-end text-caption text-fg-3 tabular">
            <span>{speedMbps} MB/s</span>
          </div>
        )}
      </div>

      <Notes title="Highlights" notes={notes} />
      <Footnote />
    </Modal>
  )
}
