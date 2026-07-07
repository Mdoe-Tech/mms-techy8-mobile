import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type AssociationUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  associationRole?: string | null;
  systemRole?: string | null;
  createdAt?: string | null;
  firstLogin: boolean;
  mfaEnabled: boolean;
  active: boolean;
};

export type AssociationUsersPage = {
  content: AssociationUser[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type AssociationUserQuery = {
  page?: number;
  size?: number;
  query?: string;
  excludeRole?: string;
};

export type AssociationUserCreatePayload = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  associationRole: string;
  techy8Admin: boolean;
  systemRole: string;
  rbacRoleIds: string[];
};

export async function getAssociationUsers(associationId: string, options: AssociationUserQuery = {}) {
  const query = buildQuery({
    page: options.page ?? 0,
    size: options.size ?? 200,
    excludeRole: options.excludeRole ?? 'MEMBER',
  });
  const payload = await apiEnvelopeRequest<AssociationUser[]>(`/users/association/${encodeURIComponent(associationId)}?${query}`);
  return normalizeAssociationUsersPage(payload);
}

export async function searchAssociationUsers(associationId: string, options: AssociationUserQuery = {}) {
  const query = buildQuery({
    query: options.query || '',
    page: options.page ?? 0,
    size: options.size ?? 200,
  });
  const payload = await apiEnvelopeRequest<AssociationUser[]>(`/users/association/${encodeURIComponent(associationId)}/search?${query}`);
  return normalizeAssociationUsersPage(payload, { excludeMemberAccess: options.excludeRole === 'MEMBER' });
}

export function convertAssociationUserToMember(associationId: string, userId: string) {
  return apiRequest<unknown>(`/members/convert/user/${encodeURIComponent(userId)}?associationId=${encodeURIComponent(associationId)}`, {
    method: 'POST',
  });
}

export function createAssociationUserDirect(associationId: string, payload: AssociationUserCreatePayload) {
  return apiRequest<AssociationUser>(`/users/association/${encodeURIComponent(associationId)}/direct`, {
    method: 'POST',
    body: payload,
  });
}

function normalizeAssociationUsersPage(
  payload: {
    data?: AssociationUser[];
    page?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
  },
  options: { excludeMemberAccess?: boolean } = {},
): AssociationUsersPage {
  const rows = (payload.data || []).filter((user) => !options.excludeMemberAccess || isSystemAccessUser(user));
  return {
    content: rows.map(normalizeAssociationUser),
    totalElements: options.excludeMemberAccess ? rows.length : Number(payload.totalElements || rows.length),
    totalPages: options.excludeMemberAccess ? (rows.length ? 1 : 0) : Number(payload.totalPages || (rows.length ? 1 : 0)),
    number: Number(payload.page || 0),
    size: Number(payload.size || rows.length),
  };
}

function normalizeAssociationUser(user: Partial<AssociationUser>): AssociationUser {
  return {
    id: String(user.id || ''),
    fullName: user.fullName || 'Unnamed user',
    email: user.email || '',
    phoneNumber: user.phoneNumber || null,
    associationRole: user.associationRole || null,
    systemRole: user.systemRole || null,
    createdAt: user.createdAt || null,
    firstLogin: Boolean(user.firstLogin),
    mfaEnabled: Boolean(user.mfaEnabled),
    active: user.active !== false,
  };
}

function isSystemAccessUser(user: AssociationUser) {
  return String(user.associationRole || '').toUpperCase() !== 'MEMBER' && String(user.systemRole || '').toUpperCase() !== 'ASSOCIATION_USER';
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}
