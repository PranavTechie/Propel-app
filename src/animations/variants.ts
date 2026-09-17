import type { Variants, Transition } from 'framer-motion'

export const fastSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

export const smoothTween: Transition = {
  type: 'tween',
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: 0.35,
}

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 28 },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: smoothTween },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
}

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export const splashVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.1 },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    transition: { duration: 0.4, ease: 'easeIn' },
  },
}

export const shimmerVariants: Variants = {
  initial: { x: '-100%' },
  animate: {
    x: '100%',
    transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
  },
}

export const pulseGlow: Variants = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(99,102,241,0)',
      '0 0 24px rgba(99,102,241,0.5)',
      '0 0 0px rgba(99,102,241,0)',
    ],
    transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' },
  },
}

export const counterVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}
