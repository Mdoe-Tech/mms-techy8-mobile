import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CheckCircle2, FileText, Layers3, LockKeyhole, Route, Smartphone } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileInfoRow,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
  MobileTimeline,
} from '@/components/mobile';
import {
  getRouteById,
  getRouteStatus,
  moduleCatalog,
  roleLabels,
} from '@/navigation/route-registry';
import AssociationMembersScreen from '@/screens/AssociationMembersScreen';
import MobileMemberDetailScreen from '@/screens/MobileMemberDetailScreen';
import { useNaneTheme } from '@/theme/tokens';

export default function RoutePreviewScreen() {
  const params = useLocalSearchParams();
  const route = getRouteById(params.routeId);
  const theme = useNaneTheme();

  if (!route) {
    return (
      <MobileScreen>
        <MobilePageHeader title="Route not found" eyebrow="Inventory" onBack={() => router.back()} />
        <MobileEmptyState
          title="Unknown route"
          description="The selected route was not found in the mobile route registry."
          actionLabel="Back to search"
          onAction={() => router.push('/search' as never)}
        />
      </MobileScreen>
    );
  }

  if (route.path === '/associations/members') {
    return <AssociationMembersScreen />;
  }

  if (route.path === '/associations/members/:memberId') {
    const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
    return <MobileMemberDetailScreen memberId={memberId} />;
  }

  const moduleMeta = moduleCatalog[route.module];
  const status = getRouteStatus(route);
  const RouteIcon = route.icon;

  return (
    <MobileScreen>
      <MobilePageHeader
        title={route.title}
        eyebrow={roleLabels[route.role].short}
        subtitle={route.path}
        onBack={() => router.back()}
        rightAction={<MobileStatusBadge status={status.label} tone={status.tone} />}
      />

      <MobileCard compact accent={moduleMeta.tone}>
        <View style={styles.routeHero}>
          <View style={[styles.routeIcon, { backgroundColor: theme.colors.kpi[moduleMeta.tone] }]}>
            <RouteIcon color={theme.colors.onPrimary} size={24} strokeWidth={2.4} />
          </View>
          <View style={styles.routeCopy}>
            <MobileText variant="section" weight="bold">
              {route.title}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              This route is inventoried and ready for native page migration planning.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileCard compact>
        <MobileInfoRow label="Source route" value={route.path} helper="Protected Next.js route from the existing frontend." icon={Route} />
        <MobileInfoRow label="Role" value={roleLabels[route.role].label} helper={roleLabels[route.role].description} icon={LockKeyhole} />
        <MobileInfoRow label="Module" value={moduleMeta.label} helper={moduleMeta.description} icon={Layers3} />
        <MobileInfoRow
          label="Route type"
          value={route.dynamic ? 'Dynamic detail route' : 'Static route'}
          helper={route.dynamic ? 'Needs selected record context before a native screen can open it.' : 'Can open without record-specific URL parameters.'}
          icon={FileText}
          status={route.dynamic ? 'Review' : 'Ready'}
        />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Migration readiness
          </MobileText>
          <MobileStatusBadge status="Planned" label={route.primary ? 'Early' : 'Queued'} tone={route.primary ? 'primary' : 'neutral'} />
        </View>
        <MobileTimeline
          items={[
            {
              id: 'inventory',
              title: 'Inventory captured',
              description: 'Route exists in mobile registry with role, module, and search metadata.',
              time: 'Done',
              tone: 'success',
              icon: CheckCircle2,
            },
            {
              id: 'design',
              title: 'Design system ready',
              description: 'The route should use shared mobile screen, header, KPI, card, list, form, loading, and status components.',
              time: 'Done',
              tone: 'success',
              icon: Smartphone,
            },
            {
              id: 'native',
              title: 'Native page migration',
              description: 'Next phase: connect real API/data behavior and replace this placeholder with the actual native screen.',
              time: route.primary ? 'Priority' : 'Queued',
              tone: route.primary ? 'primary' : 'neutral',
              icon: ArrowRight,
            },
          ]}
        />
      </MobileCard>

      <View style={styles.actions}>
        <MobileButton
          label="Open module"
          icon={Layers3}
          onPress={() => router.push({ pathname: '/module', params: { module: route.module, role: route.role } } as never)}
          fullWidth
        />
        <MobileButton label="Search routes" icon={Route} variant="secondary" onPress={() => router.push('/search' as never)} fullWidth />
      </View>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  routeHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  actions: {
    gap: 10,
  },
});
