import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Filter,
  RefreshCw,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
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
  MobileSummaryPanel,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  exportSystemAdminFinanceTransactionsCsv,
  listSystemAdminFinanceTransactions,
  type SystemAdminFinanceFilters,
  type SystemAdminFinancePage,
  type SystemAdminFinanceTransaction,
} from '@/services/system-admin-finance-service';
import { labelFromStatus, statusToneFor, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type FinanceStatusTab = 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED';
type FinanceSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'status';
type FinanceMode = 'detail' | 'filters';

type FinanceDraftFilters = {
  from: string;
  to: string;
};

type MobileSystemAdminFinanceScreenProps = {
  initialStatus?: FinanceStatusTab;
  initialMode?: FinanceMode;
};

const statusTabs: { value: FinanceStatusTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'FAILED', label: 'Failed' },
];

const sortOptions = [
  { value: 'date-desc', label: 'Newest first', description: 'Latest transaction date first.' },
  { value: 'date-asc', label: 'Oldest first', description: 'Earliest transaction date first.' },
  { value: 'amount-desc', label: 'Highest amount', description: 'Largest TZS values first.' },
  { value: 'amount-asc', label: 'Lowest amount', description: 'Smallest TZS values first.' },
  { value: 'status', label: 'Status priority', description: 'Paid, pending, overdue, then failed.' },
];

const emptyFilters: FinanceDraftFilters = {
  from: '',
  to: '',
};

export default function MobileSystemAdminFinanceScreen({
  initialStatus = 'ALL',
  initialMode,
}: MobileSystemAdminFinanceScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeStatus, setActiveStatus] = useState<FinanceStatusTab>(initialStatus);
  const [rows, setRows] = useState<SystemAdminFinanceTransaction[]>([]);
  const [allRows, setAllRows] = useState<SystemAdminFinanceTransaction[]>([]);
  const [page, setPage] = useState<SystemAdminFinancePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FinanceDraftFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FinanceDraftFilters>(emptyFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(initialMode === 'filters');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortValue, setSortValue] = useState<FinanceSort>('date-desc');
  const [selectedTransaction, setSelectedTransaction] = useState<SystemAdminFinanceTransaction | null>(null);
  const initialLoadRef = useRef(true);
  const handledInitialModeRef = useRef(false);

  const loadFinance = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      const baseFilters: SystemAdminFinanceFilters = {
        page: 0,
        size: 250,
        q: cleanString(searchTerm),
        from: cleanString(filters.from),
        to: cleanString(filters.to),
      };

      try {
        const [nextPage, nextAllPage] = await Promise.all([
          listSystemAdminFinanceTransactions({
            ...baseFilters,
            status: activeStatus === 'ALL' ? undefined : activeStatus,
          }),
          listSystemAdminFinanceTransactions(baseFilters),
        ]);
        setRows(nextPage.content);
        setAllRows(nextAllPage.content);
        setPage(nextPage);
        if (mode === 'refresh') setNotice('Financial transactions refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        if (mode === 'initial') {
          setRows([]);
          setAllRows([]);
          setPage(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStatus, filters.from, filters.to, searchTerm],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void Promise.resolve()
        .then(() => loadFinance(initialLoadRef.current ? 'initial' : 'refresh'))
        .then(() => {
          initialLoadRef.current = false;
        });
    }, searchTerm ? 320 : 0);
    return () => clearTimeout(timer);
  }, [loadFinance, searchTerm]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !initialMode) return;
    handledInitialModeRef.current = true;
    if (initialMode === 'detail') {
      const target = rows[0] || allRows[0];
      if (target) {
        void Promise.resolve().then(() => setSelectedTransaction(target));
      }
    }
  }, [allRows, initialMode, loading, rows]);

  const dashboardRows = allRows.length ? allRows : rows;
  const stats = useMemo(() => aggregateFinanceRows(dashboardRows), [dashboardRows]);
  const visibleRows = useMemo(() => sortFinanceRows(rows, sortValue), [rows, sortValue]);
  const listItems = useMemo<MobileDataListItem[]>(() => visibleRows.map(financeListItem), [visibleRows]);
  const activeFilterCount = [filters.from, filters.to].filter(Boolean).length;
  const successRate = stats.total ? Math.round((stats.paid / stats.total) * 100) : 0;
  const totalLoadedLabel = page ? `${formatNumber(rows.length)} of ${formatNumber(page.totalElements)}` : formatNumber(rows.length);
  const health = financeHealth(stats);

  const tabs = useMemo(
    () =>
      statusTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: countForStatus(tab.value, stats),
      })),
    [stats],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Financial transactions" description="Cross-tenant finance monitoring is available only to system administrators." />;
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading financial transactions" />;
  }

  if (error && rows.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform finance"
          title="Financial transactions"
          subtitle="Cross-tenant transaction monitoring"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadFinance('refresh')} />}
        />
        <MobileErrorState title="Finance unavailable" description={error} retryLabel="Retry" onRetry={() => void loadFinance('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform finance"
        title="Financial transactions"
        subtitle={user?.fullName ? `${user.fullName} · cross-tenant register` : 'Cross-tenant register'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh transactions" variant="secondary" disabled={refreshing} onPress={() => void loadFinance('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Finance" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title={health.title}
        value={formatCurrency(stats.totalAmount)}
        description={`${totalLoadedLabel} loaded · ${formatNumber(stats.paid)} paid · ${formatNumber(stats.atRisk)} at risk`}
        tone={health.tone}
        icon={Receipt}
        footer={<MobileProgressBar value={successRate} label="Paid success rate" tone={health.progressTone} />}
      />

      <MobileStatusTabs tabs={tabs} value={activeStatus} onChange={(value) => setActiveStatus(value as FinanceStatusTab)} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find transactions" />

      <View style={styles.actionsRow}>
        <MobileButton
          label={activeFilterCount ? `Filters ${activeFilterCount}` : 'Filters'}
          icon={Filter}
          size="sm"
          variant={activeFilterCount ? 'primary' : 'secondary'}
          onPress={() => {
            setDraftFilters(filters);
            setFilterSheetOpen(true);
          }}
        />
        <MobileButton label="Sort" icon={SlidersHorizontal} size="sm" variant="secondary" onPress={() => setSortSheetOpen(true)} />
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!dashboardRows.length} onPress={() => void exportRows()} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const transaction = visibleRows.find((row) => row.id === item.id);
            if (transaction) setSelectedTransaction(transaction);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No transactions found"
          description={searchTerm || activeStatus !== 'ALL' || activeFilterCount ? 'Adjust search, status, or date filters.' : 'No cross-tenant finance transactions are available yet.'}
          actionLabel={searchTerm || activeStatus !== 'ALL' || activeFilterCount ? 'Reset filters' : undefined}
          onAction={searchTerm || activeStatus !== 'ALL' || activeFilterCount ? resetAllFilters : undefined}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Loaded" value={totalLoadedLabel} description="Current server result" tone="blue" icon={BarChart3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatNumber(stats.paid)} description={`${successRate}% success rate`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(stats.pending)} description="Awaiting processing" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="At risk" value={formatNumber(stats.atRisk)} description="Overdue or failed" tone={stats.atRisk ? 'red' : 'slate'} icon={AlertTriangle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
      {renderFilterSheet()}
      <MobileSortSheet
        visible={sortSheetOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as FinanceSort)}
        onClose={() => setSortSheetOpen(false)}
      />
    </MobileScreen>
  );

  function renderDetailSheet() {
    const transaction = selectedTransaction;
    return (
      <MobileSheet
        visible={Boolean(transaction)}
        title="Transaction details"
        description={transaction?.associationName || shortId(transaction?.id)}
        onClose={() => setSelectedTransaction(null)}
      >
        {transaction ? (
          <>
            <MobileInfoRow label="Association" value={transaction.associationName || 'Unknown association'} helper={transaction.associationId || transaction.schema || undefined} icon={Building2} />
            <MobileInfoRow label="Member" value={transaction.memberName || 'Unknown member'} helper={transaction.membershipNumber || transaction.memberId || undefined} icon={UserRound} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(transaction.amount))} helper={transaction.currency || 'TZS'} icon={WalletCards} status={transaction.paymentStatus || 'Unknown'} />
            <MobileInfoRow label="Transaction date" value={formatDate(transaction.transactionDate)} helper={transaction.fineCategory || transaction.description || undefined} icon={CalendarDays} />
            <MobileInfoRow label="Gateway" value={transaction.zenoInternalRef || 'No gateway reference'} helper={transaction.paymentMethod || transaction.referenceType || undefined} icon={CreditCard} status={transaction.zenoStatus || undefined} />
            <MobileInfoRow label="Reference" value={transaction.referenceId || shortId(transaction.id)} helper={transaction.referenceType || transaction.schema || undefined} icon={FileText} />
            {transaction.description ? <MobileInfoRow label="Description" value={transaction.description} icon={Receipt} /> : null}
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderFilterSheet() {
    return (
      <MobileSheet
        visible={filterSheetOpen}
        title="Filter transactions"
        description="Use server-side filters across tenant finance records."
        onClose={() => setFilterSheetOpen(false)}
      >
        <MobileFormSection title="Date range" description="Use YYYY-MM-DD format to match the backend finance endpoint.">
          <MobileTextInput label="From date" value={draftFilters.from} onChangeText={(value) => setDraftFilters((current) => ({ ...current, from: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <MobileTextInput label="To date" value={draftFilters.to} onChangeText={(value) => setDraftFilters((current) => ({ ...current, to: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <View style={styles.actionsRow}>
            <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={() => setDraftFilters(emptyFilters)} />
            <MobileButton
              label="Apply"
              icon={Filter}
              fullWidth
              style={styles.flexButton}
              onPress={() => {
                setFilters(draftFilters);
                setFilterSheetOpen(false);
              }}
            />
          </View>
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function resetAllFilters() {
    setSearchTerm('');
    setActiveStatus('ALL');
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
  }

  async function exportRows() {
    if (!dashboardRows.length) return;
    setExporting(true);
    setError(null);
    try {
      const csv = await exportSystemAdminFinanceTransactionsCsv({
        q: cleanString(searchTerm),
        status: activeStatus === 'ALL' ? undefined : activeStatus,
        from: cleanString(filters.from),
        to: cleanString(filters.to),
      });
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-finance-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share finance transactions export' });
      }
      setNotice('Finance export prepared.');
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }
}

function financeListItem(transaction: SystemAdminFinanceTransaction): MobileDataListItem {
  const status = transaction.paymentStatus || 'UNKNOWN';
  return {
    id: transaction.id,
    title: transaction.associationName || transaction.schema || 'Unknown association',
    subtitle: transaction.memberName || transaction.description || 'Unknown member',
    meta: `${formatDate(transaction.transactionDate)} · ${transaction.fineCategory || transaction.referenceType || 'Transaction'}`,
    amount: formatCurrency(toNumber(transaction.amount)),
    status,
    statusLabel: labelFromStatus(status),
    statusTone: financeStatusTone(status),
    accent: financeStatusTone(status),
    initials: initialsFromName(transaction.associationName || transaction.memberName || transaction.schema || 'FT'),
  };
}

function aggregateFinanceRows(rows: SystemAdminFinanceTransaction[]) {
  return rows.reduce(
    (acc, row) => {
      const status = String(row.paymentStatus || '').toUpperCase();
      const amount = toNumber(row.amount);
      acc.total += 1;
      acc.totalAmount += amount;
      if (isPaidStatus(status)) {
        acc.paid += 1;
        acc.paidAmount += amount;
      } else if (isPendingStatus(status)) {
        acc.pending += 1;
      } else if (status.includes('OVERDUE')) {
        acc.overdue += 1;
        acc.atRisk += 1;
      } else if (status.includes('FAILED') || status.includes('FAIL')) {
        acc.failed += 1;
        acc.atRisk += 1;
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0, overdue: 0, failed: 0, atRisk: 0, totalAmount: 0, paidAmount: 0 },
  );
}

function countForStatus(status: FinanceStatusTab, stats: ReturnType<typeof aggregateFinanceRows>) {
  if (status === 'ALL') return stats.total;
  if (status === 'PAID') return stats.paid;
  if (status === 'PENDING') return stats.pending;
  if (status === 'OVERDUE') return stats.overdue;
  if (status === 'FAILED') return stats.failed;
  return 0;
}

function sortFinanceRows(rows: SystemAdminFinanceTransaction[], sortValue: FinanceSort) {
  const next = [...rows];
  next.sort((a, b) => {
    if (sortValue === 'date-asc') return timestamp(a.transactionDate) - timestamp(b.transactionDate);
    if (sortValue === 'amount-desc') return toNumber(b.amount) - toNumber(a.amount);
    if (sortValue === 'amount-asc') return toNumber(a.amount) - toNumber(b.amount);
    if (sortValue === 'status') return statusPriority(a.paymentStatus) - statusPriority(b.paymentStatus);
    return timestamp(b.transactionDate) - timestamp(a.transactionDate);
  });
  return next;
}

function financeHealth(stats: ReturnType<typeof aggregateFinanceRows>): { title: string; tone: KpiTone; progressTone: KpiTone } {
  if (!stats.total) return { title: 'No activity loaded', tone: 'slate', progressTone: 'slate' };
  if (stats.atRisk > 0) return { title: 'Finance needs review', tone: 'red', progressTone: 'orange' };
  if (stats.pending > 0) return { title: 'Payments pending', tone: 'orange', progressTone: 'orange' };
  return { title: 'Finance healthy', tone: 'green', progressTone: 'green' };
}

function financeStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (isPaidStatus(normalized)) return 'success';
  if (isAtRiskStatus(normalized)) return 'danger';
  if (isPendingStatus(normalized)) return 'warning';
  return statusToneFor(normalized || 'UNKNOWN');
}

function statusPriority(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (isPaidStatus(normalized)) return 1;
  if (isPendingStatus(normalized)) return 2;
  if (isAtRiskStatus(normalized)) return 3;
  return 4;
}

function isPaidStatus(status: string) {
  return status.includes('PAID') || status.includes('COMPLETED') || status.includes('SUCCESS');
}

function isPendingStatus(status: string) {
  return status.includes('PENDING') || status.includes('PROCESSING');
}

function isAtRiskStatus(status: string) {
  return status.includes('OVERDUE') || status.includes('FAILED') || status.includes('FAIL');
}

function cleanString(value?: string | null) {
  const cleaned = String(value || '').trim();
  return cleaned || undefined;
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8).toUpperCase() : 'TRANSACTION';
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
