import React from 'react'
import { motion } from 'framer-motion'
import { MonitorX, LogOut } from 'lucide-react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base" style={{ background: 'var(--t-app-bg)' }}>
      <div className="absolute inset-0 grid-bg opacity-45 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/[.03] rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 max-w-[420px] w-full p-8 text-center"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
          <MonitorX className="h-8 w-8 text-red-500" />
        </div>
        
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary mb-3">
          Device limit reached
        </h1>
        
        <p className="text-[15px] leading-relaxed text-text-secondary mb-8">
          {isFree
            ? `Free account device abuse limit reached (maximum ${limit} devices). You must remove an old device from your dashboard before logging in here.`
            : `Your current plan allows ${limit} active devices. You must remove an old device from your dashboard before logging in here.`}
        </p>

        <div className="space-y-4">
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white border-none shadow-[0_4px_14px_rgba(239,68,68,0.3)]"
            onClick={() => window.electronAPI.shell.openExternal(PROPEL_DEVICES_URL)}
          >
            Manage Devices
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-text-muted hover:text-text-primary"
            icon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
