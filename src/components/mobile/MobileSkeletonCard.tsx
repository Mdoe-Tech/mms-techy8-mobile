import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSkeleton } from './MobileSkeleton';

type MobileSkeletonCardProps = {
  lines?: number;
  showIcon?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MobileSkeletonCard({ lines = 3, showIcon = true, compact, style }: MobileSkeletonCardProps) {
  const theme = useNaneTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          padding: compact ? theme.spacing[4] : theme.spacing[5],
        },
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.textBlock}>
          <MobileSkeleton width="48%" height={14} radius={999} />
          <MobileSkeleton width="72%" height={24} radius={999} />
        </View>
        {showIcon ? <MobileSkeleton width={42} height={42} radius={14} /> : null}
      </View>
      <View style={styles.lines}>
        {Array.from({ length: lines }).map((_, index) => (
          <MobileSkeleton key={index} width={index === lines - 1 ? '58%' : '100%'} height={13} radius={999} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    gap: 16,
    shadowOpacity: 0.018,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 9,
  },
  lines: {
    gap: 9,
  },
});
