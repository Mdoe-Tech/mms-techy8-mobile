import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MobileButton } from './MobileButton';
import { MobileCard } from './MobileCard';
import { MobileSearchToolbar } from './MobileSearchToolbar';
import { MobileStatusTabs, type MobileStatusTab } from './MobileStatusTabs';

type MobileFilterAction = {
  label: string;
  icon?: LucideIcon;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

type MobileFilterControlsProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onFilterPress?: () => void;
  filterLabel?: string;
  tabs?: MobileStatusTab[];
  value?: string;
  onChange?: (value: string) => void;
  badges?: ReactNode;
  primaryAction?: MobileFilterAction | null;
  secondaryActions?: (MobileFilterAction | null | undefined | false)[];
  actionSlot?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MobileFilterControls({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onFilterPress,
  filterLabel,
  tabs,
  value,
  onChange,
  badges,
  primaryAction,
  secondaryActions = [],
  actionSlot,
  children,
  style,
}: MobileFilterControlsProps) {
  const actions = [primaryAction, ...secondaryActions].filter(Boolean) as MobileFilterAction[];
  const hasSearch = typeof searchValue === 'string' && typeof onSearchChange === 'function';
  const hasTabs = tabs && tabs.length > 0 && typeof value === 'string' && typeof onChange === 'function';

  return (
    <MobileCard compact style={[styles.panel, style]}>
      {hasSearch ? (
        <MobileSearchToolbar
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          onFilterPress={onFilterPress}
          filterLabel={filterLabel}
        />
      ) : null}

      {badges ? <View style={styles.badges}>{badges}</View> : null}

      {hasTabs ? (
        <View style={styles.tabs}>
          <MobileStatusTabs tabs={tabs} value={value} onChange={onChange} />
        </View>
      ) : null}

      {children}

      {actions.length > 0 || actionSlot ? (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <MobileButton
              key={`${action.label}-${index}`}
              label={action.label}
              icon={action.icon}
              onPress={action.onPress}
              variant={action.variant}
              loading={action.loading}
              disabled={action.disabled}
              size="sm"
              style={[styles.actionButton, index === 0 && primaryAction ? styles.primaryAction : null]}
            />
          ))}
          {actionSlot ? <View style={styles.actionSlot}>{actionSlot}</View> : null}
        </View>
      ) : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabs: {
    marginHorizontal: -2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 2,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 108,
    alignSelf: 'stretch',
  },
  primaryAction: {
    minWidth: 132,
  },
  actionSlot: {
    flexGrow: 1,
    minWidth: 108,
  },
});
