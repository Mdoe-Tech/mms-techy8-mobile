import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileCheckboxRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
};

export function MobileCheckboxRow({ label, description, checked, onChange, error, disabled }: MobileCheckboxRowProps) {
  const theme = useNaneTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.status.danger : checked ? theme.colors.primary : theme.colors.border,
          opacity: disabled ? 0.72 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.box, { backgroundColor: checked ? theme.colors.primary : theme.colors.surface, borderColor: checked ? theme.colors.primary : theme.colors.borderStrong }]}>
        {checked ? <Check color={theme.colors.onPrimary} size={15} strokeWidth={3} /> : null}
      </View>
      <View style={styles.copy}>
        <MobileText variant="small" weight="bold">
          {label}
        </MobileText>
        {description ? (
          <MobileText variant="small" tone="secondary">
            {description}
          </MobileText>
        ) : null}
        {error ? (
          <MobileText variant="small" style={{ color: theme.colors.status.danger }}>
            {error}
          </MobileText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
