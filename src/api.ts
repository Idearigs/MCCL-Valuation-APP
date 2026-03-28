const BASE = import.meta.env.VITE_API_URL || '';

// Compress + resize image before upload (reduces 5MB phone photo to ~150-300KB)
async function compressImage(file: File): Promise<Blob> {
  const MAX_PX = 1400;
  const QUALITY = 0.78;
  return new Promise(resolve => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
        else { width = Math.round(width * MAX_PX / height); height = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', QUALITY);
    };
    img.src = blobUrl;
  });
}

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
  getProbates: () => req<any[]>('GET', '/api/probate'),
  getProbate: (id: string) => req<any>('GET', `/api/probate/${id}`),
  createProbate: (data: unknown) => req<any>('POST', '/api/probate', data),
  updateProbate: (id: string, data: unknown) => req<any>('PUT', `/api/probate/${id}`, data),
  deleteProbate: (id: string) => req<void>('DELETE', `/api/probate/${id}`),

  uploadImage: async (file: File): Promise<string> => {
    const blob = await compressImage(file);
    const form = new FormData();
    form.append('image', blob, file.name.replace(/\.[^.]+$/, '.jpg'));
    const res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
    if (res.status === 401) { clearToken(); window.location.href = '/login'; throw new Error('Unauthorised'); }
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url as string;
  },
};
