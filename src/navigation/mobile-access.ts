import { MEMBER_SELF_SERVICE_BASELINE, expandPermissionKeys, normalizeAccessValue, normalizePermissionKey } from '@/auth/permission-utils';
import { normalizeAssociationType } from '@/auth/association-type';
import type { BillingEntitlements, BillingFeatureEntitlement } from '@/services/billing-entitlement-service';
import type { AuthUser, MobileViewMode } from '@/types/auth';
import {
  getRoutesForModule,
  getRoutesForRole,
  moduleCatalog,
  roleForMobileView,
  searchMobileRoutes,
  type MobileModuleSummary,
  type MobileRouteItem,
  type MobileRouteModule,
  type MobileRole,
} from './route-registry';

export type MobileRouteAccessState = {
  user: AuthUser | null;
  activeView: MobileViewMode | null;
  permissions: string[];
  roles: string[];
  permissionsLoading?: boolean;
  billingEntitlements?: BillingEntitlements | null;
  billingEntitlementsLoading?: boolean;
};

export type MobileRouteAccessDecision = {
  allowed: boolean;
  reason?: 'workspace' | 'association-type' | 'rbac' | 'billing';
  title?: string;
  description?: string;
  requiredPermissions?: string[];
  anyPermissions?: string[];
  billingFeatureKey?: string | null;
  deniedFeature?: BillingFeatureEntitlement | null;
};

const ALWAYS_ALLOWED_BILLING_KEYS = new Set(
  [
    'dashboard',
    'billing.entitlements',
    'member.dashboard',
    'member.profile',
    'member.security',
    'member.offline.support',
  ].map(normalizeFeatureKey),
);

export function canAccessMobileRoute(route: MobileRouteItem, access: MobileRouteAccessState): MobileRouteAccessDecision {
  const currentRole = roleForMobileView(access.activeView);
  if (route.role !== currentRole) {
    return {
      allowed: false,
      reason: 'workspace',
      title: 'Different workspace required',
      description: 'This page belongs to another Nane workspace.',
    };
  }

  if (!isAllowedForAssociationType(route, access.user?.associationType || access.billingEntitlements?.associationType)) {
    return {
      allowed: false,
      reason: 'association-type',
      title: 'Not available for this association',
      description: `${route.title} is not enabled for this association type.`,
    };
  }

  if (!hasRequiredRoutePermissions(route, access)) {
    return {
      allowed: false,
      reason: 'rbac',
      title: 'Permission required',
      description: 'Your role does not include access to this mobile task.',
      requiredPermissions: route.requiredPermissions,
      anyPermissions: route.anyPermissions,
    };
  }

  const deniedFeature = getDeniedBillingFeature(route, access);
  if (deniedFeature) {
    return {
      allowed: false,
      reason: 'billing',
      title: 'Not included in this plan',
      description: `${route.title} is not included in the current association billing plan.`,
      billingFeatureKey: route.billingFeatureKey,
      deniedFeature,
    };
  }

  return { allowed: true };
}

export function getAccessibleRoutesForRole(role: MobileRole, access: MobileRouteAccessState) {
  return getRoutesForRole(role).filter((route) => canAccessMobileRoute(route, access).allowed);
}

export function getAccessibleRoutesForModule(role: MobileRole, module: MobileRouteModule, access: MobileRouteAccessState) {
  return getRoutesForModule(role, module).filter((route) => canAccessMobileRoute(route, access).allowed);
}

export function getAccessibleModuleSummariesForRole(role: MobileRole, access: MobileRouteAccessState): MobileModuleSummary[] {
  const routes = getAccessibleRoutesForRole(role, access);
  const summaries = Object.entries(moduleCatalog)
    .map(([id, meta]) => {
      const moduleRoutes = routes.filter((route) => route.module === id);
      return {
        id: id as MobileRouteModule,
        label: meta.label,
        description: meta.description,
        routeCount: moduleRoutes.length,
        dynamicCount: moduleRoutes.filter((route) => route.dynamic).length,
        primaryCount: moduleRoutes.filter((route) => route.primary).length,
        tone: meta.tone,
        icon: meta.icon,
        order: meta.order,
      };
    })
    .filter((summary) => summary.routeCount > 0)
    .sort((a, b) => a.order - b.order);

  return summaries.map(({ order: _order, ...summary }) => summary);
}

export function searchAccessibleMobileRoutes(query: string, options: { role?: MobileRole; module?: MobileRouteModule }, access: MobileRouteAccessState) {
  return searchMobileRoutes(query, options).filter((route) => canAccessMobileRoute(route, access).allowed);
}

export function isMobileAccessLoading(access: MobileRouteAccessState) {
  return Boolean(access.permissionsLoading || access.billingEntitlementsLoading);
}

function hasRequiredRoutePermissions(route: MobileRouteItem, access: MobileRouteAccessState) {
  if (access.permissionsLoading) return true;
  if (!route.requiredPermissions.length && !route.anyPermissions.length) return true;

  const permissionSet = getExpandedPermissionSet(access);
  const hasAll = route.requiredPermissions.every((permission) => permissionSet.has(normalizePermissionKey(permission)));
  if (!hasAll) return false;
  return route.anyPermissions.length === 0 || route.anyPermissions.some((permission) => permissionSet.has(normalizePermissionKey(permission)));
}

function getExpandedPermissionSet(access: MobileRouteAccessState) {
  const permissionKeys = [...access.permissions, ...(access.user?.permissions || [])];
  const normalizedAssociationRole = normalizeAccessValue(access.user?.associationRole).toUpperCase();
  const normalizedSystemRole = normalizeAccessValue(access.user?.systemRole).toUpperCase();

  if (normalizedAssociationRole === 'MEMBER' || normalizedAssociationRole === 'ADMIN' || normalizedSystemRole === 'ASSOCIATION_ADMIN') {
    permissionKeys.push(...MEMBER_SELF_SERVICE_BASELINE);
  }

  return expandPermissionKeys(permissionKeys);
}

function isAllowedForAssociationType(route: MobileRouteItem, associationType?: string | null) {
  if (!route.allowedAssociationTypes?.length) return true;
  const normalized = normalizeAssociationType(associationType);
  return Boolean(normalized && route.allowedAssociationTypes.includes(normalized));
}

function getDeniedBillingFeature(route: MobileRouteItem, access: MobileRouteAccessState) {
  if (access.billingEntitlementsLoading) return null;
  const featureKey = route.billingFeatureKey;
  if (!featureKey || ALWAYS_ALLOWED_BILLING_KEYS.has(normalizeFeatureKey(featureKey))) return null;

  const entitlements = access.billingEntitlements;
  if (!entitlements?.subscriptionId) return null;

  const feature = findEntitlementFeature(entitlements, featureKey);
  if (feature) return feature.available ? null : feature;

  if (entitlements.subscriptionAllowsAccess === false) {
    return {
      featureKey,
      available: false,
      planIncluded: false,
      denialReason: 'Association subscription does not currently allow runtime access.',
    };
  }

  return null;
}

function findEntitlementFeature(entitlements: BillingEntitlements, featureKey: string) {
  const normalized = normalizeFeatureKey(featureKey);
  return entitlements.features?.find((feature) => normalizeFeatureKey(feature.featureKey) === normalized) ?? null;
}

function normalizeFeatureKey(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
