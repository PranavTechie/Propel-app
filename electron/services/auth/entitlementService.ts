import axios from 'axios'

// We get API_BASE from env or fallback for local dev
const API_BASE = process.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com'

export interface EntitlementResponse {
  success: boolean
  data?: {
    plan: 'FREE' | 'PRO' | 'MAX'
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
  try {
    const res = await axios.get<EntitlementResponse>(`${API_BASE}/api/entitlements`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 14000
    })

    if (res.data.success && res.data.data) {
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
