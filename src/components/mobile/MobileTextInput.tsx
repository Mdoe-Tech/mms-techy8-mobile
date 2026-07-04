import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileTextInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad' | 'decimal-pad';
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
};

export function MobileTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  error,
  icon: Icon,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete,
  secureTextEntry,
  textContentType,
}: MobileTextInputProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.wrap}>
      <MobileText variant="small" weight="bold">
        {label}
      </MobileText>
      <View style={[styles.inputWrap, { borderColor: error ? theme.colors.status.danger : theme.colors.border, backgroundColor: theme.colors.input }]}>
        {Icon ? <Icon color={theme.colors.textMuted} size={18} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry}
          textContentType={textContentType}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familySemiBold,
              fontSize: theme.typography.body,
            },
          ]}
        />
      </View>
      {error || helperText ? (
        <MobileText variant="small" tone={error ? 'primary' : 'secondary'} style={error ? { color: theme.colors.status.danger } : null}>
          {error || helperText}
        </MobileText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  inputWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
});
