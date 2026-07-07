import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

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
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  autoFocus?: TextInputProps['autoFocus'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  blurOnSubmit?: TextInputProps['blurOnSubmit'];
  submitBehavior?: TextInputProps['submitBehavior'];
  rightAction?: ReactNode;
  required?: boolean;
  onBlur?: TextInputProps['onBlur'];
  onFocus?: TextInputProps['onFocus'];
};

export const MobileTextInput = forwardRef<TextInput, MobileTextInputProps>(function MobileTextInput(
  {
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
    disabled,
    multiline,
    numberOfLines,
    maxLength,
    autoFocus,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
    submitBehavior,
    rightAction,
    required,
    onBlur,
    onFocus,
  },
  ref,
) {
  const theme = useNaneTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.colors.status.danger : focused ? theme.colors.primary : theme.colors.border;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <MobileText variant="small" weight="bold">
          {label}
        </MobileText>
        {required ? (
          <MobileText variant="tiny" weight="bold" style={{ color: theme.colors.status.danger }}>
            Required
          </MobileText>
        ) : null}
      </View>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor,
            backgroundColor: disabled ? theme.colors.disabled : theme.colors.input,
            opacity: disabled ? 0.72 : 1,
            alignItems: multiline ? 'flex-start' : 'center',
            minHeight: multiline ? Math.max(92, 28 * (numberOfLines || 3)) : 46,
            paddingVertical: multiline ? 10 : 0,
          },
        ]}
      >
        {Icon ? <Icon color={theme.colors.textMuted} size={18} style={multiline ? styles.multilineIcon : null} /> : null}
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
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          blurOnSubmit={blurOnSubmit}
          submitBehavior={submitBehavior}
          textAlignVertical={multiline ? 'top' : 'center'}
          ref={ref}
          style={[
            styles.input,
            multiline ? styles.multilineInput : null,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familySemiBold,
              fontSize: theme.typography.body,
            },
          ]}
        />
        {rightAction}
      </View>
      {error || helperText ? (
        <MobileText variant="small" tone={error ? 'primary' : 'secondary'} style={error ? { color: theme.colors.status.danger } : null}>
          {error || helperText}
        </MobileText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  labelRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  multilineInput: {
    minHeight: 70,
  },
  multilineIcon: {
    marginTop: 2,
  },
});
