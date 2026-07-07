import { useAuth } from '@/auth/auth-context';
import { useMemo } from 'react';

import type { MobileRouteAccessState } from './mobile-access';

export function useMobileAccess(): MobileRouteAccessState {
  const {
    activeView,
    billingEntitlements,
    billingEntitlementsLoading,
    effectivePermissions,
    effectiveRoles,
    permissionsLoading,
    user,
  } = useAuth();

  return useMemo(
    () => ({
      user,
      activeView,
      permissions: effectivePermissions,
      roles: effectiveRoles,
      permissionsLoading,
      billingEntitlements,
      billingEntitlementsLoading,
    }),
    [
      activeView,
      billingEntitlements,
      billingEntitlementsLoading,
      effectivePermissions,
      effectiveRoles,
      permissionsLoading,
      user,
    ],
  );
}
