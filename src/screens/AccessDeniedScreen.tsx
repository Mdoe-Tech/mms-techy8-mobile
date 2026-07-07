import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { MobileButton, MobileCard, MobilePageHeader, MobileScreen, MobileText } from '@/components/mobile';
import { useNaneTheme } from '@/theme/tokens';

type AccessDeniedScreenProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function AccessDeniedScreen({
  title = 'Workspace unavailable',
  description = 'This account does not have access to this mobile workspace.',
  actionLabel,
  onAction,
}: AccessDeniedScreenProps) {
  const theme = useNaneTheme();
  const { loading, signOut, user } = useAuth();
  const ActionIcon = onAction ? ArrowLeft : LogOut;

  return (
    <MobileScreen>
      <MobilePageHeader showLogo eyebrow="Access" title={title} subtitle={user?.email} rightAction={<View />} />

      <MobileCard style={styles.card}>
        <View style={[styles.icon, { backgroundColor: theme.colors.status.warning }]}>
          <ShieldAlert color={theme.colors.onPrimary} size={24} strokeWidth={2.6} />
        </View>
        <MobileText variant="section" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="body" tone="secondary">
          {description}
        </MobileText>
        <MobileButton
          label={actionLabel || 'Sign out'}
          icon={ActionIcon}
          variant="secondary"
          loading={onAction ? false : loading}
          onPress={onAction || signOut}
        />
      </MobileCard>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
