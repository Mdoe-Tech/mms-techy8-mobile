import { Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';

export type MobileActionSheetAction = {
  label: string;
  description?: string;
  icon?: LucideIcon;
  tone?: StatusTone;
  destructive?: boolean;
  onPress: () => void;
};

type MobileActionSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  actions: MobileActionSheetAction[];
  onClose: () => void;
};

export function MobileActionSheet({ visible, title, description, actions, onClose }: MobileActionSheetProps) {
  const theme = useNaneTheme();

  return (
    <MobileSheet visible={visible} title={title} description={description} onClose={onClose}>
      <View style={styles.list}>
        {actions.map((action) => {
          const color = action.destructive
            ? theme.colors.status.danger
            : theme.colors.status[action.tone || 'primary'];
          const Icon = action.icon;

          return (
            <Pressable
              key={action.label}
              onPress={() => {
                action.onPress();
                onClose();
              }}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: color }]}>
                {Icon ? <Icon color={theme.colors.onPrimary} size={18} strokeWidth={2.5} /> : null}
              </View>
              <View style={styles.text}>
                <MobileText variant="body" weight="bold" style={{ color: action.destructive ? color : theme.colors.text }}>
                  {action.label}
                </MobileText>
                {action.description ? (
                  <MobileText variant="small" tone="secondary">
                    {action.description}
                  </MobileText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  action: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
