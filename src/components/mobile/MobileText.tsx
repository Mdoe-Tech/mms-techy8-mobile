import { Text, type TextProps } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';

type MobileTextVariant = 'title' | 'section' | 'body' | 'small' | 'tiny' | 'value';

type MobileTextProps = TextProps & {
  variant?: MobileTextVariant;
  tone?: 'primary' | 'secondary' | 'muted' | 'inverse';
  weight?: 'medium' | 'semibold' | 'bold';
};

export function MobileText({
  style,
  variant = 'body',
  tone = 'primary',
  weight = 'medium',
  ...props
}: MobileTextProps) {
  const theme = useNaneTheme();
  const color =
    tone === 'inverse'
      ? theme.colors.onPrimary
      : tone === 'secondary'
        ? theme.colors.textSecondary
        : tone === 'muted'
          ? theme.colors.textMuted
          : theme.colors.text;
  const fontFamily =
    weight === 'bold'
      ? theme.typography.familyBold
      : weight === 'semibold'
        ? theme.typography.familySemiBold
        : theme.typography.familyRegular;
  const fontSize =
    variant === 'title'
      ? theme.typography.title
      : variant === 'section'
        ? theme.typography.section
        : variant === 'small'
          ? theme.typography.small
          : variant === 'tiny'
            ? theme.typography.tiny
            : variant === 'value'
              ? theme.typography.value
              : theme.typography.body;
  const lineHeight =
    variant === 'title'
      ? 31
      : variant === 'section'
        ? 24
        : variant === 'small'
          ? 18
          : variant === 'tiny'
            ? 16
            : variant === 'value'
              ? 34
              : 22;

  return <Text style={[{ color, fontFamily, fontSize, lineHeight }, style]} {...props} />;
}
