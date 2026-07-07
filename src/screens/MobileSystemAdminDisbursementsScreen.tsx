import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  AlertTriangle,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Landmark,
  Play,
  RefreshCw,
  Send,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getSystemAdminDisbursementStats,
  listSystemAdminDisbursements,
  processSystemAdminDisbursement,
  type SystemAdminDisbursementAction,
  type SystemAdminDisbursementRequest,
  type SystemAdminDisbursementStats,
} from '@/services/system-admin-disbursement-service';
import { labelFromStatus, statusToneFor, type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type DisbursementTab = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'ALL';
type InitialMode = 'detail' | 'approve' | 'reject' | 'complete' | 'fail';
type ActionTarget = {
  request: SystemAdminDisbursementRequest;
  action: SystemAdminDisbursementAction;
} | null;

type ActionForm = {
  adminNotes: string;
  rejectionReason: string;
  bankTransactionReference: string;
};

type MobileSystemAdminDisbursementsScreenProps = {
  initialStatus?: DisbursementTab;
  initialMode?: InitialMode;
};

const statusTabs: { value: DisbursementTab; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

const emptyActionForm: ActionForm = {
  adminNotes: '',
  rejectionReason: '',
  bankTransactionReference: '',
};

export default function MobileSystemAdminDisbursementsScreen({
  initialStatus = 'PENDING',
  initialMode,
}: MobileSystemAdminDisbursementsScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeTab, setActiveTab] = useState<DisbursementTab>(initialStatus);
  const [stats, setStats] = useState<SystemAdminDisbursementStats | null>(null);
  const [requests, setRequests] = useState<SystemAdminDisbursementRequest[]>([]);
  const [allRows, setAllRows] = useState<SystemAdminDisbursementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SystemAdminDisbursementRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionTarget>(null);
  const [confirmAction, setConfirmAction] = useState<ActionTarget>(null);
  const [actionForm, setActionForm] = useState<ActionForm>(emptyActionForm);
  const handledInitialModeRef = useRef(false);

  const loadDisbursements = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const [nextStats, nextRequests, nextAllRows] = await Promise.all([
          getSystemAdminDisbursementStats(),
          listSystemAdminDisbursements(activeTab),
          activeTab === 'ALL' ? Promise.resolve([]) : listSystemAdminDisbursements('ALL'),
        ]);
        setStats(nextStats);
        setRequests(nextRequests);
        setAllRows(activeTab === 'ALL' ? nextRequests : nextAllRows);
        if (mode === 'refresh') setNotice('Disbursement queue refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        if (mode === 'initial') {
          setStats(null);
          setRequests([]);
          setAllRows([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadDisbursements('initial'));
  }, [loadDisbursements]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !initialMode) return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => {
      const target = requests.find((row) => actionForInitialMode(row, initialMode)) || requests[0] || allRows.find((row) => actionForInitialMode(row, initialMode)) || allRows[0];
      if (!target) return;
      if (initialMode === 'detail') {
        setSelectedRequest(target);
        return;
      }
      const action = actionForInitialMode(target, initialMode);
      if (action) {
        setPendingAction({ request: target, action });
        setActionForm(sampleActionForm(action, target));
      } else {
        setSelectedRequest(target);
      }
    });
  }, [allRows, initialMode, loading, requests]);

  const dashboardRows = activeTab === 'ALL' ? requests : allRows.length ? allRows : requests;
  const statsFromRows = useMemo(() => aggregateRows(dashboardRows), [dashboardRows]);
  const totalAmount = useMemo(() => dashboardRows.reduce((sum, row) => sum + toNumber(row.amount), 0), [dashboardRows]);
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      if (!query) return true;
      return [
        request.referenceNumber,
        request.associationName,
        request.memberName,
        request.membershipNumber,
        request.disbursementType,
        request.status,
        request.statusDisplayText,
        request.bankName,
        request.accountNumber,
        request.accountName,
        request.requestedByName,
        String(request.amount || ''),
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [requests, searchTerm]);

  const tabs = useMemo(
    () =>
      statusTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: countForStatus(tab.value, stats, statsFromRows, dashboardRows.length),
      })),
    [dashboardRows.length, stats, statsFromRows],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () => filteredRows.map(disbursementListItem),
    [filteredRows],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Disbursements" description="Platform disbursement processing is available only to system administrators." />;
  }

  if (loading && requests.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading disbursement queue" />;
  }

  if (error && requests.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform finance"
          title="Disbursements"
          subtitle="Review and process wallet disbursement requests."
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadDisbursements('refresh')} />}
        />
        <MobileErrorState title="Disbursements unavailable" description={error} retryLabel="Retry" onRetry={() => void loadDisbursements('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform finance"
        title="Disbursements"
        subtitle={user?.fullName ? `${user.fullName} · wallet transfer operations` : 'Wallet transfer operations'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh disbursements" variant="secondary" disabled={refreshing} onPress={() => void loadDisbursements('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Disbursements" description={notice} tone="success" /> : null}

      <MobileCard compact accent={queueHealth(statsFromRows).tone}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <WalletCards color="#FFFFFF" size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {queueHealth(statsFromRows).label}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={3}>
              {formatNumber(statsFromRows.pending)} pending, {formatNumber(statsFromRows.processing)} processing, {formatCurrency(totalAmount)} loaded.
            </MobileText>
          </View>
          <MobileStatusBadge status={queueHealth(statsFromRows).label} tone={queueHealth(statsFromRows).statusTone} />
        </View>
      </MobileCard>

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as DisbursementTab)} />

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find requests" />
      <View style={styles.actionsRow}>
        <MobileButton label="Export" icon={Download} variant="secondary" size="sm" loading={exporting} disabled={!filteredRows.length} onPress={() => void exportRows()} />
        <MobileButton label="Reload" icon={RefreshCw} size="sm" variant="secondary" disabled={refreshing} onPress={() => void loadDisbursements('refresh')} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const request = filteredRows.find((row) => row.id === item.id);
            if (request) setSelectedRequest(request);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No requests in this queue"
          description={requests.length ? 'Adjust search terms or switch status tab.' : 'There are no platform disbursement requests in this status.'}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(toNumber(stats?.pendingCount ?? statsFromRows.pending))} description="Need decision" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Approved" value={formatNumber(toNumber(stats?.approvedCount ?? statsFromRows.approved))} description="Ready to start" tone="blue" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Processing" value={formatNumber(toNumber(stats?.processingCount ?? statsFromRows.processing))} description="In transfer" tone="purple" icon={Send} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(toNumber(stats?.completedCount ?? statsFromRows.completed))} description="Disbursed" tone="green" icon={Check} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
      {renderActionSheet()}
      {renderConfirmSheet()}
    </MobileScreen>
  );

  function renderDetailSheet() {
    const request = selectedRequest;
    return (
      <MobileSheet visible={Boolean(request)} title="Disbursement request" description={request?.referenceNumber || shortId(request?.id)} onClose={() => setSelectedRequest(null)}>
        {request ? (
          <>
            <MobileInfoRow label="Association" value={request.associationName || 'Unknown association'} helper={`Requested by ${request.requestedByName || 'Unknown'}`} icon={Building2} />
            <MobileInfoRow label="Recipient" value={recipientLabel(request)} helper={methodLabel(request.disbursementType)} icon={request.disbursementType === 'MEMBER_PAYOUT' ? UserRound : Building2} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(request.amount))} helper={formatDate(request.requestedAt)} icon={WalletCards} status={request.status || 'PENDING'} />
            <MobileInfoRow label="Bank" value={request.bankName || 'Not provided'} helper={`${request.accountNumber || 'No account'} · ${request.accountName || 'No account name'}`} icon={Landmark} />
            {request.requestReason ? <MobileInfoRow label="Reason" value={request.requestReason} icon={AlertTriangle} /> : null}
            {request.adminNotes ? <MobileInfoRow label="Admin notes" value={request.adminNotes} icon={Send} /> : null}
            {request.rejectionReason ? <MobileInfoRow label="Rejection" value={request.rejectionReason} icon={XCircle} status="Rejected" /> : null}
            {request.bankTransactionReference ? <MobileInfoRow label="Bank reference" value={request.bankTransactionReference} icon={CheckCircle2} status="Completed" /> : null}
            <View style={styles.actionsRow}>
              {request.status === 'PENDING' ? (
                <>
                  <MobileButton label="Approve" icon={CheckCircle2} size="sm" onPress={() => openAction(request, 'approve')} />
                  <MobileButton label="Reject" icon={XCircle} variant="danger" size="sm" onPress={() => openAction(request, 'reject')} />
                </>
              ) : null}
              {request.status === 'APPROVED' ? <MobileButton label="Start" icon={Play} size="sm" onPress={() => openAction(request, 'processing')} /> : null}
              {request.status === 'APPROVED' || request.status === 'PROCESSING' ? <MobileButton label="Complete" icon={Check} size="sm" onPress={() => openAction(request, 'complete')} /> : null}
              {request.status === 'PROCESSING' ? <MobileButton label="Fail" icon={Ban} variant="danger" size="sm" onPress={() => openAction(request, 'fail')} /> : null}
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderActionSheet() {
    const action = pendingAction;
    return (
      <MobileSheet
        visible={Boolean(action)}
        title={actionTitle(action?.action)}
        description={action?.request.referenceNumber || 'Disbursement action'}
        onClose={() => {
          setPendingAction(null);
          setConfirmAction(null);
        }}
      >
        {action ? (
          <MobileFormSection title="Action review" description="Confirm bank and amount details before updating the request state.">
            <MobileCard compact accent={actionTone(action.action)}>
              <MobileInfoRow label="Amount" value={formatCurrency(toNumber(action.request.amount))} helper={recipientLabel(action.request)} icon={WalletCards} />
              <MobileInfoRow label="Bank" value={action.request.bankName || 'Not provided'} helper={`${action.request.accountNumber || 'No account'} · ${action.request.accountName || 'No account name'}`} icon={Landmark} />
            </MobileCard>
            {action.action === 'reject' ? (
              <MobileTextInput
                label="Rejection reason"
                value={actionForm.rejectionReason}
                onChangeText={(value) => setActionForm((current) => ({ ...current, rejectionReason: value }))}
                placeholder="Explain why this request is being rejected"
                multiline
                numberOfLines={3}
              />
            ) : null}
            {action.action === 'complete' ? (
              <MobileTextInput
                label="Bank transaction reference"
                value={actionForm.bankTransactionReference}
                onChangeText={(value) => setActionForm((current) => ({ ...current, bankTransactionReference: value }))}
                placeholder="Bank reference number"
                icon={Landmark}
              />
            ) : null}
            <MobileTextInput
              label="Admin notes"
              value={actionForm.adminNotes}
              onChangeText={(value) => setActionForm((current) => ({ ...current, adminNotes: value }))}
              placeholder="Optional notes about this action"
              multiline
              numberOfLines={2}
            />
            <MobileButton
              label={actionTitle(action.action)}
              icon={actionIcon(action.action)}
              variant={action.action === 'reject' || action.action === 'fail' ? 'danger' : 'primary'}
              fullWidth
              disabled={!canSubmitAction(action.action, actionForm)}
              onPress={() => setConfirmAction(action)}
            />
          </MobileFormSection>
        ) : null}
      </MobileSheet>
    );
  }

  function renderConfirmSheet() {
    const action = confirmAction;
    return (
      <MobileConfirmSheet
        visible={Boolean(action)}
        title={actionTitle(action?.action)}
        description={action ? `${actionTitle(action.action)} ${action.request.referenceNumber || shortId(action.request.id)} for ${formatCurrency(toNumber(action.request.amount))}.` : 'Confirm action.'}
        confirmLabel={actionTitle(action?.action)}
        destructive={action?.action === 'reject' || action?.action === 'fail'}
        loading={processing}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void submitAction()}
      />
    );
  }

  function openAction(request: SystemAdminDisbursementRequest, action: SystemAdminDisbursementAction) {
    setSelectedRequest(null);
    setActionForm(sampleActionForm(action, request));
    setPendingAction({ request, action });
    setConfirmAction(null);
  }

  async function submitAction() {
    if (!confirmAction || !canSubmitAction(confirmAction.action, actionForm)) return;
    setProcessing(true);
    setError(null);
    try {
      await processSystemAdminDisbursement(confirmAction.request.id, confirmAction.action, {
        adminNotes: cleanString(actionForm.adminNotes),
        rejectionReason: confirmAction.action === 'reject' ? actionForm.rejectionReason.trim() : undefined,
        bankTransactionReference: confirmAction.action === 'complete' ? actionForm.bankTransactionReference.trim() : undefined,
      });
      setNotice(`${confirmAction.request.referenceNumber || 'Request'} ${actionPastLabel(confirmAction.action)}.`);
      setPendingAction(null);
      setConfirmAction(null);
      setActionForm(emptyActionForm);
      await loadDisbursements('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  }

  async function exportRows() {
    if (!filteredRows.length) return;
    setExporting(true);
    setError(null);
    try {
      const fileUri = `${FileSystem.cacheDirectory || ''}admin-disbursements-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, buildCsv(filteredRows));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share platform disbursements export' });
      }
      setNotice('Disbursement export prepared.');
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }
}

function disbursementListItem(request: SystemAdminDisbursementRequest): MobileDataListItem {
  return {
    id: request.id,
    title: request.referenceNumber || shortId(request.id),
    subtitle: request.associationName || recipientLabel(request),
    meta: `${recipientLabel(request)} · ${formatDate(request.requestedAt)}`,
    amount: formatCurrency(toNumber(request.amount)),
    status: request.statusDisplayText || labelFromStatus(request.status || 'PENDING'),
    statusTone: statusToneFor(request.status || 'PENDING'),
    accent: statusToneFor(request.status || 'PENDING'),
    initials: initialsFromName(request.associationName || request.memberName || request.referenceNumber || 'DR'),
  };
}

function aggregateRows(rows: SystemAdminDisbursementRequest[]) {
  return {
    pending: rows.filter((row) => row.status === 'PENDING').length,
    approved: rows.filter((row) => row.status === 'APPROVED').length,
    processing: rows.filter((row) => row.status === 'PROCESSING').length,
    completed: rows.filter((row) => row.status === 'COMPLETED').length,
    rejected: rows.filter((row) => row.status === 'REJECTED').length,
    failed: rows.filter((row) => row.status === 'FAILED').length,
  };
}

function countForStatus(status: DisbursementTab, stats: SystemAdminDisbursementStats | null, rowStats: ReturnType<typeof aggregateRows>, allCount: number) {
  if (status === 'PENDING') return toNumber(stats?.pendingCount ?? rowStats.pending);
  if (status === 'APPROVED') return toNumber(stats?.approvedCount ?? rowStats.approved);
  if (status === 'PROCESSING') return toNumber(stats?.processingCount ?? rowStats.processing);
  if (status === 'COMPLETED') return toNumber(stats?.completedCount ?? rowStats.completed);
  if (status === 'REJECTED') return toNumber(stats?.rejectedCount ?? rowStats.rejected);
  return allCount || toNumber(stats?.recentRequestsCount);
}

function queueHealth(rowStats: ReturnType<typeof aggregateRows>): { label: string; tone: KpiTone; statusTone: StatusTone } {
  if (rowStats.failed > 0) return { label: 'Failures need review', tone: 'red', statusTone: 'danger' };
  if (rowStats.processing > 0) return { label: 'Transfers in progress', tone: 'purple', statusTone: 'review' };
  if (rowStats.pending > 0) return { label: 'Pending decisions', tone: 'orange', statusTone: 'warning' };
  return { label: 'Queue clear', tone: 'green', statusTone: 'success' };
}

function actionForInitialMode(request: SystemAdminDisbursementRequest, mode: InitialMode): SystemAdminDisbursementAction | null {
  if (mode === 'approve' && request.status === 'PENDING') return 'approve';
  if (mode === 'reject' && request.status === 'PENDING') return 'reject';
  if (mode === 'complete' && (request.status === 'APPROVED' || request.status === 'PROCESSING')) return 'complete';
  if (mode === 'fail' && request.status === 'PROCESSING') return 'fail';
  return null;
}

function sampleActionForm(action: SystemAdminDisbursementAction, request: SystemAdminDisbursementRequest): ActionForm {
  return {
    adminNotes: `Reviewed ${request.referenceNumber || shortId(request.id)} from mobile preview.`,
    rejectionReason: action === 'reject' ? 'Preview rejection reason for simulator review.' : '',
    bankTransactionReference: action === 'complete' ? `BANK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}` : '',
  };
}

function canSubmitAction(action: SystemAdminDisbursementAction | undefined, form: ActionForm) {
  if (!action) return false;
  if (action === 'reject') return Boolean(form.rejectionReason.trim());
  if (action === 'complete') return Boolean(form.bankTransactionReference.trim());
  return true;
}

function actionTitle(action?: SystemAdminDisbursementAction) {
  if (action === 'approve') return 'Approve';
  if (action === 'reject') return 'Reject';
  if (action === 'processing') return 'Start processing';
  if (action === 'complete') return 'Complete';
  if (action === 'fail') return 'Mark failed';
  return 'Confirm action';
}

function actionPastLabel(action: SystemAdminDisbursementAction) {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'processing') return 'moved to processing';
  if (action === 'complete') return 'completed';
  return 'marked failed';
}

function actionIcon(action: SystemAdminDisbursementAction) {
  if (action === 'approve') return CheckCircle2;
  if (action === 'reject') return XCircle;
  if (action === 'processing') return Play;
  if (action === 'complete') return Check;
  return Ban;
}

function actionTone(action: SystemAdminDisbursementAction): KpiTone {
  if (action === 'reject' || action === 'fail') return 'red';
  if (action === 'processing') return 'purple';
  if (action === 'complete') return 'green';
  return 'blue';
}

function methodLabel(type?: string | null) {
  if (type === 'MEMBER_PAYOUT') return 'Member payout';
  if (type === 'ASSOCIATION_WITHDRAWAL') return 'Association withdrawal';
  return labelFromStatus(type || 'Disbursement');
}

function recipientLabel(request: SystemAdminDisbursementRequest) {
  if (request.disbursementType === 'MEMBER_PAYOUT') {
    return request.memberName || request.membershipNumber || 'Member payout';
  }
  return 'Association withdrawal';
}

function buildCsv(rows: SystemAdminDisbursementRequest[]) {
  const header = ['referenceNumber', 'associationName', 'type', 'recipient', 'amount', 'status', 'bankName', 'accountNumber', 'accountName', 'requestedBy', 'requestedAt'];
  const lines = rows.map((row) => [
    row.referenceNumber || '',
    row.associationName || '',
    methodLabel(row.disbursementType),
    recipientLabel(row),
    toNumber(row.amount),
    row.statusDisplayText || row.status || '',
    row.bankName || '',
    row.accountNumber || '',
    row.accountName || '',
    row.requestedByName || '',
    row.requestedAt || '',
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
  return value ? value.slice(0, 8).toUpperCase() : 'REQUEST';
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
});
