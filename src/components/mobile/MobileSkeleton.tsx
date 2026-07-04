import { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useNaneTheme } from '@/theme/tokens';

type MobileSkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  circle?: boolean;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MobileSkeleton({
  width = '100%',
  height = 16,
  radius,
  circle,
  animated = true,
  style,
}: MobileSkeletonProps) {
  const theme = useNaneTheme();
  const [opacity] = useState(() => new Animated.Value(0.72));

  useEffect(() => {
    if (!animated) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 780,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.62,
          duration: 780,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [animated, opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          opacity,
          borderRadius: circle ? 999 : radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
