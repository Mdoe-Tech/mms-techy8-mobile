import { apiRequest } from '@/api/client';

export type BusinessType = {
  id: string;
  value: string;
  displayName: string;
  enabled: boolean;
};

export type BusinessTypePayload = {
  value: string;
  displayName: string;
  enabled: boolean;
};

export function getBusinessTypes() {
  return apiRequest<BusinessType[]>('/business-types');
}

export function createBusinessType(payload: BusinessTypePayload) {
  return apiRequest<BusinessType>('/business-types', {
    method: 'POST',
    body: payload,
  });
}

export function updateBusinessType(id: string, payload: BusinessTypePayload) {
  return apiRequest<BusinessType>(`/business-types/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteBusinessType(id: string) {
  return apiRequest<void>(`/business-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
