import type { StatusTone } from '@/theme/tokens';
import { MobileApiError } from '@/types/api';

export type MobileErrorDetailsInfo = {
  status?: number;
  code?: string;
  path?: string;
  traceId?: string;
};

export type NormalizedMobileError = {
  title: string;
  description: string;
  tone: StatusTone;
  details?: MobileErrorDetailsInfo;
};

type NormalizeOptions = {
  title?: string;
  fallbackDescription?: string;
  tone?: StatusTone;
};

export function normalizeMobileError(error: unknown, options: NormalizeOptions = {}): NormalizedMobileError {
  const fallbackDescription = options.fallbackDescription || 'Something went wrong. Please try again.';

  if (error instanceof MobileApiError) {
    const description = friendlyApiDescription(error) || error.detail || error.message || fallbackDescription;
    return {
      title: options.title || titleForApiError(error),
      description,
      tone: options.tone || toneForApiError(error),
      details: {
        status: error.status,
        code: error.code,
        path: error.path,
        traceId: error.traceId,
      },
    };
  }

  if (error instanceof Error) {
    return {
      title: options.title || 'Something went wrong',
      description: error.message || fallbackDescription,
      tone: options.tone || 'danger',
    };
  }

  if (typeof error === 'string' && error.trim()) {
    return {
      title: options.title || 'Something went wrong',
      description: error.trim(),
      tone: options.tone || 'danger',
    };
  }

  return {
    title: options.title || 'Something went wrong',
    description: fallbackDescription,
    tone: options.tone || 'danger',
  };
}

function toneForApiError(error: MobileApiError): StatusTone {
  if (error.status === 401 || error.status === 403) return 'warning';
  if (error.status && error.status >= 500) return 'danger';
  if (error.status === 404) return 'info';
  return 'danger';
}

function titleForApiError(error: MobileApiError) {
  if (error.status === 401) return 'Session required';
  if (error.status === 403) return 'Access restricted';
  if (error.status === 404) return 'Record not found';
  if (error.status && error.status >= 500) return 'Service unavailable';
  return 'Request failed';
}

function friendlyApiDescription(error: MobileApiError) {
  const text = `${error.detail || error.message || ''}`.trim();
  const lower = text.toLowerCase();

  if (error.status === 401 || lower.includes('jwt') || lower.includes('token expired') || lower.includes('session expired')) {
    return 'Your secure session has ended. Sign in again to continue working in Nane.';
  }

  if (lower.includes('fetch failed') || lower.includes('network request failed') || lower.includes('could not connect')) {
    return 'Nane could not connect to the server. Check your connection and try again.';
  }

  if (error.status && error.status >= 500) {
    return 'Nane could not complete this request right now. Try again, and share the technical details with support if it keeps happening.';
  }

  return text;
}
