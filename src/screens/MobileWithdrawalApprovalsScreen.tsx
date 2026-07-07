import { router } from 'expo-router';
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  UserRound,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  MobileEmptyState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  approveWithdrawalRequest,
  getMemberWithdrawalRequests,
  getPendingWithdrawalApprovals,
  getWithdrawalStatistics,
  rejectWithdrawalRequest,
  type MemberWithdrawalRequest,
  type WithdrawalStats,
} from '@/services/wallet-service';
import { labelFromStatus, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type ApprovalView = 'pending' | 'history';
type PendingStatusFilter = 'all' | 'PENDING' | 'FIRST_APPROVED';
type HistoryStatusFilter = 'all' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
type SortOption = 'dateAsc' | 'dateDesc' | 'memberAsc' | 'amountDesc' | 'statusAsc';

const pendingStatusTabs: { value: PendingStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FIRST_APPROVED', label: 'First approved' },
];

const historyStatusTabs: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FAILED', label: 'Failed' },
];

const sortOptions = [
  { value: 'dateAsc', label: 'Oldest request', description: 'Review the oldest pending requests first.' },
  { value: 'dateDesc', label: 'Newest request', description: 'Latest withdrawal requests first.' },
  { value: 'memberAsc', label: 'Member name', description: 'Group requests by member.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest payout risk first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group records by workflow state.' },
];

export default function MobileWithdrawalApprovalsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<MemberWithdrawalRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<MemberWithdrawalRequest[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ApprovalView>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingStatus, setPendingStatus] = useState<PendingStatusFilter>('all');
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('dateAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MemberWithdrawalRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<MemberWithdrawalRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MemberWithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadApprovals = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading withdrawal approvals.');
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const [pendingPage, allPage, loadedStats] = await Promise.all([
          getPendingWithdrawalApprovals(associationId, { size: 250, sort: 'createdAt,asc' }),
          getMemberWithdrawalRequests(associationId, { size: 250, sort: 'createdAt,desc' }),
          getWithdrawalStatistics(associationId),
        ]);
        const allRequests = allPage.content || [];
        const firstApprovedRequests = allRequests.filter((request) => request.status === 'FIRST_APPROVED');
        setPendingRequests(mergeById([...(pendingPage.content || []), ...firstApprovedRequests]));
        setHistoryRequests(allRequests.filter((request) => !isPendingApprovalStatus(request.status)));
        setStats(loadedStats);
      } catch (loadError) {
        setPendingRequests([]);
        setHistoryRequests([]);
        setStats(null);
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
      if (active) void loadApprovals();
    });
    return () => {
      active = false;
    };
  }, [loadApprovals]);

  const pendingCounts = useMemo(() => countByStatus(pendingRequests, pendingStatusTabs), [pendingRequests]);
  const historyCounts = useMemo(() => countByStatus(historyRequests, historyStatusTabs), [historyRequests]);
  const activeRows = activeTab === 'pending' ? pendingRequests : historyRequests;
  const activeStatus = activeTab === 'pending' ? pendingStatus : historyStatus;

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = activeRows.filter((request) => {
      const matchesStatus = activeStatus === 'all' || request.status === activeStatus;
      const haystack = [
        request.memberName,
        request.membershipNumber,
        request.memberId,
        request.withdrawalMethod,
        destinationValue(request),
        request.status,
        request.requestNotes,
        request.rejectionReason,
        String(request.amount || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortRequests(rows, sortValue);
  }, [activeRows, activeStatus, searchTerm, sortValue]);

  const listItems = useMemo(
    () =>
      filteredRows.map((request) => ({
        id: request.id,
        title: request.memberName || 'Unknown member',
        subtitle: `${methodLabel(request.withdrawalMethod)} - ${destinationValue(request)}`,
        meta: `${formatDate(request.createdAt)} - ${request.membershipNumber || shortId(request.memberId)}`,
        amount: formatCurrency(toNumber(request.amount)),
        status: labelFromStatus(request.status),
        statusTone: withdrawalStatusTone(request.status),
        accent: withdrawalStatusTone(request.status),
        initials: initialsFromName(request.memberName || labelFromStatus(request.status)),
      })),
    [filteredRows],
  );

  const withdrawalApprovalReportOptions = useMemo(
    () => ({
      title: activeTab === 'pending' ? 'Withdrawal Approval Queue' : 'Withdrawal Approval History',
      associationName: user?.associationName || 'Association',
      purpose:
        activeTab === 'pending'
          ? 'A review-ready report of withdrawal requests awaiting approval.'
          : 'A historical report of reviewed withdrawal requests, approvers, and outcomes.',
      rows: filteredRows,
      fileName: `nane-${activeTab}-withdrawal-approvals`,
      metrics: [
        { label: 'Pending requests', value: formatNumber(toNumber(stats?.totalPending) || pendingRequests.length), helper: 'Awaiting review' },
        { label: 'Pending amount', value: formatCurrency(toNumber(stats?.totalPendingAmount) || sumAmount(pendingRequests)), helper: 'Requested payout' },
        { label: 'First approved', value: formatNumber(toNumber(stats?.totalFirstApproved)), helper: 'Needs final review' },
        { label: 'Completed', value: formatNumber(toNumber(stats?.totalCompleted)), helper: 'Disbursed requests' },
      ],
      filters: [
        { label: 'View', value: activeTab === 'pending' ? 'Approval queue' : 'History' },
        {
          label: 'Status',
          value:
            activeTab === 'pending'
              ? pendingStatusTabs.find((tab) => tab.value === pendingStatus)?.label || pendingStatus
              : historyStatusTabs.find((tab) => tab.value === historyStatus)?.label || historyStatus,
        },
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: MemberWithdrawalRequest, index: number) => index + 1 },
        { key: 'createdAt', label: 'Requested At', width: '12%', value: (row: MemberWithdrawalRequest) => formatDate(row.createdAt) },
        { key: 'memberName', label: 'Member', width: '16%', value: (row: MemberWithdrawalRequest) => row.memberName || '-' },
        { key: 'membershipNumber', label: 'Membership No.', width: '11%', value: (row: MemberWithdrawalRequest) => row.membershipNumber || shortId(row.memberId) },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '12%', value: (row: MemberWithdrawalRequest) => formatCurrency(toNumber(row.amount)) },
        { key: 'method', label: 'Method', width: '11%', value: (row: MemberWithdrawalRequest) => methodLabel(row.withdrawalMethod) },
        { key: 'destination', label: 'Destination', width: '13%', value: (row: MemberWithdrawalRequest) => destinationValue(row) },
        { key: 'status', label: 'Status', width: '10%', value: (row: MemberWithdrawalRequest) => labelFromStatus(row.status) },
        { key: 'firstApprover', label: 'First Approver', width: '12%', value: (row: MemberWithdrawalRequest) => row.firstApproverName || '-' },
        { key: 'finalApprover', label: 'Final Approver', width: '12%', value: (row: MemberWithdrawalRequest) => row.secondApproverName || '-' },
        { key: 'rejectionReason', label: 'Rejection Reason', width: '16%', value: (row: MemberWithdrawalRequest) => row.rejectionReason || '-' },
      ],
    }),
    [activeTab, filteredRows, historyStatus, pendingRequests, pendingStatus, searchTerm, sortValue, stats, user?.associationName],
  );

  const handleApprove = async () => {
    if (!approveTarget || !associationId || !user?.userId) return;
    setProcessing(true);
    setProcessingAction('approve');
    setError(null);
    setNotice(null);
    try {
      await approveWithdrawalRequest(approveTarget.id, associationId, user.userId, 'Approved from native mobile app.');
      setNotice(`Approved ${formatCurrency(toNumber(approveTarget.amount))} for ${approveTarget.memberName || 'member'}.`);
      setApproveTarget(null);
      await loadApprovals('refresh');
    } catch (approvalError) {
      setError(getApiErrorMessage(approvalError));
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !associationId || !user?.userId || rejectReason.trim().length < 3) return;
    setProcessing(true);
    setProcessingAction('reject');
    setError(null);
    setNotice(null);
    try {
      await rejectWithdrawalRequest(rejectTarget.id, associationId, user.userId, rejectReason.trim());
      setNotice(`Rejected withdrawal ${shortId(rejectTarget.id)}.`);
      setRejectTarget(null);
      setRejectReason('');
      await loadApprovals('refresh');
    } catch (rejectError) {
      setError(getApiErrorMessage(rejectError));
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Withdrawal approvals" description="This native approval queue is available for association admins only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading withdrawal approvals" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Wallet & payments"
        title="Withdrawal approvals"
        subtitle="Review payout risk before approving requests"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh approvals" onPress={() => loadApprovals('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileStatusBadge status="Approval issue" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending requests" value={formatNumber(toNumber(stats?.totalPending) || pendingRequests.length)} description="Awaiting review" tone="blue" icon={FileCheck2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending amount" value={formatCurrency(toNumber(stats?.totalPendingAmount) || sumAmount(pendingRequests))} description="Requested payout" tone="orange" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="First approved" value={formatNumber(toNumber(stats?.totalFirstApproved))} description="Needs final review" tone="purple" icon={BadgeCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Processing" value={formatNumber(toNumber(stats?.totalProcessing))} description={formatCurrency(toNumber(stats?.totalProcessingAmount))} tone="teal" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(toNumber(stats?.totalCompleted))} description="Disbursed requests" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed" value={formatNumber(toNumber(stats?.totalFailed))} description={formatCurrency(toNumber(stats?.totalFailedAmount))} tone="red" icon={ShieldAlert} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value as ApprovalView);
          setSearchTerm('');
          setSortValue(value === 'pending' ? 'dateAsc' : 'dateDesc');
        }}
        tabs={[
          { value: 'pending', label: 'Approval queue', count: pendingRequests.length },
          { value: 'history', label: 'History', count: historyRequests.length },
        ]}
      />

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search member, method, amount..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />

      <MobileStatusTabs
        value={activeStatus}
        onChange={(value) => {
          if (activeTab === 'pending') setPendingStatus(value as PendingStatusFilter);
          else setHistoryStatus(value as HistoryStatusFilter);
        }}
        tabs={(activeTab === 'pending' ? pendingStatusTabs : historyStatusTabs).map((tab) => ({
          ...tab,
          count: activeTab === 'pending' ? pendingCounts[tab.value] || 0 : historyCounts[tab.value] || 0,
        }))}
      />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            {activeTab === 'pending' ? 'Approval queue' : 'Approval history'}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Showing {formatNumber(filteredRows.length)} of {formatNumber(activeRows.length)} request(s)
          </MobileText>
        </View>
        <MobileReportExportButton options={withdrawalApprovalReportOptions} size="sm" onError={(exportError) => setError(getApiErrorMessage(exportError))} />
      </View>

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const request = filteredRows.find((row) => row.id === item.id);
            if (request) setSelectedRequest(request);
          }}
        />
      ) : (
        <MobileEmptyState
          title={activeRows.length > 0 ? 'No matching requests' : activeTab === 'pending' ? 'No pending requests' : 'No approval history'}
          description={activeRows.length > 0 ? 'Clear search or switch status filters to see more records.' : activeTab === 'pending' ? 'All caught up. New withdrawal requests will appear here.' : 'Completed, rejected, and failed requests will appear here.'}
        />
      )}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} onClose={() => setSortOpen(false)} />

      <WithdrawalApprovalDetailSheet
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApprove={(request) => {
          setSelectedRequest(null);
          setApproveTarget(request);
        }}
        onReject={(request) => {
          setSelectedRequest(null);
          setRejectTarget(request);
          setRejectReason('');
        }}
      />

      <MobileConfirmSheet
        visible={Boolean(approveTarget)}
        title="Approve withdrawal?"
        description={approveTarget ? `Approve ${formatCurrency(toNumber(approveTarget.amount))} for ${approveTarget.memberName || 'member'} to ${destinationValue(approveTarget)}.` : ''}
        confirmLabel="Approve"
        onCancel={() => setApproveTarget(null)}
        onConfirm={handleApprove}
      />

      <MobileSheet visible={Boolean(rejectTarget)} title="Reject withdrawal" description="Provide a clear reason. Members can see this note." onClose={() => {
        if (!processing) {
          setRejectTarget(null);
          setRejectReason('');
        }
      }}>
        {rejectTarget ? (
          <MobileCard compact>
            <MobileInfoRow label="Member" value={rejectTarget.memberName || 'Unknown member'} helper={rejectTarget.membershipNumber || shortId(rejectTarget.memberId)} icon={UserRound} status={rejectTarget.status || 'Pending'} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(rejectTarget.amount))} helper={`${methodLabel(rejectTarget.withdrawalMethod)} - ${destinationValue(rejectTarget)}`} icon={Banknote} />
          </MobileCard>
        ) : null}
        <MobileTextInput label="Rejection reason" value={rejectReason} onChangeText={setRejectReason} placeholder="Example: Account details could not be verified." icon={XCircle} disabled={processing} />
        <View style={styles.actionRow}>
          <MobileButton label="Cancel" variant="secondary" onPress={() => {
            setRejectTarget(null);
            setRejectReason('');
          }} disabled={processing} style={styles.actionButton} />
          <MobileButton label="Reject" variant="danger" loading={processing && processingAction === 'reject'} disabled={rejectReason.trim().length < 3 || processing} onPress={handleReject} style={styles.actionButton} />
        </View>
      </MobileSheet>
    </MobileScreen>
  );
}

function WithdrawalApprovalDetailSheet({
  request,
  onClose,
  onApprove,
  onReject,
}: {
  request: MemberWithdrawalRequest | null;
  onClose: () => void;
  onApprove: (request: MemberWithdrawalRequest) => void;
  onReject: (request: MemberWithdrawalRequest) => void;
}) {
  if (!request) return null;
  const actionable = isPendingApprovalStatus(request.status);

  return (
    <MobileSheet visible title="Withdrawal review" description={shortId(request.id)} onClose={onClose}>
      <MobileInfoRow label="Amount" value={formatCurrency(toNumber(request.amount))} helper={request.requestNotes || 'No request notes'} icon={Banknote} status={request.status || 'Pending'} />
      <MobileInfoRow label="Member" value={request.memberName || 'Unknown member'} helper={request.membershipNumber || shortId(request.memberId)} icon={UserRound} />
      <MobileInfoRow label="Destination" value={methodLabel(request.withdrawalMethod)} helper={destinationValue(request)} icon={request.withdrawalMethod === 'MOBILE_MONEY' ? Smartphone : Landmark} />
      <MobileInfoRow label="Requested" value={formatDate(request.createdAt)} helper={request.updatedAt ? `Updated ${formatDate(request.updatedAt)}` : undefined} icon={Clock3} />
      {request.firstApproverName || request.firstApprovedAt ? (
        <MobileInfoRow label="First approval" value={request.firstApproverName || 'Recorded'} helper={request.firstApprovedAt ? formatDate(request.firstApprovedAt) : request.firstApproverNotes || undefined} icon={BadgeCheck} status="First Approved" />
      ) : null}
      {request.secondApproverName || request.secondApprovedAt ? (
        <MobileInfoRow label="Final approval" value={request.secondApproverName || 'Recorded'} helper={request.secondApprovedAt ? formatDate(request.secondApprovedAt) : request.secondApproverNotes || undefined} icon={CheckCircle2} status="Approved" />
      ) : null}
      {request.rejectionReason ? <MobileInfoRow label="Rejection reason" value={request.rejectionReason} icon={XCircle} status="Rejected" /> : null}
      {request.disbursementStatus || request.disbursementError ? (
        <MobileInfoRow label="Disbursement" value={request.disbursementStatus || 'Not processed'} helper={request.disbursementError || request.zenoPayReference || undefined} icon={ShieldAlert} />
      ) : null}
      {actionable ? (
        <View style={styles.actionRow}>
          <MobileButton label="Reject" variant="secondary" icon={XCircle} onPress={() => onReject(request)} style={styles.actionButton} />
          <MobileButton label="Approve" icon={CheckCircle2} onPress={() => onApprove(request)} style={styles.actionButton} />
        </View>
      ) : null}
    </MobileSheet>
  );
}

function countByStatus<T extends { value: string }>(rows: MemberWithdrawalRequest[], tabs: T[]) {
  return tabs.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value === 'all' ? rows.length : rows.filter((row) => row.status === tab.value).length;
    return acc;
  }, {});
}

function mergeById(rows: MemberWithdrawalRequest[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function sortRequests(rows: MemberWithdrawalRequest[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'amountDesc') return toNumber(b.amount) - toNumber(a.amount);
    if (sortValue === 'memberAsc') return String(a.memberName || '').localeCompare(String(b.memberName || ''));
    if (sortValue === 'statusAsc') return String(a.status || '').localeCompare(String(b.status || ''));
    const modifier = sortValue === 'dateAsc' ? 1 : -1;
    return (dateValue(a.createdAt) - dateValue(b.createdAt)) * modifier;
  });
}

function isPendingApprovalStatus(status?: string | null) {
  return status === 'PENDING' || status === 'FIRST_APPROVED';
}

function withdrawalStatusTone(status?: string | null): StatusTone {
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning';
  if (status === 'FIRST_APPROVED' || status === 'APPROVED') return 'info';
  if (status === 'COMPLETED') return 'success';
  if (status === 'REJECTED' || status === 'FAILED') return 'danger';
  return 'neutral';
}

function methodLabel(method?: string | null) {
  if (!method) return 'Unknown method';
  return method
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function destinationValue(request: MemberWithdrawalRequest) {
  return request.destinationNumber || request.accountNumber || request.bankName || '-';
}

function sumAmount(rows: MemberWithdrawalRequest[]) {
  return rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortId(value?: string | null) {
  return value ? `#${value.slice(0, 8)}` : '-';
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
