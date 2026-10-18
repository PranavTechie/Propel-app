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

export async function getPCAdvisorDiagnosis(payload: any, token: string): Promise<any> {
  try {
    const res = await axios.post(`${API_BASE}/api/ai/diagnose`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 20000 // A bit longer than 15s to allow backend timeout to fire first
    });
    return { ok: true, data: res.data };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data;
      if (data?.code === 'AI_QUOTA_EXCEEDED' || data?.error === 'AI_QUOTA_EXCEEDED') {
        return {
          ok: false,
          quotaExceeded: true,
          code: 'AI_QUOTA_EXCEEDED',
          used: typeof data.used === 'number' ? data.used : undefined,
          limit: typeof data.limit === 'number' ? data.limit : undefined,
          resetsAt: typeof data.resetsAt === 'string' ? data.resetsAt : undefined,
          message: data.message || 'You have reached your monthly diagnostic limit.'
        };
      }
      if (data?.code === 'AI_COOLDOWN') {
        return {
          ok: false,
          quotaExceeded: false,
          code: 'AI_COOLDOWN',
          message: data.message || 'Please wait before requesting another diagnosis.',
          retryable: true
        };
      }
      if (data?.message) {
        return {
          ok: false,
          quotaExceeded: false,
          code: data.code || data.error,
          message: data.message,
          retryable: true
        };
      }
      return {
        ok: false,
        quotaExceeded: false,
        message: 'Unable to reach PC Advisor right now. Check your connection and try again.',
        retryable: true
      };
    }
    return {
      ok: false,
      quotaExceeded: false,
      message: (err as Error).message || 'An error occurred during analysis.',
      retryable: true
    };
  }
}

