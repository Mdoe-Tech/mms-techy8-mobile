import { RequireAuth } from '@/auth/RequireAuth';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  return (
    <RequireAuth>
      <AppTabs />
    </RequireAuth>
  );
}
