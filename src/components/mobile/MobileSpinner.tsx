import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  const logoSize = size === 'lg' ? 36 : size === 'sm' ? 22 : 29;

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.spinner,
          {
            width: dimension,
            height: dimension,
            borderRadius: Math.round(dimension / 2.5),
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} size={size === 'sm' ? 'small' : 'large'} />
        {branded ? (
          <Image
            source={require('@/assets/images/nane-logo.png')}
            style={[
              styles.logo,
              { width: logoSize, height: logoSize, borderRadius: Math.round(logoSize / 2) },
            ]}
          />
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
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  message: {
    textAlign: 'center',
  },
  logo: {
    position: 'absolute',
  },
});
