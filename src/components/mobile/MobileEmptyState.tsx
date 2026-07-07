import { Inbox } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileButton } from './MobileButton';
import { MobileText } from './MobileText';

type MobileEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: LucideIcon;
  tone?: StatusTone;
  compact?: boolean;
};

export function MobileEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: Icon = Inbox,
  tone = 'primary',
  compact,
}: MobileEmptyStateProps) {
  const theme = useNaneTheme();
  const color = theme.colors.status[tone];

  return (
    <View
      style={[
        styles.empty,
        compact ? styles.compact : null,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: color }]}>
        <Icon color={theme.colors.onPrimary} size={22} strokeWidth={2.5} />
      </View>
      <MobileText variant="section" weight="bold" style={styles.center}>
        {title}
      </MobileText>
      <MobileText variant="small" tone="secondary" style={styles.center}>
        {description}
      </MobileText>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? <MobileButton label={actionLabel} onPress={onAction} fullWidth={!compact} style={compact ? styles.inlineAction : null} /> : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <MobileButton
              label={secondaryActionLabel}
              variant="secondary"
              onPress={onSecondaryAction}
              fullWidth={!compact && !(actionLabel && onAction)}
              style={compact ? styles.inlineAction : null}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 190,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  compact: {
    minHeight: 142,
    padding: 16,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    alignItems: 'center',
  },
  inlineAction: {
    alignSelf: 'center',
  },
});
