import { apiRequest } from '@/api/client';
import type { AuthResponse, LoginCredentials } from '@/types/auth';

export async function login(credentials: LoginCredentials) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: credentials,
  });
}

export async function loginWithAssociation(credentials: LoginCredentials & { associationId: string }) {
  return apiRequest<AuthResponse>('/auth/login/association', {
    method: 'POST',
    auth: false,
    body: credentials,
  });
}

export async function logout() {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    retryOnUnauthorized: false,
  });
}
