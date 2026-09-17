import { useEffect, useState } from 'react'

export type PerfProfile = 'full' | 'lite'

/**
 * Detects low-end hardware at mount and returns 'lite' when:
 *  - CPU cores <= 4, OR
 *  - RAM (deviceMemory) <= 4 GB
 *
 * The 'lite' profile is picked up by [data-perf="lite"] CSS rules that
 * reduce backdrop-filter blur, ambient glow opacity, and shadow spread.
 */
export function usePerformanceProfile(): PerfProfile {
  const [profile, setProfile] = useState<PerfProfile>('full')

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
    if (cores <= 4 || memory <= 4) {
      setProfile('lite')
    }
  }, [])

  return profile
}
