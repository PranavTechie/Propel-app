import axios from 'axios'

const API_BASE = process.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com'

export interface ExchangeResponse {
  success: boolean
  session?: {
    access_token: string
    refresh_token: string
  }
  message?: string
}

export type ExchangeResult =
  | { ok: true; session: ExchangeResponse['session'] }
  | { ok: false; success: false; status: number | null; message: string; stage: string }

export async function exchangeAuthCode(code: string, state?: string): Promise<ExchangeResult> {
  const targetUrl = `${API_BASE}/api/auth/exchange`
  console.log(`[AUTH IPC] Target URL: ${targetUrl}`)
  try {
    const res = await axios.post<ExchangeResponse>(targetUrl, { code, state }, {
      timeout: 14000
    })

    if (res.data.success && res.data.session) {
      console.log(`[AUTH IPC] Backend response received (success)`)
      return { ok: true, session: res.data.session }
    }
    console.log(`[AUTH IPC] Backend response received (failure: ${res.data.message})`)
    return { ok: false, success: false, status: res.status, message: res.data.message || 'server_error', stage: 'exchange' }
  } catch (err: unknown) {
    const isAxios = axios.isAxiosError(err)
    const status = isAxios ? err.response?.status || null : null
    const message = isAxios && err.response?.data?.message ? err.response.data.message : 'network_error'
    console.error(`[AUTH IPC] Backend request failed:`, message, status)
    return {
      ok: false,
      success: false,
      status,
      message,
      stage: 'exchange'
    }
  }
}

