export type ApiResponse<T> = {
  success: boolean;
  message: string;
  timestamp?: string;
  traceId?: string;
  error?: {
    status: number;
    code: string;
    detail: string;
    path: string;
  };
  data: T;
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

export class MobileApiError extends Error {
  status?: number;
  code?: string;
  detail?: string;
  path?: string;
  traceId?: string;
  response?: unknown;

  constructor(
    message: string,
    options?: { status?: number; code?: string; detail?: string; path?: string; traceId?: string; response?: unknown },
  ) {
    super(message);
    this.name = 'MobileApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.detail = options?.detail;
    this.path = options?.path;
    this.traceId = options?.traceId;
    this.response = options?.response;
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.detail || error.message;
  }
  if (error instanceof Error) {
    const message = error.message || '';
    const lower = message.toLowerCase();
    if (lower.includes('fetch failed') || lower.includes('network request failed') || lower.includes('could not connect')) {
      return 'Nane could not connect to the server. Check your connection and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred';
}
