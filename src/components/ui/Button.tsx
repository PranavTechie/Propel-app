import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:
    '[background:var(--t-btn-bg)] [box-shadow:var(--t-btn-shadow)] text-white border border-brand-primary/30 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-primary/50',
  secondary:
    'bg-gradient-to-r from-brand-accent to-brand-primary text-white border border-brand-accent/30 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-primary/50',
  ghost:
    'bg-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary border border-transparent hover:border-border-hover',
  danger:
    'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400/30 hover:from-red-400 hover:to-red-500',
  success:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400/30 hover:from-emerald-400 hover:to-teal-400',
  outline:
    'bg-transparent text-text-primary border border-brand-primary hover:border-brand-primary/50 hover:bg-white/5',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-6 text-base gap-2.5 rounded-xl',
  icon: 'h-9 w-9 p-0 rounded-xl',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, iconRight, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? {} : { scale: 1.02 }}
        whileTap={isDisabled ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'relative inline-flex items-center justify-center font-medium',
          'transition-all duration-200 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={isDisabled}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </motion.button>
    )
  },
)

Button.displayName = 'Button'
