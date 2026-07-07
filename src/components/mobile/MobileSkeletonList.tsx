import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSkeleton } from './MobileSkeleton';

type MobileSkeletonListProps = {
  rows?: number;
  showAmount?: boolean;
};

export function MobileSkeletonList({ rows = 4, showAmount = true }: MobileSkeletonListProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.row,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <MobileSkeleton width={42} height={42} radius={14} />
          <View style={styles.main}>
            <View style={styles.titleRow}>
              <MobileSkeleton width="52%" height={16} radius={999} />
              <MobileSkeleton width={72} height={24} radius={999} />
            </View>
            <MobileSkeleton width="78%" height={13} radius={999} />
            <View style={styles.metaRow}>
              <MobileSkeleton width="44%" height={13} radius={999} />
              {showAmount ? <MobileSkeleton width={86} height={15} radius={999} /> : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.015,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
