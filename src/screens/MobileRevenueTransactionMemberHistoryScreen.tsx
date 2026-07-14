import { router } from 'expo-router';
import {
  ArrowDownUp,
  Banknote,
  CalendarDays,
  Clock3,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileFormSection,
  MobileIconButton,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  getAllAssociationMembers,
  getAssociationMemberRevenueSummary,
  getAssociationMemberRevenueTransactions,
  type AssociationMember,
  type MemberRevenueSummary,
  type MemberRevenueTransaction,
} from '@/services/member-service';
import { labelFromPaymentType } from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type RevenueStatusFilter = 'all' | 'PAID' | 'PENDING' | 'OVERDUE' | 'UNPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED';

const MEMBER_LOAD_COUNT = 5;
const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

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
  { value: 'amount,desc', label: 'Highest amount', description: 'Largest transaction value first.' },
  { value: 'amount,asc', label: 'Lowest amount', description: 'Smallest transaction value first.' },
  { value: 'paymentStatus,asc', label: 'Payment status', description: 'Group records by payment status.' },
  { value: 'paymentType,asc', label: 'Payment type', description: 'Group records by payment category.' },
];

export default function MobileRevenueTransactionMemberHistoryScreen() {
  const { activeView, associationId } = useAuth();
  const theme = useNaneTheme();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberVisibleCount, setMemberVisibleCount] = useState(MEMBER_LOAD_COUNT);
  const [transactions, setTransactions] = useState<MemberRevenueTransaction[]>([]);
  const [summary, setSummary] = useState<MemberRevenueSummary | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
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
      setDebouncedSearch(search.trim().toLowerCase());
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!associationId) {
        if (active) {
          setError('Association context is required before loading member transactions.');
          setMembersLoading(false);
        }
        return;
      }

      try {
        const response = await getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' });
        if (!active) return;
        const loadedMembers = response.content || [];
        setMembers(loadedMembers);
        setSelectedMemberId((current) => current || loadedMembers[0]?.id || null);
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError));
          setMembers([]);
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [associationId]);

  const loadMemberData = useCallback(
    async (memberId: string, mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setTransactionsLoading(true);
      }
      setError(null);

      try {
        const [loadedTransactions, loadedSummary] = await Promise.all([
          getAssociationMemberRevenueTransactions(memberId),
          getAssociationMemberRevenueSummary(memberId),
        ]);
        setTransactions((loadedTransactions || []).filter((transaction) => Boolean(transaction?.id)));
        setSummary(loadedSummary || null);
      } catch (loadError) {
        setTransactions([]);
        setSummary(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setTransactionsLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedMemberId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadMemberData(selectedMemberId);
    });
    return () => {
      active = false;
    };
  }, [loadMemberData, selectedMemberId]);

  const selectedMember = useMemo(() => members.find((member) => member.id === selectedMemberId) || null, [members, selectedMemberId]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (!query) return true;
      return (
        String(member.fullLegalName || '').toLowerCase().includes(query) ||
        String(member.membershipNumber || '').toLowerCase().includes(query) ||
        String(member.contactInfo?.email || '').toLowerCase().includes(query)
      );
    });
  }, [memberSearch, members]);

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
      { value: 'CANCELLED', label: 'Cancelled', count: statusCounts.get('CANCELLED') || 0 },
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

  const detailRoute = getRouteByPath('/associations/revenue-transactions/:id');

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member transaction history"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (membersLoading) {
    return <MobilePageLoadingState kind="form" message="Loading members" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Member transactions"
        subtitle={selectedMember ? selectedMember.fullLegalName || selectedMember.membershipNumber || 'Selected member' : 'Select a member'}
        onBack={() => router.back()}
        rightAction={
          selectedMemberId ? (
            <MobileIconButton
              icon={RefreshCw}
              label="Refresh member transactions"
              variant="secondary"
              disabled={refreshing || transactionsLoading}
              onPress={() => selectedMemberId && void loadMemberData(selectedMemberId, 'refresh')}
            />
          ) : undefined
        }
      />

      {error ? <MobileStatusBadge status="History issue" label={error} tone="warning" /> : null}

      <MobileFormSection title="Member selection" description="Choose a member to inspect their transaction history.">
        <MobileSearchToolbar
          value={memberSearch}
          onChange={(value) => {
            setMemberSearch(value);
            setMemberVisibleCount(MEMBER_LOAD_COUNT);
          }}
          placeholder="Search members..."
        />
        <View style={styles.memberList}>
          {filteredMembers.slice(0, memberVisibleCount).map((member) => {
            const selected = member.id === selectedMemberId;
            return (
              <Pressable
                key={member.id}
                onPress={() => {
                  setSelectedMemberId(member.id);
                  setSearch('');
                  setStatus('all');
                  setVisibleCount(INITIAL_VISIBLE_COUNT);
                }}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.flex}>
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {member.fullLegalName || member.membershipNumber || 'Unknown member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={1}>
                    {member.contactInfo?.email || 'No email'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={selected ? 'Selected' : member.status || 'Active'} label={selected ? 'Selected' : member.status || 'Ready'} tone={selected ? 'primary' : undefined} />
              </Pressable>
            );
          })}
        </View>
        {memberVisibleCount < filteredMembers.length ? (
          <MobileButton label="Load more members" variant="secondary" fullWidth onPress={() => setMemberVisibleCount((current) => current + MEMBER_LOAD_COUNT)} />
        ) : null}
      </MobileFormSection>

      {selectedMemberId ? (
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
      ) : null}

      {selectedMemberId ? (
        <>
          <MobileSearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search history..."
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
            title="Member ledger"
            subtitle={`Showing ${formatNumber(Math.min(visibleCount, filteredTransactions.length))} of ${formatNumber(filteredTransactions.length)} results.`}
            meta={`Filters run across all ${formatNumber(transactions.length)} loaded member transactions.`}
            actions={
              <>
                <MobileIconButton icon={ArrowDownUp} label="Sort member transactions" variant="secondary" onPress={() => setSortOpen(true)} />
                <MobileIconButton
                  icon={RefreshCw}
                  label="Refresh member transactions"
                  variant="secondary"
                  disabled={refreshing || transactionsLoading}
                  onPress={() => selectedMemberId && void loadMemberData(selectedMemberId, 'refresh')}
                />
              </>
            }
          />

          {transactionsLoading ? <MobileLoadingState compact message="Loading member transactions" /> : null}

          {!transactionsLoading && listItems.length ? (
            <MobileDataList
              items={listItems}
              onPressItem={(item) => {
                if (detailRoute) {
                  router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, id: item.id } } as never);
                }
              }}
            />
          ) : null}

          {!transactionsLoading && !listItems.length ? (
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
          ) : null}

          {visibleCount < filteredTransactions.length ? (
            <MobileButton
              label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredTransactions.length - visibleCount))} more`}
              variant="secondary"
              fullWidth
              onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
            />
          ) : null}
        </>
      ) : (
        <MobileEmptyState title="No member selected" description="Select a member above to view their transaction history." />
      )}

      <MemberHistoryFilterSheet
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

type MemberHistoryFilterSheetProps = {
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

function MemberHistoryFilterSheet({
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
}: MemberHistoryFilterSheetProps) {
  return (
    <MobileSheet
      visible={visible}
      title="Filter member transactions"
      description="These filters apply to the full loaded member history, not just visible rows."
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
  memberList: {
    gap: 8,
  },
  memberRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
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
