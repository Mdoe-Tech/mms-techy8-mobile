import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { initialsFromName } from '@/utils/format';
import { MobileText } from './MobileText';

type MobileAvatarProps = {
  name: string;
  imageUri?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: StatusTone;
};

export function MobileAvatar({ name, imageUri, size = 'md', tone = 'primary' }: MobileAvatarProps) {
  const theme = useNaneTheme();
  const dimension = size === 'lg' ? 64 : size === 'sm' ? 38 : 48;
  const radius = size === 'lg' ? 22 : size === 'sm' ? 13 : 16;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: dimension,
          height: dimension,
          borderRadius: radius,
          backgroundColor: theme.colors.status[tone],
        },
      ]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <MobileText variant={size === 'lg' ? 'section' : 'small'} weight="bold" tone="inverse">
          {initialsFromName(name)}
        </MobileText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
