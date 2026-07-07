import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileConfirmSheet,
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
  listSystemAdminWithdrawals,
  updateSystemAdminWithdrawalStatus,
  type SystemAdminWithdrawal,
  type SystemAdminWithdrawalPage,
  type SystemAdminWithdrawalStatus,
} from '@/services/system-admin-withdrawal-service';
import { labelFromStatus, statusToneFor, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type WithdrawalTab = 'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
type WithdrawalSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'status';
type WithdrawalMode = 'detail' | 'approve' | 'reject' | 'complete' | 'filters';
type WithdrawalAction = 'APPROVED' | 'REJECTED' | 'COMPLETED';
type ActionTarget = {
  withdrawal: SystemAdminWithdrawal;
  action: WithdrawalAction;
} | null;

type DateFilters = {
  from: string;
  to: string;
};

type MobileSystemAdminWithdrawalsScreenProps = {
  initialStatus?: WithdrawalTab;
  initialMode?: WithdrawalMode;
};

const statusTabs: { value: WithdrawalTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'REJECTED', label: 'Rejected' },
];

const sortOptions = [
  { value: 'date-desc', label: 'Newest request', description: 'Latest withdrawal requests first.' },
  { value: 'date-asc', label: 'Oldest request', description: 'Earliest withdrawal requests first.' },
  { value: 'amount-desc', label: 'Highest amount', description: 'Largest withdrawal values first.' },
  { value: 'amount-asc', label: 'Lowest amount', description: 'Smallest withdrawal values first.' },
  { value: 'status', label: 'Status priority', description: 'Pending, approved, completed, rejected.' },
];

const emptyFilters: DateFilters = { from: '', to: '' };

export default function MobileSystemAdminWithdrawalsScreen({
  initialStatus = 'ALL',
  initialMode,
}: MobileSystemAdminWithdrawalsScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeTab, setActiveTab] = useState<WithdrawalTab>(initialStatus);
  const [rows, setRows] = useState<SystemAdminWithdrawal[]>([]);
  const [allRows, setAllRows] = useState<SystemAdminWithdrawal[]>([]);
  const [page, setPage] = useState<SystemAdminWithdrawalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<DateFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<DateFilters>(emptyFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(initialMode === 'filters');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortValue, setSortValue] = useState<WithdrawalSort>('date-desc');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<SystemAdminWithdrawal | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionTarget>(null);
  const [confirmAction, setConfirmAction] = useState<ActionTarget>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const initialLoadRef = useRef(true);
  const handledInitialModeRef = useRef(false);

  const loadWithdrawals = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      const baseFilters = {
        page: 0,
        size: 250,
        from: cleanString(filters.from),
        to: cleanString(filters.to),
      };

      try {
        const [nextPage, nextAllPage] = await Promise.all([
          listSystemAdminWithdrawals({
            ...baseFilters,
            status: activeTab === 'ALL' ? undefined : activeTab,
          }),
          listSystemAdminWithdrawals(baseFilters),
        ]);
        setRows(nextPage.content);
        setAllRows(nextAllPage.content);
        setPage(nextPage);
        if (mode === 'refresh') setNotice('Withdrawal requests refreshed.');
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
    [activeTab, filters.from, filters.to],
  );

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadWithdrawals(initialLoadRef.current ? 'initial' : 'refresh'))
      .then(() => {
        initialLoadRef.current = false;
      });
  }, [loadWithdrawals]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !initialMode || initialMode === 'filters') return;
    handledInitialModeRef.current = true;
    const target = rows.find((row) => actionForMode(row, initialMode)) || rows[0] || allRows.find((row) => actionForMode(row, initialMode)) || allRows[0];
    if (!target) return;
    void Promise.resolve().then(() => {
      if (initialMode === 'detail') {
        setSelectedWithdrawal(target);
        return;
      }
      const action = actionForMode(target, initialMode);
      if (action) openAction(target, action);
      else setSelectedWithdrawal(target);
    });
  }, [allRows, initialMode, loading, rows]);

  const dashboardRows = allRows.length ? allRows : rows;
  const stats = useMemo(() => aggregateWithdrawals(dashboardRows), [dashboardRows]);
  const filteredRows = useMemo(() => filterWithdrawals(rows, searchTerm), [rows, searchTerm]);
  const visibleRows = useMemo(() => sortWithdrawals(filteredRows, sortValue), [filteredRows, sortValue]);
  const listItems = useMemo<MobileDataListItem[]>(() => visibleRows.map(withdrawalListItem), [visibleRows]);
  const activeFilterCount = [filters.from, filters.to].filter(Boolean).length;
  const totalLoadedLabel = page ? `${formatNumber(rows.length)} of ${formatNumber(page.totalElements)}` : formatNumber(rows.length);
  const health = withdrawalHealth(stats);

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
    return <AccessDeniedScreen title="Withdrawal requests" description="Platform withdrawal settlement is available only to system administrators." />;
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading withdrawal requests" />;
  }

  if (error && rows.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform finance"
          title="Withdrawal requests"
          subtitle="Review and settle association withdrawals"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadWithdrawals('refresh')} />}
        />
        <MobileErrorState title="Withdrawals unavailable" description={error} retryLabel="Retry" onRetry={() => void loadWithdrawals('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform finance"
        title="Withdrawal requests"
        subtitle={user?.fullName ? `${user.fullName} · settlement queue` : 'Settlement queue'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh withdrawals" variant="secondary" disabled={refreshing} onPress={() => void loadWithdrawals('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Withdrawals" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title={health.title}
        value={formatCurrency(stats.totalAmount)}
        description={`${totalLoadedLabel} loaded · ${formatNumber(stats.pending)} pending · ${formatNumber(stats.approved)} approved`}
        tone={health.tone}
        icon={WalletCards}
      />

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as WithdrawalTab)} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find withdrawals" />

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
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!visibleRows.length} onPress={() => void exportRows()} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const withdrawal = visibleRows.find((row) => row.id === item.id);
            if (withdrawal) setSelectedWithdrawal(withdrawal);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No withdrawal requests found"
          description={searchTerm || activeTab !== 'ALL' || activeFilterCount ? 'Adjust search, status, or date filters.' : 'Association withdrawal requests will appear here for platform settlement.'}
          actionLabel={searchTerm || activeTab !== 'ALL' || activeFilterCount ? 'Reset filters' : undefined}
          onAction={searchTerm || activeTab !== 'ALL' || activeFilterCount ? resetAllFilters : undefined}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(stats.pending)} description="Need decision" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Approved" value={formatNumber(stats.approved)} description="Ready to settle" tone="blue" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(stats.completed)} description="Settled" tone="green" icon={Check} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Rejected" value={formatNumber(stats.rejected)} description="Not settled" tone={stats.rejected ? 'red' : 'slate'} icon={XCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
      {renderActionSheet()}
      {renderConfirmSheet()}
      {renderFilterSheet()}
      <MobileSortSheet
        visible={sortSheetOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as WithdrawalSort)}
        onClose={() => setSortSheetOpen(false)}
      />
    </MobileScreen>
  );

  function renderDetailSheet() {
    const withdrawal = selectedWithdrawal;
    return (
      <MobileSheet
        visible={Boolean(withdrawal)}
        title="Withdrawal request"
        description={withdrawal?.associationName || shortId(withdrawal?.id)}
        onClose={() => setSelectedWithdrawal(null)}
      >
        {withdrawal ? (
          <>
            <MobileInfoRow label="Association" value={withdrawal.associationName || 'Unknown association'} helper={withdrawal.associationId || withdrawal.schema || undefined} icon={Building2} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(withdrawal.amount), withdrawal.currency || 'TZS')} helper={withdrawal.requestNotes || 'No request notes'} icon={Banknote} status={withdrawal.status || 'Pending'} />
            <MobileInfoRow label="Requested by" value={withdrawal.requestedByName || 'Unknown requester'} helper={withdrawal.requestedByEmail || withdrawal.requestedByPhone || withdrawal.requestedByUserId || undefined} icon={UserRound} />
            <MobileInfoRow label="Created" value={formatDate(withdrawal.createdAt)} helper={withdrawal.updatedAt ? `Updated ${formatDate(withdrawal.updatedAt)}` : undefined} icon={CalendarDays} />
            {withdrawal.processedByName || withdrawal.processedAt ? (
              <MobileInfoRow label="Processed" value={withdrawal.processedByName || 'Processed'} helper={formatDate(withdrawal.processedAt)} icon={CheckCircle2} />
            ) : null}
            {withdrawal.adminNotes ? <MobileInfoRow label="Admin notes" value={withdrawal.adminNotes} icon={AlertTriangle} /> : null}
            <View style={styles.actionsRow}>
              {withdrawal.status === 'PENDING' ? (
                <>
                  <MobileButton label="Approve" icon={CheckCircle2} size="sm" onPress={() => openAction(withdrawal, 'APPROVED')} />
                  <MobileButton label="Reject" icon={XCircle} variant="danger" size="sm" onPress={() => openAction(withdrawal, 'REJECTED')} />
                </>
              ) : null}
              {withdrawal.status === 'APPROVED' ? <MobileButton label="Complete" icon={Check} size="sm" onPress={() => openAction(withdrawal, 'COMPLETED')} /> : null}
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderActionSheet() {
    const target = pendingAction;
    return (
      <MobileSheet
        visible={Boolean(target)}
        title={actionTitle(target?.action)}
        description={target?.withdrawal.associationName || 'Withdrawal action'}
        onClose={() => {
          setPendingAction(null);
          setConfirmAction(null);
        }}
      >
        {target ? (
          <MobileFormSection title="Action review" description="Confirm the association, amount, and settlement status before continuing.">
            <MobileInfoRow label="Association" value={target.withdrawal.associationName || 'Unknown association'} helper={target.withdrawal.schema || undefined} icon={Building2} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(target.withdrawal.amount), target.withdrawal.currency || 'TZS')} helper={formatDate(target.withdrawal.createdAt)} icon={Banknote} status={target.withdrawal.status || 'Pending'} />
            <MobileTextInput
              label={target.action === 'REJECTED' ? 'Rejection note' : 'Admin notes'}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder={target.action === 'REJECTED' ? 'Explain why this withdrawal is rejected' : 'Optional settlement note'}
              multiline
              numberOfLines={3}
              icon={AlertTriangle}
            />
            <MobileButton
              label={actionTitle(target.action)}
              icon={actionIcon(target.action)}
              variant={target.action === 'REJECTED' ? 'danger' : 'primary'}
              fullWidth
              disabled={!canSubmitAction(target.action, adminNotes)}
              onPress={() => setConfirmAction(target)}
            />
          </MobileFormSection>
        ) : null}
      </MobileSheet>
    );
  }

  function renderConfirmSheet() {
    const target = confirmAction;
    return (
      <MobileConfirmSheet
        visible={Boolean(target)}
        title={actionTitle(target?.action)}
        description={
          target
            ? `${actionTitle(target.action)} ${formatCurrency(toNumber(target.withdrawal.amount), target.withdrawal.currency || 'TZS')} for ${target.withdrawal.associationName || shortId(target.withdrawal.id)}.`
            : 'Confirm withdrawal update.'
        }
        confirmLabel={actionTitle(target?.action)}
        destructive={target?.action === 'REJECTED'}
        loading={processing}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void submitAction()}
      />
    );
  }

  function renderFilterSheet() {
    return (
      <MobileSheet visible={filterSheetOpen} title="Filter withdrawals" description="Use server-side date filters across tenant withdrawal records." onClose={() => setFilterSheetOpen(false)}>
        <MobileFormSection title="Date range" description="Use YYYY-MM-DD format to match the backend withdrawal endpoint.">
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

  function openAction(withdrawal: SystemAdminWithdrawal, action: WithdrawalAction) {
    setSelectedWithdrawal(null);
    setPendingAction({ withdrawal, action });
    setConfirmAction(null);
    setAdminNotes(action === 'REJECTED' ? '' : `Reviewed ${shortId(withdrawal.id)} from mobile.`);
  }

  async function submitAction() {
    if (!confirmAction || !confirmAction.withdrawal.schema || !canSubmitAction(confirmAction.action, adminNotes)) return;
    setProcessing(true);
    setError(null);
    try {
      await updateSystemAdminWithdrawalStatus(confirmAction.withdrawal.schema, confirmAction.withdrawal.id, {
        status: confirmAction.action,
        adminNotes: cleanString(adminNotes),
      });
      setNotice(`${confirmAction.withdrawal.associationName || 'Withdrawal'} marked ${labelFromStatus(confirmAction.action).toLowerCase()}.`);
      setPendingAction(null);
      setConfirmAction(null);
      setAdminNotes('');
      await loadWithdrawals('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  }

  function resetAllFilters() {
    setSearchTerm('');
    setActiveTab('ALL');
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
  }

  async function exportRows() {
    if (!visibleRows.length) return;
    setExporting(true);
    setError(null);
    try {
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, buildCsv(visibleRows));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share platform withdrawals export' });
      }
      setNotice('Withdrawal export prepared.');
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }
}

function withdrawalListItem(withdrawal: SystemAdminWithdrawal): MobileDataListItem {
  const status = withdrawal.status || 'PENDING';
  return {
    id: withdrawal.id,
    title: withdrawal.associationName || withdrawal.schema || 'Unknown association',
    subtitle: withdrawal.requestNotes || withdrawal.requestedByName || 'Association withdrawal',
    meta: `${formatDate(withdrawal.createdAt)} · ${withdrawal.requestedByName || 'Requester unknown'}`,
    amount: formatCurrency(toNumber(withdrawal.amount), withdrawal.currency || 'TZS'),
    status,
    statusLabel: labelFromStatus(status),
    statusTone: withdrawalStatusTone(status),
    accent: withdrawalStatusTone(status),
    initials: initialsFromName(withdrawal.associationName || withdrawal.schema || 'WR'),
  };
}

function aggregateWithdrawals(rows: SystemAdminWithdrawal[]) {
  return rows.reduce(
    (acc, row) => {
      const status = String(row.status || '').toUpperCase();
      acc.total += 1;
      acc.totalAmount += toNumber(row.amount);
      if (status === 'PENDING') acc.pending += 1;
      else if (status === 'APPROVED') acc.approved += 1;
      else if (status === 'COMPLETED') acc.completed += 1;
      else if (status === 'REJECTED') acc.rejected += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, completed: 0, rejected: 0, totalAmount: 0 },
  );
}

function countForStatus(status: WithdrawalTab, stats: ReturnType<typeof aggregateWithdrawals>) {
  if (status === 'ALL') return stats.total;
  if (status === 'PENDING') return stats.pending;
  if (status === 'APPROVED') return stats.approved;
  if (status === 'COMPLETED') return stats.completed;
  if (status === 'REJECTED') return stats.rejected;
  return 0;
}

function withdrawalHealth(stats: ReturnType<typeof aggregateWithdrawals>): { title: string; tone: KpiTone } {
  if (!stats.total) return { title: 'No requests loaded', tone: 'slate' };
  if (stats.pending > 0) return { title: 'Withdrawals need review', tone: 'orange' };
  if (stats.approved > 0) return { title: 'Approved for settlement', tone: 'blue' };
  return { title: 'Withdrawal queue clear', tone: 'green' };
}

function filterWithdrawals(rows: SystemAdminWithdrawal[], searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    [
      row.associationName,
      row.associationId,
      row.schema,
      row.status,
      row.requestNotes,
      row.requestedByName,
      row.requestedByEmail,
      row.requestedByPhone,
      String(row.amount || ''),
    ].some((value) => String(value || '').toLowerCase().includes(query)),
  );
}

function sortWithdrawals(rows: SystemAdminWithdrawal[], sortValue: WithdrawalSort) {
  const next = [...rows];
  next.sort((a, b) => {
    if (sortValue === 'date-asc') return timestamp(a.createdAt) - timestamp(b.createdAt);
    if (sortValue === 'amount-desc') return toNumber(b.amount) - toNumber(a.amount);
    if (sortValue === 'amount-asc') return toNumber(a.amount) - toNumber(b.amount);
    if (sortValue === 'status') return statusPriority(a.status) - statusPriority(b.status);
    return timestamp(b.createdAt) - timestamp(a.createdAt);
  });
  return next;
}

function actionForMode(withdrawal: SystemAdminWithdrawal, mode: WithdrawalMode): WithdrawalAction | null {
  if (mode === 'approve' && withdrawal.status === 'PENDING') return 'APPROVED';
  if (mode === 'reject' && withdrawal.status === 'PENDING') return 'REJECTED';
  if (mode === 'complete' && withdrawal.status === 'APPROVED') return 'COMPLETED';
  return null;
}

function canSubmitAction(action: WithdrawalAction | undefined, notes: string) {
  if (!action) return false;
  if (action === 'REJECTED') return Boolean(notes.trim());
  return true;
}

function actionTitle(action?: WithdrawalAction) {
  if (action === 'APPROVED') return 'Approve';
  if (action === 'REJECTED') return 'Reject';
  if (action === 'COMPLETED') return 'Complete';
  return 'Confirm action';
}

function actionIcon(action: WithdrawalAction) {
  if (action === 'APPROVED') return CheckCircle2;
  if (action === 'REJECTED') return XCircle;
  return Check;
}

function withdrawalStatusTone(status?: SystemAdminWithdrawalStatus | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'success';
  if (normalized === 'APPROVED') return 'primary';
  if (normalized === 'REJECTED') return 'danger';
  if (normalized === 'PENDING') return 'warning';
  return statusToneFor(normalized || 'UNKNOWN');
}

function statusPriority(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return 1;
  if (normalized === 'APPROVED') return 2;
  if (normalized === 'COMPLETED') return 3;
  if (normalized === 'REJECTED') return 4;
  return 5;
}

function buildCsv(rows: SystemAdminWithdrawal[]) {
  const header = ['id', 'associationName', 'associationId', 'amount', 'currency', 'status', 'requestedByName', 'requestedByEmail', 'createdAt', 'processedByName', 'processedAt', 'schema'];
  const lines = rows.map((row) => [
    row.id,
    row.associationName || '',
    row.associationId || '',
    toNumber(row.amount),
    row.currency || 'TZS',
    row.status || '',
    row.requestedByName || '',
    row.requestedByEmail || '',
    row.createdAt || '',
    row.processedByName || '',
    row.processedAt || '',
    row.schema || '',
  ].map(csvCell).join(','));
  return `${header.join(',')}\n${lines.join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function cleanString(value?: string | null) {
  const cleaned = String(value || '').trim();
  return cleaned || undefined;
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8).toUpperCase() : 'WITHDRAWAL';
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
