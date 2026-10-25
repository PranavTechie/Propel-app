import React from "react";
import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Shimmer placeholder. Never leave a loading area blank. */
export const Skeleton: React.FC<SkeletonProps> = ({ className, style }) => (
  <div aria-hidden className={cn("skeleton", className)} style={style} />
);

export const SkeletonCard: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className,
}) => (
  <div
    role="status"
    aria-label="Loading"
    className={cn("space-y-3 rounded-card border border-line-subtle bg-surface-raised p-4", className)}
  >
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-2.5" style={{ width: `${90 - i * 15}%` }} />
    ))}
  </div>
);

export const SkeletonStatCard: React.FC<{ className?: string }> = ({ className }) => (
  <div
    role="status"
    aria-label="Loading"
    className={cn("rounded-card border border-line-subtle bg-surface-raised p-4", className)}
  >
    <div className="mb-3 flex items-center justify-between">
      <Skeleton className="h-2.5 w-14" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="mb-3 h-7 w-20" />
    <Skeleton className="mb-3 h-8 w-full" />
    <Skeleton className="h-1.5 w-full rounded-full" />
  </div>
);

export const SkeletonRow: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden className={cn("flex items-center gap-3 p-3", className)}>
    <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-2.5 w-40" />
      <Skeleton className="h-2 w-24" />
    </div>
    <Skeleton className="h-5 w-16 rounded-chip" />
  </div>
);
