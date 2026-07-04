import { CircleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileButton } from './MobileButton';
import { MobileText } from './MobileText';

type MobileErrorStateProps = {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function MobileErrorState({ title, description, retryLabel = 'Try again', onRetry }: MobileErrorStateProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.error, { backgroundColor: theme.colors.surface, borderColor: theme.colors.status.danger }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.status.danger }]}>
        <CircleAlert color={theme.colors.onPrimary} size={22} />
      </View>
      <MobileText variant="section" weight="bold">
        {title}
      </MobileText>
      <MobileText variant="small" tone="secondary">
        {description}
      </MobileText>
      {onRetry ? <MobileButton label={retryLabel} variant="danger" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    gap: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
