import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MobileDataList,
  MobileEmptyState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getAccessibleModuleSummariesForRole,
  isMobileAccessLoading,
  searchAccessibleMobileRoutes,
} from '@/navigation/mobile-access';
import {
  moduleCatalog,
  roleForMobileView,
  type MobileModuleSummary,
  type MobileRouteItem,
} from '@/navigation/route-registry';
import { useMobileAccess } from '@/navigation/use-mobile-access';

type ModuleFilter = 'all' | MobileModuleSummary['id'];

export default function RouteSearchScreen() {
  const access = useMobileAccess();
  const role = roleForMobileView(access.activeView);
  const [module, setModule] = useState<ModuleFilter>('all');
  const [query, setQuery] = useState('');
  const modules = useMemo(() => getAccessibleModuleSummariesForRole(role, access), [access, role]);
  const results = useMemo(
    () =>
      searchAccessibleMobileRoutes(query, {
        role,
        module: module === 'all' ? undefined : module,
      }, access).filter((route) => !route.dynamic),
    [access, module, query, role],
  );
  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: searchAccessibleMobileRoutes('', { role }, access).filter((route) => !route.dynamic).length },
      ...modules.map((item) => ({
        value: item.id,
        label: compactLabel(item.label),
        count: searchAccessibleMobileRoutes('', { role, module: item.id }, access).filter((route) => !route.dynamic).length,
      })),
    ],
    [access, modules, role],
  );

  if (isMobileAccessLoading(access)) {
    return <MobilePageLoadingState kind="list" message="Checking searchable work" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Search"
        title="Find work"
        subtitle="Search by task, work area, member, payment, report, wallet, SMS, or setting."
      />

      <MobileSearchToolbar value={query} onChange={setQuery} placeholder="Search members, loans, wallet, SMS..." />

      <View style={styles.filterBlock}>
        <MobileText variant="small" tone="secondary" weight="bold">
          Work areas
        </MobileText>
        <MobileStatusTabs
          tabs={tabs}
          value={module}
          onChange={(nextModule) => setModule(nextModule as ModuleFilter)}
        />
      </View>

      <View style={styles.resultHeader}>
        <MobileText variant="section" weight="bold">
          Results
        </MobileText>
        <MobileText variant="small" tone="secondary" weight="bold">
          {results.length} actions
        </MobileText>
      </View>

      {results.length > 0 ? (
        <MobileDataList items={results.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/work/route-preview', params: { routeId: item.id } } as never)} />
      ) : (
        <MobileEmptyState
          title="No matching work found"
          description="Try a different task name, work area, or keyword."
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
  return {
    id: route.id,
    title: route.title,
    subtitle: route.description,
    meta: moduleCatalog[route.module].label,
    accent: route.primary ? ('primary' as const) : ('neutral' as const),
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
