import { StyleSheet, View, type ViewProps } from 'react-native';

import { type KpiTone, useNaneTheme } from '@/theme/tokens';

type MobileCardProps = ViewProps & {
  padded?: boolean;
  accent?: KpiTone;
  compact?: boolean;
};

export function MobileCard({ style, padded = true, accent, compact = false, ...props }: MobileCardProps) {
  const theme = useNaneTheme();
  const accentColor = accent ? theme.colors.kpi[accent] : theme.colors.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: accent ? accentColor : theme.colors.border,
          shadowColor: theme.colors.shadow,
          padding: padded ? (compact ? theme.spacing[4] : theme.spacing[5]) : 0,
        },
        accent ? { borderWidth: 1.5 } : null,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
});
