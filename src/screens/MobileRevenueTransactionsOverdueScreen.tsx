import { router } from 'expo-router';
import {
  ArrowDownUp,
  Banknote,
  Clock3,
  FileWarning,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
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
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  getAllAssociationRevenueTransactions,
  getAssociationOverdueTransactions,
  getRevenueTransactionTotal,
  labelFromPaymentType,
  type RevenueOverdueResponse,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type OverdueTab = 'fines' | 'penalties' | 'overdue_payments';

const INITIAL_VISIBLE_COUNT = 14;
const LOAD_MORE_COUNT = 14;

const sortOptions = [
  { value: 'dueDate,asc', label: 'Due soonest', description: 'Earliest due date first.' },
  { value: 'dueDate,desc', label: 'Due latest', description: 'Latest due date first.' },
  { value: 'amount,desc', label: 'Highest amount', description: 'Largest remaining amount first.' },
  { value: 'amount,asc', label: 'Lowest amount', description: 'Smallest remaining amount first.' },
  { value: 'member,asc', label: 'Member name', description: 'Alphabetical member order.' },
  { value: 'status,asc', label: 'Payment status', description: 'Group records by status.' },
];

export default function MobileRevenueTransactionsOverdueScreen() {
  const { activeView, associationId } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [overdueData, setOverdueData] = useState<RevenueOverdueResponse | null>(null);
  const [fines, setFines] = useState<RevenueTransaction[]>([]);
  const [penalties, setPenalties] = useState<RevenueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OverdueTab>('fines');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('dueDate,asc');
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
        setError('Association context is required before loading overdue transactions.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [loadedMembers, loadedOverdue, loadedFines, loadedPenalties] = await Promise.all([
          getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
          getAssociationOverdueTransactions(associationId, true),
          getAllAssociationRevenueTransactions({ associationId, paymentType: 'FINE', size: 250 }),
          getAllAssociationRevenueTransactions({ associationId, paymentType: 'PENALTY', size: 250 }),
        ]);

        setMembers(loadedMembers.content || []);
        setOverdueData(loadedOverdue || null);
        setFines(loadedFines.content || []);
        setPenalties(loadedPenalties.content || []);
      } catch (loadError) {
        setMembers([]);
        setOverdueData(null);
        setFines([]);
        setPenalties([]);
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

  const enrichedFines = useMemo(() => enrichTransactions(fines, memberMap, 'FINE'), [fines, memberMap]);
  const enrichedPenalties = useMemo(() => enrichTransactions(penalties, memberMap, 'PENALTY'), [memberMap, penalties]);
  const enrichedOverduePayments = useMemo(
    () => enrichTransactions(overdueData?.details?.overduePayments || [], memberMap, undefined, true),
    [memberMap, overdueData],
  );

  const filteredFines = useMemo(() => filterRows(enrichedFines, debouncedSearch), [debouncedSearch, enrichedFines]);
  const filteredPenalties = useMemo(() => filterRows(enrichedPenalties, debouncedSearch), [debouncedSearch, enrichedPenalties]);
  const filteredOverduePayments = useMemo(() => filterRows(enrichedOverduePayments, debouncedSearch), [debouncedSearch, enrichedOverduePayments]);

  const activeRows = useMemo(() => {
    const rows =
      activeTab === 'penalties'
        ? filteredPenalties
        : activeTab === 'overdue_payments'
          ? filteredOverduePayments
          : filteredFines;
    return sortRows(rows, sortBy);
  }, [activeTab, filteredFines, filteredOverduePayments, filteredPenalties, sortBy]);

  const visibleRows = useMemo(() => activeRows.slice(0, visibleCount), [activeRows, visibleCount]);

  const fineTotals = useMemo(() => calculateRegisterTotals(enrichedFines, 'FINE'), [enrichedFines]);
  const penaltyTotals = useMemo(() => calculateRegisterTotals(enrichedPenalties, 'PENALTY'), [enrichedPenalties]);
  const overduePaymentsTotal = Number(overdueData?.totals?.totalOverduePayments || 0) || 0;
  const overdueFinesTotal = Number(overdueData?.totals?.totalOverdueFines || 0) || 0;
  const overduePenaltiesTotal = Number(overdueData?.totals?.totalOverduePenalties || 0) || 0;

  const tabs = useMemo(
    () => [
      { value: 'fines', label: 'Fines', count: filteredFines.length },
      { value: 'penalties', label: 'Penalties', count: filteredPenalties.length },
      { value: 'overdue_payments', label: 'Payments', count: filteredOverduePayments.length },
    ],
    [filteredFines.length, filteredOverduePayments.length, filteredPenalties.length],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleRows.map((row) => ({
        id: row.transaction.id,
        title: row.memberName,
        subtitle: `${row.typeLabel}${row.description ? ` · ${row.description}` : ''}`,
        meta: `${row.dueDate ? `Due ${formatDate(row.dueDate)}` : 'No due date'} · ${formatDate(row.transaction.transactionDate || row.transaction.createdAt)}`,
        amount: formatTzs(row.remainingAmount),
        status: labelFromStatus(row.transaction.paymentStatus),
        statusTone: statusToneFor(row.transaction.paymentStatus),
        initials: initialsFromName(row.memberName),
        accent: row.tabTone,
      })),
    [visibleRows],
  );

  const detailRoute = getRouteByPath('/associations/revenue-transactions/:id');
  const activeTitle = activeTab === 'penalties' ? 'Penalty register' : activeTab === 'overdue_payments' ? 'Overdue payments' : 'Fine register';

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Fines and penalties"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading fines and overdue records" />;
  }

  if (error && !fines.length && !penalties.length && !overdueData) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Fines and penalties" subtitle="Overdue tracking" onBack={() => router.back()} />
        <MobileErrorState title="Overdue data could not load" description={error} retryLabel="Retry" onRetry={() => void loadData('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Fines and penalties"
        subtitle={overdueData?.timestamp ? `Updated ${formatDate(overdueData.timestamp)}` : 'Overdue tracking'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh overdue data"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadData('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh issue" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Fine balance" value={formatTzs(fineTotals.remaining)} description={`${formatNumber(enrichedFines.length)} fine records`} tone="orange" icon={FileWarning} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Penalty balance" value={formatTzs(penaltyTotals.remaining)} description={`${formatNumber(enrichedPenalties.length)} penalty records`} tone="red" icon={ShieldAlert} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue payments" value={formatTzs(overduePaymentsTotal)} description={`${formatNumber(enrichedOverduePayments.length)} payment records`} tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Endpoint overdue" value={formatTzs(overdueFinesTotal + overduePenaltiesTotal)} description="Fines and penalties from overdue endpoint" tone="slate" icon={TriangleAlert} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.summaryGrid}>
          <RegisterSummary label="Fines issued" value={formatTzs(fineTotals.issued)} helper={`${formatTzs(fineTotals.paid)} paid`} icon={Banknote} />
          <RegisterSummary label="Penalties issued" value={formatTzs(penaltyTotals.issued)} helper={`${formatTzs(penaltyTotals.paid)} paid`} icon={Clock3} />
        </View>
      </MobileCard>

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search register..."
      />

      <MobileStatusTabs
        tabs={tabs}
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value as OverdueTab);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      <MobileListHeaderCard
        title={activeTitle}
        subtitle={`Showing ${formatNumber(Math.min(visibleCount, activeRows.length))} of ${formatNumber(activeRows.length)} records.`}
        actions={
          <>
            <MobileIconButton icon={ArrowDownUp} label="Sort register" variant="secondary" onPress={() => setSortOpen(true)} />
            <MobileIconButton icon={RefreshCw} label="Refresh overdue data" variant="secondary" disabled={refreshing} onPress={() => void loadData('refresh')} />
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

type EnrichedTransaction = {
  transaction: RevenueTransaction;
  memberName: string;
  memberEmail?: string | null;
  typeLabel: string;
  description?: string | null;
  dueDate?: string | null;
  issuedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  searchText: string;
  tabTone: 'warning' | 'danger' | 'primary';
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
  icon: typeof Banknote;
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
  regularPayment = false,
): EnrichedTransaction[] {
  return transactions
    .filter((transaction) => Boolean(transaction?.id))
    .map((transaction) => {
      const member = transaction.memberId ? memberMap.get(transaction.memberId) : undefined;
      const memberName = member?.fullLegalName || transaction.memberFullName || transaction.memberName || transaction.membershipNumber || 'Unknown member';
      const paymentDetails = transaction.paymentDetails || {};
      const typeKey = preferredType && paymentDetails[preferredType] !== undefined ? preferredType : Object.keys(paymentDetails)[0];
      const remainingAmount = Number(typeKey ? paymentDetails[typeKey] || 0 : getRevenueTransactionTotal(transaction)) || 0;
      const metadata = transaction.metadata || {};
      const issuedAmount =
        preferredType === 'PENALTY'
          ? parseAmount(metadata.penaltyAmount || metadata.fineAmount) || remainingAmount
          : preferredType === 'FINE'
            ? parseAmount(metadata.fineAmount) || remainingAmount
            : remainingAmount;
      const paidAmount = String(transaction.paymentStatus || '').toUpperCase() === 'PAID' ? issuedAmount : parseAmount(metadata.deductionAmount);
      const typeLabel = regularPayment ? labelFromPaymentType(typeKey) : transaction.fineCategory || labelFromPaymentType(typeKey);
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
        memberEmail: member?.contactInfo?.email,
        typeLabel,
        description: metadata.reason || transaction.description,
        dueDate: transaction.dueDate,
        issuedAmount,
        paidAmount,
        remainingAmount,
        searchText,
        tabTone: regularPayment ? 'primary' : preferredType === 'PENALTY' ? 'danger' : 'warning',
      };
    });
}

function filterRows(rows: EnrichedTransaction[], query: string) {
  if (!query) return rows;
  return rows.filter((row) => row.searchText.includes(query) || String(row.remainingAmount).includes(query));
}

function sortRows(rows: EnrichedTransaction[], sortBy: string) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'amount,asc' || sortBy === 'amount,desc') {
      const delta = a.remainingAmount - b.remainingAmount;
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
        totals.remaining += Number(row.transaction.paymentDetails?.[paymentType] || row.remainingAmount || 0);
      }
      return totals;
    },
    { issued: 0, paid: 0, remaining: 0 },
  );
}

function parseAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  summaryGrid: {
    gap: 10,
  },
  summaryItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
