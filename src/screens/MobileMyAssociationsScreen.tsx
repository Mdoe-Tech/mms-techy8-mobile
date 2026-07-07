import { router } from 'expo-router';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { deriveViewFromUser, hasAssociationAdminAccess, normalizeRole } from '@/auth/jwt';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileWorkspaceLogo,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getMyAssociations, type MyAssociation } from '@/services/association-service';
import { switchAssociation } from '@/services/auth-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import type { MobileViewMode } from '@/types/auth';

type AssociationFilter = 'all' | 'active' | 'default' | 'admin';

export default function MobileMyAssociationsScreen() {
  const { associationId, replaceSession, user } = useAuth();
  const [associations, setAssociations] = useState<MyAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AssociationFilter>('all');
  const [selectedAssociation, setSelectedAssociation] = useState<MyAssociation | null>(null);
  const [confirmAssociation, setConfirmAssociation] = useState<MyAssociation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAssociations = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const nextAssociations = await getMyAssociations();
      setAssociations(nextAssociations);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setAssociations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadAssociations('initial'));
  }, [loadAssociations]);

  const metrics = useMemo(() => {
    const active = associations.filter((association) => normalizeStatus(association.status) === 'ACTIVE').length;
    const admin = associations.filter((association) => isAdminRole(association.role)).length;
    const defaults = associations.filter((association) => association.isDefault).length;

    return {
      total: associations.length,
      active,
      admin,
      defaults,
    };
  }, [associations]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: associations.length },
      { value: 'active', label: 'Active', count: metrics.active },
      { value: 'default', label: 'Default', count: metrics.defaults },
      { value: 'admin', label: 'Admin', count: metrics.admin },
    ],
    [associations.length, metrics],
  );

  const filteredAssociations = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return associations.filter((association) => {
      if (filter === 'active' && normalizeStatus(association.status) !== 'ACTIVE') return false;
      if (filter === 'default' && !association.isDefault) return false;
      if (filter === 'admin' && !isAdminRole(association.role)) return false;
      if (!normalizedQuery) return true;
      return [association.displayName, association.schemaName, association.role, association.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [associations, filter, searchTerm]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredAssociations.map((association) => {
        const current = association.id === associationId;
        return {
          id: association.id,
          title: association.displayName,
          subtitle: [formatRoleLabel(association.role), association.schemaName ? 'Workspace key available' : 'Workspace key pending'].filter(Boolean).join(' · '),
          meta: current ? 'Current workspace' : association.isDefault ? 'Default association' : 'Available association',
          amount: current ? 'Selected' : 'Switch',
          status: current ? 'Active' : association.status || 'Unknown',
          statusTone: statusToneForAssociation(association, current),
          accent: current ? 'success' : isAdminRole(association.role) ? 'primary' : 'neutral',
        };
      }),
    [associationId, filteredAssociations],
  );

  const allDashboardRoute = getRouteByPath('/associations/all-dashboard');

  const openAllDashboard = () => {
    if (allDashboardRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: allDashboardRoute.id } } as never);
    }
  };

  const beginSwitch = (association: MyAssociation) => {
    setSelectedAssociation(null);
    setConfirmAssociation(association);
  };

  const confirmSwitch = async () => {
    if (!confirmAssociation) return;
    setSwitchingId(confirmAssociation.id);
    setError(null);
    setNotice(null);

    try {
      const response = await switchAssociation(confirmAssociation.id);
      if (!response.accessToken || !response.refreshToken) {
        throw new Error('The server did not return a usable switched session.');
      }

      const switchedUser = await replaceSession(response.accessToken, response.refreshToken, preferredViewFromRole(confirmAssociation.role));
      const destination = destinationForSwitchedUser(switchedUser);
      const destinationRoute = getRouteByPath(destination);

      setConfirmAssociation(null);
      setNotice(`Switched to ${confirmAssociation.displayName}.`);
      if (destinationRoute) {
        router.replace({ pathname: '/work/route-preview', params: { routeId: destinationRoute.id } } as never);
      } else {
        router.replace('/' as never);
      }
    } catch (switchError) {
      setError(getApiErrorMessage(switchError));
    } finally {
      setSwitchingId(null);
    }
  };

  if (loading && associations.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading your associations" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="My associations"
        subtitle="Choose the organization you want to work in."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh associations" variant="secondary" disabled={refreshing} onPress={() => void loadAssociations('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileCard accent="blue" compact>
        <View style={styles.heroRow}>
          <MobileWorkspaceLogo name={user?.associationName || user?.fullName || 'Association workspace'} size="md" />
          <View style={styles.heroCopy}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {user?.associationName || 'Association workspace'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={3}>
              Signed in as {user?.fullName || 'this user'}. Choose another association when you need to work somewhere else.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Associations" value={`${metrics.total}`} description="Linked to your user" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={`${metrics.active}`} description="Open workspaces" icon={CheckCircle2} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Admin access" value={`${metrics.admin}`} description="Can manage settings" icon={ShieldCheck} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Default" value={`${metrics.defaults}`} description="Primary association" icon={Star} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search associations..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(nextFilter) => setFilter(nextFilter as AssociationFilter)} />

      <SectionHeader
        title="Association switcher"
        subtitle={`${filteredAssociations.length} of ${associations.length} associations shown`}
        actionLabel={allDashboardRoute ? 'All dashboard' : undefined}
        onAction={allDashboardRoute ? openAllDashboard : undefined}
      />

      {error && associations.length === 0 ? (
        <MobileErrorState title="Associations could not load" description={error} retryLabel="Retry" onRetry={() => void loadAssociations('refresh')} />
      ) : listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const association = associations.find((candidate) => candidate.id === item.id);
            if (association) setSelectedAssociation(association);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No associations found"
          description={searchTerm ? 'No association matches your current search or filter.' : 'This user does not have any active associations available.'}
          actionLabel="Refresh"
          onAction={() => void loadAssociations('refresh')}
        />
      )}

      <AssociationDetailSheet
        association={selectedAssociation}
        currentAssociationId={associationId}
        switching={switchingId === selectedAssociation?.id}
        onClose={() => setSelectedAssociation(null)}
        onSwitch={beginSwitch}
      />

      <MobileConfirmSheet
        visible={Boolean(confirmAssociation)}
        title="Switch association?"
        description={
          confirmAssociation
            ? `Nane will replace the current mobile session with ${confirmAssociation.displayName}. Open screens will reload under that association.`
            : ''
        }
        confirmLabel={switchingId ? 'Switching...' : 'Switch association'}
        onCancel={() => (switchingId ? undefined : setConfirmAssociation(null))}
        onConfirm={() => void confirmSwitch()}
      />
    </MobileScreen>
  );
}

function AssociationDetailSheet({
  association,
  currentAssociationId,
  switching,
  onClose,
  onSwitch,
}: {
  association: MyAssociation | null;
  currentAssociationId: string | null;
  switching: boolean;
  onClose: () => void;
  onSwitch: (association: MyAssociation) => void;
}) {
  const current = Boolean(association && association.id === currentAssociationId);

  return (
    <MobileSheet
      visible={Boolean(association)}
      title={association?.displayName || 'Association details'}
      description="Workspace access and switching context."
      onClose={onClose}
    >
      {association ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent={current ? 'green' : 'blue'}>
            <View style={styles.detailHeader}>
              <MobileWorkspaceLogo name={association.displayName} size="md" />
              <View style={styles.heroCopy}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {association.displayName}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {current ? 'This is your current mobile workspace.' : 'Available for session switching.'}
                </MobileText>
              </View>
              <MobileStatusBadge status={current ? 'Active' : association.status} label={current ? 'Current' : undefined} tone={statusToneForAssociation(association, current)} />
            </View>
          </MobileCard>

          <MobileInfoRow label="Role" value={formatRoleLabel(association.role)} helper="Access level returned by the association registry." icon={Crown} />
          <MobileInfoRow label="Workspace key" value={association.schemaName || 'Not available'} helper="Used when Nane opens this association." icon={Database} />
          <MobileInfoRow label="Default" value={association.isDefault ? 'Yes' : 'No'} helper="Default association from the registry." icon={Star} />
          <MobileInfoRow label="Status" value={association.status || 'Unknown'} helper="Only active registry associations are normally selectable." icon={Search} status={association.status || 'Unknown'} />

          <View style={styles.sheetActions}>
            <MobileButton label="Close" variant="secondary" onPress={onClose} />
            <MobileButton
              label={current ? 'Current workspace' : 'Use association'}
              icon={ArrowRight}
              loading={switching}
              disabled={current || switching}
              fullWidth
              style={styles.primarySheetAction}
              onPress={() => onSwitch(association)}
            />
          </View>
        </ScrollView>
      ) : null}
    </MobileSheet>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.heroCopy}>
        <MobileText variant="section" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {subtitle}
        </MobileText>
      </View>
      {actionLabel && onAction ? <MobileButton label={actionLabel} size="sm" variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

function destinationForSwitchedUser(user: Parameters<typeof deriveViewFromUser>[0]) {
  const view = deriveViewFromUser(user);
  if (view === 'SYSTEM_ADMIN') return '/admin/dashboard';
  if (view === 'MEMBER' && !hasAssociationAdminAccess(user)) return '/member/dashboard';
  return '/associations/dashboard';
}

function preferredViewFromRole(role?: string | null): MobileViewMode | null {
  return isAdminRole(role) ? 'ADMIN' : null;
}

function isAdminRole(role?: string | null) {
  return ['ADMIN', 'CHAIRPERSON', 'VICE_CHAIRPERSON', 'SECRETARY', 'TREASURER', 'ASSOCIATION_ADMIN'].includes(normalizeRole(role));
}

function normalizeStatus(status?: string | null) {
  return String(status || 'UNKNOWN').trim().toUpperCase();
}

function statusToneForAssociation(association: MyAssociation, current: boolean): StatusTone {
  if (current) return 'success';
  const status = normalizeStatus(association.status);
  if (status === 'ACTIVE') return 'primary';
  if (status === 'PENDING') return 'warning';
  if (status === 'SUSPENDED' || status === 'INACTIVE') return 'danger';
  return 'neutral';
}

function formatRoleLabel(role?: string | null) {
  return String(role || 'Member')
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  primarySheetAction: {
    flex: 1,
  },
});
