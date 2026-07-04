import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { MobileCard } from './MobileCard';
import { MobileText } from './MobileText';

type MobileKpiCardProps = {
  title: string;
  value: string;
  description?: string;
  tone?: KpiTone;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction?: 'up' | 'down' | 'neutral';
    label?: string;
  };
  featured?: boolean;
};

export function MobileKpiCard({
  title,
  value,
  description,
  tone = 'blue',
  icon: Icon,
  trend,
  featured,
}: MobileKpiCardProps) {
  const theme = useNaneTheme();
  const color = theme.colors.kpi[tone];
  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;

  if (featured) {
    return (
      <View style={[styles.featured, { backgroundColor: theme.colors.primaryDark, shadowColor: theme.colors.shadow }]}>
        <View style={styles.featuredHeader}>
          <MobileText variant="small" weight="semibold" tone="inverse" style={styles.inverseMuted}>
            {title}
          </MobileText>
          {Icon ? (
            <View style={styles.featuredIcon}>
              <Icon color={theme.colors.onPrimary} size={20} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>
        <MobileText variant="value" weight="bold" tone="inverse" style={styles.featuredValue} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </MobileText>
        <View style={styles.featuredFooter}>
          {description ? (
            <MobileText variant="small" tone="inverse" style={styles.inverseMuted}>
              {description}
            </MobileText>
          ) : null}
          {trend ? (
            <View style={styles.featuredTrend}>
              {trend.direction && trend.direction !== 'neutral' ? <TrendIcon color={theme.colors.onPrimary} size={14} /> : null}
              <MobileText variant="tiny" weight="bold" tone="inverse">
                {trend.value} {trend.label || ''}
              </MobileText>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <MobileCard accent={tone} compact style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          {Icon ? <Icon color={theme.colors.onPrimary} size={17} strokeWidth={2.4} /> : null}
        </View>
        {trend ? (
          <View style={[styles.trend, { borderColor: theme.colors.border }]}>
            {trend.direction && trend.direction !== 'neutral' ? <TrendIcon color={color} size={13} /> : null}
            <MobileText variant="tiny" weight="bold" style={{ color }}>
              {trend.value}
            </MobileText>
          </View>
        ) : null}
      </View>
      <MobileText variant="section" weight="bold" style={{ color }} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </MobileText>
      <MobileText variant="small" weight="bold" numberOfLines={1}>
        {title}
      </MobileText>
      {description ? (
        <MobileText variant="small" tone="secondary" numberOfLines={2}>
          {description}
        </MobileText>
      ) : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  featured: {
    borderRadius: 24,
    padding: 20,
    minHeight: 162,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  featuredIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  featuredValue: {
    marginTop: 18,
  },
  featuredFooter: {
    marginTop: 12,
    gap: 10,
  },
  featuredTrend: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  inverseMuted: {
    opacity: 0.82,
  },
  card: {
    minHeight: 142,
    gap: 7,
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trend: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
});
