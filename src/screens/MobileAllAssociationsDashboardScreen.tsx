import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllAssociationsDashboard,
  type AllAssociationDashboardItem,
} from '@/services/association-service';
import { useNaneTheme, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatNumber } from '@/utils/format';

type DashboardFilter = 'all' | 'members' | 'revenue' | 'attention';

type MobileAllAssociationsDashboardScreenProps = {
  initialAssociationId?: string;
  initialMode?: 'detail';
};

export default function MobileAllAssociationsDashboardScreen({
  initialAssociationId,
  initialMode,
}: MobileAllAssociationsDashboardScreenProps) {
  const { activeView } = useAuth();
  const [items, setItems] = useState<AllAssociationDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [selectedItem, setSelectedItem] = useState<AllAssociationDashboardItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledInitialSelectionRef = useRef(false);

  const loadDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const nextItems = await getAllAssociationsDashboard();
      setItems(nextItems);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadDashboard('initial'));
  }, [loadDashboard]);

  useEffect(() => {
    if (loading || handledInitialSelectionRef.current || !items.length) return;
    if (initialMode !== 'detail') return;
    handledInitialSelectionRef.current = true;
    const firstItem = initialAssociationId ? items.find((item) => item.associationId === initialAssociationId) : items[0];
    if (firstItem) {
      void Promise.resolve().then(() => setSelectedItem(firstItem));
    }
  }, [initialAssociationId, initialMode, items, loading]);

  const metrics = useMemo(() => {
    return items.reduce(
      (totals, item) => {
        const dashboard = item.dashboard;
        totals.associations += 1;
        totals.revenue += dashboard.summaryStats.totalRevenue;
        totals.members += dashboard.summaryStats.activeMembers;
        totals.attention += attentionCount(item);
        return totals;
      },
      { associations: 0, revenue: 0, members: 0, attention: 0 },
    );
  }, [items]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: items.length },
      { value: 'members', label: 'Members', count: items.filter((item) => item.dashboard.summaryStats.activeMembers > 0).length },
      { value: 'revenue', label: 'Revenue', count: items.filter((item) => item.dashboard.summaryStats.totalRevenue > 0).length },
      { value: 'attention', label: 'Attention', count: items.filter((item) => attentionCount(item) > 0).length },
    ],
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'members' && item.dashboard.summaryStats.activeMembers <= 0) return false;
      if (filter === 'revenue' && item.dashboard.summaryStats.totalRevenue <= 0) return false;
      if (filter === 'attention' && attentionCount(item) <= 0) return false;
      if (!query) return true;
      return [item.associationName, item.schema]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [filter, items, searchTerm]);

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="All associations dashboard" description="This rollup is available from association admin workspaces only." />;
  }

  if (loading && items.length === 0) {
    return <MobilePageLoadingState kind="dashboard" message="Loading all associations dashboard" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Dashboards"
        title="All associations"
        subtitle="Compare your linked association workspaces in one rollup."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh dashboard" variant="secondary" disabled={refreshing} onPress={() => void loadDashboard('refresh')} />}
      />

      {error && items.length > 0 ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}

      <MobileCard accent="blue" compact>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <TrendingUp color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.heroCopy}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              Executive workspace rollup
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={3}>
              Review revenue, members, contributions, and overdue signals across every association linked to this login.
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Associations" value={formatNumber(metrics.associations)} description="Linked workspaces" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Revenue" value={formatCompactCurrency(metrics.revenue)} description="Total reported" icon={CircleDollarSign} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(metrics.members)} description="Active members" icon={UsersRound} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Attention" value={formatNumber(metrics.attention)} description="Overdue signals" icon={AlertTriangle} tone={metrics.attention > 0 ? 'red' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search associations..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(nextFilter) => setFilter(nextFilter as DashboardFilter)} />

      <SectionHeader
        title="Association cards"
        subtitle={`${filteredItems.length} of ${items.length} associations shown`}
      />

      {error && items.length === 0 ? (
        <MobileErrorState title="Dashboard could not load" description={error} retryLabel="Retry" onRetry={() => void loadDashboard('refresh')} />
      ) : filteredItems.length > 0 ? (
        <View style={styles.cardList}>
          {filteredItems.map((item) => (
            <AssociationDashboardCard key={item.associationId} item={item} onPress={() => setSelectedItem(item)} />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No association dashboards found"
          description={searchTerm ? 'No dashboard matches your current search or filter.' : 'This user does not have dashboard data across associations yet.'}
          actionLabel="Refresh"
          onAction={() => void loadDashboard('refresh')}
        />
      )}

      <AssociationDashboardDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </MobileScreen>
  );
}

function AssociationDashboardCard({ item, onPress }: { item: AllAssociationDashboardItem; onPress: () => void }) {
  const theme = useNaneTheme();
  const dashboard = item.dashboard;
  const attention = attentionCount(item);
  const statusTone: StatusTone = attention > 0 ? 'danger' : 'success';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <MobileCard compact accent={attention > 0 ? 'red' : 'blue'} style={styles.associationCard}>
        <View style={styles.associationHeader}>
          <View style={[styles.associationIcon, { backgroundColor: theme.colors.primary }]}>
            <Building2 color={theme.colors.onPrimary} size={20} strokeWidth={2.5} />
          </View>
          <View style={styles.heroCopy}>
            <MobileText variant="body" weight="bold" numberOfLines={2}>
              {item.associationName}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={1}>
              {item.schema ? 'Workspace key available' : 'Workspace key pending'}
            </MobileText>
          </View>
          <MobileStatusBadge status={attention > 0 ? 'Overdue' : 'Active'} label={attention > 0 ? `${attention} alerts` : 'Active'} tone={statusTone} />
        </View>

        <View style={styles.statGrid}>
          <MiniStat tone="blue" label="Revenue" value={formatCompactCurrency(dashboard.summaryStats.totalRevenue)} icon={CircleDollarSign} />
          <MiniStat tone="purple" label="Members" value={formatNumber(dashboard.summaryStats.activeMembers)} icon={UsersRound} />
          <MiniStat tone="green" label="Contrib" value={formatCompactNumber(dashboard.contributions.paidContributions)} icon={CheckCircle2} />
          <MiniStat tone={attention > 0 ? 'red' : 'slate'} label="Fines" value={formatNumber(dashboard.fines.overdueFines)} icon={AlertTriangle} />
        </View>
      </MobileCard>
    </Pressable>
  );
}

function MiniStat({
  tone,
  label,
  value,
  icon: Icon,
}: {
  tone: KpiTone;
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  const theme = useNaneTheme();
  const color = theme.colors.kpi[tone];

  return (
    <View style={[styles.miniStat, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <View style={styles.miniStatLabel}>
        <Icon color={color} size={14} strokeWidth={2.4} />
        <MobileText variant="tiny" weight="bold" style={{ color }}>
          {label}
        </MobileText>
      </View>
      <MobileText variant="body" weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </MobileText>
    </View>
  );
}

function AssociationDashboardDetailSheet({ item, onClose }: { item: AllAssociationDashboardItem | null; onClose: () => void }) {
  const dashboard = item?.dashboard;
  const myAssociationsRoute = getRouteByPath('/associations/my-associations');

  return (
    <MobileSheet
      visible={Boolean(item)}
      title={item?.associationName || 'Association dashboard'}
      description="Revenue, member, contribution, loan, and overdue context."
      onClose={onClose}
    >
      {item && dashboard ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent={attentionCount(item) > 0 ? 'red' : 'green'}>
            <View style={styles.associationHeader}>
              <View style={styles.heroIcon}>
                <Building2 color="#FFFFFF" size={22} strokeWidth={2.5} />
              </View>
              <View style={styles.heroCopy}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {item.associationName}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {item.schema ? 'Workspace key available' : 'Workspace key pending'}
                </MobileText>
              </View>
              <MobileStatusBadge status={attentionCount(item) > 0 ? 'Overdue' : 'Active'} label={attentionCount(item) > 0 ? 'Needs review' : 'Healthy'} tone={attentionCount(item) > 0 ? 'danger' : 'success'} />
            </View>
          </MobileCard>

          <MobileInfoRow label="Total revenue" value={formatCurrency(dashboard.summaryStats.totalRevenue)} helper="Total revenue returned by this association dashboard." icon={CircleDollarSign} />
          <MobileInfoRow label="Total expenses" value={formatCurrency(dashboard.summaryStats.totalExpenses)} helper="Accumulated costs reported by the association." icon={WalletCards} />
          <MobileInfoRow label="Net balance" value={formatCurrency(dashboard.summaryStats.netBalance)} helper="Revenue minus expenses where available." icon={TrendingUp} />
          <MobileInfoRow label="Active members" value={formatNumber(dashboard.summaryStats.activeMembers)} helper="Current active member count." icon={UsersRound} />
          <MobileInfoRow label="Paid contributions" value={formatCurrency(dashboard.contributions.paidContributions)} helper={`${formatCurrency(dashboard.contributions.pendingContributions)} pending contributions.`} icon={CheckCircle2} />
          <MobileInfoRow label="Loans" value={`${formatNumber(dashboard.loans.activeLoans)} active`} helper={`${formatCurrency(dashboard.loans.totalRemainingBalance)} remaining balance.`} icon={WalletCards} />
          <MobileInfoRow label="Overdue fines" value={formatNumber(dashboard.fines.overdueFines)} helper={`${formatCurrency(dashboard.fines.totalFines)} total fines tracked.`} icon={AlertTriangle} status={dashboard.fines.overdueFines > 0 ? 'Overdue' : 'Completed'} />

          <View style={styles.sheetActions}>
            <MobileButton label="Close" variant="secondary" onPress={onClose} />
            {myAssociationsRoute ? (
              <MobileButton
                label="My associations"
                icon={ArrowLeft}
                fullWidth
                style={styles.primarySheetAction}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/work/route-preview', params: { routeId: myAssociationsRoute.id } } as never);
                }}
              />
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </MobileSheet>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
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
    </View>
  );
}

function attentionCount(item: AllAssociationDashboardItem) {
  const dashboard = item.dashboard;
  const overdueSummary = Object.values(dashboard.summaryStats.overdueSummary || {}).reduce((total, value) => total + value, 0);
  return (
    dashboard.contributions.overdueContributions +
    dashboard.fines.overdueFines +
    dashboard.loans.overdueLoans +
    overdueSummary
  );
}

function formatCompactCurrency(value: number) {
  return `TZS ${formatCompactNumber(value)}`;
}

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\\.0$/, '')}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\\.0$/, '')}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\\.0$/, '')}K`;
  return formatNumber(value);
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
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
  cardList: {
    gap: 12,
  },
  pressable: {
    borderRadius: 18,
  },
  associationCard: {
    gap: 14,
  },
  associationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  associationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniStat: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 128,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 7,
  },
  miniStatLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
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
