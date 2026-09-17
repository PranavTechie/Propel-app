import React, { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar }       from './TitleBar'
import { Sidebar }        from './Sidebar'
import { ToastProvider }  from '@/components/common/ToastProvider'
import { UpdateModal }    from '@/components/ui/UpdateModal'
import { useAppStore, selectActivePage } from '@/store/appStore'
import { useSettingsStore } from '@/store/settingsStore'
import { applyTheme } from '@/theme/themes'
import { useSystemStats }  from '@/hooks/useSystemStats'
import { useUpdateCheck }  from '@/hooks/useUpdateCheck'
import { usePerformanceProfile } from '@/hooks/usePerformanceProfile'
import { pageVariants }   from '@/animations/variants'

// Dashboard is always needed immediately — keep eager
import { Dashboard } from '@/pages/Dashboard'

// All other pages are lazy — only parsed/executed when first visited
const CleanerPage           = lazy(() => import('@/pages/CleanerPage').then(m => ({ default: m.CleanerPage })))
const MemoryPage            = lazy(() => import('@/pages/MemoryPage').then(m => ({ default: m.MemoryPage })))
const PerformancePage       = lazy(() => import('@/pages/PerformancePage').then(m => ({ default: m.PerformancePage })))
const SettingsPage          = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AboutPage             = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage })))
const SmartMaintenancePage  = lazy(() => import('@/pages/SmartMaintenancePage').then(m => ({ default: m.SmartMaintenancePage })))
const AIFeaturesPage        = lazy(() => import('@/pages/AIFeaturesPage').then(m => ({ default: m.AIFeaturesPage })))

const SystemCheckPage       = lazy(() => import('@/pages/SystemCheckPage').then(m => ({ default: m.SystemCheckPage })))
const PermissionsPage       = lazy(() => import('@/pages/PermissionsPage').then(m => ({ default: m.PermissionsPage })))

const PAGE_MAP = {
  dashboard:   Dashboard,
  cleaner:     CleanerPage,
  memory:      MemoryPage,
  maintenance: SmartMaintenancePage,
  performance: PerformancePage,
  ai:          AIFeaturesPage,
  systemcheck: SystemCheckPage,
  permissions: PermissionsPage,
  settings:    SettingsPage,
  about:       AboutPage,
}

// Minimal non-animated fallback while lazy chunk loads (usually < 50ms)
const PageFallback = () => <div className="absolute inset-0" />

export const AppLayout: React.FC = () => {
  const activePage   = useAppStore(selectActivePage)
  const accentColor   = useSettingsStore(s => s.accentColor)
  const overlayEnabled = useSettingsStore(s => s.overlayEnabled)
  const themeId        = useSettingsStore(s => s.themeId)
  useSystemStats(true)
  const { updateState, showModal, handleSkip, handleUpdate } = useUpdateCheck()
  const perfProfile = usePerformanceProfile()

  // Apply full theme (also syncs --c-accent) whenever themeId changes
  React.useEffect(() => {
    applyTheme(themeId)
  }, [themeId])

  // Accent-color-picker override: if user explicitly picked an accent, sync it
  // on top of the theme's default (runs after theme effect due to deps order)
  React.useEffect(() => {
    const accentRgbMap: Record<string, string> = {
      purple:  '99 102 241',
      blue:    '59 130 246',
      red:     '239 68 68',
      emerald: '16 185 129',
      orange:  '249 115 22',
    }
    const rgb = accentRgbMap[accentColor]
    if (rgb) document.documentElement.style.setProperty('--c-accent', rgb)
  }, [accentColor])

  // Auto-open overlay if it was enabled on last session
  React.useEffect(() => {
    if (overlayEnabled) {
      window.propel.overlay.open().catch(() => {})
    }
  }, [])  // intentionally run once on mount only

  const ActivePage = PAGE_MAP[activePage]

  return (
    <>
      <div className="flex flex-col h-screen w-screen overflow-hidden relative"
           data-perf={perfProfile}
           style={{ background: 'var(--t-app-bg)' }}>
        {/* Ambient gradient blobs — promoted to own compositing layer, pointer-events none */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full opacity-60 app-bloom-1" />
          <div className="absolute -bottom-32 -right-32 w-72 h-72 rounded-full opacity-60 app-bloom-2" />
        </div>

        <TitleBar />

        <div className="flex flex-1 overflow-hidden relative z-10">
          <Sidebar />

          <main className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePage}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                data-page-container
                className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                style={{ scrollbarGutter: 'stable', willChange: 'opacity, transform' }}
              >
                <Suspense fallback={<PageFallback />}>
                  <ActivePage />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <ToastProvider />
      </div>

      {/* Update modal — rendered outside main layout so it overlays everything.
          Mandatory updates block all interaction (no backdrop dismiss, no Skip). */}
      {showModal && updateState && (
        <UpdateModal
          state={updateState}
          onSkip={handleSkip}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}
