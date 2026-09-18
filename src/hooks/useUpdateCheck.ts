import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import type { UpdateState } from '@/types'

export type ManualCheckResult = 'checking' | 'upToDate' | 'downloading' | 'ready' | 'error' | null

export interface UseUpdateCheckReturn {
  updateState:            UpdateState | null
  showModal:              boolean
  bannerVisible:          boolean
  handleDismissBanner:    () => void
  handleOpenModal:        () => void
  handleCloseModal:       () => void
  handleRestartAndInstall: () => void
  handleRetry:            () => void
  triggerManualCheck:     () => Promise<void>
}

/**
 * Full hook — used in AppLayout.
 * Listens to electron-updater state events and manages startup & banner flow.
 */
export function useUpdateCheck(): UseUpdateCheckReturn {
  const updateState           = useAppStore(s => s.updateState)
  const updateModalVisible    = useAppStore(s => s.updateModalVisible)
  const updateBannerVisible   = useAppStore(s => s.updateBannerVisible)
  const setUpdateState        = useAppStore(s => s.setUpdateState)
  const showUpdateModal       = useAppStore(s => s.showUpdateModal)
  const hideUpdateModal       = useAppStore(s => s.hideUpdateModal)
  const setUpdateBannerVisible = useAppStore(s => s.setUpdateBannerVisible)
  const dismissUpdateBanner   = useAppStore(s => s.dismissUpdateBanner)

  const bannerDismissedRef = useRef(false)

  // ── Listen to updater push events from Electron Main ─────────────────────
  useEffect(() => {
    // Subscribe to IPC state change notifications
    const unsubscribe = window.propel.updater.onStateChanged((state) => {
      setUpdateState(state)

      if (state.status === 'downloading') {
        if (!bannerDismissedRef.current) {
          setUpdateBannerVisible(true)
        }
      } else if (state.status === 'downloaded') {
        setUpdateBannerVisible(false)
        showUpdateModal()
      }
    })

    // Run non-blocking startup check
    window.propel.updater
      .check({ isManual: false })
      .catch(() => {
        // Silently ignore offline or network errors on startup
      })

    return () => {
      unsubscribe()
    }
  }, [setUpdateState, setUpdateBannerVisible, showUpdateModal])

  const handleDismissBanner = useCallback(() => {
    bannerDismissedRef.current = true
    dismissUpdateBanner()
  }, [dismissUpdateBanner])

  const handleOpenModal = useCallback(() => {
    showUpdateModal()
  }, [showUpdateModal])

  const handleCloseModal = useCallback(() => {
    hideUpdateModal()
  }, [hideUpdateModal])

  const handleRestartAndInstall = useCallback(() => {
    window.propel.updater.install()
  }, [])

  const handleRetry = useCallback(() => {
    window.propel.updater.check({ isManual: true }).catch(() => {})
  }, [])

  const triggerManualCheck = useCallback(async () => {
    try {
      const state = await window.propel.updater.check({ isManual: true })
      if (state) {
        setUpdateState(state)
        if (state.status === 'downloaded' || state.available) {
          showUpdateModal()
        }
      }
    } catch {
      // Ignored
    }
  }, [setUpdateState, showUpdateModal])

  return {
    updateState,
    showModal: updateModalVisible,
    bannerVisible: updateBannerVisible,
    handleDismissBanner,
    handleOpenModal,
    handleCloseModal,
    handleRestartAndInstall,
    handleRetry,
    triggerManualCheck,
  }
}

/**
 * Lightweight hook — used in AboutPage for manual checking.
 */
export function useManualUpdateCheck() {
  const updateState           = useAppStore(s => s.updateState)
  const setUpdateState        = useAppStore(s => s.setUpdateState)
  const showUpdateModal       = useAppStore(s => s.showUpdateModal)
  const [manualChecking, setManualChecking] = useState(false)
  const [manualCheckResult, setManualCheckResult] = useState<ManualCheckResult>(null)

  const triggerManualCheck = useCallback(async () => {
    setManualChecking(true)
    setManualCheckResult('checking')

    try {
      const state = await window.propel.updater.check({ isManual: true })
      if (state) {
        setUpdateState(state)
        if (state.status === 'downloaded') {
          setManualCheckResult('ready')
          showUpdateModal()
        } else if (state.status === 'downloading') {
          setManualCheckResult('downloading')
          showUpdateModal()
        } else if (state.available) {
          setManualCheckResult('downloading')
          showUpdateModal()
        } else if (state.status === 'not-available' || !state.available) {
          setManualCheckResult('upToDate')
        } else if (state.status === 'error') {
          setManualCheckResult('error')
        }
      } else {
        setManualCheckResult('upToDate')
      }
    } catch {
      setManualCheckResult('error')
    } finally {
      setManualChecking(false)
    }
  }, [setUpdateState, showUpdateModal])

  const clearManualResult = useCallback(() => {
    setManualCheckResult(null)
  }, [])

  return {
    manualChecking,
    manualCheckResult,
    triggerManualCheck,
    clearManualResult,
    updateState,
  }
}
