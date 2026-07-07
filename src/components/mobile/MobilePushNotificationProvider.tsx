import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-context';
import { mobileRouteRegistry, getRouteById } from '@/navigation/route-registry';
import { ensurePushRegistrationAsync } from '@/services/mobile-push-service';
import { useMobileFeedback } from './MobileFeedbackProvider';

type NotificationData = Record<string, unknown>;

export function MobilePushNotificationProvider({ children }: { children: ReactNode }) {
  const { activeView, status, user } = useAuth();
  const { toast } = useMobileFeedback();
  const bootstrapKeyRef = useRef<string | null>(null);
  const handledResponseRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      bootstrapKeyRef.current = null;
      return;
    }

    const bootstrapKey = [user.userId, user.associationId || 'platform', activeView || 'workspace'].join(':');
    if (bootstrapKeyRef.current === bootstrapKey) return;
    bootstrapKeyRef.current = bootstrapKey;

    void ensurePushRegistrationAsync({ user, activeView, prompt: false });
  }, [activeView, status, user]);

  const handleNotificationRoute = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseKey = response.notification.request.identifier;
      if (handledResponseRef.current === responseKey) return;
      handledResponseRef.current = responseKey;

      const data = (response.notification.request.content.data || {}) as NotificationData;
      const routeId = readDataString(data, ['routeId', 'mobileRouteId']);
      const path = readDataString(data, ['routePath', 'path', 'url', 'href', 'deepLink']);

      if (routeId) {
        const route = getRouteById(routeId);
        if (route) {
          router.push({
            pathname: '/work/route-preview',
            params: { routeId: route.id },
          } as never);
          Notifications.clearLastNotificationResponse();
          return;
        }
      }

      if (!path) return;

      const normalized = normalizeNotificationPath(path);
      if (!normalized) return;

      const match = matchMobileRoute(normalized.pathname);
      if (match) {
        router.push({
          pathname: '/work/route-preview',
          params: {
            routeId: match.route.id,
            ...match.params,
            ...normalized.query,
          },
        } as never);
        Notifications.clearLastNotificationResponse();
        return;
      }

      toast.info({
        title: 'Notification opened',
        description: 'This alert is ready, but its mobile destination is not mapped yet.',
      });
    },
    [toast],
  );

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title || 'Nane update';
      const body = notification.request.content.body || 'Open Nane to review the latest activity.';
      toast.info({ title, description: body, durationMs: 5200 });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationRoute);
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) handleNotificationRoute(lastResponse);

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleNotificationRoute, toast]);

  return children;
}

function readDataString(data: NotificationData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeNotificationPath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('nane://')) {
      const url = new URL(trimmed);
      const hostPath = url.host ? `/${url.host}` : '';
      const pathname = `${hostPath}${url.pathname && url.pathname !== '/' ? url.pathname : ''}` || '/';
      const query = Object.fromEntries(url.searchParams.entries());
      return { pathname, query };
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const allowedHost = /(^|\.)nane\.co\.tz$/i.test(url.hostname) || /(^|\.)test-app\.nane\.co\.tz$/i.test(url.hostname);
      if (!allowedHost) return null;
      return {
        pathname: url.pathname || '/',
        query: Object.fromEntries(url.searchParams.entries()),
      };
    }

    const [pathnamePart, queryPart] = trimmed.split('?');
    if (!pathnamePart.startsWith('/')) return null;
    return {
      pathname: pathnamePart,
      query: Object.fromEntries(new URLSearchParams(queryPart || '').entries()),
    };
  } catch {
    return null;
  }
}

function matchMobileRoute(pathname: string) {
  const incomingSegments = pathname.split('/').filter(Boolean);

  for (const route of mobileRouteRegistry) {
    const routeSegments = route.path.split('/').filter(Boolean);
    if (routeSegments.length !== incomingSegments.length) continue;

    const params: Record<string, string> = {};
    const matches = routeSegments.every((segment, index) => {
      const incoming = incomingSegments[index];
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(incoming);
        return true;
      }
      return segment === incoming;
    });

    if (matches) return { route, params };
  }

  return null;
}
