import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { initialsFromName } from '@/utils/format';
import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileStatusBadge } from './MobileStatusBadge';
import { MobileText } from './MobileText';

export type MobileDataListItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  amount?: string;
  status?: string;
  statusTone?: StatusTone;
  initials?: string;
  accent?: StatusTone;
};

type MobileDataListProps = {
  items: MobileDataListItem[];
  onPressItem?: (item: MobileDataListItem) => void;
  showChevron?: boolean;
};

export function MobileDataList({ items, onPressItem, showChevron = Boolean(onPressItem) }: MobileDataListProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const accentColor = theme.colors.status[item.accent || 'primary'];
        return (
          <Pressable
            key={item.id}
            onPress={() => onPressItem?.(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: accentColor }]}>
              <MobileText variant="small" weight="bold" tone="inverse">
                {item.initials || initialsFromName(item.title)}
              </MobileText>
            </View>
            <View style={styles.main}>
              <View style={styles.titleRow}>
                <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.title}>
                  {item.title}
                </MobileText>
                {item.status ? <MobileStatusBadge status={item.status} tone={item.statusTone} /> : null}
              </View>
              {item.subtitle ? (
                <MobileText variant="small" tone="secondary" numberOfLines={1}>
                  {item.subtitle}
                </MobileText>
              ) : null}
              <View style={styles.metaRow}>
                {item.meta ? (
                  <MobileText variant="small" tone="secondary" numberOfLines={1} style={styles.meta}>
                    {item.meta}
                  </MobileText>
                ) : null}
                {item.amount ? (
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {item.amount}
                  </MobileText>
                ) : null}
              </View>
            </View>
            {showChevron ? <ChevronRight color={theme.colors.textMuted} size={18} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.04,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  meta: {
    flex: 1,
  },
});
