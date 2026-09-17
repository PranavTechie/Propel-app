import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: boolean
  elevated?: boolean
  as?: 'div' | 'motion'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, glow = false, elevated = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-2xl',
          elevated ? 'glass-elevated' : 'glass',
          hover && 'glass-hover cursor-pointer',
          glow && 'glow-primary',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

interface MotionCardProps extends React.ComponentProps<typeof motion.div> {
  hover?: boolean
  glow?: boolean
  elevated?: boolean
}

export const MotionCard: React.FC<MotionCardProps> = ({
  className,
  hover = false,
  glow = false,
  elevated = false,
  children,
  ...props
}) => {
  return (
    <motion.div
      className={cn(
        'relative rounded-2xl',
        elevated ? 'glass-elevated' : 'glass',
        hover && 'glass-hover cursor-pointer',
        glow && 'glow-primary',
        className,
      )}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-between px-5 pt-5 pb-3', className)} {...props} />
)

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('px-5 pb-5', className)} {...props} />
)

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 className={cn('text-sm font-semibold text-text-primary', className)} {...props} />
)

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn('text-xs text-text-secondary', className)} {...props} />
)
