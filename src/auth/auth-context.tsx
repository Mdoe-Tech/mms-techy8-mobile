import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { refreshAccessToken, setSessionExpiredHandler } from '@/api/client';
import { deriveViewFromUser, hasAssociationAdminAccess, hasMemberAccess } from '@/auth/jwt';
import {
  clearStoredSession,
  getStoredRefreshToken,
  loadStoredSession,
  setStoredAssociationMode,
  storeSession,
} from '@/auth/session-store';
import { getApiErrorMessage } from '@/types/api';
import type { AuthAssociationOption, AuthResponse, AuthUser, LoginCredentials, MobileViewMode } from '@/types/auth';
import { login, loginWithAssociation, logout as requestLogout } from '@/services/auth-service';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

type PendingAssociationLogin = {
  credentials: LoginCredentials;
  associations: AuthAssociationOption[];
  email: string;
  fullName?: string;
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
  canUseAssociationAdmin: boolean;
  canUseMemberPortal: boolean;
  canUseSystemAdmin: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  selectAssociation: (associationId: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveView: (view: MobileViewMode) => Promise<void>;
  clearError: () => void;
  clearPendingAssociationLogin: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function canUseView(user: AuthUser | null, view: MobileViewMode | null) {
  if (!user || !view) return false;
  if (view === 'ADMIN') return hasAssociationAdminAccess(user);
  if (view === 'MEMBER') return hasMemberAccess(user);
  return deriveViewFromUser(user) === 'SYSTEM_ADMIN';
}

function resolveInitialView(user: AuthUser, preferredView?: MobileViewMode | null) {
  if (canUseView(user, preferredView || null)) return preferredView || null;
  return deriveViewFromUser(user);
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

  const establishSession = useCallback(async (accessToken: string, refreshToken: string, preferredView?: MobileViewMode | null) => {
    const storedUser = await storeSession(accessToken, refreshToken);
    const nextView = resolveInitialView(storedUser, preferredView);

    if (!nextView) {
      await clearStoredSession();
      throw new Error('This account is not allowed to use the mobile workspace yet.');
    }

    if (storedUser.associationId && nextView !== 'SYSTEM_ADMIN') {
      await setStoredAssociationMode(storedUser.associationId, nextView);
    }

    setUser(storedUser);
    setActiveViewState(nextView);
    setStatus('authenticated');
    setSessionExpired(false);
    setError(null);
    return storedUser;
  }, []);

  const restoreSession = useCallback(async () => {
    setStatus('booting');

    try {
      const stored = await loadStoredSession();
      if (stored) {
        const nextView = resolveInitialView(stored.user, stored.associationMode);
        if (!nextView) {
          await clearStoredSession();
          setUser(null);
          setActiveViewState(null);
          setStatus('unauthenticated');
          return;
        }

        if (stored.associationId && nextView !== 'SYSTEM_ADMIN') {
          await setStoredAssociationMode(stored.associationId, nextView);
        }

        setUser(stored.user);
        setActiveViewState(nextView);
        setStatus('authenticated');
        return;
      }

      const refreshToken = await getStoredRefreshToken();
      if (refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const refreshedSession = await loadStoredSession();
          if (refreshedSession) {
            const nextView = resolveInitialView(refreshedSession.user, refreshedSession.associationMode);
            if (nextView) {
              setUser(refreshedSession.user);
              setActiveViewState(nextView);
              setStatus('authenticated');
              return;
            }
          }
        }
      }

      setUser(null);
      setActiveViewState(null);
      setStatus('unauthenticated');
    } catch (restoreError) {
      await clearStoredSession();
      setUser(null);
      setActiveViewState(null);
      setError(getApiErrorMessage(restoreError));
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(restoreSession);
  }, [restoreSession]);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await clearStoredSession();
      setUser(null);
      setActiveViewState(null);
      setPendingAssociationLogin(null);
      setStatus('unauthenticated');
      setSessionExpired(true);
      setError('Your session expired. Sign in again to continue.');
    });

    return () => setSessionExpiredHandler(null);
  }, []);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);

      try {
        const response = await login(credentials);

        if (response.multipleAssociations && response.associations?.length) {
          setPendingAssociationLogin({
            credentials,
            associations: response.associations,
            email: response.email || credentials.email,
            fullName: response.fullName,
          });
          setStatus('unauthenticated');
          return;
        }

        if (!hasUsableTokens(response)) {
          throw new Error('The server did not return a usable mobile session.');
        }

        setPendingAssociationLogin(null);
        await establishSession(response.accessToken, response.refreshToken);
      } catch (signInError) {
        setError(getApiErrorMessage(signInError));
        setStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    },
    [establishSession],
  );

  const selectAssociation = useCallback(
    async (associationId: string) => {
      if (!pendingAssociationLogin) return;

      setLoading(true);
      setError(null);

      try {
        const response = await loginWithAssociation({ ...pendingAssociationLogin.credentials, associationId });
        if (!hasUsableTokens(response)) {
          throw new Error('The server did not return a usable mobile session.');
        }

        setPendingAssociationLogin(null);
        await establishSession(response.accessToken, response.refreshToken);
      } catch (selectionError) {
        setError(getApiErrorMessage(selectionError));
        setStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    },
    [establishSession, pendingAssociationLogin],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await requestLogout();
    } catch {}

    await clearStoredSession();
    setUser(null);
    setActiveViewState(null);
    setPendingAssociationLogin(null);
    setSessionExpired(false);
    setError(null);
    setStatus('unauthenticated');
    setLoading(false);
  }, []);

  const setActiveView = useCallback(
    async (view: MobileViewMode) => {
      if (!canUseView(user, view)) {
        setError('This account cannot switch to that workspace.');
        return;
      }

      if (user?.associationId && view !== 'SYSTEM_ADMIN') {
        await setStoredAssociationMode(user.associationId, view);
      }

      setActiveViewState(view);
      setError(null);
    },
    [user],
  );

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
      canUseAssociationAdmin: hasAssociationAdminAccess(user),
      canUseMemberPortal: hasMemberAccess(user),
      canUseSystemAdmin: deriveViewFromUser(user) === 'SYSTEM_ADMIN',
      signIn,
      selectAssociation,
      signOut,
      setActiveView,
      clearError: () => setError(null),
      clearPendingAssociationLogin: () => setPendingAssociationLogin(null),
    }),
    [activeView, error, loading, pendingAssociationLogin, selectAssociation, sessionExpired, setActiveView, signIn, signOut, status, user],
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
