import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, UserPlus, UsersRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MemberStatusFilter =
  | 'all'
  | 'ACTIVE'
  | 'PENDING'
  | 'PARTIAL'
  | 'UNDER_REVIEW'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'REJECTED';

const INITIAL_VISIBLE_COUNT = 20;
const LOAD_MORE_COUNT = 20;

const sortOptions = [
  { value: 'membershipNumber', label: 'Membership number', description: 'Smallest membership number first.' },
  { value: 'fullLegalName', label: 'Member name', description: 'Alphabetical by legal name.' },
  { value: 'createdAt', label: 'Newest members', description: 'Recently created members first.' },
  { value: 'status', label: 'Status', description: 'Group members by current status.' },
  { value: 'registrationProgress', label: 'Registration progress', description: 'Most complete profiles first.' },
];

export default function AssociationMembersScreen() {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemberStatusFilter>('all');
  const [sortBy, setSortBy] = useState('membershipNumber');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const loadMembers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getAllAssociationMembers(associationId);
        setMembers(response.content.filter((member) => Boolean(member?.id)));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadMembers());
  }, [loadMembers]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((member) => {
      const key = normalizeStatus(member.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = members.filter((member) => {
      if (status !== 'all' && normalizeStatus(member.status) !== status) return false;
      if (!query) return true;

      const values = [
        member.membershipNumber,
        member.employeeId,
        member.fullLegalName,
        getBusinessName(member),
        member.memberType,
        member.packageName,
        member.contactInfo?.email,
        member.contactInfo?.phoneNumber,
        member.contactInfo?.physicalAddress,
        ...Object.values(member.customAttributes || {}),
      ];

      return values.some((value) => String(value ?? '').toLowerCase().includes(query));
    });

    return filtered.sort((a, b) => compareMembers(a, b, sortBy));
  }, [members, search, sortBy, status]);

  const visibleMembers = useMemo(() => filteredMembers.slice(0, visibleCount), [filteredMembers, visibleCount]);
  const activeMembers = statusCounts.get('ACTIVE') || 0;
  const pendingMembers =
    (statusCounts.get('PENDING') || 0) + (statusCounts.get('PARTIAL') || 0) + (statusCounts.get('UNDER_REVIEW') || 0);
  const suspendedMembers = (statusCounts.get('SUSPENDED') || 0) + (statusCounts.get('INACTIVE') || 0);
  const averageProgress = members.length
    ? members.reduce((sum, member) => sum + Number(member.registrationProgress || 0), 0) / members.length
    : 0;

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: members.length },
      { value: 'ACTIVE', label: 'Active', count: statusCounts.get('ACTIVE') || 0 },
      { value: 'PENDING', label: 'Pending', count: statusCounts.get('PENDING') || 0 },
      { value: 'PARTIAL', label: 'Partial', count: statusCounts.get('PARTIAL') || 0 },
      { value: 'UNDER_REVIEW', label: 'Review', count: statusCounts.get('UNDER_REVIEW') || 0 },
      { value: 'SUSPENDED', label: 'Suspended', count: statusCounts.get('SUSPENDED') || 0 },
      { value: 'INACTIVE', label: 'Inactive', count: statusCounts.get('INACTIVE') || 0 },
      { value: 'REJECTED', label: 'Rejected', count: statusCounts.get('REJECTED') || 0 },
    ],
    [members.length, statusCounts],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        title: member.fullLegalName || getBusinessName(member) || 'Unnamed member',
        subtitle: `${member.membershipNumber || 'No membership number'} · ${member.contactInfo?.phoneNumber || member.contactInfo?.email || 'No contact'}`,
        meta: `${member.packageName || 'No package'} · Joined ${formatDate(member.createdAt || member.firstRegistrationDate)}`,
        amount: formatPercent(Number(member.registrationProgress || 0)),
        status: member.status || 'Unknown',
        initials: initialsFromName(member.fullLegalName || getBusinessName(member) || 'Member'),
        accent: statusTone(member.status),
      })),
    [visibleMembers],
  );

  const selectedRoute = getRouteByPath('/associations/members/new');
  const detailRoute = getRouteByPath('/associations/members/:memberId');

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Association members"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && members.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading association members" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Members" title="Association members" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening members." />
      </MobileScreen>
    );
  }

  if (error && members.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Members"
          title="Association members"
          subtitle={user?.associationName || 'Member registry'}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadMembers('refresh')}
            />
          }
        />
        <MobileErrorState title="Members could not load" description={error} retryLabel="Retry" onRetry={() => void loadMembers('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Members"
        title="Association members"
        subtitle={`${user?.associationName || 'Member registry'} · ${formatNumber(members.length)} loaded`}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Add"
            icon={UserPlus}
            size="sm"
            onPress={() =>
              selectedRoute
                ? router.push({ pathname: '/route-preview', params: { routeId: selectedRoute.id } } as never)
                : undefined
            }
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total members" value={formatNumber(members.length)} description="Full registry loaded" tone="blue" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(activeMembers)} description="Currently active" tone="green" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending work" value={formatNumber(pendingMembers)} description="Pending, partial, review" tone="orange" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Profile progress" value={formatPercent(averageProgress)} description={`${formatNumber(suspendedMembers)} inactive/suspended`} tone="purple" icon={UsersRound} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search name, phone, email, membership..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />

      <MobileStatusTabs tabs={statusTabs} value={status} onChange={(value) => setStatus(value as MemberStatusFilter)} />

      <MobileCard compact>
        <View style={styles.listHeader}>
          <View>
            <MobileText variant="section" weight="bold">
              Member registry
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(Math.min(visibleCount, filteredMembers.length))} of {formatNumber(filteredMembers.length)} matching members.
            </MobileText>
          </View>
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh members"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadMembers('refresh')}
          />
        </View>
      </MobileCard>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const member = visibleMembers.find((candidate) => candidate.id === item.id);
            if (member && detailRoute) {
              router.push({ pathname: '/route-preview', params: { routeId: detailRoute.id, memberId: member.id } } as never);
            }
          }}
        />
      ) : (
        <MobileEmptyState
          title="No matching members"
          description={search || status !== 'all' ? 'Try a different search or status filter.' : 'Members will appear here after registration.'}
          actionLabel={search || status !== 'all' ? 'Clear filters' : undefined}
          onAction={
            search || status !== 'all'
              ? () => {
                  setSearch('');
                  setStatus('all');
                }
              : undefined
          }
        />
      )}

      {visibleCount < filteredMembers.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredMembers.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={setSortBy}
        onClose={() => setSortOpen(false)}
      />

    </MobileScreen>
  );
}

function normalizeStatus(status?: string | null): MemberStatusFilter {
  const normalized = String(status || 'UNKNOWN').trim().toUpperCase();
  if (
    normalized === 'ACTIVE' ||
    normalized === 'PENDING' ||
    normalized === 'PARTIAL' ||
    normalized === 'UNDER_REVIEW' ||
    normalized === 'SUSPENDED' ||
    normalized === 'INACTIVE' ||
    normalized === 'REJECTED'
  ) {
    return normalized;
  }
  return 'all';
}

function getBusinessName(member: AssociationMember) {
  const attrs = member.customAttributes || {};
  return String(attrs.businessname || attrs.businessName || attrs.business_name || '').trim();
}

function compareMembers(a: AssociationMember, b: AssociationMember, sortBy: string) {
  if (sortBy === 'createdAt') {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  }
  if (sortBy === 'registrationProgress') {
    return Number(b.registrationProgress || 0) - Number(a.registrationProgress || 0);
  }

  const aValue = getSortValue(a, sortBy);
  const bValue = getSortValue(b, sortBy);
  return aValue.localeCompare(bValue);
}

function getSortValue(member: AssociationMember, sortBy: string) {
  if (sortBy === 'fullLegalName') return String(member.fullLegalName || getBusinessName(member) || '').toLowerCase();
  if (sortBy === 'status') return String(member.status || '').toLowerCase();
  return String(member.membershipNumber || '').toLowerCase();
}

function statusTone(status?: string | null): MobileDataListItem['accent'] {
  const normalized = normalizeStatus(status);
  if (normalized === 'ACTIVE') return 'success';
  if (normalized === 'PENDING' || normalized === 'PARTIAL' || normalized === 'UNDER_REVIEW') return 'warning';
  if (normalized === 'SUSPENDED' || normalized === 'INACTIVE' || normalized === 'REJECTED') return 'danger';
  return 'neutral';
}

const styles = StyleSheet.create({
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
