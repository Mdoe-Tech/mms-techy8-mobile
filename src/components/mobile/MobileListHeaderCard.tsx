import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MobileCard } from './MobileCard';
import { MobileText } from './MobileText';

type MobileListHeaderCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
};

export function MobileListHeaderCard({ title, subtitle, meta, actions }: MobileListHeaderCardProps) {
  return (
    <MobileCard compact>
      <View style={styles.wrap}>
        <View style={styles.textBlock}>
          <MobileText variant="section" weight="bold">
            {title}
          </MobileText>
          {subtitle ? (
            <MobileText variant="small" tone="secondary">
              {subtitle}
            </MobileText>
          ) : null}
          {meta ? (
            <MobileText variant="tiny" tone="muted">
              {meta}
            </MobileText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  textBlock: {
    gap: 3,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
