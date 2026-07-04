import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useNaneTheme } from '@/theme/tokens';
import { MobileStatusBadge } from './MobileStatusBadge';
import { MobileText } from './MobileText';

type MobileInfoRowProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  status?: string;
};

export function MobileInfoRow({ label, value, helper, icon: Icon, status }: MobileInfoRowProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceStrong }]}>
          <Icon color={theme.colors.primary} size={17} strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={styles.text}>
        <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.label}>
          {label}
        </MobileText>
        <MobileText variant="body" weight="bold" numberOfLines={2}>
          {value}
        </MobileText>
        {helper ? (
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {helper}
          </MobileText>
        ) : null}
      </View>
      {status ? <MobileStatusBadge status={status} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
});
