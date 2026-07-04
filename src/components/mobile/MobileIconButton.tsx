import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useNaneTheme } from '@/theme/tokens';

type MobileIconButtonProps = PressableProps & {
  icon: LucideIcon;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function MobileIconButton({ icon: Icon, label, variant = 'secondary', style, disabled, ...props }: MobileIconButtonProps) {
  const theme = useNaneTheme();
  const backgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.status.danger
        : variant === 'secondary'
          ? theme.colors.surface
          : 'transparent';
  const color = variant === 'primary' || variant === 'danger' ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'ghost' ? 'transparent' : theme.colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style as object,
      ]}
      {...props}
    >
      <Icon color={color} size={19} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

