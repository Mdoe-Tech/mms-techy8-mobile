import { router } from 'expo-router';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
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
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getAssociationZenoPayTransactions,
  getUnreconciledZenoPayTransactions,
  reconcileZenoPayTransaction,
  type ZenoPayTransaction,
} from '@/services/zenopay-transaction-service';
import { statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type ViewTab = 'reconcile' | 'history';
type StatusFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'CANCELLED';
type SortOption = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'statusAsc' | 'typeAsc' | 'referenceAsc';

const HISTORY_PAGE_SIZE = 20;
const statusFilterLabels: Record<StatusFilter, string> = {
  ALL: 'All',
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
const sortOptions = [
  { value: 'dateDesc', label: 'Newest first', description: 'Most recent gateway transactions first.' },
  { value: 'dateAsc', label: 'Oldest first', description: 'Oldest gateway transactions first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest payments first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest payments first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group transactions by gateway status.' },
  { value: 'typeAsc', label: 'Payment type', description: 'Group by loan, wallet, shares, or other type.' },
  { value: 'referenceAsc', label: 'Gateway reference', description: 'Alphabetical reference order.' },
];

export default function MobilePaymentReconciliationScreen() {
  const { activeView, associationId } = useAuth();
  const theme = useNaneTheme();
  const [viewTab, setViewTab] = useState<ViewTab>('reconcile');
  const [unreconciled, setUnreconciled] = useState<ZenoPayTransaction[]>([]);
  const [historyRows, setHistoryRows] = useState<ZenoPayTransaction[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalElements, setHistoryTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortValue, setSortValue] = useState<SortOption>('dateDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [confirmTransaction, setConfirmTransaction] = useState<ZenoPayTransaction | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadUnreconciled = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before reconciling gateway transactions.');
        return;
      }
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        setUnreconciled(await getUnreconciledZenoPayTransactions(associationId));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setUnreconciled([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  const loadHistory = useCallback(
    async (page = 0, mode: 'load' | 'refresh' = 'load') => {
      if (!associationId) return;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setHistoryLoading(true);
      }
      setError(null);
      try {
        const history = await getAssociationZenoPayTransactions(associationId, page, HISTORY_PAGE_SIZE);
        setHistoryRows(history.content);
        setHistoryPage(history.number);
        setHistoryTotalPages(Math.max(history.totalPages || 1, 1));
        setHistoryTotalElements(history.totalElements);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setHistoryRows([]);
      } finally {
        setHistoryLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadUnreconciled();
    });
    return () => {
      active = false;
    };
  }, [loadUnreconciled]);

  useEffect(() => {
    if (viewTab !== 'history' || historyRows.length > 0 || historyLoading) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadHistory(0);
    });
    return () => {
      active = false;
    };
  }, [historyLoading, historyRows.length, loadHistory, viewTab]);

  useEffect(() => {
    if (!associationId || historyRows.length > 0 || historyLoading) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadHistory(0);
    });
    return () => {
      active = false;
    };
  }, [associationId, historyLoading, historyRows.length, loadHistory]);

  const activeRows = viewTab === 'reconcile' ? unreconciled : historyRows;
  const totalUnreconciledValue = unreconciled.reduce((sum, transaction) => sum + amountNumber(transaction), 0);
  const historyStats = useMemo(
    () => ({
      completed: historyRows.filter((transaction) => String(transaction.status || '').toUpperCase() === 'COMPLETED').length,
      failed: historyRows.filter((transaction) => String(transaction.status || '').toUpperCase() === 'FAILED').length,
      reconciled: historyRows.filter((transaction) => Boolean(transaction.isReconciled)).length,
      pending: historyRows.filter((transaction) => String(transaction.status || '').toUpperCase() === 'PENDING').length,
    }),
    [historyRows],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: activeRows.length,
      COMPLETED: 0,
      PENDING: 0,
      PROCESSING: 0,
      FAILED: 0,
      CANCELLED: 0,
    };
    activeRows.forEach((transaction) => {
      const status = String(transaction.status || '').toUpperCase() as StatusFilter;
      if (status in counts) counts[status] += 1;
    });
    return counts;
  }, [activeRows]);

  const visibleRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = activeRows.filter((transaction) => {
      const matchesStatus = statusFilter === 'ALL' || String(transaction.status || '').toUpperCase() === statusFilter;
      const haystack = [
        transaction.internalReference,
        transaction.orderId,
        transaction.reference,
        transaction.description,
        transaction.paymentMethod,
        transaction.entityType,
        transaction.status,
        transaction.amount,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortTransactions(filtered, sortValue);
  }, [activeRows, searchTerm, sortValue, statusFilter]);

  const refreshActiveTab = () => {
    if (viewTab === 'history') {
      void loadHistory(historyPage, 'refresh');
    } else {
      void loadUnreconciled('refresh');
    }
  };

  const reconcileSelected = async () => {
    if (!confirmTransaction) return;
    setReconcilingId(confirmTransaction.id);
    setConfirmTransaction(null);
    setError(null);
    setLastResult(null);
    try {
      const updated = await reconcileZenoPayTransaction(confirmTransaction);
      setUnreconciled((current) => current.filter((transaction) => transaction.id !== confirmTransaction.id));
      setLastResult(`${referenceLabel(updated || confirmTransaction)} has been reconciled.`);
      if (viewTab === 'history') {
        void loadHistory(historyPage, 'refresh');
      }
    } catch (reconcileError) {
      setError(getApiErrorMessage(reconcileError));
    } finally {
      setReconcilingId(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Payment reconciliation"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading gateway transactions" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Wallet & Payments"
        title="Payment reconciliation"
        subtitle="Review missed gateway callbacks and payment history"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh transactions"
            variant="secondary"
            disabled={refreshing || historyLoading || Boolean(reconcilingId)}
            onPress={refreshActiveTab}
          />
        }
      />

      {error ? <MobileErrorState title="Reconciliation issue" description={error} retryLabel="Refresh" onRetry={refreshActiveTab} /> : null}
      {lastResult ? <MobileStatusBadge status="Completed" label={lastResult} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Action required"
            value={String(unreconciled.length)}
            description="Gateway payments awaiting review"
            tone={unreconciled.length > 0 ? 'orange' : 'green'}
            icon={AlertCircle}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Pending value"
            value={formatCurrency(totalUnreconciledValue)}
            description="Total unreconciled amount"
            tone="blue"
            icon={WalletCards}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="History loaded"
            value={String(historyTotalElements || historyRows.length)}
            description={historyRows.length ? `Page ${historyPage + 1} of ${historyTotalPages}` : 'Open history to load'}
            tone="purple"
            icon={History}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Completed"
            value={String(historyStats.completed)}
            description={`${historyStats.reconciled} confirmed on loaded page`}
            tone="green"
            icon={CheckCircle2}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        value={viewTab}
        onChange={(value) => {
          setViewTab(value as ViewTab);
          setStatusFilter('ALL');
        }}
        tabs={[
          { value: 'reconcile', label: 'Action required', count: unreconciled.length },
          { value: 'history', label: 'History', count: historyTotalElements || historyRows.length },
        ]}
      />

      <MobileSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={viewTab === 'reconcile' ? 'Search missed payments...' : 'Search loaded history...'}
        filterLabel="Sort"
        onFilterPress={() => setSortOpen(true)}
      />

      <MobileStatusTabs
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        tabs={(Object.keys(statusFilterLabels) as StatusFilter[]).map((status) => ({
          value: status,
          label: statusFilterLabels[status],
          count: statusCounts[status],
        }))}
      />

      {viewTab === 'reconcile' ? (
        <MobileCard compact accent={unreconciled.length > 0 ? 'orange' : 'green'}>
          <View style={styles.noticeRow}>
            <View style={[styles.noticeIcon, { backgroundColor: unreconciled.length > 0 ? theme.colors.kpi.orange : theme.colors.kpi.green }]}>
              {unreconciled.length > 0 ? (
                <AlertCircle color={theme.colors.onPrimary} size={20} strokeWidth={2.5} />
              ) : (
                <ShieldCheck color={theme.colors.onPrimary} size={20} strokeWidth={2.5} />
              )}
            </View>
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                {unreconciled.length > 0 ? 'Review before recording' : 'All caught up'}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {unreconciled.length > 0
                  ? 'Reconciliation verifies the gateway payment and records it in the matching finance or loan workflow.'
                  : 'There are no completed or pending gateway transactions waiting for reconciliation.'}
              </MobileText>
            </View>
          </View>
        </MobileCard>
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold">
            {viewTab === 'reconcile' ? 'Payments needing action' : 'Gateway history'}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {viewTab === 'history'
              ? `Showing ${visibleRows.length} loaded records from page ${historyPage + 1}.`
              : `${visibleRows.length} of ${unreconciled.length} records visible.`}
          </MobileText>
        </View>
        {historyLoading || refreshing ? <MobileStatusBadge status="Processing" label="Loading" tone="warning" /> : null}
      </View>

      {viewTab === 'history' && historyLoading && historyRows.length === 0 ? (
        <MobilePageLoadingState kind="list" message="Loading payment history" />
      ) : visibleRows.length > 0 ? (
        <View style={styles.list}>
          {visibleRows.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              showReconcileAction={viewTab === 'reconcile'}
              reconciling={reconcilingId === transaction.id}
              onReconcile={() => setConfirmTransaction(transaction)}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title={viewTab === 'reconcile' ? 'No payments waiting' : 'No history found'}
          description={
            viewTab === 'reconcile'
              ? 'There are no unreconciled gateway transactions matching the current filters.'
              : 'No loaded gateway history rows match the current search or status filter.'
          }
          actionLabel="Refresh"
          onAction={refreshActiveTab}
        />
      )}

      {viewTab === 'history' ? (
        <MobileCard compact>
          <View style={styles.pagerRow}>
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                History page {historyPage + 1} of {historyTotalPages}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {historyStats.pending} pending, {historyStats.failed} failed on the loaded page.
              </MobileText>
            </View>
            <View style={styles.pagerActions}>
              <MobileButton
                label="Prev"
                size="sm"
                variant="secondary"
                disabled={historyPage <= 0 || historyLoading}
                onPress={() => void loadHistory(Math.max(0, historyPage - 1))}
              />
              <MobileButton
                label="Next"
                size="sm"
                variant="secondary"
                disabled={historyPage >= historyTotalPages - 1 || historyLoading}
                onPress={() => void loadHistory(historyPage + 1)}
              />
            </View>
          </View>
        </MobileCard>
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />
      <MobileConfirmSheet
        visible={Boolean(confirmTransaction)}
        title="Reconcile payment?"
        description={
          confirmTransaction
            ? `${referenceLabel(confirmTransaction)} will be verified and recorded in the matching ${labelFromCode(confirmTransaction.entityType).toLowerCase()} workflow.`
            : ''
        }
        confirmLabel="Reconcile"
        onCancel={() => setConfirmTransaction(null)}
        onConfirm={reconcileSelected}
      />
    </MobileScreen>
  );
}

function TransactionCard({
  transaction,
  showReconcileAction,
  reconciling,
  onReconcile,
}: {
  transaction: ZenoPayTransaction;
  showReconcileAction: boolean;
  reconciling: boolean;
  onReconcile: () => void;
}) {
  const theme = useNaneTheme();
  const typeLabel = labelFromCode(transaction.entityType);
  const status = String(transaction.status || 'Unknown');
  const amount = amountNumber(transaction);

  return (
    <MobileCard compact accent={toneForTransaction(transaction)}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {referenceLabel(transaction)}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {transaction.description || transaction.paymentMethod || typeLabel}
          </MobileText>
        </View>
        <MobileText variant="body" weight="bold" style={{ color: theme.colors.text }}>
          {formatCurrencyValue(amount, transaction.currency)}
        </MobileText>
      </View>

      <View style={styles.badgeRow}>
        <MobileStatusBadge status={status} tone={statusToneFor(status)} />
        <MobileStatusBadge status="Published" label={typeLabel} tone="info" showDot={false} />
        {transaction.isReconciled ? (
          <MobileStatusBadge status="Completed" label="Reconciled" tone="success" />
        ) : (
          <MobileStatusBadge status="Pending" label="Not reconciled" tone="warning" />
        )}
      </View>

      <MobileInfoRow
        label="Created"
        value={formatDate(transaction.createdAt)}
        helper={transaction.completedAt ? `Completed ${formatDate(transaction.completedAt)}` : 'Gateway completion time not recorded'}
        icon={Clock3}
      />
      <MobileInfoRow
        label="Payment method"
        value={labelFromCode(transaction.paymentMethod)}
        helper={transaction.orderId || transaction.reference || 'No external reference recorded'}
        icon={CreditCard}
      />

      {showReconcileAction ? (
        <View style={styles.actionRow}>
          <MobileButton
            label="Reconcile"
            icon={SearchCheck}
            loading={reconciling}
            disabled={reconciling}
            onPress={onReconcile}
            fullWidth
          />
        </View>
      ) : null}
    </MobileCard>
  );
}

function sortTransactions(rows: ZenoPayTransaction[], sortValue: SortOption) {
  return [...rows].sort((left, right) => {
    if (sortValue === 'amountDesc' || sortValue === 'amountAsc') {
      return compareNumbers(amountNumber(left), amountNumber(right), sortValue === 'amountDesc' ? 'desc' : 'asc');
    }
    if (sortValue === 'statusAsc') return compareStrings(left.status, right.status);
    if (sortValue === 'typeAsc') return compareStrings(left.entityType, right.entityType);
    if (sortValue === 'referenceAsc') return compareStrings(referenceLabel(left), referenceLabel(right));
    return compareNumbers(timestamp(left), timestamp(right), sortValue === 'dateAsc' ? 'asc' : 'desc');
  });
}

function compareNumbers(left: number, right: number, direction: 'asc' | 'desc') {
  return direction === 'asc' ? left - right : right - left;
}

function compareStrings(left?: string | null, right?: string | null) {
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function amountNumber(transaction: ZenoPayTransaction) {
  const amount = Number(transaction.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function timestamp(transaction: ZenoPayTransaction) {
  const date = new Date(transaction.createdAt || transaction.completedAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function referenceLabel(transaction: ZenoPayTransaction) {
  return transaction.internalReference || transaction.reference || transaction.orderId || 'Gateway transaction';
}

function labelFromCode(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrencyValue(amount: number, currency?: string | null) {
  const safeCurrency = /^[A-Z]{3}$/.test(String(currency || '').toUpperCase()) ? String(currency).toUpperCase() : 'TZS';
  return formatCurrency(amount, safeCurrency);
}

function toneForTransaction(transaction: ZenoPayTransaction) {
  const type = String(transaction.entityType || '').toUpperCase();
  const status = String(transaction.status || '').toUpperCase();
  if (status === 'FAILED' || status === 'CANCELLED') return 'red';
  if (transaction.isReconciled) return 'green';
  if (type.includes('LOAN')) return 'purple';
  if (type.includes('WALLET')) return 'teal';
  if (status === 'PENDING' || status === 'PROCESSING') return 'orange';
  return 'blue';
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noticeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  list: {
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRow: {
    marginTop: 2,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pagerActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
