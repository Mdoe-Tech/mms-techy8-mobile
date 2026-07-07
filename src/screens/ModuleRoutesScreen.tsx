import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileEmptyState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileText,
} from '@/components/mobile';
import {
  getAccessibleRoutesForModule,
  isMobileAccessLoading,
} from '@/navigation/mobile-access';
import {
  coerceMobileModule,
  coerceMobileRole,
  moduleCatalog,
  roleForMobileView,
  roleLabels,
  type MobileRouteItem,
} from '@/navigation/route-registry';
import { useMobileAccess } from '@/navigation/use-mobile-access';
import { useNaneTheme } from '@/theme/tokens';

export default function ModuleRoutesScreen() {
  const params = useLocalSearchParams();
  const access = useMobileAccess();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole ? coerceMobileRole(rawRole) : roleForMobileView(access.activeView);
  const module = coerceMobileModule(params.module);
  const meta = moduleCatalog[module];
  const routes = useMemo(() => getAccessibleRoutesForModule(role, module, access), [access, module, role]);
  const actionRoutes = useMemo(() => routes.filter((route) => !route.dynamic), [routes]);
  const primaryRoutes = useMemo(() => actionRoutes.filter((route) => route.primary), [actionRoutes]);
  const Icon = meta.icon;
  const theme = useNaneTheme();

  if (isMobileAccessLoading(access)) {
    return <MobilePageLoadingState kind="list" message="Checking your access" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title={meta.label}
        eyebrow={roleLabels[role].short}
        subtitle={meta.description}
        onBack={() => router.back()}
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
              Choose what you want to do here. Member-specific work opens from the member record.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <View style={styles.resultHeader}>
        <View style={styles.resultCopy}>
          <MobileText variant="section" weight="bold">
            What you can do
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {primaryRoutes.length > 0 ? 'Most-used tasks appear first.' : 'Pick a task to continue.'}
          </MobileText>
        </View>
        <MobileButton label="Search" variant="secondary" size="sm" onPress={() => router.push('/search' as never)} />
      </View>

      {actionRoutes.length > 0 ? (
        <MobileDataList items={actionRoutes.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/work/route-preview', params: { routeId: item.id } } as never)} />
      ) : (
        <MobileEmptyState title="Nothing to show here yet" description="There are no mobile tasks in this area for your current access." />
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
  resultCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
});
