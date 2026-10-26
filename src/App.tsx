import React from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useAppStore } from '@/store/appStore'
import { SplashScreen }      from '@/pages/SplashScreen'
import { NoInternetScreen }  from '@/pages/NoInternetScreen'
import { LoginPage }         from '@/pages/LoginPage'
import { DeviceLimitScreen } from '@/pages/DeviceLimitScreen'
import { AppLayout }         from '@/components/layout/AppLayout'
import { OverlayApp }        from '@/components/overlay/OverlayApp'

// Overlay window loads the same renderer URL with ?mode=overlay
const IS_OVERLAY = new URLSearchParams(window.location.search).get('mode') === 'overlay'

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.24 } }
// Splash is on screen when the window is revealed, so it never fades in;
// it only fades out while the next screen fades in underneath (cross-fade,
// no blank frame between them).
const SPLASH_EXIT = { exit: { opacity: 0 }, transition: { duration: 0.2 } }

const MainApp: React.FC = () => { // Main app component
  const phase = useAppStore(s => s.phase)

  return (
    // Respect Windows "reduce animations" on every screen, incl. login/splash.
    <MotionConfig reducedMotion="user">
    <AnimatePresence initial={false}>
      {phase === 'splash' && (
        <motion.div key="splash" {...SPLASH_EXIT} className="fixed inset-0 z-50">
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

      {phase === 'device_limit' && (
        <motion.div key="device_limit" {...FADE} className="fixed inset-0 z-40">
          <DeviceLimitScreen />
        </motion.div>
      )}

      {phase === 'main' && (
        <motion.div key="main" {...FADE} className="fixed inset-0 z-30">
          <AppLayout />
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  )
}

export const App: React.FC = () => { // App component
  return IS_OVERLAY ? <OverlayApp /> : <MainApp />
}
