import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { useNaneTheme } from '@/theme/tokens';
import { MobileIconButton } from './MobileIconButton';
import { MobileText } from './MobileText';

type MobileSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function MobileSheet({ visible, title, description, children, onClose }: MobileSheetProps) {
  const theme = useNaneTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <MobileText variant="section" weight="bold">
                {title}
              </MobileText>
              {description ? (
                <MobileText variant="small" tone="secondary">
                  {description}
                </MobileText>
              ) : null}
            </View>
            <MobileIconButton icon={X} label="Close" variant="ghost" onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
});
