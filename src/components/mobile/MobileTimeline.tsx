import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileText } from './MobileText';

export type MobileTimelineItem = {
  id: string;
  title: string;
  description?: string;
  time?: string;
  tone?: StatusTone;
  icon?: LucideIcon;
};

type MobileTimelineProps = {
  items: MobileTimelineItem[];
};

export function MobileTimeline({ items }: MobileTimelineProps) {
  const theme = useNaneTheme();

  return (
    <View style={styles.timeline}>
      {items.map((item, index) => {
        const color = theme.colors.status[item.tone || 'primary'];
        const Icon = item.icon;

        return (
          <View key={item.id} style={styles.item}>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: color }]}>
                {Icon ? <Icon color={theme.colors.onPrimary} size={13} strokeWidth={2.5} /> : null}
              </View>
              {index < items.length - 1 ? <View style={[styles.line, { backgroundColor: theme.colors.border }]} /> : null}
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <MobileText variant="body" weight="bold" style={styles.title}>
                  {item.title}
                </MobileText>
                {item.time ? (
                  <MobileText variant="small" tone="secondary" weight="bold">
                    {item.time}
                  </MobileText>
                ) : null}
              </View>
              {item.description ? (
                <MobileText variant="small" tone="secondary">
                  {item.description}
                </MobileText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const MobileActivityFeed = MobileTimeline;

const styles = StyleSheet.create({
  timeline: {
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
  },
  rail: {
    width: 26,
    alignItems: 'center',
  },
  node: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
  },
});
