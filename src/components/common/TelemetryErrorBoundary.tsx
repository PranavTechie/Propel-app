/**
 * TelemetryErrorBoundary.tsx
 *
 * React ErrorBoundary that:
 *  1. Captures component crashes to GlitchTip (if telemetry enabled)
 *  2. Logs to local crashLogger as fallback
 *  3. Shows a polished recovery UI — never a blank white screen
 */

import React from 'react'
import { Sentry } from '@/services/telemetry'
import { logError } from '@/services/crashLogger'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: React.ReactNode
  page?: string
  feature?: string
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
  eventId: string | null
}

export class TelemetryErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '', eventId: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unknown component error',
    }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { page = 'unknown', feature } = this.props

    // 1. Local fallback logger (always runs)
    logError(
      'renderer',
      `[${page}${feature ? `/${feature}` : ''}] ${error.message}`,
      info.componentStack?.slice(0, 500) ?? undefined,
    )

    // 2. GlitchTip (fire-and-forget, never throws)
    try {
      const eventId = Sentry.captureException(error, {
        extra: {
          componentStack: info.componentStack?.slice(0, 500),
          page,
          feature: feature ?? 'unknown',
        },
        tags: {
          page,
          featureName: feature ?? 'unknown',
        },
      })
      this.setState({ eventId: eventId ?? null })
    } catch { /* telemetry must never crash the boundary */ }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '', eventId: null })
  }

  override render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    // Custom fallback if provided
    if (this.props.fallback) return this.props.fallback

    // Default recovery UI. The technical message goes to the logs only.
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface-raised p-8 text-center shadow-[var(--shadow-1),var(--highlight-top)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-card border border-danger/25 bg-danger-soft text-danger-fg">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-title font-semibold text-fg-1">Something went wrong here</p>
          <p className="mt-1 max-w-xs text-body-sm text-fg-3">
            This section hit an unexpected error. Try again, and restart Propel if it keeps happening.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={this.handleReset}>
          Try Again
        </Button>
        {this.state.eventId && (
          <p className="font-mono text-[10.5px] text-fg-4">Error ID: {this.state.eventId.slice(0, 8)}</p>
        )}
      </div>
    )
  }
}
