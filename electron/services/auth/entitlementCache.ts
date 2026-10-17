import fs from 'fs'
import fsPromises from 'fs/promises'
import { getEntitlementFilePath } from '../../utils/userData'

export interface EntitlementFeatures {
  customThresholds: boolean
  alwaysOnMaintenance: boolean
}

export interface EntitlementLimits {
  devices: number
  aiChecksPerMonth: number
}

export interface CachedEntitlementPayload {
  plan: 'FREE' | 'PRO' | 'MAX'
  features: EntitlementFeatures
  limits: EntitlementLimits
  expiresAt: string | null
  serverTime: string
  fetchedAt: number
  source?: string
  trial_active?: boolean
  trial_expires_at?: string | null
  subscription_status?: string
}

export interface EvaluatedEntitlement extends CachedEntitlementPayload {
  isExpired: boolean
  isTampered: boolean
  isFallback: boolean
}

export const OFFLINE_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
const CLOCK_ROLLBACK_TOLERANCE_MS = 60 * 1000 // 1 minute tolerance for clock adjustments

export const DEFAULT_FREE_ENTITLEMENT: EvaluatedEntitlement = {
  plan: 'FREE',
  features: {
    customThresholds: false,
    alwaysOnMaintenance: false,
  },
  limits: {
    devices: 10,
    aiChecksPerMonth: 1,
  },
  expiresAt: null,
  serverTime: new Date(0).toISOString(),
  fetchedAt: 0,
  source: 'plan',
  trial_active: false,
  trial_expires_at: null,
  subscription_status: '',
  isExpired: false,
  isTampered: false,
  isFallback: true,
}

/**
 * Evaluates whether a cached entitlement payload is valid, expired, or tampered.
 * In any invalid/expired/tampered scenario, local features revert to FREE.
 */
export function evaluateEntitlement(
  payload: CachedEntitlementPayload | null | undefined,
  now: number = Date.now()
): EvaluatedEntitlement {
  if (!payload || !payload.plan) {
    return { ...DEFAULT_FREE_ENTITLEMENT, isFallback: true }
  }

  // If the plan is already FREE, it is always valid as FREE
  if (payload.plan === 'FREE') {
    return {
      ...payload,
      features: {
        customThresholds: false,
        alwaysOnMaintenance: false,
      },
      limits: payload.limits || { devices: 10, aiChecksPerMonth: 1 },
      isExpired: false,
      isTampered: false,
      isFallback: false,
    }
  }

  const fetchedAt = Number(payload.fetchedAt) || 0
  const serverTimeMs = new Date(payload.serverTime).getTime()

  // 1. Clock Rollback Detection
  // If current local time is before the time this entitlement was fetched (with 1m tolerance),
  // local clock was moved backward to artificially extend access.
  if (now < fetchedAt - CLOCK_ROLLBACK_TOLERANCE_MS) {
    console.warn('[EntitlementCache] Clock rollback detected! Treating entitlement as expired.')
    return {
      ...DEFAULT_FREE_ENTITLEMENT,
      isExpired: true,
      isTampered: true,
      isFallback: false,
    }
  }

  const elapsedLocal = Math.max(0, now - fetchedAt)

  // 2. Offline 3-day Grace Period Check
  // Server-confirmed access can only be cached offline for at most 3 days.
  if (elapsedLocal > OFFLINE_GRACE_PERIOD_MS) {
    console.info('[EntitlementCache] Offline grace period (3 days) expired. Reverting to FREE.')
    return {
      ...DEFAULT_FREE_ENTITLEMENT,
      isExpired: true,
      isTampered: false,
      isFallback: false,
    }
  }

  // 3. Subscription / Trial Expiry Check
  // Effective current server time: server timestamp at fetch + local elapsed time.
  const effectiveServerTime = (!isNaN(serverTimeMs) && serverTimeMs > 0)
    ? serverTimeMs + elapsedLocal
    : now

  if (payload.expiresAt) {
    const expiresAtMs = new Date(payload.expiresAt).getTime()
    if (!isNaN(expiresAtMs) && effectiveServerTime >= expiresAtMs) {
      console.info('[EntitlementCache] Entitlement expired at', payload.expiresAt, '. Reverting to FREE.')
      return {
        ...DEFAULT_FREE_ENTITLEMENT,
        isExpired: true,
        isTampered: false,
        isFallback: false,
      }
    }
  }

  // Entitlement is valid and active
  return {
    ...payload,
    isExpired: false,
    isTampered: false,
    isFallback: false,
  }
}

/**
 * Synchronously reads and evaluates the cached entitlement file.
 * Required for --scheduled-maintenance hidden startup before window initialization.
 */
export function getCachedEntitlementSync(): EvaluatedEntitlement {
  const filePath = getEntitlementFilePath()
  try {
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_FREE_ENTITLEMENT, isFallback: true }
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as CachedEntitlementPayload
    return evaluateEntitlement(parsed)
  } catch (err) {
    console.warn('[EntitlementCache] Failed to read cached entitlement sync:', err)
    return { ...DEFAULT_FREE_ENTITLEMENT, isFallback: true }
  }
}

/**
 * Asynchronously reads and evaluates the cached entitlement file.
 */
export async function getCachedEntitlement(): Promise<EvaluatedEntitlement> {
  const filePath = getEntitlementFilePath()
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as CachedEntitlementPayload
    return evaluateEntitlement(parsed)
  } catch {
    return { ...DEFAULT_FREE_ENTITLEMENT, isFallback: true }
  }
}

/**
 * Writes updated entitlement data to userData (propel_entitlement.json).
 */
export async function saveCachedEntitlement(data: {
  plan: 'FREE' | 'PRO' | 'MAX'
  features?: EntitlementFeatures
  limits?: EntitlementLimits
  expiresAt?: string | null
  serverTime?: string
  fetchedAt?: number
  source?: string
  trial_active?: boolean
  trial_expires_at?: string | null
  subscription_status?: string
}): Promise<void> {
  const filePath = getEntitlementFilePath()
  const payload: CachedEntitlementPayload = {
    plan: data.plan,
    features: data.features || {
      customThresholds: data.plan !== 'FREE',
      alwaysOnMaintenance: data.plan !== 'FREE',
    },
    limits: data.limits || {
      devices: data.plan === 'MAX' ? 3 : data.plan === 'PRO' ? 2 : 10,
      aiChecksPerMonth: data.plan === 'MAX' ? 50 : data.plan === 'PRO' ? 10 : 1,
    },
    expiresAt: data.expiresAt ?? null,
    serverTime: data.serverTime || new Date().toISOString(),
    fetchedAt: data.fetchedAt || Date.now(),
    source: data.source,
    trial_active: data.trial_active,
    trial_expires_at: data.trial_expires_at,
    subscription_status: data.subscription_status,
  }

  try {
    await fsPromises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
    console.log('[EntitlementCache] Cached entitlement updated successfully for plan:', payload.plan)
  } catch (err) {
    console.error('[EntitlementCache] Failed to write cached entitlement:', err)
  }
}
