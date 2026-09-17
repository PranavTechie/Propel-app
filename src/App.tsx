import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/appStore'
import { SplashScreen }      from '@/pages/SplashScreen'
import { NoInternetScreen }  from '@/pages/NoInternetScreen'
import { LoginPage }         from '@/pages/LoginPage'
import { AppLayout }         from '@/components/layout/AppLayout'
import { OverlayApp }        from '@/components/overlay/OverlayApp'

// Overlay window loads the same renderer URL with ?mode=overlay
const IS_OVERLAY = new URLSearchParams(window.location.search).get('mode') === 'overlay'

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3 } }

const MainApp: React.FC = () => { // Main app component
  const phase = useAppStore(s => s.phase)

  return (
    <AnimatePresence mode="wait">
      {phase === 'splash' && (
        <motion.div key="splash" className="fixed inset-0 z-50">
          <SplashScreen />
        </motion.div>
      )}

      {phase === 'no_internet' && (
        <motion.div key="no_internet" {...FADE} className="fixed inset-0 z-50">
          <NoInternetScreen />
        </motion.div>
      )}

      {phase === 'login' && (
        <motion.div key="login" {...FADE} className="fixed inset-0 z-40">
          <LoginPage />
        </motion.div>
      )}

      {phase === 'main' && (
        <motion.div key="main" {...FADE} className="fixed inset-0 z-30">
          <AppLayout />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const App: React.FC = () => { // App component
  return IS_OVERLAY ? <OverlayApp /> : <MainApp />
}
