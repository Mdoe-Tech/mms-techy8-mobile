import type { ImageSource } from 'expo-image';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { mobileEnv } from '@/config/env';
import { getAssociationProfile } from '@/services/association-service';
import { getStoredAccessToken, getStoredAssociationMode } from '@/auth/session-store';
import { useAuth } from './auth-context';

type WorkspaceIdentity = {
  workspaceName: string | null;
  workspaceLogoPath: string | null;
  workspaceLogoSource: ImageSource | null;
  isAssociationWorkspace: boolean;
};

const WorkspaceIdentityContext = createContext<WorkspaceIdentity>({
  workspaceName: null,
  workspaceLogoPath: null,
  workspaceLogoSource: null,
  isAssociationWorkspace: false,
});

export function WorkspaceIdentityProvider({ children }: { children: ReactNode }) {
  const { activeView, associationId, status, user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<ImageSource | null>(null);
  const isAssociationWorkspace = Boolean(status === 'authenticated' && associationId && activeView !== 'SYSTEM_ADMIN');

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceIdentity() {
      setProfileName(null);
      setLogoPath(null);
      setLogoSource(null);

      if (!isAssociationWorkspace || !associationId) return;

      try {
        const profile = await getAssociationProfile(associationId);
        if (cancelled) return;

        const nextLogoPath = profile.logoPath?.trim() || null;
        const nextLogoSource = nextLogoPath ? await buildAssociationLogoSource(nextLogoPath, associationId) : null;
        if (cancelled) return;

        setProfileName(profile.name?.trim() || null);
        setLogoPath(nextLogoPath);
        setLogoSource(nextLogoSource);
      } catch {
        if (!cancelled) {
          setProfileName(null);
          setLogoPath(null);
          setLogoSource(null);
        }
      }
    }

    void loadWorkspaceIdentity();

    return () => {
      cancelled = true;
    };
  }, [associationId, isAssociationWorkspace]);

  const value = useMemo<WorkspaceIdentity>(
    () => ({
      workspaceName: profileName || user?.associationName || null,
      workspaceLogoPath: logoPath,
      workspaceLogoSource: logoSource,
      isAssociationWorkspace,
    }),
    [isAssociationWorkspace, logoPath, logoSource, profileName, user?.associationName],
  );

  return <WorkspaceIdentityContext.Provider value={value}>{children}</WorkspaceIdentityContext.Provider>;
}

export function useWorkspaceIdentity() {
  return useContext(WorkspaceIdentityContext);
}

async function buildAssociationLogoSource(filePath: string, associationId: string): Promise<ImageSource> {
  const accessToken = await getStoredAccessToken();
  const associationMode = await getStoredAssociationMode(associationId);
  const headers: Record<string, string> = {
    Accept: 'image/*',
    'X-Association-Id': associationId,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (associationMode === 'ADMIN' || associationMode === 'MEMBER') {
    headers['X-Association-Mode'] = associationMode;
  }

  if (/^https?:\/\//i.test(filePath)) {
    return { uri: filePath, headers, cacheKey: `association-logo-${associationId}-${filePath}` };
  }

  const query = new URLSearchParams({ filePath, disposition: 'inline' });
  return {
    uri: `${mobileEnv.apiBaseUrl}/files/download?${query.toString()}`,
    headers,
    cacheKey: `association-logo-${associationId}-${filePath}`,
  };
}
