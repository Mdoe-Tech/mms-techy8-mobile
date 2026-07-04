import { router } from 'expo-router';
import { ArrowRight, Compass, Layers3, Route, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getModuleSummariesForRole,
  getRouteStatus,
  getRoutesForRole,
  mobileRouteInventoryCounts,
  mobileRoles,
  moduleCatalog,
  roleForMobileView,
  roleLabels,
  type MobileModuleSummary,
  type MobileRole,
  type MobileRouteItem,
} from '@/navigation/route-registry';
import { useNaneTheme } from '@/theme/tokens';

export default function WorkHubScreen() {
  const { activeView } = useAuth();
  const defaultRole = roleForMobileView(activeView);
  const [selectedRole, setSelectedRole] = useState<MobileRole | null>(null);
  const role = selectedRole || defaultRole;
  const routes = useMemo(() => getRoutesForRole(role), [role]);
  const modules = useMemo(() => getModuleSummariesForRole(role), [role]);
  const primaryRoutes = useMemo(() => routes.filter((route) => route.primary).slice(0, 6), [routes]);
  const dynamicCount = useMemo(() => routes.filter((route) => route.dynamic).length, [routes]);

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Mobile navigation"
        title="Work Hub"
        subtitle="Role-aware route map before native page migration."
      />

      <MobileStatusTabs
        tabs={mobileRoles.map((item) => ({
          value: item,
          label: roleLabels[item].short,
          count: getRoutesForRole(item).length,
        }))}
        value={role}
        onChange={(nextRole) => setSelectedRole(nextRole as MobileRole)}
      />

      <MobileCard compact accent="blue">
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <MobileText variant="section" weight="bold">
              {roleLabels[role].label}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {roleLabels[role].description}
            </MobileText>
          </View>
          <MobileStatusBadge status="Tracked" label={`${routes.length} routes`} tone="primary" />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Protected routes" value={`${routes.length}`} description="From frontend route tree" icon={Route} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Modules" value={`${modules.length}`} description="Grouped for mobile" icon={Layers3} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Dynamic paths" value={`${dynamicCount}`} description="Need record context" icon={Compass} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Inventory" value={`${mobileRouteInventoryCounts.total}`} description="All roles combined" icon={Sparkles} tone="teal" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <SectionHeader title="Modules" subtitle="Open a module to see every route inside it." />
      <View style={styles.moduleGrid}>
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} role={role} />
        ))}
      </View>

      <SectionHeader title="Primary work" subtitle="High-frequency routes that should migrate early." />
      {primaryRoutes.length > 0 ? (
        <MobileDataList items={primaryRoutes.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/route-preview', params: { routeId: item.id } } as never)} />
      ) : null}

      <MobileCard compact>
        <View style={styles.ctaRow}>
          <View style={styles.heroCopy}>
            <MobileText variant="section" weight="bold">
              Find any route
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Search across association, member, and system admin routes.
            </MobileText>
          </View>
          <MobileButton label="Search" size="sm" icon={ArrowRight} onPress={() => router.push('/search' as never)} />
        </View>
      </MobileCard>
    </MobileScreen>
  );
}

function ModuleCard({ module, role }: { module: MobileModuleSummary; role: MobileRole }) {
  const theme = useNaneTheme();
  const Icon = module.icon;
  const accent = theme.colors.kpi[module.tone];

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/module', params: { module: module.id, role } } as never)}
      style={({ pressed }) => [styles.modulePressable, { opacity: pressed ? 0.84 : 1 }]}
    >
      <MobileCard compact accent={module.tone} style={styles.moduleCard}>
        <View style={[styles.moduleIcon, { backgroundColor: accent }]}>
          <Icon color={theme.colors.onPrimary} size={20} strokeWidth={2.4} />
        </View>
        <View style={styles.moduleContent}>
          <View style={styles.moduleTitleRow}>
            <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.moduleTitle}>
              {module.label}
            </MobileText>
            <MobileStatusBadge status="Count" label={`${module.routeCount}`} tone="neutral" showDot={false} />
          </View>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {module.description}
          </MobileText>
          <View style={styles.moduleMeta}>
            <MobileText variant="tiny" tone="secondary" weight="bold">
              {module.primaryCount} primary
            </MobileText>
            <MobileText variant="tiny" tone="secondary" weight="bold">
              {module.dynamicCount} dynamic
            </MobileText>
          </View>
        </View>
      </MobileCard>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <MobileText variant="section" weight="bold">
        {title}
      </MobileText>
      <MobileText variant="small" tone="secondary">
        {subtitle}
      </MobileText>
    </View>
  );
}

function routeToListItem(route: MobileRouteItem) {
  const status = getRouteStatus(route);

  return {
    id: route.id,
    title: route.title,
    subtitle: route.path,
    meta: `${roleLabels[route.role].short} · ${moduleCatalog[route.module].label}`,
    status: status.label,
    statusTone: status.tone,
    accent: status.tone,
  };
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  moduleGrid: {
    gap: 10,
  },
  modulePressable: {
    borderRadius: 18,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  moduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleTitle: {
    flex: 1,
  },
  moduleMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeader: {
    gap: 3,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
