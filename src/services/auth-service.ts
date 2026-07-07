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

export async function switchAssociation(targetAssociationId: string) {
  return apiRequest<AuthResponse>(`/auth/switch-association?targetAssociationId=${encodeURIComponent(targetAssociationId)}`, {
    method: 'POST',
  });
}

export async function logout() {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    retryOnUnauthorized: false,
  });
}

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<void>('/auth/change-password', {
    method: 'POST',
    body: payload,
  });
}
