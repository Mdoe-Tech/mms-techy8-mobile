import { RequireAuth } from '@/auth/RequireAuth';
import AppTabs from '@/components/app-tabs';
import { useLocalSearchParams, useSegments } from 'expo-router';

export default function TabLayout() {
  const params = useLocalSearchParams();
  const segments = useSegments();
  const previewSession = firstParam(params.previewSession);
  const isRoutePreview = (segments as readonly string[]).includes('route-preview');
  const allowsPreviewBootstrap = __DEV__ && isRoutePreview && previewSession === 'env';

  if (allowsPreviewBootstrap) {
    return <AppTabs />;
  }

  return (
    <RequireAuth>
      <AppTabs />
    </RequireAuth>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
