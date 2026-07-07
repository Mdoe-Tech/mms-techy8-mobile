import { RequireAuth } from '@/auth/RequireAuth';
import ModuleRoutesScreen from '@/screens/ModuleRoutesScreen';

export default function ModuleScreen() {
  return (
    <RequireAuth>
      <ModuleRoutesScreen />
    </RequireAuth>
  );
}
