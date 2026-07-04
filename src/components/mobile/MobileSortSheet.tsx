import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';

export type MobileSortOption = {
  value: string;
  label: string;
  description?: string;
};

type MobileSortSheetProps = {
  visible: boolean;
  value: string;
  options: MobileSortOption[];
  onChange: (value: string) => void;
  onClose: () => void;
};

export function MobileSortSheet({ visible, value, options, onChange, onClose }: MobileSortSheetProps) {
  const theme = useNaneTheme();

  return (
    <MobileSheet visible={visible} title="Sort records" description="Choose how records should be ordered." onClose={onClose}>
      <View style={styles.options}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                onClose();
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
              <View style={styles.optionText}>
                <MobileText variant="body" weight="bold">
                  {option.label}
                </MobileText>
                {option.description ? (
                  <MobileText variant="small" tone="secondary">
                    {option.description}
                  </MobileText>
                ) : null}
              </View>
              {active ? <Check color={theme.colors.primary} size={19} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 10,
  },
  option: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});

