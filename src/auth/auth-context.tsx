import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { refreshAccessToken, setSessionExpiredHandler } from '@/api/client';
import {
  canChooseAssociationMode,
  decodeAuthUser,
  deriveViewFromUser,
  hasAssociationAdminAccess,
  hasMemberAccess,
  isTenantScopedAuthPayload,
} from '@/auth/jwt';
import { MEMBER_SELF_SERVICE_BASELINE, expandPermissionKeys, normalizePermissionKey } from '@/auth/permission-utils';
import {
  clearStoredSession,
  getStoredRefreshToken,
  loadStoredSession,
  setStoredAssociationMode,
  storeSession,
  type StoredSession,
} from '@/auth/session-store';
import {
  authenticateWithBiometrics,
  disableBiometricUnlock as clearBiometricUnlockPreference,
  enableBiometricUnlock as enableBiometricUnlockPreference,
  getBiometricAccountLabel,
  getBiometricCapability,
  isBiometricUnlockEnabled,
  type BiometricCapability,
} from '@/auth/biometric-auth';
import { getApiErrorMessage } from '@/types/api';
import type { AuthAssociationOption, AuthResponse, AuthUser, LoginCredentials, MobileViewMode } from '@/types/auth';
import { login, loginWithAssociation, logout as requestLogout } from '@/services/auth-service';
import { getEffectivePermissions, type EffectivePermissionsResponse } from '@/services/association-rbac-service';
import { getCurrentBillingEntitlements, type BillingEntitlements } from '@/services/billing-entitlement-service';
import { clearLocalPushRegistrationAsync, unregisterPushDeviceAsync } from '@/services/mobile-push-service';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

type PendingAssociationLogin = {
  credentials: LoginCredentials;
  associations: AuthAssociationOption[];
  email: string;
  fullName?: string;
};

type PendingModeSelection = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type PendingBiometricUnlock = {
  mode: 'stored-session' | 'refresh-session';
  session?: StoredSession;
  accountLabel?: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  booting: boolean;
  loading: boolean;
  sessionExpired: boolean;
  error: string | null;
  user: AuthUser | null;
  associationId: string | null;
  activeView: MobileViewMode | null;
  pendingAssociationLogin: PendingAssociationLogin | null;
  pendingModeSelection: PendingModeSelection | null;
  permissionsLoading: boolean;
  permissionsError: string | null;
  effectivePermissions: string[];
  effectiveRoles: string[];
  effectivePermissionVersion: number | null;
  billingEntitlements: BillingEntitlements | null;
  billingEntitlementsLoading: boolean;
  billingEntitlementsError: string | null;
  canUseAssociationAdmin: boolean;
  canUseMemberPortal: boolean;
  canUseSystemAdmin: boolean;
  biometricUnlockEnabled: boolean;
  biometricUnlockAvailable: boolean;
  biometricLabel: string;
  biometricAccountLabel: string | null;
  biometricLoading: boolean;
  biometricError: string | null;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  selectAssociation: (associationId: string) => Promise<void>;
  selectLoginMode: (mode: Extract<MobileViewMode, 'ADMIN' | 'MEMBER'>) => Promise<void>;
  replaceSession: (accessToken: string, refreshToken: string, preferredView?: MobileViewMode | null) => Promise<AuthUser>;
  unlockWithBiometrics: () => Promise<void>;
  enableBiometricUnlock: () => Promise<boolean>;
  disableBiometricUnlock: () => Promise<void>;
  refreshBiometricState: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveView: (view: MobileViewMode) => Promise<void>;
  refreshAccessState: () => Promise<void>;
  clearError: () => void;
  clearPendingAssociationLogin: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const MEMBER_SELF_SERVICE_PERMISSION_SET = new Set(MEMBER_SELF_SERVICE_BASELINE.map((permission) => normalizePermissionKey(permission)));
const NON_ADMIN_ASSOCIATION_PERMISSIONS = new Set(['members.lookup', 'community.view', 'governance.view', 'subscriptions.view']);

function hasAssociationPermissionSurface(permissionKeys: Iterable<string>) {
  for (const permissionKey of expandPermissionKeys(permissionKeys)) {
    const normalized = normalizePermissionKey(permissionKey);
    if (normalized.includes('.') && !normalized.startsWith('member.self.') && !NON_ADMIN_ASSOCIATION_PERMISSIONS.has(normalized)) {
      return true;
    }
  }
  return false;
}

function hasMemberPermissionSurface(permissionKeys: Iterable<string>) {
  for (const permissionKey of expandPermissionKeys(permissionKeys)) {
    const normalized = normalizePermissionKey(permissionKey);
    if (normalized.startsWith('member.self.') || MEMBER_SELF_SERVICE_PERMISSION_SET.has(normalized)) {
      return true;
    }
  }
  return false;
}

function canUseView(user: AuthUser | null, view: MobileViewMode | null, permissionKeys: Iterable<string> = []) {
  if (!user || !view) return false;
  const hasAdminWorkspace = hasAssociationAdminAccess(user) || hasAssociationPermissionSurface(permissionKeys);
  if (view === 'ADMIN') return hasAdminWorkspace;
  if (view === 'MEMBER') return hasMemberAccess(user) || hasMemberPermissionSurface(permissionKeys) || hasAdminWorkspace;
  return deriveViewFromUser(user) === 'SYSTEM_ADMIN';
}

function resolveInitialView(user: AuthUser, preferredView?: MobileViewMode | null, permissionKeys: Iterable<string> = []) {
  if (canUseView(user, preferredView || null, permissionKeys)) return preferredView || null;
  if (canUseView(user, 'SYSTEM_ADMIN', permissionKeys)) return 'SYSTEM_ADMIN';
  if (canUseView(user, 'ADMIN', permissionKeys)) return 'ADMIN';
  if (canUseView(user, 'MEMBER', permissionKeys)) return 'MEMBER';
  return null;
}

function hasUsableTokens(response: AuthResponse): response is AuthResponse & { accessToken: string; refreshToken: string } {
  return Boolean(response.accessToken && response.refreshToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeView, setActiveViewState] = useState<MobileViewMode | null>(null);
  const [pendingAssociationLogin, setPendingAssociationLogin] = useState<PendingAssociationLogin | null>(null);
  const [pendingModeSelection, setPendingModeSelection] = useState<PendingModeSelection | null>(null);
  const [effectivePermissionsState, setEffectivePermissionsState] = useState<EffectivePermissionsResponse | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [billingEntitlements, setBillingEntitlements] = useState<BillingEntitlements | null>(null);
  const [billingEntitlementsLoading, setBillingEntitlementsLoading] = useState(false);
  const [billingEntitlementsError, setBillingEntitlementsError] = useState<string | null>(null);
  const [biometricUnlockEnabled, setBiometricUnlockEnabled] = useState(false);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability>({
    available: false,
    supported: false,
    enrolled: false,
    label: 'Biometric login',
  });
  const [biometricAccountLabel, setBiometricAccountLabel] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [pendingBiometricUnlock, setPendingBiometricUnlock] = useState<PendingBiometricUnlock | null>(null);
  const accessRequestRef = useRef(0);
  const biometricUnlockedRef = useRef(false);

  const clearAccessState = useCallback(() => {
    accessRequestRef.current += 1;
    setEffectivePermissionsState(null);
    setPermissionsLoading(false);
    setPermissionsError(null);
    setBillingEntitlements(null);
    setBillingEntitlementsLoading(false);
    setBillingEntitlementsError(null);
  }, []);

  const loadAccessState = useCallback(async () => {
    if (status !== 'authenticated' || !user || activeView === 'SYSTEM_ADMIN' || !user.associationId) {
      clearAccessState();
      return;
    }

    const requestId = accessRequestRef.current + 1;
    accessRequestRef.current = requestId;

    setPermissionsLoading(true);
    setBillingEntitlementsLoading(true);
    setPermissionsError(null);
    setBillingEntitlementsError(null);

    const [permissionsResult, billingResult] = await Promise.allSettled([
      getEffectivePermissions(user.associationId),
      getCurrentBillingEntitlements(),
    ]);

    if (accessRequestRef.current !== requestId) return;

    if (permissionsResult.status === 'fulfilled') {
      setEffectivePermissionsState(permissionsResult.value);
      setPermissionsError(null);
    } else {
      setEffectivePermissionsState(null);
      setPermissionsError(getApiErrorMessage(permissionsResult.reason));
    }

    if (billingResult.status === 'fulfilled') {
      setBillingEntitlements(billingResult.value);
      setBillingEntitlementsError(null);
    } else {
      setBillingEntitlements(null);
      setBillingEntitlementsError(getApiErrorMessage(billingResult.reason));
    }

    setPermissionsLoading(false);
    setBillingEntitlementsLoading(false);
  }, [activeView, clearAccessState, status, user]);

  const resolveViewWithEffectivePermissions = useCallback(async (authUser: AuthUser, preferredView?: MobileViewMode | null) => {
    const tokenView = resolveInitialView(authUser, preferredView);
    const shouldCheckEffectivePermissions = Boolean(
      isTenantScopedAuthPayload(authUser) &&
        authUser.associationId &&
        (!tokenView || (preferredView && tokenView !== preferredView) || (!preferredView && !hasAssociationAdminAccess(authUser))),
    );

    if (!shouldCheckEffectivePermissions) {
      return { nextView: tokenView, effectivePermissions: null as EffectivePermissionsResponse | null };
    }

    try {
      const effectivePermissions = await getEffectivePermissions(authUser.associationId);
      const permissionView = resolveInitialView(authUser, preferredView, effectivePermissions.permissions);
      return {
        nextView: permissionView || tokenView,
        effectivePermissions,
      };
    } catch {
      return { nextView: tokenView, effectivePermissions: null as EffectivePermissionsResponse | null };
    }
  }, []);

  const refreshBiometricState = useCallback(async () => {
    const [enabled, capability, accountLabel] = await Promise.all([
      isBiometricUnlockEnabled(),
      getBiometricCapability(),
      getBiometricAccountLabel(),
    ]);
    setBiometricUnlockEnabled(enabled);
    setBiometricCapability(capability);
    setBiometricAccountLabel(accountLabel);
  }, []);

  const establishSession = useCallback(async (accessToken: string, refreshToken: string, preferredView?: MobileViewMode | null) => {
    const storedUser = await storeSession(accessToken, refreshToken);
    clearAccessState();
    const { nextView, effectivePermissions } = await resolveViewWithEffectivePermissions(storedUser, preferredView);

    if (!nextView) {
      await clearStoredSession();
      throw new Error('This account is not allowed to use the mobile workspace yet.');
    }

    if (storedUser.associationId && nextView !== 'SYSTEM_ADMIN') {
      await setStoredAssociationMode(storedUser.associationId, nextView);
    }

    setUser(storedUser);
    setActiveViewState(nextView);
    if (effectivePermissions) {
      setEffectivePermissionsState(effectivePermissions);
    }
    setPendingBiometricUnlock(null);
    setBiometricError(null);
    setStatus('authenticated');
    setSessionExpired(false);
    setError(null);
    return storedUser;
  }, [clearAccessState, resolveViewWithEffectivePermissions]);

  const establishStoredSession = useCallback(
    async (stored: StoredSession) => {
      const { nextView, effectivePermissions } = await resolveViewWithEffectivePermissions(stored.user, stored.associationMode);
      if (!nextView) {
        await clearStoredSession();
        throw new Error('This account is not allowed to use the mobile workspace yet.');
      }

      if (stored.associationId && nextView !== 'SYSTEM_ADMIN') {
        await setStoredAssociationMode(stored.associationId, nextView);
      }

      clearAccessState();
      setUser(stored.user);
      setActiveViewState(nextView);
      if (effectivePermissions) {
        setEffectivePermissionsState(effectivePermissions);
      }
      setPendingBiometricUnlock(null);
      setBiometricError(null);
      setStatus('authenticated');
      setSessionExpired(false);
      setError(null);
      return stored.user;
    },
    [clearAccessState, resolveViewWithEffectivePermissions],
  );

  const completeAuthResponse = useCallback(
    async (response: AuthResponse) => {
      if (!hasUsableTokens(response)) {
        throw new Error('The server did not return a usable mobile session.');
      }

      const responseUser = decodeAuthUser(response.accessToken);
      if (!responseUser) {
        throw new Error('Nane could not read your mobile session. Try again.');
      }

      if (canChooseAssociationMode(responseUser)) {
        setPendingModeSelection({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          user: responseUser,
        });
        setPendingAssociationLogin(null);
        setStatus('unauthenticated');
        return;
      }

      setPendingModeSelection(null);
      setPendingAssociationLogin(null);
      await establishSession(response.accessToken, response.refreshToken);
    },
    [establishSession],
  );

  const restoreSession = useCallback(async () => {
    setStatus('booting');

    try {
      const [biometricsEnabled, capability, biometricAccount] = await Promise.all([
        isBiometricUnlockEnabled(),
        getBiometricCapability(),
        getBiometricAccountLabel(),
      ]);
      setBiometricUnlockEnabled(biometricsEnabled);
      setBiometricCapability(capability);
      setBiometricAccountLabel(biometricAccount);

      const stored = await loadStoredSession();
      if (stored) {
        if (biometricsEnabled && !biometricUnlockedRef.current) {
          if (capability.available) {
            setPendingBiometricUnlock({
              mode: 'stored-session',
              session: stored,
              accountLabel: biometricAccount || stored.user.fullName || stored.user.email,
            });
          } else {
            setPendingBiometricUnlock(null);
            setBiometricError(capability.reason || 'Biometric login is not available. Log in with your password to continue.');
          }
          setUser(null);
          setActiveViewState(null);
          clearAccessState();
          setStatus('unauthenticated');
          return;
        }

        await establishStoredSession(stored);
        return;
      }

      const refreshToken = await getStoredRefreshToken();
      if (refreshToken) {
        if (biometricsEnabled && !biometricUnlockedRef.current) {
          if (capability.available) {
            setPendingBiometricUnlock({
              mode: 'refresh-session',
              accountLabel: biometricAccount,
            });
          } else {
            setPendingBiometricUnlock(null);
            setBiometricError(capability.reason || 'Biometric login is not available. Log in with your password to continue.');
          }
          setUser(null);
          setActiveViewState(null);
          clearAccessState();
          setStatus('unauthenticated');
          return;
        }

        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const refreshedSession = await loadStoredSession();
          if (refreshedSession) {
            await establishStoredSession(refreshedSession);
            return;
          }
        }
      }

      setUser(null);
      setActiveViewState(null);
      setPendingBiometricUnlock(null);
      clearAccessState();
      setStatus('unauthenticated');
    } catch (restoreError) {
      await clearStoredSession();
      await clearBiometricUnlockPreference();
      setUser(null);
      setActiveViewState(null);
      setPendingBiometricUnlock(null);
      setBiometricUnlockEnabled(false);
      setBiometricAccountLabel(null);
      clearAccessState();
      setError(getApiErrorMessage(restoreError));
      setStatus('unauthenticated');
    }
  }, [clearAccessState, establishStoredSession]);

  useEffect(() => {
    void Promise.resolve().then(restoreSession);
  }, [restoreSession]);

  useEffect(() => {
    void Promise.resolve().then(loadAccessState);
  }, [loadAccessState]);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await clearLocalPushRegistrationAsync();
      await clearBiometricUnlockPreference();
      await clearStoredSession();
      setUser(null);
      setActiveViewState(null);
      setPendingAssociationLogin(null);
      setPendingModeSelection(null);
      setPendingBiometricUnlock(null);
      setBiometricUnlockEnabled(false);
      setBiometricAccountLabel(null);
      clearAccessState();
      setStatus('unauthenticated');
      setSessionExpired(true);
      setError('Your session expired. Sign in again to continue.');
    });

    return () => setSessionExpiredHandler(null);
  }, [clearAccessState]);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);

      try {
        const response = await login(credentials);
        biometricUnlockedRef.current = false;
        setPendingBiometricUnlock(null);
        setBiometricError(null);

        if (response.multipleAssociations && response.associations?.length) {
          setPendingAssociationLogin({
            credentials,
            associations: response.associations,
            email: response.email || credentials.email,
            fullName: response.fullName,
          });
          setPendingModeSelection(null);
          setStatus('unauthenticated');
          return;
        }

        await completeAuthResponse(response);
      } catch (signInError) {
        setError(getApiErrorMessage(signInError));
        setStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    },
    [completeAuthResponse],
  );

  const selectAssociation = useCallback(
    async (associationId: string) => {
      if (!pendingAssociationLogin) return;

      setLoading(true);
      setError(null);

      try {
        const response = await loginWithAssociation({ ...pendingAssociationLogin.credentials, associationId });
        await completeAuthResponse(response);
      } catch (selectionError) {
        setError(getApiErrorMessage(selectionError));
        setStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    },
    [completeAuthResponse, pendingAssociationLogin],
  );

  const selectLoginMode = useCallback(
    async (mode: Extract<MobileViewMode, 'ADMIN' | 'MEMBER'>) => {
      if (!pendingModeSelection) return;

      setLoading(true);
      setError(null);

      try {
        await establishSession(pendingModeSelection.accessToken, pendingModeSelection.refreshToken, mode);
        setPendingModeSelection(null);
      } catch (modeError) {
        setError(getApiErrorMessage(modeError));
        setStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    },
    [establishSession, pendingModeSelection],
  );

  const replaceSession = useCallback(
    async (accessToken: string, refreshToken: string, preferredView?: MobileViewMode | null) => {
      return establishSession(accessToken, refreshToken, preferredView);
    },
    [establishSession],
  );

  const unlockWithBiometrics = useCallback(async () => {
    const challenge = pendingBiometricUnlock;
    if (!challenge || biometricLoading) return;

    setBiometricLoading(true);
    setBiometricError(null);
    setError(null);

    try {
      const result = await authenticateWithBiometrics(biometricCapability.label);
      if (!result.success) {
        setBiometricError(result.message || 'Use your password to continue.');
        return;
      }

      biometricUnlockedRef.current = true;

      if (challenge.mode === 'stored-session' && challenge.session) {
        await establishStoredSession(challenge.session);
        return;
      }

      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        await clearStoredSession();
        await clearBiometricUnlockPreference();
        setBiometricUnlockEnabled(false);
        setBiometricAccountLabel(null);
        setPendingBiometricUnlock(null);
        setError('Your saved session ended. Log in with your password to continue.');
        setStatus('unauthenticated');
        return;
      }

      const refreshedSession = await loadStoredSession();
      if (!refreshedSession) {
        await clearBiometricUnlockPreference();
        setBiometricUnlockEnabled(false);
        setBiometricAccountLabel(null);
        setPendingBiometricUnlock(null);
        setError('Your saved session ended. Log in with your password to continue.');
        setStatus('unauthenticated');
        return;
      }

      await establishStoredSession(refreshedSession);
    } catch (unlockError) {
      setBiometricError(getApiErrorMessage(unlockError));
      setStatus('unauthenticated');
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricCapability.label, biometricLoading, establishStoredSession, pendingBiometricUnlock]);

  const enableBiometricUnlock = useCallback(async () => {
    setBiometricLoading(true);
    setBiometricError(null);

    try {
      const capability = await getBiometricCapability();
      setBiometricCapability(capability);

      if (!capability.available) {
        setBiometricError(capability.reason || 'Biometric login is not ready on this device.');
        return false;
      }

      const result = await authenticateWithBiometrics(capability.label);
      if (!result.success) {
        setBiometricError(result.message || 'Biometric login was not enabled.');
        return false;
      }

      const accountLabel = user?.fullName || user?.email || null;
      await enableBiometricUnlockPreference(accountLabel);
      biometricUnlockedRef.current = true;
      setBiometricUnlockEnabled(true);
      setBiometricAccountLabel(accountLabel);
      return true;
    } finally {
      setBiometricLoading(false);
    }
  }, [user]);

  const disableBiometricUnlock = useCallback(async () => {
    setBiometricLoading(true);
    try {
      await clearBiometricUnlockPreference();
      biometricUnlockedRef.current = false;
      setBiometricUnlockEnabled(false);
      setBiometricAccountLabel(null);
      setPendingBiometricUnlock(null);
      setBiometricError(null);
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await unregisterPushDeviceAsync();
      await requestLogout();
    } catch {}

    await clearBiometricUnlockPreference();
    await clearStoredSession();
    setUser(null);
    setActiveViewState(null);
    setPendingAssociationLogin(null);
    setPendingModeSelection(null);
    setPendingBiometricUnlock(null);
    setBiometricUnlockEnabled(false);
    setBiometricAccountLabel(null);
    biometricUnlockedRef.current = false;
    clearAccessState();
    setSessionExpired(false);
    setError(null);
    setStatus('unauthenticated');
    setLoading(false);
  }, [clearAccessState]);

  const expandedEffectivePermissions = useMemo(() => {
    const permissionKeys = [...(effectivePermissionsState?.permissions ?? []), ...(user?.permissions ?? [])];
    const associationRole = String(user?.associationRole || '').trim().toUpperCase();
    const systemRole = String(user?.systemRole || '').trim().toUpperCase();

    if (associationRole === 'MEMBER' || associationRole === 'ADMIN' || systemRole === 'ASSOCIATION_ADMIN') {
      permissionKeys.push(...MEMBER_SELF_SERVICE_BASELINE);
    }

    return Array.from(expandPermissionKeys(permissionKeys));
  }, [effectivePermissionsState, user]);

  const effectiveRoleList = useMemo(
    () => Array.from(new Set([...(effectivePermissionsState?.roles ?? []), ...(user?.roles ?? [])].filter(Boolean))),
    [effectivePermissionsState, user],
  );

  const canUseAssociationAdmin = useMemo(
    () => Boolean(user && canUseView(user, 'ADMIN', expandedEffectivePermissions)),
    [expandedEffectivePermissions, user],
  );
  const canUseMemberPortal = useMemo(() => Boolean(user && canUseView(user, 'MEMBER', expandedEffectivePermissions)), [expandedEffectivePermissions, user]);
  const canUseSystemAdmin = useMemo(() => Boolean(user && canUseView(user, 'SYSTEM_ADMIN', expandedEffectivePermissions)), [expandedEffectivePermissions, user]);

  const setActiveView = useCallback(
    async (view: MobileViewMode) => {
      if (!canUseView(user, view, expandedEffectivePermissions)) {
        setError('This account cannot switch to that workspace.');
        return;
      }

      if (user?.associationId && view !== 'SYSTEM_ADMIN') {
        await setStoredAssociationMode(user.associationId, view);
      }

      setActiveViewState(view);
      setError(null);
    },
    [expandedEffectivePermissions, user],
  );

  useEffect(() => {
    if (status !== 'authenticated' || !user || !activeView || activeView === 'SYSTEM_ADMIN' || permissionsLoading) return;
    if (!effectivePermissionsState && !permissionsError) return;
    if (canUseView(user, activeView, expandedEffectivePermissions)) return;

    const fallbackView = resolveInitialView(user, null, expandedEffectivePermissions);
    if (fallbackView && fallbackView !== activeView) {
      void Promise.resolve().then(() => {
        setActiveViewState(fallbackView);
        if (user.associationId && fallbackView !== 'SYSTEM_ADMIN') {
          void setStoredAssociationMode(user.associationId, fallbackView);
        }
      });
      return;
    }

    void Promise.resolve().then(() => {
      setError('This account does not have mobile workspace access. Ask an administrator to review the assigned role.');
    });
  }, [activeView, effectivePermissionsState, expandedEffectivePermissions, permissionsError, permissionsLoading, status, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      booting: status === 'booting',
      loading,
      sessionExpired,
      error,
      user,
      associationId: user?.associationId || null,
      activeView,
      pendingAssociationLogin,
      pendingModeSelection,
      permissionsLoading,
      permissionsError,
      effectivePermissions: expandedEffectivePermissions,
      effectiveRoles: effectiveRoleList,
      effectivePermissionVersion: effectivePermissionsState?.permissionVersion ?? null,
      billingEntitlements,
      billingEntitlementsLoading,
      billingEntitlementsError,
      canUseAssociationAdmin,
      canUseMemberPortal,
      canUseSystemAdmin,
      biometricUnlockEnabled,
      biometricUnlockAvailable: Boolean(pendingBiometricUnlock && biometricUnlockEnabled && biometricCapability.available),
      biometricLabel: biometricCapability.label,
      biometricAccountLabel: pendingBiometricUnlock?.accountLabel || biometricAccountLabel,
      biometricLoading,
      biometricError,
      signIn,
      selectAssociation,
      selectLoginMode,
      replaceSession,
      unlockWithBiometrics,
      enableBiometricUnlock,
      disableBiometricUnlock,
      refreshBiometricState,
      signOut,
      setActiveView,
      refreshAccessState: loadAccessState,
      clearError: () => {
        setError(null);
        setBiometricError(null);
        setSessionExpired(false);
      },
      clearPendingAssociationLogin: () => {
        setPendingAssociationLogin(null);
        setPendingModeSelection(null);
      },
    }),
    [
      activeView,
      billingEntitlements,
      billingEntitlementsError,
      billingEntitlementsLoading,
      biometricAccountLabel,
      biometricCapability,
      biometricError,
      biometricLoading,
      biometricUnlockEnabled,
      canUseAssociationAdmin,
      canUseMemberPortal,
      canUseSystemAdmin,
      error,
      effectivePermissionsState,
      effectiveRoleList,
      expandedEffectivePermissions,
      loadAccessState,
      loading,
      pendingBiometricUnlock,
      pendingAssociationLogin,
      pendingModeSelection,
      permissionsError,
      permissionsLoading,
      replaceSession,
      refreshBiometricState,
      selectAssociation,
      selectLoginMode,
      sessionExpired,
      setActiveView,
      signIn,
      signOut,
      status,
      unlockWithBiometrics,
      enableBiometricUnlock,
      disableBiometricUnlock,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
