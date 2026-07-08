import type { AuthUser, JwtPayload } from '@/types/auth';
import { normalizeAssociationType } from '@/auth/association-type';

const ASSOCIATION_ADMIN_ROLES = new Set([
  'ADMIN',
  'SECRETARY',
  'CHAIRPERSON',
  'VICE_CHAIRPERSON',
  'TREASURER',
]);

function decodeBase64(input: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of input) {
    if (char === '=') break;
    const value = chars.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const decoded = typeof globalThis.atob === 'function' ? globalThis.atob(padded) : decodeBase64(padded);
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return decoded;
  }
}

export function parseJwtPayload(token?: string | null): JwtPayload | null {
  if (!token || token.split('.').length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(token.split('.')[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export function isExpiredPayload(payload: JwtPayload | null, skewSeconds = 30) {
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

export function normalizeRole(role?: string | null) {
  return String(role || '').trim().toUpperCase();
}

function normalizePermission(permission?: string | null) {
  return String(permission || '').trim().toLowerCase();
}

function stringClaim(payload: JwtPayload, ...keys: string[]) {
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function associationTypeClaim(payload: JwtPayload) {
  const direct = stringClaim(
    payload,
    'associationType',
    'association_type',
    'association_type_name',
    'associationTypeName',
    'tenantType',
    'tenant_type',
    'organizationType',
    'organisationType',
  );
  const normalized = normalizeAssociationType(direct);
  return normalized || direct;
}

function isAssociationSurfacePermission(permission?: string | null) {
  const normalized = normalizePermission(permission);
  return (
    Boolean(normalized) &&
    normalized.includes('.') &&
    !normalized.startsWith('member.self.') &&
    !['members.lookup', 'community.view', 'governance.view', 'subscriptions.view'].includes(normalized)
  );
}

function roleListIncludes(user: Pick<AuthUser, 'roles'> | JwtPayload | null | undefined, role: string) {
  const expected = normalizeRole(role);
  return Array.isArray(user?.roles) && user.roles.some((value) => normalizeRole(value) === expected);
}

function hasAssociationSurfacePermission(user: Pick<AuthUser, 'permissions' | 'roles'> | JwtPayload | null | undefined) {
  return (
    (Array.isArray(user?.permissions) && user.permissions.some(isAssociationSurfacePermission)) ||
    (Array.isArray(user?.roles) && user.roles.some(isAssociationSurfacePermission))
  );
}

export function isTenantScopedAuthPayload(user: Pick<AuthUser, 'associationId' | 'schema' | 'isTechy8Admin'> | JwtPayload | null | undefined) {
  return Boolean(user?.associationId && user?.schema && user.schema !== 'public' && user.isTechy8Admin !== true);
}

export function hasAssociationAdminAccess(
  user:
    | Pick<AuthUser, 'associationId' | 'schema' | 'isTechy8Admin' | 'systemRole' | 'associationRole' | 'roles' | 'permissions' | 'impersonatedBy'>
    | JwtPayload
    | null
    | undefined,
) {
  if (!user || !isTenantScopedAuthPayload(user)) return false;
  if (normalizeRole(user.systemRole) === 'ASSOCIATION_ADMIN') return true;
  if (ASSOCIATION_ADMIN_ROLES.has(normalizeRole(user.associationRole))) return true;
  if (roleListIncludes(user, 'ASSOCIATION_ADMIN')) return true;
  if (Boolean(user.impersonatedBy) && normalizeRole(user.systemRole) === 'SYSTEM_ADMIN') return true;
  return hasAssociationSurfacePermission(user);
}

export function hasMemberAccess(
  user:
    | Pick<AuthUser, 'associationId' | 'schema' | 'isTechy8Admin' | 'systemRole' | 'associationRole' | 'roles' | 'permissions' | 'impersonatedBy'>
    | JwtPayload
    | null
    | undefined,
) {
  if (!user || !isTenantScopedAuthPayload(user)) return false;
  if (hasAssociationAdminAccess(user)) return true;
  if (normalizeRole(user.systemRole) === 'MEMBER') return true;
  if (normalizeRole(user.systemRole) === 'ASSOCIATION_USER' && normalizeRole(user.associationRole) === 'MEMBER') return true;
  if (roleListIncludes(user, 'MEMBER') || roleListIncludes(user, 'ASSOCIATION_USER')) return true;
  return Array.isArray(user.permissions) && user.permissions.some((permission) => normalizePermission(permission).startsWith('member.self.'));
}

export function canChooseAssociationMode(
  user:
    | Pick<AuthUser, 'associationId' | 'schema' | 'isTechy8Admin' | 'systemRole' | 'associationRole' | 'roles' | 'permissions' | 'impersonatedBy'>
    | JwtPayload
    | null
    | undefined,
) {
  return hasAssociationAdminAccess(user) && hasMemberAccess(user);
}

export function decodeAuthUser(token: string): AuthUser | null {
  const payload = parseJwtPayload(token);
  if (!payload || isExpiredPayload(payload)) return null;
  const systemRole = stringClaim(payload, 'systemRole', 'system_role');
  const associationId = stringClaim(payload, 'associationId', 'association_id');
  const schema = stringClaim(payload, 'schema', 'schemaName', 'schema_name');
  const platformSystemAdmin =
    payload.isTechy8Admin === true ||
    (normalizeRole(systemRole) === 'SYSTEM_ADMIN' && !(associationId && schema && schema !== 'public'));

  return {
    email: payload.sub,
    fullName: payload.fullName || payload.sub,
    associationRole: stringClaim(payload, 'associationRole', 'association_role'),
    systemRole,
    associationType: platformSystemAdmin ? undefined : associationTypeClaim(payload),
    associationName: platformSystemAdmin ? undefined : stringClaim(payload, 'associationName', 'association_name'),
    userId: stringClaim(payload, 'userId', 'user_id', 'id'),
    isTechy8Admin: payload.isTechy8Admin,
    impersonatedBy: payload.impersonatedBy,
    firstLogin: payload.firstLogin,
    associationId: platformSystemAdmin ? undefined : associationId,
    schema,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

export function deriveViewFromUser(user: AuthUser | null): 'SYSTEM_ADMIN' | 'ADMIN' | 'MEMBER' | null {
  if (!user) return null;
  if (hasAssociationAdminAccess(user)) return 'ADMIN';
  if (normalizeRole(user.systemRole) === 'SYSTEM_ADMIN' && !isTenantScopedAuthPayload(user)) return 'SYSTEM_ADMIN';
  if (hasMemberAccess(user)) return 'MEMBER';
  return null;
}
