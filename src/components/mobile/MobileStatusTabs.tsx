import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

export type MobileStatusTab = {
  value: string;
  label: string;
  count?: number;
};

type MobileStatusTabsProps = {
  tabs: MobileStatusTab[];
  value: string;
  onChange: (value: string) => void;
};

export function MobileStatusTabs({ tabs, value, onChange }: MobileStatusTabsProps) {
  const theme = useNaneTheme();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, activeIndex * 118 - 18), animated: true });
  }, [activeIndex]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <MobileText variant="small" weight="bold" style={{ color: active ? theme.colors.onPrimary : theme.colors.textSecondary }}>
              {tab.label}
            </MobileText>
            {typeof tab.count === 'number' ? (
              <View style={[styles.count, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : theme.colors.surfaceMuted }]}>
                <MobileText variant="tiny" weight="bold" style={{ color: active ? theme.colors.onPrimary : theme.colors.textSecondary }}>
                  {tab.count}
                </MobileText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 18,
  },
  tab: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
