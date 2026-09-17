import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CleanupReport } from '@/types'

const MAX_HISTORY = 30

interface CleanerHistoryStore {
  history:      CleanupReport[]
  addReport:    (report: CleanupReport) => void
  clearHistory: () => void
}

export const useCleanerHistoryStore = create<CleanerHistoryStore>()(
  persist(
    (set) => ({
      history: [],
      addReport: (report) =>
        set(state => ({
          history: [report, ...state.history].slice(0, MAX_HISTORY),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'cm-cleaner-history' },
  ),
)
