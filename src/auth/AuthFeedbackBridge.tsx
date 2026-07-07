import { useEffect } from 'react';

import { useAuth } from '@/auth/auth-context';
import { useMobileFeedback } from '@/components/mobile';

const SESSION_NOTICE_ID = 'session-expired';

export function AuthFeedbackBridge() {
  const { clearError, sessionExpired } = useAuth();
  const { dismissFeedback, showFeedback } = useMobileFeedback();

  useEffect(() => {
    if (!sessionExpired) {
      dismissFeedback(SESSION_NOTICE_ID);
      return;
    }

    showFeedback({
      id: SESSION_NOTICE_ID,
      kind: 'session',
      tone: 'warning',
      title: 'Session expired',
      description: 'For security, your Nane session has ended. Sign in again to continue from a fresh secure session.',
      details: {
        code: 'SESSION_EXPIRED',
      },
      primaryAction: {
        label: 'Sign in again',
        onPress: clearError,
      },
      secondaryAction: {
        label: 'Dismiss',
        onPress: clearError,
      },
      dismissible: false,
    });
  }, [clearError, dismissFeedback, sessionExpired, showFeedback]);

  return null;
}
