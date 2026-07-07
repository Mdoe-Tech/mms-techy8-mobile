import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import type { MobileErrorDetailsInfo } from '@/utils/mobile-error';
import { MobileButton } from './MobileButton';
import { MobileErrorDetails } from './MobileErrorDetails';
import { MobileText } from './MobileText';

type MobileAlertBannerProps = {
  title: string;
  description?: string;
  tone?: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  details?: MobileErrorDetailsInfo;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MobileAlertBanner({
  title,
  description,
  tone = 'info',
  actionLabel,
  onAction,
  onDismiss,
  details,
  compact,
  style,
}: MobileAlertBannerProps) {
  const theme = useNaneTheme();
  const color = theme.colors.status[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: color,
          shadowColor: theme.colors.shadow,
          padding: compact ? 12 : 14,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          {renderToneIcon(tone, theme.colors.onPrimary)}
        </View>
        <View style={styles.textBlock}>
          <MobileText variant="small" weight="bold">
            {title}
          </MobileText>
          {description ? (
            <MobileText variant="small" tone="secondary">
              {description}
            </MobileText>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss alert" onPress={onDismiss} style={styles.dismiss}>
            <X color={theme.colors.textMuted} size={17} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
      {details ? <MobileErrorDetails details={details} /> : null}
      {actionLabel && onAction ? (
        <View style={styles.actions}>
          <MobileButton label={actionLabel} size="sm" variant={tone === 'danger' ? 'danger' : 'primary'} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

function renderToneIcon(tone: StatusTone, color: string) {
  if (tone === 'success' || tone === 'paid') return <CircleCheck color={color} size={18} strokeWidth={2.5} />;
  if (tone === 'warning') return <TriangleAlert color={color} size={18} strokeWidth={2.5} />;
  if (tone === 'danger') return <CircleAlert color={color} size={18} strokeWidth={2.5} />;
  return <Info color={color} size={18} strokeWidth={2.5} />;
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1.3,
    borderRadius: 18,
    gap: 10,
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});
