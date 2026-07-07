import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  Building2,
  CircleDollarSign,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileEmptyState,
  MobileErrorState,
  MobileHomeHeader,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllSystemAdminAssociationMetrics,
  type SystemAdminAssociationMetricsRow,
} from '@/services/dashboard-service';
import { labelFromStatus, statusToneFor, useNaneTheme, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

type AdminDashboardFilter = 'all' | 'attention' | 'live' | 'disabled' | 'revenue';

type PlatformTotals = {
  associations: number;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  incompleteRegistrations: number;
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  lastLoginActive7d: number;
  activeLoans: number;
  overdueLoans: number;
  nextDueLoans7d: number;
  loansOutstandingAmount: number;
  loansOverdueOutstandingAmount: number;
  revenuePaidAmountTotal: number;
  revenuePaidAmount30d: number;
  revenuePendingAmount30d: number;
  revenueOverdueAmount30d: number;
  paidTransactions: number;
  pendingTransactions: number;
  overdueTransactions: number;
  campaignsCompleted7d: number;
  campaignsFailed7d: number;
  messagesDelivered7d: number;
  messagesFailed7d: number;
  liveConnections: number;
  attention: number;
  disabledAssociations: number;
};

type MobileSystemAdminDashboardScreenProps = {
  initialAssociationId?: string;
  initialMode?: 'detail';
};

export default function MobileSystemAdminDashboardScreen({
  initialAssociationId,
  initialMode,
}: MobileSystemAdminDashboardScreenProps = {}) {
  const { activeView, user } = useAuth();
  const theme = useNaneTheme();
  const [rows, setRows] = useState<SystemAdminAssociationMetricsRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AdminDashboardFilter>('attention');
  const [selectedAssociation, setSelectedAssociation] = useState<SystemAdminAssociationMetricsRow | null>(null);
  const handledInitialSelectionRef = useRef(false);

  const loadDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const response = await getAllSystemAdminAssociationMetrics({ size: 100 });
      setRows(response.rows);
      setTotalElements(response.totalElements || response.rows.length);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') {
        setRows([]);
        setTotalElements(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadDashboard('initial'));
  }, [loadDashboard]);

  useEffect(() => {
    if (loading || handledInitialSelectionRef.current || !rows.length || initialMode !== 'detail') return;
    handledInitialSelectionRef.current = true;
    const selectedRow = initialAssociationId
      ? rows.find((row) => row.associationId === initialAssociationId)
      : rows.slice().sort(sortAssociationHealthRows)[0];
    if (selectedRow) {
      void Promise.resolve().then(() => setSelectedAssociation(selectedRow));
    }
  }, [initialAssociationId, initialMode, loading, rows]);

  const totals = useMemo(() => aggregatePlatformTotals(rows), [rows]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      { value: 'attention', label: 'Attention', count: rows.filter((row) => associationAttention(row) > 0).length },
      { value: 'live', label: 'Live', count: rows.filter((row) => row.currentWebsocketConnections > 0).length },
      { value: 'disabled', label: 'Disabled', count: rows.filter((row) => isDisabledAssociation(row)).length },
      { value: 'revenue', label: 'Revenue', count: rows.filter((row) => row.revenuePaidAmountTotal > 0).length },
    ],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === 'attention' && associationAttention(row) === 0) return false;
        if (filter === 'live' && row.currentWebsocketConnections === 0) return false;
        if (filter === 'disabled' && !isDisabledAssociation(row)) return false;
        if (filter === 'revenue' && row.revenuePaidAmountTotal <= 0) return false;
        if (!query) return true;
        return [row.associationName, row.associationType, row.schemaName, row.adminEmail]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(sortAssociationHealthRows);
  }, [filter, rows, searchTerm]);

  const memberCoverage = percentage(totals.activeMembers, totals.totalMembers);
  const userActivity = percentage(totals.activeUsers, totals.totalUsers);
  const healthyAssociations = Math.max(0, totals.associations - tabs[1].count);
  const healthyCoverage = percentage(healthyAssociations, totals.associations);
  const associationsRoute = getRouteByPath('/admin/associations');

  if (activeView !== 'SYSTEM_ADMIN') {
    return (
      <AccessDeniedScreen
        title="System admin dashboard"
        description="This dashboard is available only to platform administrators."
      />
    );
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="dashboard" message="Loading platform dashboard" />;
  }

  return (
    <MobileScreen refreshing={refreshing} onRefresh={() => void loadDashboard('refresh')}>
      <MobileHomeHeader
        displayName={user?.fullName}
        workspaceLabel="Platform"
        workspaceName="System admin"
        subtitle="Mobile command center"
        refreshing={refreshing}
        onRefresh={() => void loadDashboard('refresh')}
      />

      {error && rows.length > 0 ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}

      <MobileSummaryPanel
        title="Platform collections"
        value={formatCompactCurrency(totals.revenuePaidAmountTotal)}
        description={`${formatNumber(totalElements || totals.associations)} associations · ${formatNumber(totals.activeMembers)} active members`}
        tone="blue"
        icon={CircleDollarSign}
        footer={
          <View style={styles.progressStack}>
            <MobileProgressBar value={memberCoverage} label="Active member coverage" tone="green" />
            <MobileProgressBar value={healthyCoverage} label="Associations without alerts" tone={healthyCoverage >= 80 ? 'green' : 'orange'} />
          </View>
        }
      />

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search platform..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(nextFilter) => setFilter(nextFilter as AdminDashboardFilter)} />

      <View style={styles.sectionHeader}>
        <View style={styles.titleBlock}>
          <MobileText variant="section" weight="bold">
            Association health
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {formatNumber(filteredRows.length)} of {formatNumber(rows.length)} associations shown
          </MobileText>
        </View>
        <MobileStatusBadge status={totals.attention > 0 ? 'Overdue' : 'Active'} label={totals.attention > 0 ? 'Review' : 'Healthy'} tone={totals.attention > 0 ? 'danger' : 'success'} />
      </View>

      {error && rows.length === 0 ? (
        <MobileErrorState title="Dashboard could not load" description={error} retryLabel="Retry" onRetry={() => void loadDashboard('refresh')} />
      ) : filteredRows.length > 0 ? (
        <MobileDataList
          items={filteredRows.slice(0, 40).map(toDataListItem)}
          onPressItem={(item) => {
            const selectedRow = rows.find((row) => row.associationId === item.id);
            if (selectedRow) setSelectedAssociation(selectedRow);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No associations match"
          description="Change the search or status tab to see more platform metrics."
          actionLabel="Reset filters"
          onAction={() => {
            setSearchTerm('');
            setFilter('all');
          }}
        />
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.titleBlock}>
          <MobileText variant="section" weight="bold">
            Platform snapshot
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Membership, user, and exception totals from the same metric payload.
          </MobileText>
        </View>
      </View>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Associations" value={formatNumber(totals.associations)} description="Metric workspaces" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active members" value={formatCompactNumber(totals.activeMembers)} description={`${formatPercent(memberCoverage)} of members`} icon={UsersRound} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Attention" value={formatNumber(totals.attention)} description="Overdue, failed, incomplete" icon={AlertTriangle} tone={totals.attention > 0 ? 'red' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active users" value={formatCompactNumber(totals.activeUsers)} description={`${formatPercent(userActivity)} of users`} icon={UserCheck} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent="teal" style={styles.signalCard}>
        <View style={styles.signalHeader}>
          <View style={[styles.signalIcon, { backgroundColor: theme.colors.kpi.teal }]}>
            <Activity color={theme.colors.onPrimary} size={19} strokeWidth={2.4} />
          </View>
          <View style={styles.titleBlock}>
            <MobileText variant="section" weight="bold">
              Operating signals
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Real metrics from platform workspaces, without generated chart data.
            </MobileText>
          </View>
        </View>
        <View style={styles.signalGrid}>
          <MiniSignal label="Live sockets" value={formatNumber(totals.liveConnections)} tone="teal" />
          <MiniSignal label="Active loans" value={formatNumber(totals.activeLoans)} tone="purple" />
          <MiniSignal label="Pending bills" value={formatNumber(totals.pendingTransactions)} tone="orange" />
          <MiniSignal label="Failed SMS" value={formatNumber(totals.messagesFailed7d)} tone={totals.messagesFailed7d > 0 ? 'red' : 'slate'} />
        </View>
      </MobileCard>

      {associationsRoute ? (
        <MobileButton
          label="Open associations"
          icon={Building2}
          variant="secondary"
          fullWidth
          onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: associationsRoute.id } } as never)}
        />
      ) : null}

      <AssociationMetricSheet
        row={selectedAssociation}
        onClose={() => setSelectedAssociation(null)}
      />
    </MobileScreen>
  );
}

function AssociationMetricSheet({
  row,
  onClose,
}: {
  row: SystemAdminAssociationMetricsRow | null;
  onClose: () => void;
}) {
  const theme = useNaneTheme();
  const attention = row ? associationAttention(row) : 0;
  const status = row ? associationStatus(row) : { label: 'Unknown', status: 'Unknown', tone: 'neutral' as StatusTone };

  return (
    <MobileSheet
      visible={Boolean(row)}
      title={row?.associationName || 'Association metrics'}
      description="Platform health, users, billing, loans, messaging, and live activity."
      onClose={onClose}
    >
      {row ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent={status.tone === 'danger' ? 'red' : status.tone === 'success' ? 'green' : 'orange'}>
            <View style={styles.sheetHero}>
              <View style={[styles.sheetIcon, { backgroundColor: theme.colors.primary }]}>
                <Building2 color={theme.colors.onPrimary} size={21} strokeWidth={2.5} />
              </View>
              <View style={styles.titleBlock}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {row.associationName}
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={1}>
                  {row.schemaName || row.associationType || 'Association workspace'}
                </MobileText>
              </View>
              <MobileStatusBadge status={status.status} label={status.label} tone={status.tone} />
            </View>
          </MobileCard>

          <MobileInfoRow label="Admin email" value={row.adminEmail || 'Not available'} helper="Primary admin user when available." icon={ShieldCheck} />
          <MobileInfoRow label="Members" value={`${formatNumber(row.activeMembers)} active / ${formatNumber(row.totalMembers)} total`} helper={`${formatNumber(row.incompleteRegistrations)} incomplete registrations.`} icon={UsersRound} status={row.incompleteRegistrations > 0 ? 'Pending' : 'Completed'} />
          <MobileInfoRow label="Users" value={`${formatNumber(row.activeUsers)} active / ${formatNumber(row.totalUsers)} total`} helper={`${formatNumber(row.adminUsers)} admin users · ${formatNumber(row.lastLoginActive7d)} active in 7 days.`} icon={UserCheck} />
          <MobileInfoRow label="Paid revenue" value={formatCurrency(row.revenuePaidAmountTotal)} helper={`${formatCurrency(row.revenuePaidAmount30d)} paid in 30 days.`} icon={CircleDollarSign} />
          <MobileInfoRow label="Pending revenue" value={formatCurrency(row.revenuePendingAmount30d)} helper={`${formatNumber(row.pendingTransactions)} pending transactions.`} icon={WalletCards} status={row.pendingTransactions > 0 ? 'Pending' : 'Completed'} />
          <MobileInfoRow label="Loan exposure" value={formatCurrency(row.loansOutstandingAmount)} helper={`${formatNumber(row.activeLoans)} active loans · ${formatNumber(row.overdueLoans)} overdue.`} icon={WalletCards} status={row.overdueLoans > 0 ? 'Overdue' : 'Active'} />
          <MobileInfoRow label="Messaging" value={`${formatNumber(row.messagesDelivered7d)} delivered`} helper={`${formatNumber(row.messagesFailed7d)} failed messages · ${formatNumber(row.campaignsCompleted7d)} campaigns completed.`} icon={MessageSquare} status={row.messagesFailed7d > 0 ? 'Failed' : 'Delivered'} />
          <MobileInfoRow label="Live connections" value={formatNumber(row.currentWebsocketConnections)} helper={formatComputedTime(row.computedAtEpochMs)} icon={Activity} status={row.currentWebsocketConnections > 0 ? 'Active' : 'Inactive'} />
          <MobileInfoRow label="Attention score" value={formatNumber(attention)} helper="Overdue, failed, incomplete, and disabled-account signals." icon={AlertTriangle} status={attention > 0 ? 'Overdue' : 'Completed'} />

          <View style={styles.sheetActions}>
            <MobileButton label="Close" variant="secondary" onPress={onClose} fullWidth />
          </View>
        </ScrollView>
      ) : null}
    </MobileSheet>
  );
}

function MiniSignal({ label, value, tone }: { label: string; value: string; tone: KpiTone }) {
  const theme = useNaneTheme();
  const color = theme.colors.kpi[tone];

  return (
    <View style={[styles.miniSignal, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <MobileText variant="tiny" tone="secondary" weight="bold" numberOfLines={1}>
        {label}
      </MobileText>
      <MobileText variant="body" weight="bold" style={{ color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </MobileText>
    </View>
  );
}

function toDataListItem(row: SystemAdminAssociationMetricsRow) {
  const attention = associationAttention(row);
  const status = associationStatus(row);
  const type = labelFromStatus(row.associationType || 'Association');

  return {
    id: row.associationId,
    title: row.associationName,
    subtitle: `${type} · ${row.adminEmail || row.schemaName || 'No admin email'}`,
    meta: `${formatCompactNumber(row.activeMembers)} active members · ${formatCompactNumber(row.activeUsers)} users`,
    amount: formatCompactCurrency(row.revenuePaidAmountTotal),
    status: status.status,
    statusLabel: attention > 0 ? `${attention} alerts` : status.label,
    statusTone: status.tone,
    accent: status.tone,
  };
}

function aggregatePlatformTotals(rows: SystemAdminAssociationMetricsRow[]): PlatformTotals {
  return rows.reduce<PlatformTotals>(
    (totals, row) => ({
      associations: totals.associations + 1,
      totalMembers: totals.totalMembers + row.totalMembers,
      activeMembers: totals.activeMembers + row.activeMembers,
      inactiveMembers: totals.inactiveMembers + row.inactiveMembers,
      incompleteRegistrations: totals.incompleteRegistrations + row.incompleteRegistrations,
      totalUsers: totals.totalUsers + row.totalUsers,
      activeUsers: totals.activeUsers + row.activeUsers,
      adminUsers: totals.adminUsers + row.adminUsers,
      lastLoginActive7d: totals.lastLoginActive7d + row.lastLoginActive7d,
      activeLoans: totals.activeLoans + row.activeLoans,
      overdueLoans: totals.overdueLoans + row.overdueLoans,
      nextDueLoans7d: totals.nextDueLoans7d + row.nextDueLoans7d,
      loansOutstandingAmount: totals.loansOutstandingAmount + row.loansOutstandingAmount,
      loansOverdueOutstandingAmount: totals.loansOverdueOutstandingAmount + row.loansOverdueOutstandingAmount,
      revenuePaidAmountTotal: totals.revenuePaidAmountTotal + row.revenuePaidAmountTotal,
      revenuePaidAmount30d: totals.revenuePaidAmount30d + row.revenuePaidAmount30d,
      revenuePendingAmount30d: totals.revenuePendingAmount30d + row.revenuePendingAmount30d,
      revenueOverdueAmount30d: totals.revenueOverdueAmount30d + row.revenueOverdueAmount30d,
      paidTransactions: totals.paidTransactions + row.paidTransactions,
      pendingTransactions: totals.pendingTransactions + row.pendingTransactions,
      overdueTransactions: totals.overdueTransactions + row.overdueTransactions,
      campaignsCompleted7d: totals.campaignsCompleted7d + row.campaignsCompleted7d,
      campaignsFailed7d: totals.campaignsFailed7d + row.campaignsFailed7d,
      messagesDelivered7d: totals.messagesDelivered7d + row.messagesDelivered7d,
      messagesFailed7d: totals.messagesFailed7d + row.messagesFailed7d,
      liveConnections: totals.liveConnections + row.currentWebsocketConnections,
      attention: totals.attention + associationAttention(row),
      disabledAssociations: totals.disabledAssociations + (isDisabledAssociation(row) ? 1 : 0),
    }),
    {
      associations: 0,
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      incompleteRegistrations: 0,
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
      lastLoginActive7d: 0,
      activeLoans: 0,
      overdueLoans: 0,
      nextDueLoans7d: 0,
      loansOutstandingAmount: 0,
      loansOverdueOutstandingAmount: 0,
      revenuePaidAmountTotal: 0,
      revenuePaidAmount30d: 0,
      revenuePendingAmount30d: 0,
      revenueOverdueAmount30d: 0,
      paidTransactions: 0,
      pendingTransactions: 0,
      overdueTransactions: 0,
      campaignsCompleted7d: 0,
      campaignsFailed7d: 0,
      messagesDelivered7d: 0,
      messagesFailed7d: 0,
      liveConnections: 0,
      attention: 0,
      disabledAssociations: 0,
    },
  );
}

function associationAttention(row: SystemAdminAssociationMetricsRow) {
  return (
    row.incompleteRegistrations +
    row.overdueLoans +
    row.overdueTransactions +
    row.campaignsFailed7d +
    row.messagesFailed7d +
    (isDisabledAssociation(row) ? 1 : 0)
  );
}

function associationStatus(row: SystemAdminAssociationMetricsRow): { status: string; label: string; tone: StatusTone } {
  if (isDisabledAssociation(row)) {
    return {
      status: row.accountStatus || 'Disabled',
      label: labelFromStatus(row.accountStatus || 'Disabled'),
      tone: statusToneFor(row.accountStatus || 'Disabled'),
    };
  }

  if (associationAttention(row) > 0) {
    return { status: 'Overdue', label: 'Review', tone: 'danger' };
  }

  if (row.currentWebsocketConnections > 0) {
    return { status: 'Active', label: 'Live', tone: 'success' };
  }

  return { status: 'Active', label: 'Healthy', tone: 'success' };
}

function sortAssociationHealthRows(
  left: SystemAdminAssociationMetricsRow,
  right: SystemAdminAssociationMetricsRow,
) {
  const attentionDelta = associationAttention(right) - associationAttention(left);
  if (attentionDelta !== 0) return attentionDelta;
  const revenueDelta = right.revenuePaidAmountTotal - left.revenuePaidAmountTotal;
  if (revenueDelta !== 0) return revenueDelta;
  return left.associationName.localeCompare(right.associationName);
}

function isDisabledAssociation(row: SystemAdminAssociationMetricsRow) {
  return String(row.accountStatus || 'ACTIVE').toUpperCase() !== 'ACTIVE';
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 1000) / 10));
}

function formatCompactCurrency(value: number) {
  return `TZS ${formatCompactNumber(value)}`;
}

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatNumber(value);
}

function formatComputedTime(value: number) {
  if (!value) return 'Computed time not available.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Computed time not available.';
  return `Computed ${date.toLocaleString('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}.`;
}

const styles = StyleSheet.create({
  progressStack: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  signalCard: {
    gap: 14,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  signalIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniSignal: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 128,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  sheetHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActions: {
    paddingTop: 2,
  },
});
