import { apiRequest } from '@/api/client';

export type EffectivePermissionsResponse = {
  associationId?: string | null;
  permissionVersion: number;
  permissions: string[];
  roles: string[];
  systemAdmin: boolean;
};

export type RbacPermission = {
  key: string;
  groupKey: string;
  groupLabel: string;
  label: string;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  visibleInBuilder: boolean;
  systemOnly: boolean;
  dangerous: boolean;
  ownerRequired: boolean;
  billingFeatureKey?: string | null;
  sortOrder: number;
};

export type RbacPermissionGroup = {
  groupKey: string;
  groupLabel: string;
  permissions: RbacPermission[];
};

export type AssociationRole = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  templateCode?: string | null;
  protectedRole: boolean;
  systemRole: boolean;
  active: boolean;
  archived: boolean;
  sortOrder: number;
  permissionCount: number;
  assignedUserCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AssociationRoleDetail = {
  role: AssociationRole;
  permissionKeys: string[];
};

export type RbacUserAssignment = {
  userId: string;
  email: string;
  fullName: string;
  associationRole: string;
  active: boolean;
  roles: AssociationRole[];
};

export type RbacMemberAssignment = {
  memberId: string;
  userId?: string | null;
  email?: string | null;
  fullName: string;
  membershipNumber?: string | null;
  status: string;
  roles: AssociationRole[];
};

export type RbacAuditEvent = {
  id: string;
  eventType: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorSystemRole?: string | null;
  targetUserId?: string | null;
  targetMemberId?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  permissionKey?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
  reason?: string | null;
  createdAt?: string | null;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type RolePayload = {
  name: string;
  description?: string | null;
  permissionKeys?: string[];
  reason?: string | null;
};

export function getEffectivePermissions(associationId?: string | null) {
  const suffix = associationId ? `?associationId=${encodeURIComponent(associationId)}` : '';
  return apiRequest<EffectivePermissionsResponse>(`/me/permissions${suffix}`);
}

export function listPermissionCatalog() {
  return apiRequest<RbacPermissionGroup[]>('/association/rbac/permissions');
}

export function listAssociationRoles() {
  return apiRequest<AssociationRole[]>('/association/rbac/roles');
}

export function listAssignableAssociationRoles() {
  return apiRequest<AssociationRole[]>('/association/rbac/assignable-roles');
}

export function getAssociationRole(roleId: string) {
  return apiRequest<AssociationRoleDetail>(`/association/rbac/roles/${encodeURIComponent(roleId)}`);
}

export function createAssociationRole(payload: RolePayload) {
  return apiRequest<AssociationRoleDetail>('/association/rbac/roles', {
    method: 'POST',
    body: payload,
  });
}

export function updateAssociationRole(roleId: string, payload: RolePayload) {
  return apiRequest<AssociationRoleDetail>(`/association/rbac/roles/${encodeURIComponent(roleId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function archiveAssociationRole(roleId: string, reason?: string | null) {
  return apiRequest<AssociationRoleDetail>(`/association/rbac/roles/${encodeURIComponent(roleId)}/archive`, {
    method: 'POST',
    body: { reason },
  });
}

export function restoreAssociationRole(roleId: string, reason?: string | null) {
  return apiRequest<AssociationRoleDetail>(`/association/rbac/roles/${encodeURIComponent(roleId)}/restore`, {
    method: 'POST',
    body: { reason },
  });
}

export function updateAssociationRolePermissions(roleId: string, permissionKeys: string[], reason?: string | null) {
  return apiRequest<AssociationRoleDetail>(`/association/rbac/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: 'PUT',
    body: { permissionKeys, reason },
  });
}

export async function listUserRoleAssignments(page = 0, size = 10) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const response = await apiRequest<unknown>(`/association/rbac/assignments?${query.toString()}`);
  return normalizePage<RbacUserAssignment>(response);
}

export function updateUserRoleAssignments(userId: string, roleIds: string[], reason?: string | null) {
  return apiRequest<RbacUserAssignment>(`/association/rbac/users/${encodeURIComponent(userId)}/roles`, {
    method: 'PUT',
    body: { roleIds, reason },
  });
}

export async function listMemberRoleAssignments(page = 0, size = 10) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const response = await apiRequest<unknown>(`/association/rbac/members?${query.toString()}`);
  return normalizePage<RbacMemberAssignment>(response);
}

export function updateMemberRoleAssignments(memberId: string, roleIds: string[], reason?: string | null) {
  return apiRequest<RbacMemberAssignment>(`/association/rbac/members/${encodeURIComponent(memberId)}/roles`, {
    method: 'PUT',
    body: { roleIds, reason },
  });
}

export async function listRbacAuditEvents(page = 0, size = 10) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const response = await apiRequest<unknown>(`/association/rbac/audit?${query.toString()}`);
  return normalizePage<RbacAuditEvent>(response);
}

function normalizePage<T>(response: unknown): PageResponse<T> {
  if (Array.isArray(response)) {
    return {
      content: response as T[],
      totalElements: response.length,
      totalPages: response.length ? 1 : 0,
      number: 0,
      size: response.length,
    };
  }

  const value = (response || {}) as {
    content?: T[];
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
    page?: {
      totalElements?: number;
      totalPages?: number;
      number?: number;
      size?: number;
    };
  };
  const content = Array.isArray(value.content) ? value.content : [];
  return {
    content,
    totalElements: value.totalElements ?? value.page?.totalElements ?? content.length,
    totalPages: value.totalPages ?? value.page?.totalPages ?? (content.length ? 1 : 0),
    number: value.number ?? value.page?.number ?? 0,
    size: value.size ?? value.page?.size ?? content.length,
  };
}
