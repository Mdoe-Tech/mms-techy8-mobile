import { StyleSheet, View } from 'react-native';

import { MobileScreen } from './MobileScreen';
import { MobileDetailSkeleton } from './MobileDetailSkeleton';
import { MobileFormSkeleton } from './MobileFormSkeleton';
import { MobileSkeleton } from './MobileSkeleton';
import { MobileSkeletonCard } from './MobileSkeletonCard';
import { MobileSkeletonKpiGrid } from './MobileSkeletonKpiGrid';
import { MobileSkeletonList } from './MobileSkeletonList';
import { MobileSpinner } from './MobileSpinner';

type MobilePageLoadingStateProps = {
  message?: string;
  kind?: 'dashboard' | 'list' | 'detail' | 'form';
  fullScreen?: boolean;
};

export function MobilePageLoadingState({
  message = 'Preparing your workspace',
  kind = 'dashboard',
  fullScreen = true,
}: MobilePageLoadingStateProps) {
  const content = (
    <View style={fullScreen ? styles.screenContent : styles.inlineContent}>
      <View style={styles.header}>
        <MobileSkeleton width={52} height={52} radius={18} />
        <View style={styles.headerText}>
          <MobileSkeleton width="52%" height={13} radius={999} />
          <MobileSkeleton width="78%" height={25} radius={999} />
          <MobileSkeleton width="62%" height={14} radius={999} />
        </View>
      </View>

      <MobileSpinner message={message} size="lg" style={styles.spinner} />

      {kind === 'dashboard' ? (
        <>
          <MobileSkeletonCard lines={2} />
          <MobileSkeletonList rows={2} />
          <MobileSkeletonKpiGrid count={4} />
        </>
      ) : null}

      {kind === 'list' ? (
        <>
          <MobileSkeleton width="100%" height={46} radius={16} />
          <MobileSkeletonKpiGrid count={2} />
          <MobileSkeletonList rows={5} />
        </>
      ) : null}

      {kind === 'detail' ? <MobileDetailSkeleton /> : null}

      {kind === 'form' ? <MobileFormSkeleton /> : null}
    </View>
  );

  return fullScreen ? <MobileScreen>{content}</MobileScreen> : content;
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    gap: 16,
  },
  inlineContent: {
    gap: 16,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  spinner: {
    marginVertical: 4,
  },
});
