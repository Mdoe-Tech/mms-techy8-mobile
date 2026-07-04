import { StyleSheet, View } from 'react-native';

import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { MobileCard } from './MobileCard';
import { MobileText } from './MobileText';

type MobileChartCardProps = {
  title: string;
  description?: string;
  values: number[];
  tone?: KpiTone;
};

export function MobileChartCard({ title, description, values, tone = 'blue' }: MobileChartCardProps) {
  const theme = useNaneTheme();
  const max = Math.max(...values, 1);
  const color = theme.colors.kpi[tone];

  return (
    <MobileCard>
      <MobileText variant="section" weight="bold">
        {title}
      </MobileText>
      {description ? (
        <MobileText variant="small" tone="secondary" style={styles.description}>
          {description}
        </MobileText>
      ) : null}
      <View style={styles.chart}>
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={styles.barWrap}>
            <View
              style={[
                styles.bar,
                {
                  height: `${Math.max(12, (value / max) * 100)}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  description: {
    marginTop: 3,
  },
  chart: {
    height: 96,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 999,
  },
});

