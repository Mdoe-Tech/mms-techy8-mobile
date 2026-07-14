import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Banknote,
  CalendarDays,
  Clock3,
  FilePlus2,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
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
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  formatRevenuePaymentTypes,
  getAllAssociationRevenueTransactions,
  getRevenueTransactionTotal,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type RevenueStatusFilter = 'all' | 'PAID' | 'PENDING' | 'OVERDUE' | 'UNPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED';

const INITIAL_VISIBLE_COUNT = 20;
const LOAD_MORE_COUNT = 20;

const paymentTypeOptions = [
  { label: 'All payment types', value: 'all' },
  { label: 'Share purchase', value: 'SHARE_PURCHASE' },
  { label: 'Social contribution', value: 'SOCIAL_CONTRIBUTION' },
  { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Fine', value: 'FINE' },
  { label: 'Penalty', value: 'PENALTY' },
  { label: 'Event registration', value: 'EVENT_REGISTRATION' },
  { label: 'Subscription', value: 'SUBSCRIPTION' },
];

const sortOptions = [
  { value: 'transactionDate,desc', label: 'Newest transactions', description: 'Latest transaction date first.' },
  { value: 'transactionDate,asc', label: 'Oldest transactions', description: 'Earliest transaction date first.' },
  { value: 'memberFullName,asc', label: 'Member name', description: 'Alphabetical member order.' },
  { value: 'paymentStatus,asc', label: 'Payment status', description: 'Group records by payment status.' },
  { value: 'createdAt,desc', label: 'Recently created', description: 'Latest system records first.' },
];

export default function MobileRevenueTransactionsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setDebouncedSearch(search.trim());
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadTransactions = useCallback(
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
        const transactionResponse = await getAllAssociationRevenueTransactions({
          associationId,
          paymentType: paymentType === 'all' ? undefined : paymentType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: debouncedSearch || undefined,
          sort: sortBy,
        });

        setTransactions(transactionResponse.content.filter((transaction) => Boolean(transaction?.id)));
        setServerTotal(transactionResponse.totalElements);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setTransactions([]);
        setServerTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, debouncedSearch, endDate, paymentType, sortBy, startDate],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

  const amountFilteredTransactions = useMemo(() => {
    const min = parseAmountFilter(minAmount);
    const max = parseAmountFilter(maxAmount);
    return transactions.filter((transaction) => {
      const total = getRevenueTransactionTotal(transaction);
      if (min !== null && total < min) return false;
      if (max !== null && total > max) return false;
      return true;
    });
  }, [maxAmount, minAmount, transactions]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    amountFilteredTransactions.forEach((transaction) => {
      const key = normalizeStatus(transaction.paymentStatus);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [amountFilteredTransactions]);

  const filteredTransactions = useMemo(
    () =>
      amountFilteredTransactions.filter((transaction) => {
        if (status === 'all') return true;
        return normalizeStatus(transaction.paymentStatus) === status;
      }),
    [amountFilteredTransactions, status],
  );

  const visibleTransactions = useMemo(() => filteredTransactions.slice(0, visibleCount), [filteredTransactions, visibleCount]);

  const kpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    filteredTransactions.forEach((transaction) => {
      const amount = getRevenueTransactionTotal(transaction);
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
      { value: 'all', label: 'All', count: amountFilteredTransactions.length },
      { value: 'PAID', label: 'Paid', count: statusCounts.get('PAID') || 0 },
      { value: 'PENDING', label: 'Pending', count: statusCounts.get('PENDING') || 0 },
      { value: 'OVERDUE', label: 'Overdue', count: statusCounts.get('OVERDUE') || 0 },
      { value: 'UNPAID', label: 'Unpaid', count: statusCounts.get('UNPAID') || 0 },
      { value: 'PARTIALLY_PAID', label: 'Partial', count: statusCounts.get('PARTIALLY_PAID') || 0 },
      { value: 'FAILED', label: 'Failed', count: statusCounts.get('FAILED') || 0 },
      { value: 'CANCELLED', label: 'Cancelled', count: statusCounts.get('CANCELLED') || 0 },
    ],
    [amountFilteredTransactions.length, statusCounts],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleTransactions.map((transaction) => {
        const memberName = transaction.memberFullName || transaction.membershipNumber || 'Unassigned member';
        const amount = getRevenueTransactionTotal(transaction);
        const paymentTypes = formatRevenuePaymentTypes(transaction);
        const dueDate = transaction.dueDate ? ` · Due ${formatDate(transaction.dueDate)}` : '';

        return {
          id: transaction.id,
          title: memberName,
          subtitle: `${transaction.membershipNumber || 'No membership number'} · ${paymentTypes}`,
          meta: `${formatDate(transaction.transactionDate || transaction.createdAt)}${dueDate}`,
          amount: formatTzs(amount),
          status: labelFromStatus(transaction.paymentStatus),
          statusTone: statusToneFor(transaction.paymentStatus),
          initials: initialsFromName(memberName),
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

  const createRoute = getRouteByPath('/associations/revenue-transactions/create');
  const detailRoute = getRouteByPath('/associations/revenue-transactions/:id');

  const transactionReportOptions = useMemo(
    () => ({
      title: 'Revenue Transactions Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered ledger of member revenue transactions, payment types, due dates, statuses, and values.',
      rows: filteredTransactions,
      fileName: 'nane-revenue-transactions',
      metrics: [
        { label: 'Total value', value: formatTzs(kpis.total), helper: 'Matching transaction value' },
        { label: 'Paid value', value: formatTzs(kpis.paid), helper: 'Paid and partial paid' },
        { label: 'Pending', value: formatTzs(kpis.pending), helper: 'Pending and unpaid' },
        { label: 'Overdue', value: formatTzs(kpis.overdue), helper: 'Overdue balance' },
      ],
      filters: [
        { label: 'Search', value: debouncedSearch || search || 'All' },
        { label: 'Status', value: status === 'all' ? 'All' : status },
        { label: 'Payment type', value: paymentTypeOptions.find((option) => option.value === paymentType)?.label || paymentType },
        { label: 'Start date', value: startDate || 'Any' },
        { label: 'End date', value: endDate || 'Any' },
        { label: 'Min amount', value: minAmount || 'Any' },
        { label: 'Max amount', value: maxAmount || 'Any' },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_transaction: RevenueTransaction, index: number) => index + 1 },
        { key: 'date', label: 'Date', width: '10%', value: (transaction: RevenueTransaction) => formatDate(transaction.transactionDate || transaction.createdAt) },
        { key: 'member', label: 'Member', width: '16%', value: (transaction: RevenueTransaction) => transaction.memberFullName || transaction.membershipNumber || 'Unassigned member' },
        { key: 'membershipNumber', label: 'Member No', width: '10%', value: (transaction: RevenueTransaction) => transaction.membershipNumber || '-' },
        { key: 'paymentTypes', label: 'Payment Types', width: '18%', value: (transaction: RevenueTransaction) => formatRevenuePaymentTypes(transaction) },
        { key: 'status', label: 'Status', width: '10%', value: (transaction: RevenueTransaction) => labelFromStatus(transaction.paymentStatus) },
        { key: 'dueDate', label: 'Due Date', width: '10%', value: (transaction: RevenueTransaction) => formatDate(transaction.dueDate) },
        { key: 'reference', label: 'Reference', width: '10%', value: (transaction: RevenueTransaction) => transaction.referenceId || transaction.referenceType || '-' },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '12%', value: (transaction: RevenueTransaction) => formatTzs(getRevenueTransactionTotal(transaction)) },
      ],
    }),
    [debouncedSearch, endDate, filteredTransactions, kpis, maxAmount, minAmount, paymentType, search, startDate, status, user?.associationName],
  );

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Revenue transactions"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && transactions.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading revenue transactions" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Revenue transactions" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening transactions." />
      </MobileScreen>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Finance"
          title="Revenue transactions"
          subtitle={user?.associationName || 'Financial records'}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadTransactions('refresh')}
            />
          }
        />
        <MobileErrorState title="Transactions could not load" description={error} retryLabel="Retry" onRetry={() => void loadTransactions('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Revenue transactions"
        subtitle={`${formatNumber(filteredTransactions.length)} matching records`}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label="Add"
            icon={FilePlus2}
            size="sm"
            onPress={() =>
              createRoute
                ? router.push({ pathname: '/work/route-preview', params: { routeId: createRoute.id } } as never)
                : undefined
            }
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total value" value={formatTzs(kpis.total)} description="Matching transaction value" tone="blue" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid value" value={formatTzs(kpis.paid)} description="Paid and partial paid" tone="green" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatTzs(kpis.pending)} description="Pending and unpaid" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatTzs(kpis.overdue)} description="Overdue balance" tone="red" icon={TriangleAlert} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search member, ref, description..."
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
        title="Transaction ledger"
        subtitle={`Showing ${formatNumber(Math.min(visibleCount, filteredTransactions.length))} of ${formatNumber(filteredTransactions.length)} results.`}
        meta={`Loaded ${formatNumber(transactions.length)} of ${formatNumber(serverTotal || transactions.length)} records for full-list filtering.`}
        actions={
          <>
            <MobileReportExportButton mode="icon" label="Export report" options={transactionReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
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
          title="No matching transactions"
          description="Try a different search, status, payment type, date range, or amount filter."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('');
            setStatus('all');
            setPaymentType('all');
            setStartDate('');
            setEndDate('');
            setMinAmount('');
            setMaxAmount('');
          }}
        />
      )}

      {visibleCount < filteredTransactions.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredTransactions.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <RevenueFilterSheet
        visible={filterOpen}
        paymentType={paymentType}
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

type RevenueFilterSheetProps = {
  visible: boolean;
  paymentType: string;
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

function RevenueFilterSheet({
  visible,
  paymentType,
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
}: RevenueFilterSheetProps) {
  return (
    <MobileSheet
      visible={visible}
      title="Filter transactions"
      description="Filter the full loaded ledger, not only the visible rows."
      onClose={onClose}
    >
      <View style={styles.filterFields}>
        <MobileSelect label="Payment type" value={paymentType} options={paymentTypeOptions} onChange={onPaymentTypeChange} />
        <View style={styles.twoColumns}>
          <MobileTextInput
            label="Start date"
            value={startDate}
            onChangeText={onStartDateChange}
            placeholder="YYYY-MM-DD"
            helperText="Optional"
            icon={CalendarDays}
            autoCapitalize="none"
          />
          <MobileTextInput
            label="End date"
            value={endDate}
            onChangeText={onEndDateChange}
            placeholder="YYYY-MM-DD"
            helperText="Optional"
            icon={CalendarDays}
            autoCapitalize="none"
          />
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

function parseAmountFilter(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

const styles = StyleSheet.create({
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
