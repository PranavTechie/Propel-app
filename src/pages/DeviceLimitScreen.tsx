import React from 'react'
import { motion } from 'framer-motion'
import { MonitorX, LogOut, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/appStore'
import { PROPEL_DEVICES_URL } from '@/constants/appConstants'

export const DeviceLimitScreen: React.FC = () => {
  const resetUserSession = useAppStore(s => s.resetUserSession)
  const setPhase = useAppStore(s => s.setPhase)
  const entitlement = useAppStore(s => s.entitlementStatus)

  const isFree = entitlement.plan === 'FREE'
  const limit = entitlement.limits?.devices ?? (entitlement.plan === 'MAX' ? 3 : isFree ? 10 : 2)

  const handleLogout = () => {
    resetUserSession()
    setPhase('login')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(circle_at_50%_45%,black,transparent_65%)]" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-[440px] px-6"
      >
        <div className="rounded-panel border border-line bg-surface-raised p-8 text-center shadow-[var(--shadow-3),var(--highlight-top)]">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-card border border-danger/25 bg-danger-soft text-danger-fg">
            <MonitorX className="h-7 w-7" />
          </div>

          <h1 className="mb-2 font-display text-[26px] font-semibold leading-8 tracking-[-.025em] text-fg-1">
            Device limit reached
          </h1>

          <p className="mb-7 text-body text-fg-2">
            {isFree
              ? `Free account device abuse limit reached (maximum ${limit} devices). You must remove an old device from your dashboard before logging in here.`
              : `Your current plan allows ${limit} active devices. You must remove an old device from your dashboard before logging in here.`}
          </p>

          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              icon={<ExternalLink />}
              onClick={() => window.electronAPI.shell.openExternal(PROPEL_DEVICES_URL)}
            >
              Manage Devices
            </Button>
            <Button variant="ghost" className="w-full" icon={<LogOut />} onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
