export type ApiResponse<T> = {
  success: boolean;
  message: string;
  timestamp?: string;
  error?: {
    status: number;
    code: string;
    detail: string;
    path: string;
  };
  data: T;
};

export class MobileApiError extends Error {
  status?: number;
  code?: string;
  detail?: string;
  path?: string;
  response?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: string; path?: string; response?: unknown }) {
    super(message);
    this.name = 'MobileApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.detail = options?.detail;
    this.path = options?.path;
    this.response = options?.response;
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.detail || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

