import { StyleSheet, View } from 'react-native';

import { MobileButton } from './MobileButton';
import { MobileSheet } from './MobileSheet';
import { MobileText } from './MobileText';

type MobileConfirmSheetProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MobileConfirmSheet({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onCancel,
  onConfirm,
}: MobileConfirmSheetProps) {
  return (
    <MobileSheet visible={visible} title={title} onClose={onCancel}>
      <MobileText variant="body" tone="secondary">
        {description}
      </MobileText>
      <View style={styles.actions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onCancel} />
        <MobileButton label={confirmLabel} variant={destructive ? 'danger' : 'primary'} fullWidth onPress={onConfirm} style={styles.confirm} />
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirm: {
    flex: 1,
  },
});

