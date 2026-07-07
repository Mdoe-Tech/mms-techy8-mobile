import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { MobileButton } from './MobileButton';

type StickyAction = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

type MobileStickyActionBarProps = {
  primary: StickyAction;
  secondary?: StickyAction;
};

export function MobileStickyActionBar({ primary, secondary }: MobileStickyActionBarProps) {
  return (
    <View style={styles.bar}>
      {secondary ? (
        <MobileButton
          label={secondary.label}
          icon={secondary.icon}
          loading={secondary.loading}
          disabled={secondary.disabled}
          variant={secondary.variant || 'secondary'}
          onPress={secondary.onPress}
          style={styles.secondary}
        />
      ) : null}
      <MobileButton
        label={primary.label}
        icon={primary.icon}
        loading={primary.loading}
        disabled={primary.disabled}
        variant={primary.variant || 'primary'}
        onPress={primary.onPress}
        fullWidth
        style={styles.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  primary: {
    flex: 1,
  },
  secondary: {
    minWidth: 108,
  },
});
