import { apiRequest } from '@/api/client';

export type AdminPasswordResetPayload = {
  email: string;
  newPassword: string;
};

export async function resetUserPasswordAsAdmin(payload: AdminPasswordResetPayload) {
  return apiRequest<void>('/auth/admin/reset-password', {
    method: 'POST',
    body: payload,
  });
}
