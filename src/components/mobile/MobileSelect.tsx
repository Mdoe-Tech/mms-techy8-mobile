import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';

type MobileSelectOption = {
  label: string;
  value: string;
};

type MobileSelectProps = {
  label: string;
  value: string;
  options: MobileSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  error?: string;
};

export function MobileSelect({ label, value, options, onChange, placeholder = 'Select option', disabled, helperText, error }: MobileSelectProps) {
  const [open, setOpen] = useState(false);
  const theme = useNaneTheme();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrap}>
      <MobileText variant="small" weight="bold">
        {label}
      </MobileText>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: error ? theme.colors.status.danger : theme.colors.border,
            backgroundColor: disabled ? theme.colors.disabled : theme.colors.input,
            opacity: disabled ? 0.62 : pressed ? 0.82 : 1,
          },
        ]}
      >
        <MobileText variant="body" weight="semibold" tone={selected ? 'primary' : 'muted'} style={styles.triggerText} numberOfLines={1}>
          {selected?.label || placeholder}
        </MobileText>
        <ChevronDown color={theme.colors.textMuted} size={18} />
      </Pressable>
      {error || helperText ? (
        <MobileText variant="tiny" style={{ color: error ? theme.colors.status.danger : theme.colors.textMuted }}>
          {error || helperText}
        </MobileText>
      ) : null}
      <MobileSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={styles.options}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active ? theme.colors.surfaceStrong : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <MobileText variant="body" weight="bold" style={{ color: active ? theme.colors.primary : theme.colors.text }}>
                  {option.label}
                </MobileText>
              </Pressable>
            );
          })}
        </View>
      </MobileSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  trigger: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  triggerText: {
    flex: 1,
  },
  options: {
    gap: 10,
  },
  option: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
