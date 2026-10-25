import React from 'react'
import { WifiOff } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export const OfflineBanner: React.FC = () => {
  const isOffline = useAppStore(s => s.entitlementStatus.isOffline)

  if (!isOffline) return null

  return (
    <div
      className="relative z-20 flex h-7 shrink-0 items-center justify-center gap-2 border-b border-warning/25 bg-warning-soft px-3 text-caption text-warning-fg"
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span className="font-semibold">Offline: using saved plan</span>
    </div>
  )
}
