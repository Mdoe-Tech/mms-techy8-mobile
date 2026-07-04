import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileProgressBarProps = {
  value: number;
  label?: string;
  tone?: KpiTone;
  style?: StyleProp<ViewStyle>;
};

export function MobileProgressBar({ value, label, tone = 'green', style }: MobileProgressBarProps) {
  const theme = useNaneTheme();
  const percent = Math.max(0, Math.min(100, value));

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <MobileText variant="small" tone="secondary" weight="bold">
            {label}
          </MobileText>
          <MobileText variant="small" weight="bold" style={{ color: theme.colors.kpi[tone] }}>
            {percent}%
          </MobileText>
        </View>
      ) : null}
      <View style={[styles.track, { backgroundColor: theme.colors.disabled }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.colors.kpi[tone] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  track: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
