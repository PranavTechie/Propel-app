import axios from 'axios';

const API_BASE = process.env.VITE_API_BASE_URL || 'https://cleanmasterpro-backend-server.onrender.com';

export async function getPCAdvisorDiagnosis(payload: any, token: string): Promise<any> {
  try {
    const res = await axios.post(`${API_BASE}/api/ai/diagnose`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 20000 // A bit longer than 15s to allow backend timeout to fire first
    });
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Unable to reach PC Advisor right now. Check your connection and try again.');
    }
    throw err;
  }
}
