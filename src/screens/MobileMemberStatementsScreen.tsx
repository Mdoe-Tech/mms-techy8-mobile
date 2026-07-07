import { router } from 'expo-router';
import { CalendarRange, RefreshCw, Search, UsersRound, WalletCards } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllAssociationMembers,
  getAssociationGroupConfigs,
  type AssociationMember,
  type GroupConfig,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';

const INITIAL_VISIBLE_COUNT = 25;
const LOAD_MORE_COUNT = 25;

const sortOptions = [
  { value: 'membershipNumber', label: 'Membership number', description: 'Smallest membership number first.' },
  { value: 'fullLegalName', label: 'Member name', description: 'Alphabetical by member name.' },
  { value: 'status', label: 'Status', description: 'Group members by current status.' },
  { value: 'createdAt', label: 'Newest members', description: 'Recently created members first.' },
];

export default function MobileMemberStatementsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('membershipNumber');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const loadDirectory = useCallback(
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
        const [memberResponse, configs] = await Promise.all([
          getAllAssociationMembers(associationId),
          getAssociationGroupConfigs(associationId).catch(() => []),
        ]);
        setMembers(memberResponse.content.filter((member) => Boolean(member.id)));
        setGroupConfig(configs[0] || null);
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
    void Promise.resolve().then(() => loadDirectory());
  }, [loadDirectory]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((member) => {
      const key = labelFromStatus(member.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [members]);

  const statusTabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: members.length },
      ...Array.from(statusCounts.entries()).map(([label, count]) => ({ value: label, label, count })),
    ],
    [members.length, statusCounts],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((member) => status === 'ALL' || labelFromStatus(member.status) === status)
      .filter((member) => {
        if (!query) return true;
        return [
          member.fullLegalName,
          member.membershipNumber,
          member.employeeId,
          member.memberType,
          member.packageName,
          member.contactInfo?.email,
          member.contactInfo?.phoneNumber,
          member.status,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => compareMembers(left, right, sortBy));
  }, [members, search, sortBy, status]);

  const visibleMembers = filteredMembers.slice(0, visibleCount);
  const activeMembers = members.filter((member) => labelFromStatus(member.status) === 'Active').length;
  const configured = Boolean(groupConfig?.financialYearStartDate);
  const currentPeriod = configured ? buildCurrentPeriodLabel(groupConfig) : 'Not configured';
  const detailRoute = getRouteByPath('/associations/statements/:memberId');

  const statementReportOptions = useMemo(
    () => ({
      title: 'Member Statements Directory',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered directory of members available for statement review with current status, package, and profile readiness.',
      rows: filteredMembers,
      fileName: 'nane-member-statements-directory',
      metrics: [
        { label: 'Members', value: formatNumber(members.length), helper: 'Available for statements' },
        { label: 'Active', value: formatNumber(activeMembers), helper: 'Currently active' },
        { label: 'Period', value: currentPeriod, helper: configured ? 'Current financial year' : 'Configure first' },
        { label: 'Filtered', value: formatNumber(filteredMembers.length), helper: 'Matching current filters' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: status === 'ALL' ? 'All' : status },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
        { label: 'Financial year', value: configured ? `${formatDate(groupConfig?.financialYearStartDate)} - ${formatDate(groupConfig?.financialYearEndDate)}` : 'Not configured' },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_member: AssociationMember, index: number) => index + 1 },
        { key: 'membershipNumber', label: 'Membership No', width: '12%', value: (member: AssociationMember) => member.membershipNumber || member.employeeId || '-' },
        { key: 'fullLegalName', label: 'Member Name', width: '20%', value: (member: AssociationMember) => member.fullLegalName || 'Unnamed member' },
        { key: 'status', label: 'Status', width: '10%', value: (member: AssociationMember) => labelFromStatus(member.status) },
        { key: 'package', label: 'Package', width: '14%', value: (member: AssociationMember) => member.packageName || '-' },
        { key: 'phone', label: 'Phone', width: '12%', value: (member: AssociationMember) => member.contactInfo?.phoneNumber || '-' },
        { key: 'email', label: 'Email', width: '16%', value: (member: AssociationMember) => member.contactInfo?.email || '-' },
        { key: 'progress', label: 'Progress', align: 'right' as const, width: '8%', value: (member: AssociationMember) => formatPercent(Number(member.registrationProgress || 0)) },
        { key: 'joined', label: 'Joined', width: '8%', value: (member: AssociationMember) => formatDate(member.firstRegistrationDate || member.createdAt) },
      ],
    }),
    [activeMembers, configured, currentPeriod, filteredMembers, groupConfig?.financialYearEndDate, groupConfig?.financialYearStartDate, members.length, search, sortBy, status, user?.associationName],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        title: member.fullLegalName || 'Unnamed member',
        subtitle: member.membershipNumber || member.employeeId || 'No membership number',
        meta: `${member.packageName || 'No package'} · Joined ${formatDate(member.firstRegistrationDate || member.createdAt)}`,
        amount: formatPercent(Number(member.registrationProgress || 0)),
        status: member.status || 'Unknown',
        statusTone: statusToneFor(member.status),
        accent: statusToneFor(member.status),
        initials: initialsFromName(member.fullLegalName || 'Member'),
      })),
    [visibleMembers],
  );

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member statements"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && members.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading member statements" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Statements" title="Member statements" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening statements." />
      </MobileScreen>
    );
  }

  if (error && members.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Statements"
          title="Member statements"
          subtitle={user?.associationName || 'Statement directory'}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadDirectory('refresh')} />}
        />
        <MobileErrorState title="Statements could not load" description={error} retryLabel="Retry" onRetry={() => void loadDirectory('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Statements"
        title="Member statements"
        subtitle={`${user?.associationName || 'Statement directory'} · ${formatNumber(members.length)} members`}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh statements"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadDirectory('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(members.length)} description="Available for statements" tone="blue" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(activeMembers)} description="Currently active" tone="green" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Period" value={currentPeriod} description={configured ? 'Current financial year' : 'Configure first'} tone={configured ? 'purple' : 'red'} icon={CalendarRange} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Filtered" value={formatNumber(filteredMembers.length)} description="Matching current filters" tone="teal" icon={Search} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <MobileText variant="body" weight="bold">
              Statement readiness
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Member detail screens use the association financial year configuration.
            </MobileText>
          </View>
          <MobileStatusBadge status={configured ? 'Ready' : 'Setup required'} tone={configured ? 'success' : 'danger'} />
        </View>
        <View style={styles.exportRow}>
          <MobileReportExportButton label="Export directory" options={statementReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
        <MobileInfoRow
          label="Group config"
          value={groupConfig?.name || 'Not configured'}
          helper={configured ? `${formatDate(groupConfig?.financialYearStartDate)} - ${formatDate(groupConfig?.financialYearEndDate)}` : 'Financial year dates are required for statements.'}
          icon={WalletCards}
          status={configured ? 'Ready' : 'Missing'}
        />
      </MobileCard>

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search name, membership, phone..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />
      <MobileStatusTabs tabs={statusTabs} value={status} onChange={setStatus} />

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            if (detailRoute) {
              router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, memberId: item.id } } as never);
            }
          }}
        />
      ) : (
        <MobileEmptyState
          title="No members found"
          description="Adjust the search text or status filter to find statement records."
        />
      )}

      {visibleCount < filteredMembers.length ? (
        <MobileButton
          label={`Load ${Math.min(LOAD_MORE_COUNT, filteredMembers.length - visibleCount)} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        options={sortOptions}
        value={sortBy}
        onChange={setSortBy}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function compareMembers(left: AssociationMember, right: AssociationMember, sortBy: string) {
  if (sortBy === 'fullLegalName') {
    return String(left.fullLegalName || '').localeCompare(String(right.fullLegalName || ''));
  }
  if (sortBy === 'status') {
    return String(left.status || '').localeCompare(String(right.status || ''));
  }
  if (sortBy === 'createdAt') {
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  }
  return String(left.membershipNumber || '').localeCompare(String(right.membershipNumber || ''));
}

function buildCurrentPeriodLabel(config: GroupConfig | null) {
  const start = config?.financialYearStartDate ? new Date(config.financialYearStartDate) : null;
  if (!start || Number.isNaN(start.getTime())) return 'Not configured';
  const today = new Date();
  const thisYearStart = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  const fyStart = today < thisYearStart
    ? new Date(today.getFullYear() - 1, start.getMonth(), start.getDate())
    : thisYearStart;
  const fyEnd = new Date(fyStart);
  fyEnd.setFullYear(fyStart.getFullYear() + 1);
  fyEnd.setDate(fyEnd.getDate() - 1);
  return `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  exportRow: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
});
