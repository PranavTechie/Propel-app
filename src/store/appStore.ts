import { create } from 'zustand'
import { playSound } from '@/utils/soundManager'
import type {
  AppPhase,
  EntitlementStatus,
  SystemStats,
  ScanCategory,
  ToastMessage,
  ChartDataPoint,
  NavPage,
  CleanupReport,
  UpdateState,
} from '@/types'
import type { Session } from '@supabase/supabase-js'

const MAX_CHART_POINTS = 60

interface AppStore {
  // ── Phase ───────────────────────────────────────
  phase: AppPhase
  setPhase: (phase: AppPhase) => void

  // ── Navigation ──────────────────────────────────
  activePage: NavPage
  setActivePage: (page: NavPage) => void

  // ── Authentication & Entitlement ─────────────────
  session: Session | null
  setSession: (session: Session | null) => void
  entitlementStatus: EntitlementStatus
  setEntitlementStatus: (status: EntitlementStatus) => void

  // ── System Stats (split so chart updates don't rerender stat subscribers) ──
  stats: SystemStats | null
  chartData: ChartDataPoint[]
  setStats: (stats: SystemStats) => void

  // ── Cleaner ─────────────────────────────────────
  scanResults: ScanCategory[]
  isScanning: boolean
  isCleaning: boolean
  scanProgress: number
  cleanProgress: number
  lastCleanResult: { freed: number; errors: number } | null
  cleanupHistory: CleanupReport[]
  setScanResults: (results: ScanCategory[]) => void
  setIsScanning: (v: boolean) => void
  setIsCleaning: (v: boolean) => void
  setScanProgress: (v: number) => void
  setCleanProgress: (v: number) => void
  setLastCleanResult: (r: { freed: number; errors: number } | null) => void
  addCleanupReport: (report: CleanupReport) => void

  // ── Toast ───────────────────────────────────────
  toasts: ToastMessage[]
  addToast: (msg: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void

  // ── Loading ─────────────────────────────────────
  isAppLoading: boolean
  setAppLoading: (v: boolean) => void

  // ── Update system ────────────────────────────────
  updateState:          UpdateState | null
  updateModalVisible:   boolean
  updateBannerVisible:  boolean
  setUpdateState:       (state: UpdateState | null) => void
  showUpdateModal:      () => void
  hideUpdateModal:      () => void
  setUpdateBannerVisible: (v: boolean) => void
  dismissUpdateBanner:  () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  phase: 'splash',
  setPhase: phase => set({ phase }),

  activePage: 'dashboard',
  setActivePage: page => set({ activePage: page }),

  session: null,
  setSession: session => set({ session }),

  entitlementStatus: { status: 'checking', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' },
  setEntitlementStatus: entitlementStatus => set({ entitlementStatus }),

  stats: null,
  chartData: [],
  setStats: newStats => {
    const now = new Date()
    const timeLabel = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    const newPoint: ChartDataPoint = { time: timeLabel, cpu: newStats.cpu, ram: newStats.ram.percent }

    // Update stats and chartData in one atomic set to avoid double renders,
    // but use Object.is equality so subscribers that only read `stats` skip
    // re-renders when only chart data changed and vice-versa.
    set(state => {
      const nextChart = [...state.chartData.slice(-(MAX_CHART_POINTS - 1)), newPoint]
      return { stats: newStats, chartData: nextChart }
    })
  },

  scanResults: [],
  isScanning: false,
  isCleaning: false,
  scanProgress: 0,
  cleanProgress: 0,
  lastCleanResult: null,
  cleanupHistory: [],
  setScanResults: scanResults => set({ scanResults }),
  setIsScanning: isScanning => set({ isScanning }),
  setIsCleaning: isCleaning => set({ isCleaning }),
  setScanProgress: scanProgress => set({ scanProgress }),
  setCleanProgress: cleanProgress => set({ cleanProgress }),
  setLastCleanResult: lastCleanResult => set({ lastCleanResult }),
  addCleanupReport: report =>
    set(state => ({ cleanupHistory: [report, ...state.cleanupHistory].slice(0, 20) })),

  toasts: [],
  addToast: msg => {
    const id = Math.random().toString(36).slice(2)
    const toast: ToastMessage = { ...msg, id, duration: msg.duration ?? 4000 }
    set(state => ({ toasts: [...state.toasts, toast] }))
    setTimeout(() => get().removeToast(id), toast.duration)
    const ev = toast.type === 'success' ? 'clean' : (toast.type === 'error' || toast.type === 'warning') ? 'warning' : 'notification'
    playSound(ev)
  },
  removeToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  isAppLoading: false,
  setAppLoading: isAppLoading => set({ isAppLoading }),

  updateState: null,
  updateModalVisible: false,
  updateBannerVisible: false,
  setUpdateState: updateState => set({ updateState }),
  showUpdateModal: () => set({ updateModalVisible: true }),
  hideUpdateModal: () => set({ updateModalVisible: false }),
  setUpdateBannerVisible: updateBannerVisible => set({ updateBannerVisible }),
  dismissUpdateBanner: () => set({ updateBannerVisible: false }),
}))

// ── Stable derived selectors (use these instead of inline computations) ──
// These use reference equality — only rerender when the specific value changes.
export const selectStats       = (s: AppStore) => s.stats
export const selectChartData   = (s: AppStore) => s.chartData
export const selectActivePage  = (s: AppStore) => s.activePage
export const selectEntitlement = (s: AppStore) => s.entitlementStatus
export const selectSession     = (s: AppStore) => s.session
export const selectPhase       = (s: AppStore) => s.phase
export const selectToasts      = (s: AppStore) => s.toasts
export const selectSetStats    = (s: AppStore) => s.setStats
