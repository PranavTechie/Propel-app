import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import type { UpdateState } from '@/types'

export type ManualCheckResult = 'upToDate' | 'error' | null

export interface UseUpdateCheckReturn {
  updateState:        UpdateState | null
  showModal:          boolean
  manualChecking:     boolean
  manualCheckResult:  ManualCheckResult
  handleSkip:         () => Promise<void>
  handleUpdate:       () => void
  triggerManualCheck: () => Promise<void>
  clearManualResult:  () => void
}

/**
 * Full hook — used in AppLayout.
 * Runs the silent startup check AND exposes manual-trigger helpers.
 */
export function useUpdateCheck(): UseUpdateCheckReturn {
  const updateState        = useAppStore(s => s.updateState)
  const updateModalVisible = useAppStore(s => s.updateModalVisible)
  const setUpdateState     = useAppStore(s => s.setUpdateState)
  const showUpdateModal    = useAppStore(s => s.showUpdateModal)
  const hideUpdateModal    = useAppStore(s => s.hideUpdateModal)

  const [manualChecking,    setManualChecking]    = useState(false)
  const [manualCheckResult, setManualCheckResult] = useState<ManualCheckResult>(null)

  // ── Startup silent check (runs once when AppLayout mounts) ───────────
  useEffect(() => {
    let active = true
    window.propel.updater
      .check()
      .then(state => {
        if (active && state && state.available) {
          setUpdateState(state as UpdateState)
          showUpdateModal()
        }
      })
      .catch(() => { /* silent on startup */ })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerManualCheck = useCallback(async () => {
    setManualChecking(true)
    setManualCheckResult(null)
    try {
      const state = await window.propel.updater.check()
      if (state && state.available) {
        setUpdateState(state as UpdateState)
        showUpdateModal()
      } else {
        setManualCheckResult('upToDate')
      }
    } catch {
      setManualCheckResult('error')
    } finally {
      setManualChecking(false)
    }
  }, [setUpdateState, showUpdateModal])

  const clearManualResult = useCallback(() => setManualCheckResult(null), [])

  const handleSkip = useCallback(async () => {
    if (!updateState) return
    await window.propel.updater.skip(updateState.latestVersion)
    hideUpdateModal()
  }, [updateState, hideUpdateModal])

  const handleUpdate = useCallback(() => {
    if (!updateState) return
    window.electronAPI.shell.openExternal(updateState.websiteUrl)
  }, [updateState])

  return {
    updateState,
    showModal: updateModalVisible,
    manualChecking,
    manualCheckResult,
    handleSkip,
    handleUpdate,
    triggerManualCheck,
    clearManualResult,
  }
}

/**
 * Lightweight hook — used in pages (e.g. AboutPage).
 * NO startup check. Only exposes the manual trigger and shared modal state.
 */
export function useManualUpdateCheck() {
  const updateState        = useAppStore(s => s.updateState)
  const updateModalVisible = useAppStore(s => s.updateModalVisible)
  const setUpdateState     = useAppStore(s => s.setUpdateState)
  const showUpdateModal    = useAppStore(s => s.showUpdateModal)
  const hideUpdateModal    = useAppStore(s => s.hideUpdateModal)

  const [manualChecking,    setManualChecking]    = useState(false)
  const [manualCheckResult, setManualCheckResult] = useState<ManualCheckResult>(null)

  const triggerManualCheck = useCallback(async () => {
    setManualChecking(true)
    setManualCheckResult(null)
    try {
      const state = await window.propel.updater.check()
      if (state && state.available) {
        setUpdateState(state as UpdateState)
        showUpdateModal()
      } else {
        setManualCheckResult('upToDate')
      }
    } catch {
      setManualCheckResult('error')
    } finally {
      setManualChecking(false)
    }
  }, [setUpdateState, showUpdateModal])

  const clearManualResult = useCallback(() => setManualCheckResult(null), [])

  const handleSkip = useCallback(async () => {
    if (!updateState) return
    await window.propel.updater.skip(updateState.latestVersion)
    hideUpdateModal()
  }, [updateState, hideUpdateModal])

  const handleUpdate = useCallback(() => {
    if (!updateState) return
    window.electronAPI.shell.openExternal(updateState.websiteUrl)
  }, [updateState])

  return {
    manualChecking,
    manualCheckResult,
    triggerManualCheck,
    clearManualResult,
    // expose these so AboutPage can consume the modal from its side too if needed
    handleSkip,
    handleUpdate,
    showModal: updateModalVisible,
    updateState,
  }
}
