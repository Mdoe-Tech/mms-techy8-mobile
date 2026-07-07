import { StyleSheet, View } from 'react-native';

import { MobileSkeletonCard } from './MobileSkeletonCard';

type MobileSkeletonKpiGridProps = {
  count?: number;
};

export function MobileSkeletonKpiGrid({ count = 4 }: MobileSkeletonKpiGridProps) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.item}>
          <MobileSkeletonCard compact lines={2} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  item: {
    flexGrow: 1,
    flexBasis: '47%',
    alignSelf: 'stretch',
  },
});
