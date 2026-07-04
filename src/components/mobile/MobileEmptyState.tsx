import { Inbox } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileButton } from './MobileButton';
import { MobileText } from './MobileText';

type MobileEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function MobileEmptyState({ title, description, actionLabel, onAction }: MobileEmptyStateProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.empty, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primary }]}>
        <Inbox color={theme.colors.onPrimary} size={22} />
      </View>
      <MobileText variant="section" weight="bold" style={styles.center}>
        {title}
      </MobileText>
      <MobileText variant="small" tone="secondary" style={styles.center}>
        {description}
      </MobileText>
      {actionLabel && onAction ? <MobileButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 190,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
