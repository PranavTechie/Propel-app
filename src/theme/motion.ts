// Motion tokens for framer-motion. Mirrors --dur-* / --ease-* in tokens.css.
// All UI motion stays inside 120-320ms. Reduced motion is handled globally by
// <MotionConfig reducedMotion="user"> in AppLayout plus the CSS media query.
import type { Transition, Variants } from "framer-motion";

export const DUR = { fast: 0.12, base: 0.2, slow: 0.32 } as const;
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

export const tBase: Transition = { duration: DUR.base, ease: EASE_OUT };
export const tSlow: Transition = { duration: DUR.slow, ease: EASE_OUT };

/** Container that staggers its children 40ms apart. */
export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

/** Card entrance: fade + 8px rise. */
export const rise: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: tBase },
};
