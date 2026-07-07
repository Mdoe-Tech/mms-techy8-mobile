import { Fragment, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-context';
import { MobileLaunchScreen } from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import LoginScreen from '@/screens/LoginScreen';
import type { MobileViewMode } from '@/types/auth';

type RequireAuthProps = {
  children: ReactNode;
  allowedViews?: MobileViewMode[];
};

export function RequireAuth({ children, allowedViews }: RequireAuthProps) {
  const { activeView, booting, status } = useAuth();

  if (booting) {
    return <MobileLaunchScreen message="Opening Nane" />;
  }

  if (status !== 'authenticated' || !activeView) {
    return <LoginScreen />;
  }

  if (allowedViews?.length && !allowedViews.includes(activeView)) {
    return (
      <AccessDeniedScreen
        title="Different workspace required"
        description="This screen belongs to another Nane workspace. Switch workspace or sign in with an account that has access."
      />
    );
  }

  return <Fragment>{children}</Fragment>;
}
