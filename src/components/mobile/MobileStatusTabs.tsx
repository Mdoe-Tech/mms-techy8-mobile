import { useEffect, useRef, useState } from 'react';
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
  const [containerWidth, setContainerWidth] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const activeLayout = tabLayouts[value];
    if (!activeLayout || !containerWidth) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const centeredX = activeLayout.x + activeLayout.width / 2 - containerWidth / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, centeredX), animated: true });
  }, [containerWidth, tabLayouts, value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setTabLayouts((current) => {
                const previous = current[tab.value];
                if (previous && previous.x === x && previous.width === width) return current;
                return {
                  ...current,
                  [tab.value]: { x, width },
                };
              });
            }}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <MobileText numberOfLines={1} variant="small" weight="bold" style={[styles.label, { color: active ? theme.colors.onPrimary : theme.colors.textSecondary }]}>
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
  scroller: {
    flexGrow: 0,
    minHeight: 36,
  },
  row: {
    gap: 8,
    paddingRight: 18,
    alignItems: 'center',
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
  label: {
    flexShrink: 1,
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
