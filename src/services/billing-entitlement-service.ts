import { apiRequest } from '@/api/client';

export type BillingFeatureEntitlement = {
  featureId?: string | null;
  featureKey: string;
  featureName?: string | null;
  groupKey?: string | null;
  available: boolean;
  planIncluded: boolean;
  overrideEnabled?: boolean | null;
  limitValue?: number | string | null;
  limitUnit?: string | null;
  denialReason?: string | null;
  config?: Record<string, unknown> | null;
};

export type BillingEntitlements = {
  associationId: string;
  associationName?: string | null;
  associationType?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  planId?: string | null;
  planCode?: string | null;
  planName?: string | null;
  subscriptionAllowsAccess: boolean;
  accessUntil?: string | null;
  features?: BillingFeatureEntitlement[] | null;
  evaluatedAt?: string | null;
};

export function getCurrentBillingEntitlements() {
  return apiRequest<BillingEntitlements>('/entitlements/current', {
    headers: { 'x-cache-ttl-ms': '30000' },
  });
}

export function requireBillingFeature(featureKey: string) {
  return apiRequest<{ featureKey: string; allowed: boolean }>(`/entitlements/current/features/${encodeURIComponent(featureKey)}/require`);
}
