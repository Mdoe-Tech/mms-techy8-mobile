import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { RequireAuth } from '@/auth/RequireAuth';
import { useAuth } from '@/auth/auth-context';
import { MobileErrorState, MobilePageLoadingState } from '@/components/mobile';
import { getRouteById } from '@/navigation/route-registry';
import RoutePreviewScreen from '@/screens/RoutePreviewScreen';

type PreviewBootstrapState = 'idle' | 'loading' | 'done' | 'error';

export default function RoutePreview() {
  const params = useLocalSearchParams();
  const { replaceSession } = useAuth();
  const [bootstrapState, setBootstrapState] = useState<PreviewBootstrapState>('idle');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const bootstrapStartedRef = useRef(false);
  const previewSession = firstParam(params.previewSession);
  const previewRoute = getRouteById(params.routeId);
  const previewView = previewRoute?.role === 'member' ? 'MEMBER' : previewRoute?.role === 'system-admin' ? 'SYSTEM_ADMIN' : 'ADMIN';
  const shouldBootstrapPreviewSession = __DEV__ && previewSession === 'env';

  useEffect(() => {
    if (!shouldBootstrapPreviewSession || bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    let cancelled = false;

    void Promise.resolve().then(async () => {
      const accessToken = process.env.EXPO_PUBLIC_NANE_PREVIEW_ACCESS_TOKEN;
      const refreshToken = process.env.EXPO_PUBLIC_NANE_PREVIEW_REFRESH_TOKEN;

      if (!accessToken || !refreshToken) {
        if (!cancelled) {
          setBootstrapError('Preview session tokens are not available in the local Expo environment.');
          setBootstrapState('error');
        }
        return;
      }

      if (!cancelled) {
        setBootstrapState('loading');
      }

      try {
        await replaceSession(accessToken, refreshToken, previewView);
        if (!cancelled) {
          setBootstrapError(null);
          setBootstrapState('done');
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setBootstrapError(error instanceof Error ? error.message : 'Preview session could not be loaded.');
          setBootstrapState('error');
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewView, replaceSession, shouldBootstrapPreviewSession]);

  if (shouldBootstrapPreviewSession && bootstrapState !== 'done') {
    if (bootstrapState === 'error') {
      return <MobileErrorState title="Preview session issue" description={bootstrapError || 'Preview session could not be loaded.'} />;
    }
    return <MobilePageLoadingState kind="dashboard" message="Opening preview session" />;
  }

  return (
    <RequireAuth>
      <RoutePreviewScreen />
    </RequireAuth>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
