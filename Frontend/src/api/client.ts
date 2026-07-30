/** API client — Vite proxies /api → Backend :8000 in dev */

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<any>('/api/ml/health'),
  predict: (body: Record<string, unknown>) =>
    request<any>('/api/ml/predict', { method: 'POST', body: JSON.stringify(body) }),
  alerts: (resolved = false, limit = 100) =>
    request<any>(`/api/alerts?resolved=${resolved}&limit=${limit}`),
  resolveAlert: (alertId: number) =>
    request<any>('/api/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ alertId }),
    }),
  telemetry: () => request<any>('/api/telemetry'),
  simulate: (body: Record<string, unknown>) =>
    request<any>('/api/simulate', { method: 'POST', body: JSON.stringify(body) }),
};
