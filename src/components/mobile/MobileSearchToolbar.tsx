import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

type MobileSearchToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  filterLabel?: string;
};

export function MobileSearchToolbar({
  value,
  onChange,
  placeholder = 'Search records...',
  onFilterPress,
  filterLabel = 'Filter',
}: MobileSearchToolbarProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Search color={theme.colors.textMuted} size={18} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familySemiBold,
              fontSize: theme.typography.body,
            },
          ]}
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={8} style={styles.clearButton}>
            <X color={theme.colors.textMuted} size={16} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>
      {onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [
            styles.filter,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <SlidersHorizontal color={theme.colors.primary} size={17} />
          <MobileText numberOfLines={1} variant="small" weight="bold" style={[styles.filterLabel, { color: theme.colors.primary }]}>
            {filterLabel}
          </MobileText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minWidth: 0,
  },
  search: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filter: {
    flexShrink: 0,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterLabel: {
    flexShrink: 1,
  },
});
