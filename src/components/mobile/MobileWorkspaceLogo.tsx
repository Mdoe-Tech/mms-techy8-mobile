import { Image, type ImageSource } from 'expo-image';
import { Building2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileWorkspaceLogoProps = {
  name?: string | null;
  source?: ImageSource | null;
  appLogo?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

const naneLogo = require('@/assets/images/nane-logo.png');

export function MobileWorkspaceLogo({ name, source, appLogo, size = 'md' }: MobileWorkspaceLogoProps) {
  const theme = useNaneTheme();
  const frame = sizeStyles[size];
  const initials = initialsFor(name);
  const sourceKey = source?.uri || '';
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const showImage = Boolean(source && sourceKey && failedSourceKey !== sourceKey);
  const imageMode = showImage || appLogo;

  return (
    <View
      style={[
        styles.frame,
        frame.frame,
        {
          backgroundColor: imageMode ? theme.colors.surface : theme.colors.primary,
          borderColor: imageMode ? theme.colors.border : theme.colors.primary,
        },
      ]}
    >
      {showImage ? (
        <Image source={source} style={frame.image} contentFit="contain" transition={120} onError={() => setFailedSourceKey(sourceKey)} />
      ) : appLogo ? (
        <Image source={naneLogo} style={frame.appImage} contentFit="contain" />
      ) : initials ? (
        <MobileText variant={size === 'lg' ? 'section' : 'small'} weight="bold" style={{ color: theme.colors.onPrimary }}>
          {initials}
        </MobileText>
      ) : (
        <Building2 color={theme.colors.onPrimary} size={frame.icon} strokeWidth={2.6} />
      )}
    </View>
  );
}

function initialsFor(name?: string | null) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  return `${words[0]?.[0] || ''}${words[1]?.[0] || ''}`.toUpperCase();
}

const sizeStyles = {
  sm: {
    frame: { width: 40, height: 40, borderRadius: 14 },
    image: { width: 32, height: 32 },
    appImage: { width: 32, height: 32 },
    icon: 17,
  },
  md: {
    frame: { width: 54, height: 54, borderRadius: 18 },
    image: { width: 44, height: 44 },
    appImage: { width: 44, height: 44 },
    icon: 22,
  },
  lg: {
    frame: { width: 72, height: 72, borderRadius: 24 },
    image: { width: 60, height: 60 },
    appImage: { width: 60, height: 60 },
    icon: 28,
  },
} as const;

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
