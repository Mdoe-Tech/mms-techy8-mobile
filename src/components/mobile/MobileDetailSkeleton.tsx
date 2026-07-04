import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSkeleton } from './MobileSkeleton';
import { MobileSkeletonCard } from './MobileSkeletonCard';

export function MobileDetailSkeleton() {
  const theme = useNaneTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <MobileSkeleton width={64} height={64} radius={22} />
        <View style={styles.headerText}>
          <MobileSkeleton width="42%" height={13} radius={999} />
          <MobileSkeleton width="82%" height={30} radius={999} />
          <MobileSkeleton width="60%" height={15} radius={999} />
        </View>
        <MobileSkeleton width={42} height={42} radius={14} />
      </View>

      <MobileSkeletonCard lines={3} />

      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <MobileSkeleton width="52%" height={22} radius={999} />
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={[styles.infoRow, { borderColor: theme.colors.border }]}>
            <MobileSkeleton width={36} height={36} radius={12} />
            <View style={styles.infoText}>
              <MobileSkeleton width="34%" height={12} radius={999} />
              <MobileSkeleton width={index === 2 ? '76%' : '58%'} height={17} radius={999} />
            </View>
            {index === 2 ? <MobileSkeleton width={70} height={24} radius={999} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  header: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 13,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  infoRow: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
});
