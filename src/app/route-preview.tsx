import { RequireAuth } from '@/auth/RequireAuth';
import RoutePreviewScreen from '@/screens/RoutePreviewScreen';

export default function RoutePreview() {
  return (
    <RequireAuth>
      <RoutePreviewScreen />
    </RequireAuth>
  );
}
