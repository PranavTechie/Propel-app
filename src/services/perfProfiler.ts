/**
 * perfProfiler.ts
 * Lightweight in-process performance tracker for Propel.
 * Developer-only diagnostics — never exposed to end users in production.
 *
 * Tracks: scan duration, IPC round-trips, long tasks (>50ms), render budget hints.
 */

interface PerfEntry {
  id:       string
  label:    string
  category: 'scan' | 'ipc' | 'render' | 'general'
  startMs:  number
  endMs:    number
  durationMs: number
  meta?:    Record<string, unknown>
}

const DEV = typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
const MAX_ENTRIES = 200
const LONG_TASK_THRESHOLD_MS = 50

const entries: PerfEntry[] = []
const activeTimers = new Map<string, { label: string; category: PerfEntry['category']; startMs: number; meta?: Record<string, unknown> }>()

let idSeq = 0
function genId() { return `perf_${++idSeq}` }

// ── Start a named timer ───────────────────────────────────────────────────
export function perfStart(label: string, category: PerfEntry['category'] = 'general', meta?: Record<string, unknown>): string {
  const id = genId()
  activeTimers.set(id, { label, category, startMs: performance.now(), meta })
  return id
}

// ── End a timer and record the entry ─────────────────────────────────────
export function perfEnd(id: string): PerfEntry | null {
  const timer = activeTimers.get(id)
  if (!timer) return null
  activeTimers.delete(id)

  const endMs = performance.now()
  const entry: PerfEntry = {
    id,
    label:      timer.label,
    category:   timer.category,
    startMs:    timer.startMs,
    endMs,
    durationMs: endMs - timer.startMs,
    meta:       timer.meta,
  }

  if (entries.length >= MAX_ENTRIES) entries.shift()
  entries.push(entry)

  if (DEV && entry.durationMs > LONG_TASK_THRESHOLD_MS) {
    console.warn(`[PerfProfiler] Long task: "${entry.label}" took ${entry.durationMs.toFixed(1)}ms`, entry.meta)
  }

  return entry
}

// ── Convenience: time an async operation ─────────────────────────────────
export async function perfTime<T>(
  label: string,
  fn: () => Promise<T>,
  category: PerfEntry['category'] = 'general',
  meta?: Record<string, unknown>,
): Promise<T> {
  const id = perfStart(label, category, meta)
  try {
    return await fn()
  } finally {
    perfEnd(id)
  }
}

// ── Retrieve all recorded entries ────────────────────────────────────────
export function getPerfEntries(): PerfEntry[] { return [...entries] }

export function getPerfSummary() {
  const byCategory: Record<string, { count: number; totalMs: number; maxMs: number; slowest: string }> = {}
  for (const e of entries) {
    const c = byCategory[e.category] ??= { count: 0, totalMs: 0, maxMs: 0, slowest: '' }
    c.count++
    c.totalMs += e.durationMs
    if (e.durationMs > c.maxMs) { c.maxMs = e.durationMs; c.slowest = e.label }
  }
  return byCategory
}

export function clearPerfEntries() { entries.length = 0 }

export function getPerfAsText(): string {
  return entries
    .slice(-50)
    .map(e => `[${e.category.padEnd(7)}] ${e.label.padEnd(40)} ${e.durationMs.toFixed(1).padStart(8)}ms`)
    .join('\n')
}
