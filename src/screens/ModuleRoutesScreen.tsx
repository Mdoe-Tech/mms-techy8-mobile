import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileEmptyState,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import {
  coerceMobileModule,
  coerceMobileRole,
  getRoutesForModule,
  getRouteStatus,
  moduleCatalog,
  roleForMobileView,
  roleLabels,
  type MobileRouteItem,
} from '@/navigation/route-registry';
import { useNaneTheme } from '@/theme/tokens';

export default function ModuleRoutesScreen() {
  const params = useLocalSearchParams();
  const { activeView } = useAuth();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole ? coerceMobileRole(rawRole) : roleForMobileView(activeView);
  const module = coerceMobileModule(params.module);
  const meta = moduleCatalog[module];
  const routes = useMemo(() => getRoutesForModule(role, module), [module, role]);
  const dynamicRoutes = useMemo(() => routes.filter((route) => route.dynamic), [routes]);
  const primaryRoutes = useMemo(() => routes.filter((route) => route.primary), [routes]);
  const Icon = meta.icon;
  const theme = useNaneTheme();

  return (
    <MobileScreen>
      <MobilePageHeader
        title={meta.label}
        eyebrow={roleLabels[role].short}
        subtitle={meta.description}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status="Routes" label={`${routes.length}`} tone="primary" />}
      />

      <MobileCard compact accent={meta.tone}>
        <View style={styles.moduleIntro}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.kpi[meta.tone] }]}>
            <Icon color="#FFFFFF" size={24} strokeWidth={2.4} />
          </View>
          <View style={styles.introCopy}>
            <MobileText variant="section" weight="bold">
              {meta.label}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {routes.length} tracked web routes are grouped here for native migration planning.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Routes" value={`${routes.length}`} description="In this module" tone={meta.tone} icon={meta.icon} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Primary" value={`${primaryRoutes.length}`} description="High-frequency work" tone="blue" icon={meta.icon} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Dynamic" value={`${dynamicRoutes.length}`} description="Needs record context" tone="purple" icon={meta.icon} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <View style={styles.resultHeader}>
        <MobileText variant="section" weight="bold">
          Route inventory
        </MobileText>
        <MobileButton label="Search" variant="secondary" size="sm" onPress={() => router.push('/search' as never)} />
      </View>

      {routes.length > 0 ? (
        <MobileDataList items={routes.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/route-preview', params: { routeId: item.id } } as never)} />
      ) : (
        <MobileEmptyState title="No routes in this module" description="This role does not currently expose pages in this module." />
      )}
    </MobileScreen>
  );
}

function routeToListItem(route: MobileRouteItem) {
  const status = getRouteStatus(route);
  return {
    id: route.id,
    title: route.title,
    subtitle: route.path,
    meta: `${route.primary ? 'Primary' : 'Secondary'} · ${route.dynamic ? 'Dynamic path' : 'Static path'}`,
    status: status.label,
    statusTone: status.tone,
    accent: status.tone,
  };
}

const styles = StyleSheet.create({
  moduleIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
