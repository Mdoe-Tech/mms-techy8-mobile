import { router } from 'expo-router';
import { ChevronRight, Moon, Smartphone, Sun } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import {
  MobileCard,
  MobileEmptyState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import {
  getAccessibleModuleSummariesForRole,
  getAccessibleRoutesForModule,
  isMobileAccessLoading,
  type MobileRouteAccessState,
} from '@/navigation/mobile-access';
import {
  roleForMobileView,
  roleLabels,
  type MobileModuleSummary,
  type MobileRole,
} from '@/navigation/route-registry';
import { useMobileAccess } from '@/navigation/use-mobile-access';
import { useNaneTheme } from '@/theme/tokens';

export default function MoreMenuScreen() {
  const access = useMobileAccess();
  const role = roleForMobileView(access.activeView);
  const modules = useMemo(() => getAccessibleModuleSummariesForRole(role, access), [access, role]);
  const theme = useNaneTheme();
  const scheme = useColorScheme();
  const SchemeIcon = scheme === 'dark' ? Moon : Sun;

  if (isMobileAccessLoading(access)) {
    return <MobilePageLoadingState kind="list" message="Checking your menu access" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Menu"
        title="More"
        subtitle="Work areas and appearance."
      />

      <MobileCard compact accent="blue">
        <View style={styles.systemRow}>
          <View style={[styles.systemIcon, { backgroundColor: theme.colors.primary }]}>
            <Smartphone color={theme.colors.onPrimary} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.systemCopy}>
            <MobileText variant="section" weight="bold">
              {roleLabels[role].label}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {roleLabels[role].description}
            </MobileText>
          </View>
          <MobileStatusBadge status="Active" label="Current" tone="success" />
        </View>
      </MobileCard>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Work areas
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Choose where you want to continue working.
        </MobileText>
      </View>

      <View style={styles.menuList}>
        {modules.length > 0 ? (
          modules.map((module) => <ModuleMenuRow key={module.id} module={module} role={role} access={access} />)
        ) : (
          <MobileEmptyState
            title="No work areas available"
            description="Your current role or association plan does not include more mobile work areas."
          />
        )}
      </View>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Appearance
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Uses your phone appearance setting.
        </MobileText>
      </View>

      <View style={styles.menuList}>
        <MenuRow
          title={`${scheme === 'dark' ? 'Dark' : 'Light'} mode`}
          subtitle="Uses the device appearance setting"
          icon={SchemeIcon}
          badge="Device"
          onPress={() => undefined}
        />
      </View>
    </MobileScreen>
  );
}

function ModuleMenuRow({ module, role, access }: { module: MobileModuleSummary; role: MobileRole; access: MobileRouteAccessState }) {
  const moduleRoutes = getAccessibleRoutesForModule(role, module.id, access);
  const previewActions = moduleRoutes
    .filter((route) => route.primary && !route.dynamic)
    .concat(moduleRoutes)
    .filter((route) => !route.dynamic)
    .filter((route, index, all) => all.findIndex((item) => item.id === route.id) === index)
    .slice(0, 2)
    .map((route) => route.title);

  return (
    <MenuRow
      title={module.label}
      subtitle={previewActions.length ? previewActions.join(' • ') : module.description}
      icon={module.icon}
      badge="Open"
      onPress={() => router.push({ pathname: '/work/module', params: { module: module.id, role } } as never)}
    />
  );
}

function MenuRow({
  title,
  subtitle,
  icon: Icon,
  badge,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: MobileModuleSummary['icon'];
  badge: string;
  onPress: () => void;
}) {
  const theme = useNaneTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.84 : 1 }]}>
      <MobileCard compact style={styles.rowCard}>
        <View style={[styles.rowIcon, { backgroundColor: theme.colors.primary }]}>
          <Icon color={theme.colors.onPrimary} size={19} strokeWidth={2.4} />
        </View>
        <View style={styles.rowCopy}>
          <View style={styles.rowTitle}>
            <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.rowTitleText}>
              {title}
            </MobileText>
            <MobileStatusBadge status="More" label={badge} tone="neutral" showDot={false} />
          </View>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {subtitle}
          </MobileText>
        </View>
        <ChevronRight color={theme.colors.textMuted} size={18} />
      </MobileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  systemIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionHeader: {
    gap: 3,
  },
  menuList: {
    gap: 10,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitleText: {
    flex: 1,
  },
});
