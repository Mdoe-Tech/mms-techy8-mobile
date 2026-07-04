import { CheckCircle2, Info, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileToastProps = {
  title: string;
  description?: string;
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
};

export function MobileToast({ title, description, tone = 'success', style }: MobileToastProps) {
  const theme = useNaneTheme();
  const color = theme.colors.status[tone];
  const Icon = tone === 'danger' || tone === 'warning' ? TriangleAlert : tone === 'info' ? Info : CheckCircle2;

  return (
    <View style={[styles.toast, { backgroundColor: color }, style]}>
      <Icon color={theme.colors.onPrimary} size={20} strokeWidth={2.4} />
      <View style={styles.text}>
        <MobileText variant="small" weight="bold" tone="inverse">
          {title}
        </MobileText>
        {description ? (
          <MobileText variant="tiny" tone="inverse" style={styles.description}>
            {description}
          </MobileText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  description: {
    opacity: 0.9,
  },
});
