import React from 'react'
import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
  style?:     React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, style }) => (
  <div className={cn('animate-pulse rounded-lg bg-white/[0.05]', className)} style={style} />
)

export const SkeletonCard: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className }) => (
  <div className={cn('glass rounded-2xl p-4 space-y-3', className)}>
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-2.5" style={{ width: `${90 - i * 15}%`, opacity: 1 - i * 0.2 }} />
    ))}
  </div>
)

export const SkeletonStatCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('glass rounded-2xl p-4', className)}>
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="w-8 h-8 rounded-xl" />
      <Skeleton className="w-14 h-2.5" />
    </div>
    <Skeleton className="h-5 w-24 mb-2" />
    <Skeleton className="h-2.5 w-full mb-1" />
    <Skeleton className="h-1.5 w-full mt-2 rounded-full" />
  </div>
)

export const SkeletonRow: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center gap-3 p-3', className)}>
    <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-2.5 w-40" />
      <Skeleton className="h-2 w-24" />
    </div>
    <Skeleton className="w-16 h-5 rounded-lg" />
  </div>
)
