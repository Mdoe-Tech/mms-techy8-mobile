import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSkeleton } from './MobileSkeleton';

type MobileFormSkeletonProps = {
  fields?: number;
};

export function MobileFormSkeleton({ fields = 4 }: MobileFormSkeletonProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.header}>
        <MobileSkeleton width="58%" height={22} radius={999} />
        <MobileSkeleton width="82%" height={13} radius={999} />
      </View>
      <View style={styles.fields}>
        {Array.from({ length: fields }).map((_, index) => (
          <View key={index} style={styles.field}>
            <MobileSkeleton width={index % 2 === 0 ? '38%' : '46%'} height={13} radius={999} />
            <MobileSkeleton width="100%" height={46} radius={15} />
            {index === 1 ? <MobileSkeleton width="72%" height={13} radius={999} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  fields: {
    gap: 14,
  },
  field: {
    gap: 7,
  },
});
