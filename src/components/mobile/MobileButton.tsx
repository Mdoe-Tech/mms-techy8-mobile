import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type MobileButtonProps = PressableProps & {
  label: string;
  variant?: MobileButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
};

export function MobileButton({
  label,
  variant = 'primary',
  icon: Icon,
  loading,
  fullWidth,
  size = 'md',
  disabled,
  style,
  ...props
}: MobileButtonProps) {
  const theme = useNaneTheme();
  const isDisabled = disabled || loading;
  const visuallyDisabled = Boolean(disabled && !loading);
  const height = size === 'sm' ? 38 : 46;
  const activeBackgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.status.danger
        : variant === 'secondary'
          ? theme.colors.surface
          : 'transparent';
  const backgroundColor = visuallyDisabled ? theme.colors.disabled : activeBackgroundColor;
  const foreground = visuallyDisabled
    ? theme.colors.textMuted
    :
    variant === 'primary' || variant === 'danger'
      ? theme.colors.onPrimary
      : variant === 'secondary'
        ? theme.colors.text
        : theme.colors.primary;
  const borderColor =
    visuallyDisabled
      ? theme.colors.border
      :
    variant === 'secondary'
      ? theme.colors.borderStrong
      : variant === 'ghost'
        ? 'transparent'
        : backgroundColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor,
          borderColor,
          opacity: loading ? 0.82 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        fullWidth ? styles.fullWidth : null,
        style as object,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon color={foreground} size={17} strokeWidth={2.5} /> : null}
          <MobileText numberOfLines={1} variant="small" weight="bold" style={[styles.label, { color: foreground }]}>
            {label}
          </MobileText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
  },
});
