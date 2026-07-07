import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileScreen } from './MobileScreen';
import { MobileSkeleton } from './MobileSkeleton';
import { MobileText } from './MobileText';

type MobileLaunchScreenProps = {
  message?: string;
};

export function MobileLaunchScreen({ message = 'Opening Nane' }: MobileLaunchScreenProps) {
  const theme = useNaneTheme();
  const [rotate] = useState(() => new Animated.Value(0));
  const [detail, setDetail] = useState('Preparing your workspace');

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 980,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [rotate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDetail('Checking your account');
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <MobileScreen scroll={false} style={styles.screen}>
      <View style={styles.skeletonLayer} pointerEvents="none">
        <View style={styles.headerSkeleton}>
          <MobileSkeleton width={52} height={52} radius={18} />
          <View style={styles.headerTextSkeleton}>
            <MobileSkeleton width="48%" height={13} radius={999} />
            <MobileSkeleton width="74%" height={24} radius={999} />
            <MobileSkeleton width="58%" height={14} radius={999} />
          </View>
        </View>

        <View style={styles.kpiSkeletonGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={[styles.kpiSkeletonCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MobileSkeleton width={36} height={36} radius={13} />
              <MobileSkeleton width="68%" height={24} radius={999} />
              <MobileSkeleton width="78%" height={12} radius={999} />
            </View>
          ))}
        </View>

        <View style={[styles.toolbarSkeleton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <MobileSkeleton width="52%" height={16} radius={999} />
          <MobileSkeleton width={82} height={28} radius={999} />
        </View>

        <View style={styles.listSkeleton}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={[styles.listSkeletonRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MobileSkeleton width={38} height={38} radius={13} />
              <View style={styles.listSkeletonCopy}>
                <MobileSkeleton width="66%" height={15} radius={999} />
                <MobileSkeleton width="84%" height={12} radius={999} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.brandPanel, { backgroundColor: theme.colors.background }]}>
        <View style={styles.logoStage}>
          <Animated.View
            style={[
              styles.spinnerRing,
              {
                borderTopColor: theme.colors.primary,
                borderRightColor: theme.colors.primary,
                borderBottomColor: theme.colors.borderStrong,
                borderLeftColor: theme.colors.borderStrong,
                transform: [{ rotate: spin }],
              },
            ]}
          />
          <Image source={require('@/assets/images/nane-splash-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.copy}>
          <MobileText variant="section" weight="bold" style={styles.centerText}>
            {message}
          </MobileText>
          <MobileText variant="small" tone="secondary" style={styles.centerText}>
            {detail}
          </MobileText>
        </View>
      </View>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
    paddingTop: 12,
    paddingBottom: 24,
  },
  skeletonLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 14,
    opacity: 0.58,
  },
  headerSkeleton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTextSkeleton: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  kpiSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiSkeletonCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  toolbarSkeleton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listSkeleton: {
    gap: 10,
  },
  listSkeletonRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  listSkeletonCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  brandPanel: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    minHeight: 212,
    borderRadius: 28,
    padding: 24,
    gap: 14,
  },
  logoStage: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 3,
    zIndex: 2,
  },
  logo: {
    width: 112,
    height: 112,
  },
  copy: {
    gap: 3,
  },
  centerText: {
    textAlign: 'center',
  },
});
