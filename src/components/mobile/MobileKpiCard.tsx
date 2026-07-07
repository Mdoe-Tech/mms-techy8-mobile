import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { getReadableTextColor, type KpiTone, useNaneTheme } from '@/theme/tokens';
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
  featured = true,
}: MobileKpiCardProps) {
  const theme = useNaneTheme();
  const color = theme.colors.kpi[tone];
  const featuredTextColor = getReadableTextColor(color);
  const featuredOverlayColor = featuredTextColor === theme.colors.onPrimary ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)';
  const featuredBorderColor = featuredTextColor === theme.colors.onPrimary ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)';
  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;

  if (featured) {
    return (
      <View style={[styles.featured, { backgroundColor: color, shadowColor: theme.colors.shadow }]}>
        <View style={styles.featuredHeader}>
          <MobileText
            variant="small"
            weight="semibold"
            numberOfLines={2}
            style={[styles.featuredTitle, styles.featuredText, styles.featuredMuted, { color: featuredTextColor }]}
          >
            {title}
          </MobileText>
          {Icon ? (
            <View style={[styles.featuredIcon, { backgroundColor: featuredOverlayColor, borderColor: featuredBorderColor }]}>
              <Icon color={featuredTextColor} size={17} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>
        <MobileText variant="section" weight="bold" style={[styles.featuredValue, styles.featuredText, { color: featuredTextColor }]} adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1}>
          {value}
        </MobileText>
        <View style={styles.featuredFooter}>
          {description ? (
            <MobileText variant="small" style={[styles.featuredText, styles.featuredMuted, { color: featuredTextColor }]}>
              {description}
            </MobileText>
          ) : null}
          {trend ? (
            <View style={[styles.featuredTrend, { backgroundColor: featuredOverlayColor }]}>
              {trend.direction && trend.direction !== 'neutral' ? <TrendIcon color={featuredTextColor} size={14} /> : null}
              <MobileText
                variant="tiny"
                weight="bold"
                numberOfLines={1}
                style={[styles.featuredText, styles.pillText, { color: featuredTextColor }]}
              >
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
            <MobileText variant="tiny" weight="bold" numberOfLines={1} style={[styles.pillText, { color }]}>
              {trend.value}
            </MobileText>
          </View>
        ) : null}
      </View>
      <MobileText variant="section" weight="bold" style={{ color }} adjustsFontSizeToFit={value.length > 8} minimumFontScale={0.75} numberOfLines={1}>
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
    borderRadius: 20,
    padding: 15,
    minHeight: 124,
    flex: 1,
    justifyContent: 'space-between',
    shadowOpacity: 0.055,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  featuredTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  featuredIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    flexShrink: 0,
  },
  featuredValue: {
    marginTop: 10,
  },
  featuredFooter: {
    marginTop: 8,
    gap: 6,
  },
  featuredTrend: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  featuredText: {
    includeFontPadding: false,
  },
  featuredMuted: {
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
    maxWidth: '62%',
    minWidth: 0,
    flexShrink: 1,
  },
  pillText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
