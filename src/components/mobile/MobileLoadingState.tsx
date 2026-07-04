import { StyleSheet, View } from 'react-native';

import { MobileSkeletonCard } from './MobileSkeletonCard';
import { MobileSpinner } from './MobileSpinner';

type MobileLoadingStateProps = {
  message?: string;
  compact?: boolean;
};

export function MobileLoadingState({ message = 'Preparing Nane workspace', compact }: MobileLoadingStateProps) {
  return (
    <View style={[styles.wrap, compact ? styles.compact : null]}>
      <MobileSpinner message={message} size={compact ? 'md' : 'lg'} />
      {!compact ? <MobileSkeletonCard lines={2} showIcon={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 280,
    justifyContent: 'center',
    gap: 18,
  },
  compact: {
    minHeight: 132,
  },
});
