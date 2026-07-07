import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type MembershipPackage = {
  id: string;
  name?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  weeklyAmount?: number | string | null;
  biWeeklyAmount?: number | string | null;
  monthlyAmount?: number | string | null;
  quarterlyAmount?: number | string | null;
  semiAnnualAmount?: number | string | null;
  annualAmount?: number | string | null;
  currency?: string | null;
  active?: boolean | null;
  associationId?: string | null;
  associationName?: string | null;
  memberCount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MembershipPackagePayload = {
  name: string;
  description?: string | null;
  benefits?: string[];
  currency?: string | null;
  weeklyAmount?: number | null;
  biWeeklyAmount?: number | null;
  monthlyAmount?: number | null;
  quarterlyAmount?: number | null;
  semiAnnualAmount?: number | null;
  annualAmount?: number | null;
};

export async function getAssociationPackages(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/packages?associationId=${encodeURIComponent(associationId)}`);
  return extractPackageList(response.data);
}

export async function getActiveAssociationPackages(associationId: string) {
  const response = await apiEnvelopeRequest<unknown>(`/packages/association/${encodeURIComponent(associationId)}`);
  return extractPackageList(response.data);
}

export function getMembershipPackageById(packageId: string) {
  return apiRequest<MembershipPackage>(`/packages/${encodeURIComponent(packageId)}`);
}

export function createMembershipPackage(associationId: string, payload: MembershipPackagePayload) {
  return apiRequest<MembershipPackage>(`/packages?associationId=${encodeURIComponent(associationId)}`, {
    method: 'POST',
    body: compactPackagePayload(payload),
  });
}

export function updateMembershipPackage(packageId: string, payload: MembershipPackagePayload) {
  return apiRequest<MembershipPackage>(`/packages/${encodeURIComponent(packageId)}`, {
    method: 'PUT',
    body: compactPackagePayload(payload),
  });
}

export function toggleMembershipPackageStatus(packageId: string) {
  return apiRequest<MembershipPackage>(`/packages/${encodeURIComponent(packageId)}/toggle-status`, {
    method: 'PUT',
  });
}

export function activateMembershipPackage(packageId: string) {
  return apiRequest<MembershipPackage>(`/packages/${encodeURIComponent(packageId)}/activate`, {
    method: 'PUT',
  });
}

export function deleteMembershipPackage(packageId: string) {
  return apiRequest<void>(`/packages/${encodeURIComponent(packageId)}`, {
    method: 'DELETE',
  });
}

function extractPackageList(data: unknown) {
  if (Array.isArray(data)) return data as MembershipPackage[];

  const payload = data as {
    content?: MembershipPackage[];
    packages?: MembershipPackage[];
    data?: MembershipPackage[];
  } | null;

  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.packages)) return payload.packages;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function compactPackagePayload(payload: MembershipPackagePayload) {
  const next: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    if (Array.isArray(value)) {
      const cleaned = value.map((item) => item.trim()).filter(Boolean);
      next[key] = cleaned;
      return;
    }
    next[key] = value;
  });
  return next;
}
