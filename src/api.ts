const BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string {
  return localStorage.getItem('val_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('val_token', token);
}

export function clearToken() {
  localStorage.removeItem('val_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorised');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: { id: string; email: string; name: string } }>(
      'POST', '/api/auth/login', { email, password }
    ),
  getValuations: () => req<any[]>('GET', '/api/valuations'),
  getValuation: (id: string) => req<any>('GET', `/api/valuations/${id}`),
  createValuation: (data: unknown) => req<any>('POST', '/api/valuations', data),
  updateValuation: (id: string, data: unknown) => req<any>('PUT', `/api/valuations/${id}`, data),
  deleteValuation: (id: string) => req<void>('DELETE', `/api/valuations/${id}`),
};
