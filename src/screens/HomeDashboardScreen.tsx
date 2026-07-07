import { useAuth } from '@/auth/auth-context';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import AssociationHomeScreen from '@/screens/AssociationHomeScreen';
import MemberHomeScreen from '@/screens/MemberHomeScreen';
import MobileSystemAdminDashboardScreen from '@/screens/MobileSystemAdminDashboardScreen';
import MobileUnionDashboardScreen from '@/screens/MobileUnionDashboardScreen';

export default function HomeDashboardScreen() {
  const { activeView, user } = useAuth();

  if (activeView === 'ADMIN') {
    if (user?.associationType === 'UNION') {
      return <MobileUnionDashboardScreen />;
    }
    return <AssociationHomeScreen />;
  }

  if (activeView === 'MEMBER') {
    return <MemberHomeScreen />;
  }

  if (activeView === 'SYSTEM_ADMIN') {
    return <MobileSystemAdminDashboardScreen />;
  }

  return (
    <AccessDeniedScreen
      title="System admin mobile workspace"
      description="System admin routes are inventoried for mobile, but this first production foundation only enables association and member dashboards."
    />
  );
}
