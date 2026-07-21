import { router } from 'expo-router';
import {
  ArrowDownUp,
  Banknote,
  CalendarDays,
  Clock3,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation } from '@/auth/association-type';
import {
  MobileAmountInput,
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
  MobileListHeaderCard,
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusTabs,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  getAssociationMemberRevenueSummary,
  getAssociationMemberRevenueTransactions,
  getCurrentMemberByUserId,
  type AssociationMember,
  type MemberRevenueSummary,
  type MemberRevenueTransaction,
} from '@/services/member-service';
import { labelFromPaymentType } from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';

type RevenueStatusFilter = 'all' | 'PAID' | 'PENDING' | 'OVERDUE' | 'UNPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED';

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

const vikobaPaymentTypeOptions = [
  { label: 'All payment types', value: 'all' },
  { label: 'Share purchase', value: 'SHARE_PURCHASE' },
  { label: 'Social contribution', value: 'SOCIAL_CONTRIBUTION' },
  { label: 'Shares + social', value: 'SHARED_SOCIAL' },
  { label: 'Membership fee', value: 'MEMBERSHIP_FEE' },
  { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Loan application fee', value: 'LOAN_APPLICATION_FEE' },
  { label: 'Fine', value: 'FINE' },
  { label: 'Penalty', value: 'PENALTY' },
  { label: 'Dividend', value: 'DIVIDEND' },
  { label: 'Event registration', value: 'EVENT_REGISTRATION' },
  { label: 'Subscription', value: 'SUBSCRIPTION' },
];

const sortOptions = [
  { value: 'transactionDate,desc', label: 'Newest transactions', description: 'Latest transaction date first.' },
  { value: 'transactionDate,asc', label: 'Oldest transactions', description: 'Earliest transaction date first.' },
  { value: 'amount,desc', label: 'Highest amount', description: 'Largest transaction value first.' },
  { value: 'amount,asc', label: 'Lowest amount', description: 'Smallest transaction value first.' },
  { value: 'paymentStatus,asc', label: 'Payment status', description: 'Group records by payment status.' },
  { value: 'paymentType,asc', label: 'Payment type', description: 'Group records by payment category.' },
];

export default function MobileMemberRevenueTransactionsScreen() {
  const { activeView, user } = useAuth();
  const paymentTypeOptions = useMemo(() => isSaccosAssociation(user?.associationType) ? [
    { label: 'All payment types', value: 'all' },
    { label: 'Savings', value: 'SAVINGS' },
    { label: 'Equity share purchase', value: 'SHARE_PURCHASE' },
    { label: 'Membership fee', value: 'MEMBERSHIP_FEE' },
    { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
    { label: 'Loan application fee', value: 'LOAN_APPLICATION_FEE' },
    { label: 'Fine', value: 'FINE' },
    { label: 'Penalty', value: 'PENALTY' },
    { label: 'Dividend', value: 'DIVIDEND' },
    { label: 'Event registration', value: 'EVENT_REGISTRATION' },
    { label: 'Subscription', value: 'SUBSCRIPTION' },
  ] : vikobaPaymentTypeOptions, [user?.associationType]);
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [transactions, setTransactions] = useState<MemberRevenueTransaction[]>([]);
  const [summary, setSummary] = useState<MemberRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<RevenueStatusFilter>('all');
  const [paymentType, setPaymentType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('transactionDate,desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadTransactions = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setLoadError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const loadedMember = await getCurrentMemberByUserId(userId);
        const [loadedTransactions, loadedSummary] = await Promise.all([
          getAssociationMemberRevenueTransactions(loadedMember.id),
          getAssociationMemberRevenueSummary(loadedMember.id),
        ]);
        setMember(loadedMember);
        setTransactions((loadedTransactions || []).filter((transaction) => Boolean(transaction?.id) && normalizeStatus(transaction.paymentStatus) !== 'CANCELLED'));
        setSummary(loadedSummary || null);
      } catch (error) {
        setMember(null);
        setTransactions([]);
        setSummary(null);
        setLoadError(getApiErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

  const baseFilteredTransactions = useMemo(() => {
    const min = parseAmountFilter(minAmount);
    const max = parseAmountFilter(maxAmount);
    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

    return transactions.filter((transaction) => {
      const amount = getMemberTransactionTotal(transaction);
      const transactionTypes = Object.keys(transaction.paymentDetails || {});
      const searchable = [
        transaction.id,
        transaction.description,
        transaction.paymentStatus,
        transactionTypes.join(' '),
        transactionTypes.map(labelFromPaymentType).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (debouncedSearch && !searchable.includes(debouncedSearch)) return false;
      if (paymentType !== 'all' && !transactionTypes.includes(paymentType)) return false;
      if (min !== null && amount < min) return false;
      if (max !== null && amount > max) return false;

      if (start !== null || end !== null) {
        const timestamp = new Date(String(transaction.transactionDate || '')).getTime();
        if (!Number.isFinite(timestamp)) return false;
        if (start !== null && timestamp < start) return false;
        if (end !== null && timestamp > end) return false;
      }

      return true;
    });
  }, [debouncedSearch, endDate, maxAmount, minAmount, paymentType, startDate, transactions]);

  const sortedTransactions = useMemo(() => sortTransactions(baseFilteredTransactions, sortBy), [baseFilteredTransactions, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedTransactions.forEach((transaction) => {
      const key = normalizeStatus(transaction.paymentStatus);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [sortedTransactions]);

  const filteredTransactions = useMemo(
    () => sortedTransactions.filter((transaction) => status === 'all' || normalizeStatus(transaction.paymentStatus) === status),
    [sortedTransactions, status],
  );

  const visibleTransactions = useMemo(() => filteredTransactions.slice(0, visibleCount), [filteredTransactions, visibleCount]);

  const kpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    filteredTransactions.forEach((transaction) => {
      const amount = getMemberTransactionTotal(transaction);
      total += amount;
      const txStatus = normalizeStatus(transaction.paymentStatus);
      if (txStatus === 'PAID' || txStatus === 'PARTIALLY_PAID') paid += amount;
      if (txStatus === 'PENDING' || txStatus === 'UNPAID') pending += amount;
      if (txStatus === 'OVERDUE') overdue += amount;
    });

    return { total, paid, pending, overdue };
  }, [filteredTransactions]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: sortedTransactions.length },
      { value: 'PAID', label: 'Paid', count: statusCounts.get('PAID') || 0 },
      { value: 'PENDING', label: 'Pending', count: statusCounts.get('PENDING') || 0 },
      { value: 'OVERDUE', label: 'Overdue', count: statusCounts.get('OVERDUE') || 0 },
      { value: 'UNPAID', label: 'Unpaid', count: statusCounts.get('UNPAID') || 0 },
      { value: 'PARTIALLY_PAID', label: 'Partial', count: statusCounts.get('PARTIALLY_PAID') || 0 },
      { value: 'FAILED', label: 'Failed', count: statusCounts.get('FAILED') || 0 },
    ],
    [sortedTransactions.length, statusCounts],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleTransactions.map((transaction) => {
        const paymentTypes = formatMemberPaymentTypes(transaction);
        const amount = getMemberTransactionTotal(transaction);
        const dueDate = transaction.dueDate ? ` · Due ${formatDate(transaction.dueDate)}` : '';
        return {
          id: transaction.id,
          title: paymentTypes,
          subtitle: transaction.description || 'No description',
          meta: `${formatDate(transaction.transactionDate)}${dueDate}`,
          amount: formatTzs(amount),
          status: labelFromStatus(transaction.paymentStatus),
          statusTone: statusToneFor(transaction.paymentStatus),
          initials: initialsFromName(paymentTypes),
          accent: statusToneFor(transaction.paymentStatus),
        };
      }),
    [visibleTransactions],
  );

  const activeFilterCount = [
    paymentType !== 'all',
    Boolean(startDate),
    Boolean(endDate),
    Boolean(minAmount),
    Boolean(maxAmount),
  ].filter(Boolean).length;
  const detailRoute = getRouteByPath('/member/revenue-transactions/:id');

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="My contributions"
        description="This native transaction page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading your transactions" />;
  }

  if (loadError && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My contributions"
          subtitle="Transactions unavailable"
          onBack={() => router.back()}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadTransactions('refresh')} />}
        />
        <MobileErrorState title="Transactions could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadTransactions('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="My contributions"
        subtitle={member?.associationName || user?.associationName || 'Contribution and payment history'}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Refresh"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={refreshing}
            disabled={refreshing}
            onPress={() => void loadTransactions('refresh')}
          />
        }
      />

      {loadError ? <MobileErrorState title="Some records could not refresh" description={loadError} retryLabel="Retry" onRetry={() => void loadTransactions('refresh')} /> : null}

      <MobileCard accent="blue" compact>
        <MobileInfoRow icon={WalletCards} label="Member" value={member?.fullLegalName || user?.fullName || 'Current member'} helper={member?.membershipNumber || 'Membership number unavailable'} status={member?.status || undefined} />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total value" value={formatTzs(kpis.total)} description={`${formatNumber(filteredTransactions.length)} matching records`} tone="blue" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatTzs(kpis.paid)} description={`${formatNumber(summary?.paidCount || 0)} paid records`} tone="green" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatTzs(kpis.pending)} description={`${formatNumber(summary?.pendingCount || 0)} pending records`} tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatTzs(kpis.overdue)} description={`${formatNumber(summary?.overdueCount || 0)} overdue records`} tone="red" icon={TriangleAlert} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search type, note, status..."
        onFilterPress={() => setFilterOpen(true)}
        filterLabel={activeFilterCount ? `Filters ${activeFilterCount}` : 'Filters'}
      />

      <MobileStatusTabs
        tabs={statusTabs}
        value={status}
        onChange={(value) => {
          setStatus(value as RevenueStatusFilter);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      <MobileListHeaderCard
        title="Transaction history"
        subtitle={`Showing ${formatNumber(Math.min(visibleCount, filteredTransactions.length))} of ${formatNumber(filteredTransactions.length)} results.`}
        meta={`Filters run across all ${formatNumber(transactions.length)} loaded member transactions.`}
        actions={
          <>
            <MobileIconButton icon={ArrowDownUp} label="Sort transactions" variant="secondary" onPress={() => setSortOpen(true)} />
            <MobileIconButton
              icon={RefreshCw}
              label="Refresh transactions"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadTransactions('refresh')}
            />
          </>
        }
      />

      {refreshing ? <MobileLoadingState compact message="Refreshing transactions" /> : null}

      {!refreshing && listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            if (detailRoute) {
              router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, id: item.id } } as never);
            }
          }}
        />
      ) : null}

      {!refreshing && !listItems.length ? (
        <MobileEmptyState
          title="No matching transactions"
          description={transactions.length ? 'Try a different search, status, payment type, date range, or amount filter.' : 'Your contribution and payment history is empty for this association.'}
          actionLabel={transactions.length ? 'Clear filters' : undefined}
          onAction={
            transactions.length
              ? () => {
                  setSearch('');
                  setStatus('all');
                  setPaymentType('all');
                  setStartDate('');
                  setEndDate('');
                  setMinAmount('');
                  setMaxAmount('');
                }
              : undefined
          }
        />
      ) : null}

      {visibleCount < filteredTransactions.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredTransactions.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MemberTransactionFilterSheet
        visible={filterOpen}
        paymentType={paymentType}
        paymentTypeOptions={paymentTypeOptions}
        startDate={startDate}
        endDate={endDate}
        minAmount={minAmount}
        maxAmount={maxAmount}
        onPaymentTypeChange={(value) => {
          setPaymentType(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onStartDateChange={(value) => {
          setStartDate(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onMinAmountChange={(value) => {
          setMinAmount(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onMaxAmountChange={(value) => {
          setMaxAmount(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onReset={() => {
          setPaymentType('all');
          setStartDate('');
          setEndDate('');
          setMinAmount('');
          setMaxAmount('');
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onClose={() => setFilterOpen(false)}
      />

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

type MemberTransactionFilterSheetProps = {
  visible: boolean;
  paymentType: string;
  paymentTypeOptions: { label: string; value: string }[];
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  onPaymentTypeChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
};

function MemberTransactionFilterSheet({
  visible,
  paymentType,
  paymentTypeOptions,
  startDate,
  endDate,
  minAmount,
  maxAmount,
  onPaymentTypeChange,
  onStartDateChange,
  onEndDateChange,
  onMinAmountChange,
  onMaxAmountChange,
  onReset,
  onClose,
}: MemberTransactionFilterSheetProps) {
  return (
    <MobileSheet
      visible={visible}
      title="Filter transactions"
      description="These filters apply to your full loaded transaction history."
      onClose={onClose}
    >
      <View style={styles.filterFields}>
        <MobileSelect label="Payment type" value={paymentType} options={paymentTypeOptions} onChange={onPaymentTypeChange} />
        <View style={styles.twoColumns}>
          <MobileTextInput label="Start date" value={startDate} onChangeText={onStartDateChange} placeholder="YYYY-MM-DD" helperText="Optional" icon={CalendarDays} autoCapitalize="none" />
          <MobileTextInput label="End date" value={endDate} onChangeText={onEndDateChange} placeholder="YYYY-MM-DD" helperText="Optional" icon={CalendarDays} autoCapitalize="none" />
        </View>
        <View style={styles.twoColumns}>
          <MobileAmountInput label="Min amount" value={minAmount} onChangeText={onMinAmountChange} helperText="Optional" />
          <MobileAmountInput label="Max amount" value={maxAmount} onChangeText={onMaxAmountChange} helperText="Optional" />
        </View>
      </View>
      <View style={styles.filterActions}>
        <MobileButton label="Reset" variant="secondary" onPress={onReset} />
        <MobileButton label="Apply filters" fullWidth onPress={onClose} style={styles.applyButton} />
      </View>
    </MobileSheet>
  );
}

function normalizeStatus(status?: string | null): RevenueStatusFilter {
  const normalized = String(status || 'UNKNOWN').trim().toUpperCase();
  if (
    normalized === 'PAID' ||
    normalized === 'PENDING' ||
    normalized === 'OVERDUE' ||
    normalized === 'UNPAID' ||
    normalized === 'PARTIALLY_PAID' ||
    normalized === 'FAILED' ||
    normalized === 'CANCELLED'
  ) {
    return normalized;
  }
  return 'all';
}

function getMemberTransactionTotal(transaction: MemberRevenueTransaction) {
  const detailTotal = Object.values(transaction.paymentDetails || {}).reduce<number>((sum, value) => sum + Number(value || 0), 0);
  return detailTotal || Number(transaction.totalShareValue || 0);
}

function formatMemberPaymentTypes(transaction: MemberRevenueTransaction) {
  const keys = Object.keys(transaction.paymentDetails || {});
  if (!keys.length) return 'No payment type';
  return keys.map(labelFromPaymentType).join(' + ');
}

function parseAmountFilter(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function sortTransactions(transactions: MemberRevenueTransaction[], sortBy: string) {
  const sorted = [...transactions];
  sorted.sort((a, b) => {
    if (sortBy === 'amount,desc' || sortBy === 'amount,asc') {
      const delta = getMemberTransactionTotal(a) - getMemberTransactionTotal(b);
      return sortBy.endsWith('desc') ? -delta : delta;
    }

    if (sortBy === 'paymentStatus,asc') {
      return String(a.paymentStatus || '').localeCompare(String(b.paymentStatus || ''));
    }

    if (sortBy === 'paymentType,asc') {
      return formatMemberPaymentTypes(a).localeCompare(formatMemberPaymentTypes(b));
    }

    const aTime = new Date(String(a.transactionDate || '')).getTime() || 0;
    const bTime = new Date(String(b.transactionDate || '')).getTime() || 0;
    return sortBy === 'transactionDate,asc' ? aTime - bTime : bTime - aTime;
  });
  return sorted;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  filterFields: {
    gap: 14,
  },
  twoColumns: {
    gap: 12,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  applyButton: {
    flex: 1,
  },
});
