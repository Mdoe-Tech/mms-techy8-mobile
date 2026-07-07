import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNaneTheme } from '@/theme/tokens';
import type { MobileErrorDetailsInfo } from '@/utils/mobile-error';
import { MobileText } from './MobileText';

type MobileErrorDetailsProps = {
  details?: MobileErrorDetailsInfo;
};

export function MobileErrorDetails({ details }: MobileErrorDetailsProps) {
  const theme = useNaneTheme();
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () =>
      [
        ['Status', details?.status ? String(details.status) : undefined],
        ['Code', details?.code],
        ['Path', details?.path],
        ['Trace ID', details?.traceId],
      ].filter((row): row is [string, string] => Boolean(row[1])),
    [details],
  );

  if (!rows.length) return null;

  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.root, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.trigger}>
        <MobileText variant="tiny" weight="bold" tone="secondary">
          Details for support
        </MobileText>
        <Icon size={15} color={theme.colors.textSecondary} strokeWidth={2.4} />
      </Pressable>
      {open ? (
        <View style={styles.rows}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <MobileText variant="tiny" tone="muted" style={styles.label}>
                {label}
              </MobileText>
              <MobileText variant="tiny" tone="secondary" selectable style={styles.value}>
                {value}
              </MobileText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  trigger: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100, 116, 139, 0.24)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  row: {
    gap: 3,
  },
  label: {
    textTransform: 'uppercase',
  },
  value: {
    flexWrap: 'wrap',
  },
});
