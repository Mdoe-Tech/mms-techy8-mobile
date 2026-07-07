import { MoreHorizontal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileAvatar } from './MobileAvatar';
import { MobileIconButton } from './MobileIconButton';
import { MobileStatusBadge } from './MobileStatusBadge';
import { MobileText } from './MobileText';

type MobileDetailHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  status?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  avatarName?: string;
  avatarTone?: StatusTone;
  onActionsPress?: () => void;
};

export function MobileDetailHeader({
  title,
  subtitle,
  eyebrow,
  status,
  statusLabel,
  statusTone,
  avatarName,
  avatarTone = 'primary',
  onActionsPress,
}: MobileDetailHeaderProps) {
  const theme = useNaneTheme();
  const statusBorder = statusTone ? theme.colors.status[statusTone] : theme.colors.border;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.surface,
          borderColor: status ? statusBorder : theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={styles.top}>
        {avatarName ? <MobileAvatar name={avatarName} tone={avatarTone} size="lg" /> : null}
        <View style={styles.titleBlock}>
          {eyebrow ? (
            <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.eyebrow}>
              {eyebrow}
            </MobileText>
          ) : null}
          <MobileText variant="title" weight="bold" numberOfLines={2}>
            {title}
          </MobileText>
          {subtitle ? (
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </MobileText>
          ) : null}
        </View>
        {onActionsPress ? <MobileIconButton icon={MoreHorizontal} label="Record actions" onPress={onActionsPress} /> : null}
      </View>
      {status ? (
        <View style={styles.statusRow}>
          <MobileStatusBadge status={status} label={statusLabel} tone={statusTone} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },
});
