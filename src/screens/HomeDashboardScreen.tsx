import { useAuth } from '@/auth/auth-context';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import AssociationHomeScreen from '@/screens/AssociationHomeScreen';
import MemberHomeScreen from '@/screens/MemberHomeScreen';

export default function HomeDashboardScreen() {
  const { activeView } = useAuth();

  if (activeView === 'ADMIN') {
    return <AssociationHomeScreen />;
  }

  if (activeView === 'MEMBER') {
    return <MemberHomeScreen />;
  }

  return (
    <AccessDeniedScreen
      title="System admin mobile workspace"
      description="System admin routes are inventoried for mobile, but this first production foundation only enables association and member dashboards."
    />
  );
}
