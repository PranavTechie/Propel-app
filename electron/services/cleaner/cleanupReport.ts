export interface CleanupReport {
  id: string
  timestamp: number
  totalFreed: number
  filesRemoved: number
  errors: number
  errorDetails?: { path: string; reason: string }[]
  filesSkipped?: number
  cancelled?: boolean
  permissionDeniedCount?: number
  permissionBatchToken?: string
  permissionDeniedPaths?: string[]
  durationMs: number
  categories: string[]
}

export function createReport(data: Omit<CleanupReport, 'id'>): CleanupReport {
  return {
    id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...data,
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
