import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileSpinnerProps = {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  branded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MobileSpinner({ message, size = 'md', branded = true, style }: MobileSpinnerProps) {
  const theme = useNaneTheme();
  const dimension = size === 'lg' ? 76 : size === 'sm' ? 42 : 58;
  const markSize = size === 'lg' ? 36 : size === 'sm' ? 22 : 29;
  const haloColor = theme.scheme === 'dark' ? 'rgba(96, 165, 250, 0.22)' : 'rgba(37, 99, 235, 0.16)';

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.spinner,
          {
            width: dimension,
            height: dimension,
            borderRadius: Math.round(dimension / 2),
            borderColor: haloColor,
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} size={size === 'sm' ? 'small' : 'large'} />
        {branded ? (
          <View
            style={[
              styles.mark,
              {
                width: markSize,
                height: markSize,
                borderRadius: Math.round(markSize / 2),
                backgroundColor: theme.colors.primary,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Svg width={markSize} height={markSize} viewBox="0 0 36 36">
              <Circle cx="18" cy="18" r="18" fill={theme.colors.primary} />
              <Circle cx="18" cy="12.6" r="7.9" fill="#A3E635" />
              <Circle cx="18" cy="23.4" r="7.9" fill="#A3E635" />
              <Circle cx="18" cy="12.6" r="3.5" fill={theme.colors.primary} />
              <Circle cx="18" cy="23.4" r="3.5" fill={theme.colors.primary} />
            </Svg>
          </View>
        ) : null}
      </View>
      {message ? (
        <MobileText variant="small" weight="bold" tone="secondary" style={styles.message}>
          {message}
        </MobileText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  spinner: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
  },
  mark: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
});
