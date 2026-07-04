import { mobileEnv } from '@/config/env';
import { MobileApiError } from '@/types/api';
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredAssociationId,
  getStoredAssociationMode,
  getStoredRefreshToken,
  storeSession,
} from '@/auth/session-store';
import type { ApiResponse } from '@/types/api';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let sessionExpiredHandler: (() => void | Promise<void>) | null = null;

export function setSessionExpiredHandler(handler: (() => void | Promise<void>) | null) {
  sessionExpiredHandler = handler;
}

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${mobileEnv.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createApiError(response: Response, parsed: unknown) {
  const payload = parsed as Partial<ApiResponse<null>> | null;
  const detail = payload?.error?.detail || payload?.message || `Request failed with status ${response.status}`;
  return new MobileApiError(detail, {
    status: response.status,
    code: payload?.error?.code,
    detail,
    path: payload?.error?.path,
    response: parsed,
  });
}

async function buildHeaders(options: RequestOptions) {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  if (options.auth !== false) {
    const accessToken = await getStoredAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const associationId = await getStoredAssociationId();
    if (associationId) {
      headers.set('X-Association-Id', associationId);
      const mode = await getStoredAssociationMode(associationId);
      if (mode === 'ADMIN' || mode === 'MEMBER') {
        headers.set('X-Association-Mode', mode);
      }
    }
  }

  return headers;
}

export async function refreshAccessToken() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  const parsed = await parseResponse(response);

  if (!response.ok) {
    await clearStoredSession();
    return false;
  }

  const data = (parsed as ApiResponse<{ accessToken: string; refreshToken: string }>).data;
  if (!data?.accessToken || !data?.refreshToken) {
    await clearStoredSession();
    return false;
  }

  await storeSession(data.accessToken, data.refreshToken);
  return true;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = await buildHeaders(options);
  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const parsed = await parseResponse(response);

  if (response.status === 401 && options.auth !== false && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
    await sessionExpiredHandler?.();
  }

  if (!response.ok) {
    throw createApiError(response, parsed);
  }

  const payload = parsed as ApiResponse<T>;
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success) {
      throw new MobileApiError(payload.message || 'Request failed', {
        status: payload.error?.status,
        code: payload.error?.code,
        detail: payload.error?.detail,
        path: payload.error?.path,
        response: payload,
      });
    }
    return payload.data;
  }

  return parsed as T;
}
