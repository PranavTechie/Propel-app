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

    // Default polished recovery UI
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center rounded-2xl border border-red-500/20 bg-red-500/5">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-2xl">
          ⚠
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Something went wrong here</p>
          <p className="text-xs text-text-muted mt-1 max-w-xs">
            {this.state.errorMessage || 'An unexpected error occurred in this section.'}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-white/5 border border-border/40 text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors"
        >
          Try Again
        </button>
        {this.state.eventId && (
          <p className="text-2xs text-text-muted/50 font-mono">
            Error ID: {this.state.eventId.slice(0, 8)}
          </p>
        )}
      </div>
    )
  }
}
