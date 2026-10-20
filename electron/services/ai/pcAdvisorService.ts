import axios from 'axios';

const API_BASE = process.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com';

export interface PCAdvisorQuotaExceeded {
  ok: false;
  quotaExceeded: true;
  code: 'AI_QUOTA_EXCEEDED';
  used?: number;
  limit?: number;
  resetsAt?: string;
  message: string;
}

export interface PCAdvisorSuccess {
  ok: true;
  data: any;
}

export interface PCAdvisorError {
  ok: false;
  quotaExceeded?: false;
  code?: string;
  message: string;
  retryable: boolean;
}

export type PCAdvisorDiagnosisResult = PCAdvisorSuccess | PCAdvisorQuotaExceeded | PCAdvisorError;

export async function pingBackendHealth(): Promise<void> {
  try {
    await axios.get(`${API_BASE}/api/health`, { timeout: 10000 });
  } catch {
    // Fire-and-forget wakeup ping
  }
}

export async function getPCAdvisorDiagnosis(payload: any, token: string): Promise<any> {
  try {
    const res = await axios.post(`${API_BASE}/api/ai/diagnose`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 35000 // 35s to allow backend 28s timeout + retry budget to complete cleanly
    });
    return { ok: true, data: res.data };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (data?.code === 'AI_QUOTA_EXCEEDED' || data?.error === 'AI_QUOTA_EXCEEDED') {
        return {
          ok: false,
          quotaExceeded: true,
          code: 'AI_QUOTA_EXCEEDED',
          status: status || 429,
          used: typeof data.used === 'number' ? data.used : undefined,
          limit: typeof data.limit === 'number' ? data.limit : undefined,
          resetsAt: typeof data.resetsAt === 'string' ? data.resetsAt : undefined,
          message: data.message || 'You have reached your monthly diagnostic limit.'
        };
      }
      if (data?.code || data?.error) {
        return {
          ok: false,
          quotaExceeded: false,
          code: data.code || data.error,
          status,
          message: data.message || 'PC Advisor is temporarily unavailable.',
          retryable: true
        };
      }
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        return {
          ok: false,
          quotaExceeded: false,
          code: 'AI_TIMEOUT',
          status: 504,
          message: 'Analysis took longer than expected. Please try again in a few seconds.',
          retryable: true
        };
      }
      return {
        ok: false,
        quotaExceeded: false,
        code: 'NETWORK_ERROR',
        status,
        message: 'Unable to reach PC Advisor right now. Check your connection and try again.',
        retryable: true
      };
    }
    return {
      ok: false,
      quotaExceeded: false,
      code: 'UNKNOWN_ERROR',
      message: (err as Error).message || 'An error occurred during analysis.',
      retryable: true
    };
  }
}

