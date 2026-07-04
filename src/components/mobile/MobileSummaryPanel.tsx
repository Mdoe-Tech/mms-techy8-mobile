import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { MobileCard } from './MobileCard';
import { MobileText } from './MobileText';

type MobileSummaryPanelProps = {
  title: string;
  value: string;
  description?: string;
  tone?: KpiTone;
  icon?: LucideIcon;
  footer?: ReactNode;
};

export function MobileSummaryPanel({
  title,
  value,
  description,
  tone = 'blue',
  icon: Icon,
  footer,
}: MobileSummaryPanelProps) {
  const theme = useNaneTheme();
  const color = theme.colors.kpi[tone];

  return (
    <MobileCard accent={tone} style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <MobileText variant="small" tone="secondary" weight="bold">
            {title}
          </MobileText>
          <MobileText variant="value" weight="bold" style={{ color }} adjustsFontSizeToFit numberOfLines={1}>
            {value}
          </MobileText>
          {description ? (
            <MobileText variant="small" tone="secondary">
              {description}
            </MobileText>
          ) : null}
        </View>
        {Icon ? (
          <View style={[styles.icon, { backgroundColor: color }]}>
            <Icon color={theme.colors.onPrimary} size={22} strokeWidth={2.4} />
          </View>
        ) : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 2,
  },
});
