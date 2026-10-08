import type {
  AuthStatus, DocumentImage, DocumentListItem, DocumentRecord, DocumentStats,
  Paginated, PdfMode, PdfResult, SessionUser,
} from '@mccl/shared';

// Same origin in dev (Vite proxies /api) and in production; auth is an httpOnly cookie.
const BASE = '';

// Compress + resize image before upload (keeps uploads quick on shop wi-fi).
// The server makes the print/thumbnail sizes, so this stays a little above print size.
async function compressImage(file: File): Promise<Blob> {
  const MAX_PX = 2000;
  const QUALITY = 0.85;
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
    // Formats the browser can't decode (e.g. HEIC on desktop) go up as-is; the server converts them.
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: any) { super(message); }
}

function onUnauthorised(path: string) {
  // Session expired mid-use: go back to the PIN screen (not for the login calls themselves).
  if (!path.startsWith('/api/auth/')) window.location.href = '/login';
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) onUnauthorised(path);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data);
  return data;
}

async function upload<T>(method: string, path: string, file: Blob, name: string): Promise<T> {
  const form = new FormData();
  form.append('image', file, name);
  const res = await fetch(`${BASE}${path}`, { method, body: form });
  if (res.status === 401) onUnauthorised(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Upload failed', data);
  return data;
}

export interface ListParams {
  q?: string; from?: string; to?: string; type?: 'valuation' | 'probate'; page?: number; pageSize?: number;
}

export const api = {
  // ── Auth ──
  status: () => req<AuthStatus>('GET', '/api/auth/status'),
  pinLogin: (pin: string) => req<{ user: SessionUser }>('POST', '/api/auth/pin', { pin }),
  logout: () => req<void>('POST', '/api/auth/logout'),
  changePin: (currentPin: string, newPin: string) =>
    req<void>('PUT', '/api/auth/pin', { currentPin, newPin }),

  // ── Documents (valuations and probates share one endpoint) ──
  listDocuments: (p: ListParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    );
    return req<Paginated<DocumentListItem>>('GET', `/api/documents?${qs}`);
  },
  getStats: () => req<DocumentStats>('GET', '/api/documents/stats'),
  getDocument: (id: string) => req<DocumentRecord>('GET', `/api/documents/${id}`),
  createDocument: (data: unknown) => req<DocumentRecord>('POST', '/api/documents', data),
  updateDocument: (id: string, data: unknown) => req<DocumentRecord>('PUT', `/api/documents/${id}`, data),
  deleteDocument: (id: string) => req<void>('DELETE', `/api/documents/${id}`),

  // ── Images & signature ──
  uploadImage: async (documentId: string, file: File): Promise<DocumentImage> => {
    const blob = await compressImage(file);
    return upload<DocumentImage>('POST', `/api/documents/${documentId}/images`, blob, file.name.replace(/\.[^.]+$/, '.jpg'));
  },
  deleteImage: (documentId: string, imageId: string) =>
    req<void>('DELETE', `/api/documents/${documentId}/images/${imageId}`),
  reorderImages: (documentId: string, imageIds: string[]) =>
    req<DocumentImage[]>('PUT', `/api/documents/${documentId}/images/order`, { imageIds }),
  uploadSignature: (documentId: string, png: Blob) =>
    upload<{ signatureUrl: string }>('PUT', `/api/documents/${documentId}/signature`, png, 'signature.png'),
  deleteSignature: (documentId: string) => req<void>('DELETE', `/api/documents/${documentId}/signature`),

  // ── PDF (rendered on the server) ──
  generatePdf: (documentId: string, mode: PdfMode) =>
    req<PdfResult>('POST', `/api/documents/${documentId}/pdf`, { mode }),
};
