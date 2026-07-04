import { Image } from 'expo-image';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useNaneTheme } from '@/theme/tokens';
import { MobileIconButton } from './MobileIconButton';
import { MobileText } from './MobileText';

type MobilePageHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  showLogo?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
};

export function MobilePageHeader({
  title,
  eyebrow,
  subtitle,
  showLogo,
  onBack,
  rightAction,
}: MobilePageHeaderProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? <MobileIconButton icon={ArrowLeft} label="Back" variant="ghost" onPress={onBack} /> : null}
        {showLogo ? (
          <View style={[styles.logoWrap, { borderColor: theme.colors.border }]}>
            <Image source={require('@/assets/images/nane-logo.png')} style={styles.logo} />
          </View>
        ) : null}
        <View style={styles.titleBlock}>
          {eyebrow ? (
            <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.eyebrow}>
              {eyebrow}
            </MobileText>
          ) : null}
          <MobileText variant="section" weight="bold" numberOfLines={2} style={styles.title}>
            {title}
          </MobileText>
          {subtitle ? (
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </MobileText>
          ) : null}
        </View>
      </View>
      {rightAction || <MobileIconButton icon={Bell} label="Notifications" />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 38,
    height: 38,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    lineHeight: 24,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
