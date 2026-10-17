import React from 'react'
import { WifiOff } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export const OfflineBanner: React.FC = () => {
  const isOffline = useAppStore(s => s.entitlementStatus.isOffline)

  if (!isOffline) return null

  return (
    <div 
      className="relative z-20 flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1 text-center text-xs text-amber-300 backdrop-blur-sm"
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span className="font-medium">Offline: using saved plan</span>
    </div>
  )
}
