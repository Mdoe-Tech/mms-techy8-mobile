import { router } from 'expo-router';
import {
  ArrowDownUp,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  RefreshCw,
  Search,
  TrendingDown,
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
  MobileProgressBar,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import { getAssociationProfile } from '@/services/association-service';
import {
  getUnionDashboard,
  getUnionDeductions,
  type UnionDashboardData,
  type UnionDeduction,
  type UnionTrendPoint,
} from '@/services/dashboard-service';
import { type KpiTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format';
import AccessDeniedScreen from './AccessDeniedScreen';

type UnionDashboardTab = 'overview' | 'deductions' | 'contributors';
type UnionSort = 'period_desc' | 'period_asc' | 'amount_desc' | 'amount_asc';

type MobileUnionDashboardScreenProps = {
  initialTab?: UnionDashboardTab;
  initialMode?: 'detail';
  initialDeductionId?: string;
};

const sortOptions = [
  { value: 'period_desc', label: 'Newest deductions', description: 'Most recent deduction period first.' },
  { value: 'period_asc', label: 'Oldest deductions', description: 'Oldest deduction period first.' },
  { value: 'amount_desc', label: 'Highest amount', description: 'Largest deduction amounts first.' },
  { value: 'amount_asc', label: 'Lowest amount', description: 'Smallest deduction amounts first.' },
];

export default function MobileUnionDashboardScreen({
  initialTab,
  initialMode,
  initialDeductionId,
}: MobileUnionDashboardScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const userAssociationName = user?.associationName;
  const [dashboard, setDashboard] = useState<UnionDashboardData | null>(null);
  const [deductions, setDeductions] = useState<UnionDeduction[]>([]);
  const [associationName, setAssociationName] = useState(userAssociationName || 'Union dashboard');
  const [activeTab, setActiveTab] = useState<UnionDashboardTab>(initialTab || 'overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortValue, setSortValue] = useState<UnionSort>('period_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedDeduction, setSelectedDeduction] = useState<UnionDeduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const loadDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const [nextDashboard, nextDeductions, profile] = await Promise.all([
          getUnionDashboard(associationId),
          getUnionDeductions(associationId),
          getAssociationProfile(associationId),
        ]);
        setDashboard(nextDashboard);
        setDeductions(nextDeductions);
        setAssociationName(profile.name || userAssociationName || 'Union dashboard');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userAssociationName],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadDashboard('initial'));
  }, [loadDashboard]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !deductions.length) return;
    if (initialMode !== 'detail') return;
    handledInitialModeRef.current = true;
    const nextDeduction = initialDeductionId ? deductions.find((deduction) => deduction.id === initialDeductionId) : deductions[0];
    if (nextDeduction) {
      void Promise.resolve().then(() => {
        setActiveTab('deductions');
        setSelectedDeduction(nextDeduction);
      });
    }
  }, [deductions, initialDeductionId, initialMode, loading]);

  const filteredDeductions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = deductions.filter((deduction) => {
      if (!query) return true;
      return [deduction.member?.fullLegalName, deduction.member?.membershipNumber, deduction.amount, deduction.deductionPeriod]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
    return [...filtered].sort((a, b) => compareDeductions(a, b, sortValue));
  }, [deductions, searchTerm, sortValue]);

  const deductionItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredDeductions.slice(0, 12).map((deduction) => ({
        id: deduction.id,
        title: deduction.member?.fullLegalName || 'Union member',
        subtitle: deduction.member?.membershipNumber || 'Membership number unavailable',
        meta: formatDate(deduction.deductionPeriod),
        amount: formatCurrency(deduction.amount ?? 0),
        status: 'Paid',
        statusTone: 'paid',
        accent: 'success',
      })),
    [filteredDeductions],
  );

  const contributorItems = useMemo<MobileDataListItem[]>(
    () =>
      (dashboard?.topContributors || []).slice(0, 10).map((contributor, index) => ({
        id: contributor.memberId || `${contributor.membershipNumber || 'contributor'}-${index}`,
        title: contributor.memberFullLegalName || `Contributor ${index + 1}`,
        subtitle: contributor.membershipNumber || 'Membership number unavailable',
        meta: `Rank #${index + 1}`,
        amount: formatCurrency(contributor.totalAmount ?? 0),
        status: 'Completed',
        statusTone: 'success',
        accent: index < 3 ? 'primary' : 'neutral',
      })),
    [dashboard?.topContributors],
  );

  const retentionRate = useMemo(() => {
    const active = dashboard?.totalActiveMembers ?? 0;
    const inactive = dashboard?.totalInactiveMembers ?? 0;
    return active / Math.max(active + inactive, 1) * 100;
  }, [dashboard?.totalActiveMembers, dashboard?.totalInactiveMembers]);
  const netPosition = (dashboard?.totalRevenue ?? 0) - (dashboard?.totalExpenses ?? 0);
  const tabs = [
    { value: 'overview', label: 'Overview', count: dashboard ? 1 : 0 },
    { value: 'deductions', label: 'Deductions', count: deductions.length },
    { value: 'contributors', label: 'Top', count: dashboard?.topContributors?.length || 0 },
  ];

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Union dashboard" description="Union dashboards are available from association admin workspaces only." />;
  }

  if (loading && !dashboard) {
    return <MobilePageLoadingState kind="dashboard" message="Loading union dashboard" />;
  }

  if (error && !dashboard) {
    return (
      <MobileScreen refreshing={refreshing} onRefresh={() => void loadDashboard('refresh')}>
        <MobilePageHeader showLogo eyebrow="Union dashboard" title={associationName} subtitle="Dashboard data could not be loaded" />
        <MobileErrorState title="Union dashboard could not load" description={error} retryLabel="Retry" onRetry={() => void loadDashboard('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen refreshing={refreshing} onRefresh={() => void loadDashboard('refresh')}>
      <MobilePageHeader
        showLogo
        eyebrow="Union dashboard"
        title={associationName}
        subtitle="Monthly deductions and member activity overview."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh union dashboard" variant="secondary" disabled={refreshing} onPress={() => void loadDashboard('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiCard
        featured
        title="Total collected"
        value={formatCurrency(dashboard?.totalCollectedAmount ?? 0)}
        description={`${formatCurrency(dashboard?.totalDeductionsThisMonth ?? 0)} deducted this month`}
        icon={WalletCards}
        trend={{ value: formatNumber(dashboard?.newMembersThisMonth ?? 0), label: 'new members', direction: 'up' }}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active members" value={formatNumber(dashboard?.totalActiveMembers ?? 0)} description={`${formatNumber(dashboard?.totalInactiveMembers ?? 0)} inactive`} icon={UsersRound} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="This month" value={formatCompactCurrency(dashboard?.totalDeductionsThisMonth ?? 0)} description="Deductions posted" icon={CalendarDays} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Average" value={formatCompactCurrency(dashboard?.averageMonthlyContribution ?? 0)} description="Monthly contribution" icon={CircleDollarSign} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Expenses" value={formatCompactCurrency(dashboard?.totalExpenses ?? 0)} description={`${formatCompactCurrency(netPosition)} net`} icon={TrendingDown} tone={netPosition < 0 ? 'red' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as UnionDashboardTab)} />

      {activeTab === 'overview' ? (
        <>
          <MobileCard compact accent={retentionRate >= 75 ? 'green' : 'orange'}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <UsersRound color="#FFFFFF" size={21} strokeWidth={2.5} />
              </View>
              <View style={styles.heroCopy}>
                <MobileText variant="section" weight="bold">
                  Member retention
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Active members compared with the whole union base.
                </MobileText>
              </View>
              <MobileStatusBadge status={retentionRate >= 75 ? 'Active' : 'Pending'} label={formatPercent(retentionRate)} tone={retentionRate >= 75 ? 'success' : 'warning'} />
            </View>
            <MobileProgressBar value={Number(retentionRate.toFixed(1))} label="Retention rate" tone={retentionRate >= 75 ? 'green' : 'orange'} />
          </MobileCard>

          <TrendSection title="Monthly deduction trends" description="Total deductions by month." data={dashboard?.monthlyDeductionTrends || []} tone="blue" money />
          <TrendSection title="Member retention trends" description="Active contribution rate by month." data={dashboard?.memberRetentionTrends || []} tone="green" percent />
        </>
      ) : null}

      {activeTab === 'deductions' ? (
        <>
          <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search deductions..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
          <SectionHeader title="Deduction records" subtitle={`${filteredDeductions.length} of ${deductions.length} deductions shown`} />
          {deductionItems.length ? (
            <MobileDataList
              items={deductionItems}
              onPressItem={(item) => {
                const deduction = deductions.find((candidate) => candidate.id === item.id);
                if (deduction) setSelectedDeduction(deduction);
              }}
            />
          ) : (
            <MobileEmptyState title="No deductions found" description="No union deductions match the current search." />
          )}
        </>
      ) : null}

      {activeTab === 'contributors' ? (
        <>
          <SectionHeader title="Top contributors" subtitle="Members ranked by total deductions." />
          {contributorItems.length ? <MobileDataList items={contributorItems} showChevron={false} /> : <MobileEmptyState title="No contributors found" description="Contributor rankings will appear after deductions are posted." />}
        </>
      ) : null}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as UnionSort)} onClose={() => setSortOpen(false)} />
      <DeductionDetailSheet deduction={selectedDeduction} onClose={() => setSelectedDeduction(null)} />
    </MobileScreen>
  );
}

function TrendSection({
  title,
  description,
  data,
  tone,
  money,
  percent,
}: {
  title: string;
  description: string;
  data: UnionTrendPoint[];
  tone: KpiTone;
  money?: boolean;
  percent?: boolean;
}) {
  const maxValue = Math.max(1, ...data.map((point) => point.totalDeductions || 0));

  return (
    <MobileCard compact>
      <SectionHeader title={title} subtitle={description} />
      <View style={styles.trendList}>
        {data.length ? (
          data.slice(-6).map((point) => {
            const value = point.totalDeductions || 0;
            return (
              <View key={`${title}-${point.month}`} style={styles.trendRow}>
                <View style={styles.trendLabel}>
                  <MobileText variant="small" weight="bold">
                    {point.month || 'Period'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {money ? formatCurrency(value) : percent ? formatPercent(value) : formatNumber(value)}
                  </MobileText>
                </View>
                <MobileProgressBar value={(value / maxValue) * 100} tone={tone} style={styles.trendBar} />
              </View>
            );
          })
        ) : (
          <MobileEmptyState title="No trend data" description="Trend data will appear after monthly deductions are posted." />
        )}
      </View>
    </MobileCard>
  );
}

function DeductionDetailSheet({ deduction, onClose }: { deduction: UnionDeduction | null; onClose: () => void }) {
  return (
    <MobileSheet
      visible={Boolean(deduction)}
      title={deduction?.member?.fullLegalName || 'Deduction details'}
      description="Member, amount, and deduction period context."
      onClose={onClose}
    >
      {deduction ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent="green">
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Banknote color="#FFFFFF" size={21} strokeWidth={2.5} />
              </View>
              <View style={styles.heroCopy}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {formatCurrency(deduction.amount ?? 0)}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {formatDate(deduction.deductionPeriod)}
                </MobileText>
              </View>
              <MobileStatusBadge status="Paid" tone="paid" />
            </View>
          </MobileCard>
          <MobileInfoRow label="Member" value={deduction.member?.fullLegalName || 'Unknown member'} helper={deduction.member?.membershipNumber || 'Membership number unavailable'} icon={UsersRound} />
          <MobileInfoRow label="Deduction period" value={formatDate(deduction.deductionPeriod)} helper="Payroll or contribution period." icon={CalendarDays} />
          <MobileInfoRow label="Created" value={formatDate(deduction.createdAt)} helper="Record creation timestamp." icon={Search} />
          <MobileInfoRow label="Record ID" value={deduction.id} helper="Backend deduction identifier." icon={ArrowDownUp} />
          <MobileButton label="Close" variant="secondary" onPress={onClose} />
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

function compareDeductions(a: UnionDeduction, b: UnionDeduction, sortValue: UnionSort) {
  if (sortValue === 'amount_desc' || sortValue === 'amount_asc') {
    const diff = (a.amount || 0) - (b.amount || 0);
    return sortValue === 'amount_desc' ? -diff : diff;
  }
  const aTime = new Date(a.deductionPeriod || a.createdAt || 0).getTime();
  const bTime = new Date(b.deductionPeriod || b.createdAt || 0).getTime();
  const diff = aTime - bTime;
  return sortValue === 'period_desc' ? -diff : diff;
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
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendList: {
    gap: 12,
  },
  trendRow: {
    gap: 7,
  },
  trendLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendBar: {
    marginTop: 0,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
});
