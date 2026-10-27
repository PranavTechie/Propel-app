import axios from 'axios'
import { saveCachedEntitlement, getAuthEpoch } from './entitlementCache'

// We get API_BASE from env or fallback for local dev
const API_BASE = process.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com'

export interface EntitlementResponse {
  success: boolean
  data?: {
    plan: 'FREE' | 'PRO' | 'MAX'
    limits?: {
      devices: number
      aiChecksPerMonth: number
    }
    features?: {
      customThresholds: boolean
      alwaysOnMaintenance: boolean
    }
    expiresAt?: string | null
    serverTime?: string
    source: 'plan' | 'subscription' | 'trial'
    trial_active: boolean
    trial_expires_at: string | null
    subscription_status: string
    db_plan: string
  }
  message?: string
}

export type EntitlementResult =
  | { ok: true; data: EntitlementResponse['data'] }
  | { ok: false; networkError: boolean; message: string }

export async function fetchEntitlements(accessToken: string): Promise<EntitlementResult> {
  const epoch = getAuthEpoch()
  try {
    const res = await axios.get<EntitlementResponse>(`${API_BASE}/api/entitlements`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 14000
    })

    if (res.data.success && res.data.data) {
      // Cache immediately upon successful fetch
      await saveCachedEntitlement({
        plan: res.data.data.plan,
        features: res.data.data.features,
        limits: res.data.data.limits,
        expiresAt: res.data.data.expiresAt,
        serverTime: res.data.data.serverTime,
        fetchedAt: Date.now(),
        source: res.data.data.source,
        trial_active: res.data.data.trial_active,
        trial_expires_at: res.data.data.trial_expires_at,
        subscription_status: res.data.data.subscription_status,
      }, epoch)

      return { ok: true, data: res.data.data }
    }
    return { ok: false, networkError: false, message: res.data.message || 'server_error' }
  } catch (err: unknown) {
    const isNetwork = axios.isAxiosError(err) && (!err.response || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')
    
    if (isNetwork) {
      return { ok: false, networkError: true, message: 'network_error' }
    }

    return {
      ok: false,
      networkError: false,
      message: axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : 'server_error'
    }
  }
}
