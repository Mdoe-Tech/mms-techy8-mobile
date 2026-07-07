import { CircleAlert, RefreshCw } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import type { MobileErrorDetailsInfo } from '@/utils/mobile-error';
import { MobileButton } from './MobileButton';
import { MobileCard } from './MobileCard';
import { MobileErrorDetails } from './MobileErrorDetails';
import { MobileText } from './MobileText';

type MobileErrorPanelProps = {
  title: string;
  description: string;
  tone?: StatusTone;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  details?: MobileErrorDetailsInfo;
  style?: StyleProp<ViewStyle>;
};

export function MobileErrorPanel({
  title,
  description,
  tone = 'danger',
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  details,
  style,
}: MobileErrorPanelProps) {
  const theme = useNaneTheme();
  const color = theme.colors.status[tone];

  return (
    <MobileCard compact style={[styles.panel, { borderColor: color }, style]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <CircleAlert color={theme.colors.onPrimary} size={22} strokeWidth={2.6} />
        </View>
        <View style={styles.titleBlock}>
          <MobileText variant="section" weight="bold" style={styles.messageText}>
            {title}
          </MobileText>
          <MobileText variant="small" tone="secondary" style={styles.messageText}>
            {description}
          </MobileText>
        </View>
      </View>
      {details ? <MobileErrorDetails details={details} /> : null}
      {(primaryLabel && onPrimary) || (secondaryLabel && onSecondary) ? (
        <View style={styles.actions}>
          {primaryLabel && onPrimary ? <MobileButton label={primaryLabel} icon={RefreshCw} onPress={onPrimary} /> : null}
          {secondaryLabel && onSecondary ? <MobileButton label={secondaryLabel} variant="secondary" onPress={onSecondary} /> : null}
        </View>
      ) : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
    borderWidth: 1.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  messageText: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
