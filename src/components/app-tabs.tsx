import { useRouter } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { BriefcaseBusiness, House, Menu, Search, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNaneTheme } from '@/theme/tokens';

const primaryTabs: Array<{
  name: string;
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { name: 'index', href: '/', label: 'Home', icon: House },
  { name: 'work', href: '/work', label: 'Work', icon: BriefcaseBusiness },
  { name: 'search', href: '/search', label: 'Search', icon: Search },
  { name: 'more', href: '/more', label: 'More', icon: Menu },
];

const hiddenTabs = [
  { name: 'member', href: '/member' },
  { name: 'components', href: '/components' },
  { name: 'records', href: '/records' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <BottomTabList>
          {primaryTabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} resetOnFocus asChild>
              <BottomTabButton label={tab.label} icon={tab.icon} targetHref={tab.href} />
            </TabTrigger>
          ))}
          {hiddenTabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} asChild>
              <Pressable
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.hiddenTab}
              />
            </TabTrigger>
          ))}
        </BottomTabList>
      </TabList>
    </Tabs>
  );
}

function BottomTabList({ children, style, ...props }: TabListProps) {
  const theme = useNaneTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      {...props}
      pointerEvents="box-none"
      style={[style, styles.tabListContainer]}
    >
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <View style={styles.bottomBarContent}>{children}</View>
      </View>
    </View>
  );
}

function BottomTabButton({
  label,
  icon: Icon,
  targetHref,
  isFocused,
  onPress,
  style,
  ...props
}: TabTriggerSlotProps & { label: string; icon: LucideIcon; targetHref: string }) {
  const router = useRouter();
  const theme = useNaneTheme();
  const active = Boolean(isFocused);
  const foreground = active ? theme.colors.primary : theme.colors.textSecondary;
  const fontFamily = active ? theme.typography.familyBold : theme.typography.familySemiBold;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={(event) => {
        if (active) {
          router.dismissTo(targetHref as never);
          return;
        }
        onPress?.(event);
      }}
      style={({ pressed }) => [
        style as object,
        styles.tabButton,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.iconFrame}>
        <Icon color={foreground} size={24} strokeWidth={active ? 2.75 : 2.35} />
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: foreground, fontFamily }]}>
        {label}
      </Text>
      <View style={[styles.activeIndicator, { backgroundColor: active ? theme.colors.primary : 'transparent' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomBar: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    paddingHorizontal: 6,
  },
  bottomBarContent: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  iconFrame: {
    width: 38,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    includeFontPadding: false,
    marginTop: 2,
    textAlign: 'center',
  },
  activeIndicator: {
    width: 18,
    height: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  hiddenTab: {
    display: 'none',
  },
});
