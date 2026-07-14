import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowDownUp,
  Banknote,
  FileWarning,
  HandCoins,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
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
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileListHeaderCard,
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
import { getAssociationLoanStatistics, getAssociationLoanSummaries } from '@/services/loan-service';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  getAllAssociationRevenueTransactions,
  getAssociationOverdueTransactions,
  getRevenueTransactionTotal,
  labelFromPaymentType,
  type RevenueOverdueResponse,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type RevenueTrackingTab = 'loans' | 'fines' | 'penalties' | 'overdue_payments';

const INITIAL_VISIBLE_COUNT = 14;
const LOAD_MORE_COUNT = 14;

const sortOptions = [
  { value: 'dueDate,asc', label: 'Due soonest', description: 'Earliest due date first.' },
  { value: 'dueDate,desc', label: 'Due latest', description: 'Latest due date first.' },
  { value: 'amount,desc', label: 'Highest amount', description: 'Largest amount first.' },
  { value: 'amount,asc', label: 'Lowest amount', description: 'Smallest amount first.' },
  { value: 'member,asc', label: 'Member name', description: 'Alphabetical member order.' },
  { value: 'status,asc', label: 'Payment status', description: 'Group records by status.' },
];

export default function MobileRevenueTrackingScreen() {
  const { activeView, associationId } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [overdueData, setOverdueData] = useState<RevenueOverdueResponse | null>(null);
  const [fines, setFines] = useState<RevenueTransaction[]>([]);
  const [penalties, setPenalties] = useState<RevenueTransaction[]>([]);
  const [loanRepayments, setLoanRepayments] = useState<RevenueTransaction[]>([]);
  const [loanCount, setLoanCount] = useState(0);
  const [loanStats, setLoanStats] = useState<RevenueLoanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RevenueTrackingTab>('loans');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('dueDate,desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading revenue tracking.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [
          loadedMembers,
          loadedOverdue,
          loadedFines,
          loadedPenalties,
          loadedLoanRepayments,
          loadedLoans,
          loadedLoanStats,
        ] = await Promise.all([
          getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
          getAssociationOverdueTransactions(associationId, true),
          getAllAssociationRevenueTransactions({ associationId, paymentType: 'FINE', size: 250 }),
          getAllAssociationRevenueTransactions({ associationId, paymentType: 'PENALTY', size: 250 }),
          getAllAssociationRevenueTransactions({ associationId, paymentType: 'LOAN_REPAYMENT', size: 250 }),
          getAssociationLoanSummaries(associationId),
          getAssociationLoanStatistics(associationId),
        ]);

        setMembers(loadedMembers.content || []);
        setOverdueData(loadedOverdue || null);
        setFines(loadedFines.content || []);
        setPenalties(loadedPenalties.content || []);
        setLoanRepayments(loadedLoanRepayments.content || []);
        setLoanCount(loadedLoans?.length || 0);
        setLoanStats(normalizeLoanStats(loadedLoanStats));
      } catch (loadError) {
        setMembers([]);
        setOverdueData(null);
        setFines([]);
        setPenalties([]);
        setLoanRepayments([]);
        setLoanCount(0);
        setLoanStats(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const memberMap = useMemo(() => {
    const map = new Map<string, AssociationMember>();
    members.forEach((member) => map.set(member.id, member));
    return map;
  }, [members]);

  const enrichedLoanRepayments = useMemo(
    () => enrichTransactions(loanRepayments, memberMap, 'LOAN_REPAYMENT', 'primary'),
    [loanRepayments, memberMap],
  );
  const enrichedFines = useMemo(() => enrichTransactions(fines, memberMap, 'FINE', 'warning'), [fines, memberMap]);
  const enrichedPenalties = useMemo(
    () => enrichTransactions(penalties, memberMap, 'PENALTY', 'danger'),
    [memberMap, penalties],
  );
  const enrichedOverduePayments = useMemo(
    () => enrichTransactions(overdueData?.details?.overduePayments || [], memberMap, undefined, 'primary', true),
    [memberMap, overdueData],
  );

  const filteredLoanRepayments = useMemo(
    () => filterRows(enrichedLoanRepayments, debouncedSearch),
    [debouncedSearch, enrichedLoanRepayments],
  );
  const filteredFines = useMemo(() => filterRows(enrichedFines, debouncedSearch), [debouncedSearch, enrichedFines]);
  const filteredPenalties = useMemo(
    () => filterRows(enrichedPenalties, debouncedSearch),
    [debouncedSearch, enrichedPenalties],
  );
  const filteredOverduePayments = useMemo(
    () => filterRows(enrichedOverduePayments, debouncedSearch),
    [debouncedSearch, enrichedOverduePayments],
  );

  const activeRows = useMemo(() => {
    const rows =
      activeTab === 'fines'
        ? filteredFines
        : activeTab === 'penalties'
          ? filteredPenalties
          : activeTab === 'overdue_payments'
            ? filteredOverduePayments
            : filteredLoanRepayments;
    return sortRows(rows, sortBy);
  }, [activeTab, filteredFines, filteredLoanRepayments, filteredOverduePayments, filteredPenalties, sortBy]);

  const visibleRows = useMemo(() => activeRows.slice(0, visibleCount), [activeRows, visibleCount]);
  const fineTotals = useMemo(() => calculateRegisterTotals(enrichedFines, 'FINE'), [enrichedFines]);
  const penaltyTotals = useMemo(() => calculateRegisterTotals(enrichedPenalties, 'PENALTY'), [enrichedPenalties]);
  const loanRepaymentTotal = useMemo(
    () => enrichedLoanRepayments.reduce((sum, row) => sum + row.paidAmount, 0),
    [enrichedLoanRepayments],
  );
  const overduePaymentsTotal = toAmount(overdueData?.totals?.totalOverduePayments);
  const totalRevenueGenerated =
    fineTotals.paid +
    penaltyTotals.paid +
    toAmount(loanStats?.totalLoanInterestGenerated) +
    toAmount(loanStats?.totalLoanInsuranceGenerated);

  const tabs = useMemo(
    () => [
      { value: 'loans', label: 'Repayments', count: filteredLoanRepayments.length },
      { value: 'fines', label: 'Fines', count: filteredFines.length },
      { value: 'penalties', label: 'Penalties', count: filteredPenalties.length },
      { value: 'overdue_payments', label: 'Overdue', count: filteredOverduePayments.length },
    ],
    [filteredFines.length, filteredLoanRepayments.length, filteredOverduePayments.length, filteredPenalties.length],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleRows.map((row) => ({
        id: row.transaction.id,
        title: row.memberName,
        subtitle: `${row.typeLabel}${row.description ? ` · ${row.description}` : ''}`,
        meta: `${row.dueDate ? `Due ${formatDate(row.dueDate)}` : 'No due date'} · ${formatDate(row.transaction.transactionDate || row.transaction.createdAt)}`,
        amount: formatTzs(row.displayAmount),
        status: labelFromStatus(row.transaction.paymentStatus),
        statusTone: statusToneFor(row.transaction.paymentStatus),
        initials: initialsFromName(row.memberName),
        accent: row.tabTone,
      })),
    [visibleRows],
  );

  const detailRoute = getRouteByPath('/associations/revenue-transactions/:id');
  const activeTitle =
    activeTab === 'fines'
      ? 'Fine register'
      : activeTab === 'penalties'
        ? 'Penalty register'
        : activeTab === 'overdue_payments'
          ? 'Other overdue payments'
          : 'Loan repayments';

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Revenue tracking"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading revenue tracking" />;
  }

  if (error && !fines.length && !penalties.length && !loanRepayments.length && !overdueData) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Revenue tracking" subtitle="Loans, fines and penalties" onBack={() => router.back()} />
        <MobileErrorState title="Revenue tracking could not load" description={error} retryLabel="Retry" onRetry={() => void loadData('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Revenue tracking"
        subtitle={overdueData?.timestamp ? `Updated ${formatDate(overdueData.timestamp)}` : 'Loans, fines and penalties'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh revenue tracking"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadData('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh issue" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Revenue generated" value={formatTzs(totalRevenueGenerated)} description="Paid fines, penalties and loan charges" tone="green" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Interest generated" value={formatTzs(toAmount(loanStats?.totalLoanInterestGenerated))} description="Loan interest revenue" tone="blue" icon={TrendingUp} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Insurance generated" value={formatTzs(toAmount(loanStats?.totalLoanInsuranceGenerated))} description="Loan insurance revenue" tone="teal" icon={ShieldAlert} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Repayments received" value={formatTzs(loanRepaymentTotal)} description={`${formatNumber(loanCount)} loan records loaded`} tone="purple" icon={HandCoins} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Loan revenue context
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Charges, balances and loan register health.
            </MobileText>
          </View>
          <MobileStatusBadge
            status={toAmount(loanStats?.overdueLoansCount) > 0 ? 'Overdue' : 'Active'}
            label={`${formatNumber(toAmount(loanStats?.overdueLoansCount))} overdue`}
            tone={toAmount(loanStats?.overdueLoansCount) > 0 ? 'danger' : 'success'}
          />
        </View>
        <View style={styles.summaryGrid}>
          <RegisterSummary label="Loans loaded" value={formatNumber(loanCount)} helper={`${formatNumber(toAmount(loanStats?.totalLoans))} total loans`} icon={ReceiptText} />
          <RegisterSummary label="Repaid amount" value={formatTzs(toAmount(loanStats?.totalRepaidAmount))} helper="From loan statistics" icon={PiggyBank} />
          <RegisterSummary label="Remaining balance" value={formatTzs(toAmount(loanStats?.totalRemainingBalance))} helper={`${formatNumber(toAmount(loanStats?.defaultedLoansCount))} defaulted`} icon={TrendingDown} />
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.summaryGrid}>
          <RegisterSummary label="Fines issued" value={formatTzs(fineTotals.issued)} helper={`${formatTzs(fineTotals.paid)} paid`} icon={FileWarning} />
          <RegisterSummary label="Penalties issued" value={formatTzs(penaltyTotals.issued)} helper={`${formatTzs(penaltyTotals.paid)} paid`} icon={TriangleAlert} />
          <RegisterSummary label="Other overdue" value={formatTzs(overduePaymentsTotal)} helper={`${formatNumber(enrichedOverduePayments.length)} unpaid payment records`} icon={Wallet} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search revenue..." />

      <MobileStatusTabs
        tabs={tabs}
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value as RevenueTrackingTab);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      <MobileListHeaderCard
        title={activeTitle}
        subtitle={`Showing ${formatNumber(Math.min(visibleCount, activeRows.length))} of ${formatNumber(activeRows.length)} records.`}
        actions={
          <>
            <MobileIconButton icon={ArrowDownUp} label="Sort revenue register" variant="secondary" onPress={() => setSortOpen(true)} />
            <MobileIconButton icon={RefreshCw} label="Refresh revenue tracking" variant="secondary" disabled={refreshing} onPress={() => void loadData('refresh')} />
          </>
        }
      />

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            if (detailRoute) {
              router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, id: item.id } } as never);
            }
          }}
        />
      ) : (
        <MobileEmptyState
          title="No records in this register"
          description="Try another tab or change the search term."
          actionLabel="Clear search"
          onAction={() => setSearch('')}
        />
      )}

      {visibleCount < activeRows.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, activeRows.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={(value) => {
          setSortBy(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

type RevenueLoanStats = {
  totalLoans?: number | string | null;
  totalRepaidAmount?: number | string | null;
  totalRemainingBalance?: number | string | null;
  overdueLoansCount?: number | string | null;
  defaultedLoansCount?: number | string | null;
  totalLoanInterestGenerated?: number | string | null;
  totalLoanInsuranceGenerated?: number | string | null;
};

type EnrichedTransaction = {
  transaction: RevenueTransaction;
  memberName: string;
  typeLabel: string;
  description?: string | null;
  dueDate?: string | null;
  issuedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  displayAmount: number;
  searchText: string;
  tabTone: StatusTone;
};

function RegisterSummary({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
}) {
  return (
    <View style={styles.summaryItem}>
      <Icon size={18} color="#2563EB" />
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {label}
        </MobileText>
        <MobileText variant="body" weight="bold">
          {value}
        </MobileText>
        <MobileText variant="tiny" tone="secondary">
          {helper}
        </MobileText>
      </View>
    </View>
  );
}

function enrichTransactions(
  transactions: RevenueTransaction[],
  memberMap: Map<string, AssociationMember>,
  preferredType?: string,
  tabTone: StatusTone = 'primary',
  regularPayment = false,
): EnrichedTransaction[] {
  return transactions
    .filter((transaction) => Boolean(transaction?.id))
    .map((transaction) => {
      const member = transaction.memberId ? memberMap.get(transaction.memberId) : undefined;
      const memberName =
        member?.fullLegalName ||
        transaction.memberFullName ||
        transaction.memberName ||
        transaction.membershipNumber ||
        'Unknown member';
      const paymentDetails = transaction.paymentDetails || {};
      const typeKey = preferredType && paymentDetails[preferredType] !== undefined ? preferredType : Object.keys(paymentDetails)[0];
      const detailAmount = toAmount(typeKey ? paymentDetails[typeKey] : getRevenueTransactionTotal(transaction));
      const metadata = transaction.metadata || {};
      const issuedAmount =
        preferredType === 'PENALTY'
          ? toAmount(metadata.penaltyAmount || metadata.fineAmount) || detailAmount
          : preferredType === 'FINE'
            ? toAmount(metadata.fineAmount) || detailAmount
            : detailAmount;
      const status = String(transaction.paymentStatus || '').toUpperCase();
      const paidAmount = status === 'PAID' ? issuedAmount : toAmount(metadata.deductionAmount);
      const remainingAmount = status === 'PAID' ? 0 : detailAmount;
      const typeLabel = regularPayment ? labelFromPaymentType(typeKey) : transaction.fineCategory || labelFromPaymentType(typeKey);
      const description = metadata.reason || transaction.description;
      const searchText = [
        memberName,
        member?.contactInfo?.email,
        transaction.id,
        transaction.description,
        transaction.paymentStatus,
        transaction.fineCategory,
        typeLabel,
        metadata.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        transaction,
        memberName,
        typeLabel,
        description,
        dueDate: transaction.dueDate,
        issuedAmount,
        paidAmount,
        remainingAmount,
        displayAmount: status === 'PAID' ? paidAmount : remainingAmount || issuedAmount,
        searchText,
        tabTone,
      };
    });
}

function filterRows(rows: EnrichedTransaction[], query: string) {
  if (!query) return rows;
  return rows.filter(
    (row) =>
      row.searchText.includes(query) ||
      String(row.displayAmount).includes(query) ||
      String(row.issuedAmount).includes(query),
  );
}

function sortRows(rows: EnrichedTransaction[], sortBy: string) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'amount,asc' || sortBy === 'amount,desc') {
      const delta = a.displayAmount - b.displayAmount;
      return sortBy.endsWith('desc') ? -delta : delta;
    }
    if (sortBy === 'member,asc') return a.memberName.localeCompare(b.memberName);
    if (sortBy === 'status,asc') return String(a.transaction.paymentStatus || '').localeCompare(String(b.transaction.paymentStatus || ''));
    const aTime = new Date(String(a.dueDate || a.transaction.transactionDate || '')).getTime() || 0;
    const bTime = new Date(String(b.dueDate || b.transaction.transactionDate || '')).getTime() || 0;
    return sortBy === 'dueDate,desc' ? bTime - aTime : aTime - bTime;
  });
  return sorted;
}

function calculateRegisterTotals(rows: EnrichedTransaction[], paymentType: 'FINE' | 'PENALTY') {
  return rows.reduce(
    (totals, row) => {
      totals.issued += row.issuedAmount;
      totals.paid += row.paidAmount;
      if (String(row.transaction.paymentStatus || '').toUpperCase() !== 'PAID') {
        totals.remaining += toAmount(row.transaction.paymentDetails?.[paymentType]) || row.remainingAmount;
      }
      return totals;
    },
    { issued: 0, paid: 0, remaining: 0 },
  );
}

function normalizeLoanStats(stats: RevenueLoanStats | null | undefined): RevenueLoanStats | null {
  return stats || null;
}

function toAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  summaryGrid: {
    gap: 10,
  },
  summaryItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
