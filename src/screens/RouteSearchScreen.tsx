import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileDataList,
  MobileEmptyState,
  MobilePageHeader,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getModuleSummariesForRole,
  getRouteStatus,
  mobileRoles,
  moduleCatalog,
  roleForMobileView,
  roleLabels,
  searchMobileRoutes,
  type MobileModuleSummary,
  type MobileRole,
  type MobileRouteItem,
} from '@/navigation/route-registry';

type ModuleFilter = 'all' | MobileModuleSummary['id'];

export default function RouteSearchScreen() {
  const { activeView } = useAuth();
  const defaultRole = roleForMobileView(activeView);
  const [selectedRole, setSelectedRole] = useState<MobileRole | null>(null);
  const role = selectedRole || defaultRole;
  const [module, setModule] = useState<ModuleFilter>('all');
  const [query, setQuery] = useState('');
  const modules = useMemo(() => getModuleSummariesForRole(role), [role]);
  const results = useMemo(
    () =>
      searchMobileRoutes(query, {
        role,
        module: module === 'all' ? undefined : module,
      }),
    [module, query, role],
  );

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Global route search"
        title="Find work"
        subtitle="Search routes by module, label, path, or role."
      />

      <MobileStatusTabs
        tabs={mobileRoles.map((item) => ({
          value: item,
          label: roleLabels[item].short,
          count: searchMobileRoutes('', { role: item }).length,
        }))}
        value={role}
        onChange={(nextRole) => {
          setSelectedRole(nextRole as MobileRole);
          setModule('all');
        }}
      />

      <MobileSearchToolbar value={query} onChange={setQuery} placeholder="Search members, loans, wallet, SMS..." />

      <View style={styles.filterBlock}>
        <MobileText variant="small" tone="secondary" weight="bold">
          Modules
        </MobileText>
        <MobileStatusTabs
          tabs={[
            { value: 'all', label: 'All', count: searchMobileRoutes('', { role }).length },
            ...modules.map((item) => ({
              value: item.id,
              label: compactLabel(item.label),
              count: item.routeCount,
            })),
          ]}
          value={module}
          onChange={(nextModule) => setModule(nextModule as ModuleFilter)}
        />
      </View>

      <View style={styles.resultHeader}>
        <MobileText variant="section" weight="bold">
          Results
        </MobileText>
        <MobileText variant="small" tone="secondary" weight="bold">
          {results.length} routes
        </MobileText>
      </View>

      {results.length > 0 ? (
        <MobileDataList items={results.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/route-preview', params: { routeId: item.id } } as never)} />
      ) : (
        <MobileEmptyState
          title="No routes found"
          description="Try a different route name, module, or path keyword."
          actionLabel="Clear search"
          onAction={() => {
            setQuery('');
            setModule('all');
          }}
        />
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
    meta: `${roleLabels[route.role].short} · ${moduleCatalog[route.module].label}`,
    status: status.label,
    statusTone: status.tone,
    accent: status.tone,
  };
}

function compactLabel(label: string) {
  return label.replace('Wallet & Payments', 'Wallet').replace('Dashboards', 'Dashboard');
}

const styles = StyleSheet.create({
  filterBlock: {
    gap: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
