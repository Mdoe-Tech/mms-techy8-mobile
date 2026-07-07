import { StyleSheet, View } from 'react-native';

import { getReadableTextColor, labelFromStatus, statusToneFor, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileStatusBadgeProps = {
  status?: string | null;
  label?: string;
  tone?: StatusTone;
  showDot?: boolean;
};

export function MobileStatusBadge({ status, label, tone, showDot = true }: MobileStatusBadgeProps) {
  const theme = useNaneTheme();
  const resolvedTone = tone || statusToneFor(status);
  const backgroundColor = theme.colors.status[resolvedTone] || theme.colors.status.neutral;
  const textColor = getReadableTextColor(backgroundColor);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      {showDot ? <View style={[styles.dot, { backgroundColor: textColor }]} /> : null}
      <MobileText variant="tiny" weight="bold" numberOfLines={1} style={[styles.label, { color: textColor }]}>
        {label || labelFromStatus(status)}
      </MobileText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 9,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    opacity: 0.9,
  },
});
