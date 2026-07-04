import { StyleSheet, View } from 'react-native';

import { MobileButton } from './MobileButton';
import { MobileSheet } from './MobileSheet';
import { MobileStatusTabs, type MobileStatusTab } from './MobileStatusTabs';

type MobileFilterSheetProps = {
  visible: boolean;
  statusTabs: MobileStatusTab[];
  status: string;
  onStatusChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function MobileFilterSheet({
  visible,
  statusTabs,
  status,
  onStatusChange,
  onApply,
  onReset,
  onClose,
}: MobileFilterSheetProps) {
  return (
    <MobileSheet visible={visible} title="Filter records" description="Narrow this list without losing context." onClose={onClose}>
      <MobileStatusTabs tabs={statusTabs} value={status} onChange={onStatusChange} />
      <View style={styles.actions}>
        <MobileButton label="Reset" variant="secondary" onPress={onReset} />
        <MobileButton label="Apply" fullWidth onPress={onApply} style={styles.apply} />
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  apply: {
    flex: 1,
  },
});

