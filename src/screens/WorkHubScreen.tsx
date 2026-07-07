import { router } from 'expo-router';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  MobileButton,
  MobileCard,
  MobileDataList,
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
  getAccessibleRoutesForRole,
  isMobileAccessLoading,
  type MobileRouteAccessState,
} from '@/navigation/mobile-access';
import {
  moduleCatalog,
  roleForMobileView,
  roleLabels,
  type MobileModuleSummary,
  type MobileRole,
  type MobileRouteItem,
} from '@/navigation/route-registry';
import { useMobileAccess } from '@/navigation/use-mobile-access';
import { useNaneTheme } from '@/theme/tokens';

export default function WorkHubScreen() {
  const access = useMobileAccess();
  const role = roleForMobileView(access.activeView);
  const routes = useMemo(() => getAccessibleRoutesForRole(role, access), [access, role]);
  const modules = useMemo(() => getAccessibleModuleSummariesForRole(role, access), [access, role]);
  const primaryRoutes = useMemo(() => routes.filter((route) => route.primary && !route.dynamic).slice(0, 6), [routes]);

  if (isMobileAccessLoading(access)) {
    return <MobilePageLoadingState kind="list" message="Checking your access" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Workspace"
        title="Work"
        subtitle="Choose where you want to work next."
      />

      <MobileCard compact accent="blue">
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <BriefcaseBusiness color="#FFFFFF" size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
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

      <SectionHeader title="Work areas" subtitle="Start with the area you want to manage." />
      {modules.length > 0 ? (
        <View style={styles.moduleGrid}>
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} role={role} access={access} />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No work areas available"
          description="Your current role or association plan does not include mobile work areas yet."
        />
      )}

      <SectionHeader title="Quick actions" subtitle="Start the tasks people use most often." />
      {primaryRoutes.length > 0 ? (
        <MobileDataList items={primaryRoutes.map(routeToListItem)} onPressItem={(item) => router.push({ pathname: '/work/route-preview', params: { routeId: item.id } } as never)} />
      ) : null}

      <MobileCard compact>
        <View style={styles.ctaRow}>
          <View style={styles.heroCopy}>
            <MobileText variant="section" weight="bold">
              Find a task
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Search members, payments, loans, reports, wallet work, SMS, or settings.
            </MobileText>
          </View>
          <MobileButton label="Search" size="sm" icon={Search} onPress={() => router.push('/search' as never)} />
        </View>
      </MobileCard>
    </MobileScreen>
  );
}

function ModuleCard({ module, role, access }: { module: MobileModuleSummary; role: MobileRole; access: MobileRouteAccessState }) {
  const theme = useNaneTheme();
  const Icon = module.icon;
  const accent = theme.colors.kpi[module.tone];
  const moduleRoutes = getAccessibleRoutesForModule(role, module.id, access);
  const previewActions = moduleRoutes
    .filter((route) => route.primary && !route.dynamic)
    .concat(moduleRoutes)
    .filter((route) => !route.dynamic)
    .filter((route, index, all) => all.findIndex((item) => item.id === route.id) === index)
    .slice(0, 2)
    .map((route) => route.title);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/work/module', params: { module: module.id, role } } as never)}
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
            <ArrowRight color={theme.colors.textMuted} size={18} />
          </View>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {module.description}
          </MobileText>
          {previewActions.length > 0 ? (
            <MobileText variant="tiny" tone="secondary" weight="bold" numberOfLines={1}>
              {previewActions.join(' • ')}
            </MobileText>
          ) : null}
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
  return {
    id: route.id,
    title: route.title,
    subtitle: route.description,
    meta: moduleCatalog[route.module].label,
    accent: 'primary' as const,
  };
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
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
