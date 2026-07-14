import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  Landmark,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  WalletCards,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDetailHeader,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileListHeaderCard,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileTimeline,
} from '@/components/mobile';
import {
  approveLoan,
  checkAndUpdateOverdueLoans,
  disburseLoan,
  getAllAssociationLoans,
  getAssociationLoanStatistics,
  getLoanDetails,
  getLoanHistory,
  rejectLoan,
  type AssociationLoanStatistics,
  type AssociationLoanSummary,
  type LoanDetail,
  type LoanHistoryRecord,
  type LoanRepaymentSchedule,
} from '@/services/loan-service';
import { statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type LoanTab = 'disbursed' | 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'defaulted';
type SortOption = 'memberAsc' | 'dateDesc' | 'amountDesc' | 'balanceDesc' | 'statusAsc';
type ConfirmAction = 'approve' | 'disburse' | 'overdue' | null;

const loanTabs: { value: LoanTab; label: string }[] = [
  { value: 'disbursed', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'defaulted', label: 'Defaulted' },
];
const sortOptions = [
  { value: 'memberAsc', label: 'Member number', description: 'Natural member order, then member name.' },
  { value: 'dateDesc', label: 'Newest request', description: 'Latest requested loans first.' },
  { value: 'amountDesc', label: 'Highest requested', description: 'Largest loan requests first.' },
  { value: 'balanceDesc', label: 'Highest balance', description: 'Largest outstanding balances first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group loans by current status.' },
];

type MobileAssociationLoansScreenProps = {
  initialLoanId?: string;
};

export default function MobileAssociationLoansScreen({ initialLoanId }: MobileAssociationLoansScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [loans, setLoans] = useState<AssociationLoanSummary[]>([]);
  const [stats, setStats] = useState<AssociationLoanStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<LoanTab>('disbursed');
  const [sortValue, setSortValue] = useState<SortOption>('memberAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loanHistory, setLoanHistory] = useState<LoanHistoryRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoan, setActionLoan] = useState<AssociationLoanSummary | LoanDetail | null>(null);
  const [rejectLoanRow, setRejectLoanRow] = useState<AssociationLoanSummary | LoanDetail | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadLoans = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading loans.');
        return;
      }
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const startParam = startDate ? `${startDate}T00:00:00` : undefined;
        const endParam = endDate ? `${endDate}T23:59:59` : undefined;
        const [loanPage, loadedStats] = await Promise.all([
          getAllAssociationLoans({
            associationId,
            startDate: startParam,
            endDate: endParam,
            sort: 'requestDate,desc',
          }),
          getAssociationLoanStatistics(associationId),
        ]);
        setLoans(loanPage.content || []);
        setStats(loadedStats);
      } catch (loadError) {
        setLoans([]);
        setStats(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, endDate, startDate],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadLoans();
    });
    return () => {
      active = false;
    };
  }, [loadLoans]);

  const visibleLoans = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = filterLoansByTab(loans, activeTab).filter((loan) => {
      if (!query) return true;
      return [loan.memberFullName, memberNumberFor(loan), loan.id, loan.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    return sortLoans(filtered, sortValue);
  }, [activeTab, loans, searchTerm, sortValue]);

  const tabCounts = useMemo(
    () =>
      loanTabs.reduce<Record<LoanTab, number>>((acc, tab) => {
        acc[tab.value] = filterLoansByTab(loans, tab.value).length;
        return acc;
      }, {} as Record<LoanTab, number>),
    [loans],
  );
  const tileTotals = useMemo(() => summarizeLoans(loans), [loans]);

  const openLoanDetail = useCallback(async (loanId: string) => {
    setSelectedLoanId(loanId);
    setDetailLoading(true);
    setError(null);
    try {
      const [details, history] = await Promise.all([getLoanDetails(loanId), getLoanHistory(loanId)]);
      setSelectedLoan(details);
      setLoanHistory(history || details.histories || []);
    } catch (detailError) {
      setSelectedLoan(null);
      setLoanHistory([]);
      setError(getApiErrorMessage(detailError));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLoanId || selectedLoanId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void openLoanDetail(initialLoanId);
    });
    return () => {
      active = false;
    };
  }, [initialLoanId, openLoanDetail, selectedLoanId]);

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    setError(null);
    setLastResult(null);
    try {
      if (confirmAction === 'overdue') {
        const updated = await checkAndUpdateOverdueLoans();
        setLastResult(`Overdue check completed for ${updated.length} loan records.`);
      } else if (actionLoan) {
        if (confirmAction === 'approve') {
          await approveLoan(actionLoan.id);
          setLastResult(`Loan ${shortId(actionLoan.id)} approved.`);
        }
        if (confirmAction === 'disburse') {
          await disburseLoan(actionLoan.id);
          setLastResult(`Loan ${shortId(actionLoan.id)} disbursed.`);
        }
      }
      setConfirmAction(null);
      setActionLoan(null);
      await loadLoans('refresh');
      if (selectedLoanId) await openLoanDetail(selectedLoanId);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  };

  const submitReject = async () => {
    if (!rejectLoanRow || rejectReason.trim().length < 3) return;
    setProcessing(true);
    setError(null);
    setLastResult(null);
    try {
      await rejectLoan(rejectLoanRow.id, rejectReason.trim());
      setLastResult(`Loan ${shortId(rejectLoanRow.id)} rejected.`);
      setRejectLoanRow(null);
      setRejectReason('');
      await loadLoans('refresh');
      if (selectedLoanId) await openLoanDetail(selectedLoanId);
    } catch (rejectError) {
      setError(getApiErrorMessage(rejectError));
    } finally {
      setProcessing(false);
    }
  };

  const loanReportOptions = useMemo(
    () => ({
      title: 'Loan Management Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered register of association loans with requested amounts, balances, repayment progress, status, and due dates.',
      rows: visibleLoans,
      fileName: 'nane-loan-management',
      metrics: [
        { label: 'Active loans', value: tileTotals.activeCount, helper: `${formatNumber(tileTotals.totalLoans)} loaded` },
        { label: 'Loan balance', value: formatCurrency(tileTotals.totalRemainingBalance), helper: `Repaid ${formatCurrency(tileTotals.totalRepaid)}` },
        { label: 'Pending approval', value: tileTotals.pendingCount, helper: formatCurrency(tileTotals.pendingValue) },
        { label: 'Overdue/defaulted', value: `${tileTotals.overdueCount} / ${tileTotals.defaultedCount}`, helper: formatCurrency(tileTotals.overdueValue) },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status tab', value: loanTabs.find((tab) => tab.value === activeTab)?.label || activeTab },
        { label: 'Start date', value: startDate || 'Any' },
        { label: 'End date', value: endDate || 'Any' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_loan: AssociationLoanSummary, index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '17%', value: (loan: AssociationLoanSummary) => memberNameFor(loan) },
        { key: 'membershipNumber', label: 'Member No', width: '10%', value: (loan: AssociationLoanSummary) => memberNumberFor(loan) || '-' },
        { key: 'requestDate', label: 'Requested', width: '10%', value: (loan: AssociationLoanSummary) => formatDate(loan.requestDate) },
        { key: 'status', label: 'Status', width: '10%', value: (loan: AssociationLoanSummary) => loan.status || 'Unknown' },
        { key: 'requestedAmount', label: 'Requested Amount', align: 'right' as const, width: '13%', value: (loan: AssociationLoanSummary) => formatCurrency(toNumber(loan.requestedAmount)) },
        { key: 'remainingBalance', label: 'Balance', align: 'right' as const, width: '13%', value: (loan: AssociationLoanSummary) => formatCurrency(toNumber(loan.remainingBalance)) },
        { key: 'paid', label: 'Paid', align: 'right' as const, width: '11%', value: (loan: AssociationLoanSummary) => formatCurrency(Math.max(0, toNumber(loan.requestedAmount) - toNumber(loan.remainingBalance))) },
        { key: 'dueDate', label: 'Next Due', width: '12%', value: (loan: AssociationLoanSummary) => formatDate(loan.nextPaymentDueDate) },
      ],
    }),
    [activeTab, endDate, searchTerm, sortValue, startDate, tileTotals, user?.associationName, visibleLoans],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Manage loans" description="This native page is available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading loans" />;
  }

  if (selectedLoanId) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Loans"
          title="Loan detail"
          subtitle={selectedLoan ? `${selectedLoan.memberFullName || selectedLoan.memberFullName || 'Member'} · ${shortId(selectedLoan.id)}` : shortId(selectedLoanId)}
          onBack={() => {
            setSelectedLoanId(null);
            setSelectedLoan(null);
            setLoanHistory([]);
          }}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Reload loan"
              variant="secondary"
              disabled={detailLoading || processing}
              onPress={() => void openLoanDetail(selectedLoanId)}
            />
          }
        />
        {error ? <MobileErrorState title="Loan detail issue" description={error} retryLabel="Reload" onRetry={() => void openLoanDetail(selectedLoanId)} /> : null}
        {detailLoading || !selectedLoan ? (
          <MobilePageLoadingState kind="detail" message="Loading loan detail" />
        ) : (
          <LoanDetailView
            loan={selectedLoan}
            history={loanHistory}
            processing={processing}
            onApprove={() => {
              setActionLoan(selectedLoan);
              setConfirmAction('approve');
            }}
            onDisburse={() => {
              setActionLoan(selectedLoan);
              setConfirmAction('disburse');
            }}
            onReject={() => {
              setRejectLoanRow(selectedLoan);
              setRejectReason('');
            }}
          />
        )}
        {renderActionSheets()}
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Loans"
        title="Manage loans"
        subtitle="Review, approve, disburse and track loan balances"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh loans"
            variant="secondary"
            disabled={refreshing || processing}
            onPress={() => void loadLoans('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Loan issue" description={error} retryLabel="Reload loans" onRetry={() => void loadLoans('refresh')} /> : null}
      {lastResult ? <MobileStatusBadge status="Completed" label={lastResult} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active loans" value={String(tileTotals.activeCount)} description={`${formatNumber(tileTotals.totalLoans)} loaded · ${formatNumber(toNumber(stats?.totalLoans))} server total`} tone="blue" icon={Landmark} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Loan balance" value={formatCurrency(tileTotals.totalRemainingBalance)} description={`Repaid ${formatCurrency(tileTotals.totalRepaid)}`} tone="green" icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending approval" value={String(tileTotals.pendingCount)} description={formatCurrency(tileTotals.pendingValue)} tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue / Defaulted" value={`${tileTotals.overdueCount} / ${tileTotals.defaultedCount}`} description={formatCurrency(tileTotals.overdueValue)} tone="red" icon={AlertTriangle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.actionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Loan workspace
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Search and act on all loaded loan records.
            </MobileText>
          </View>
          <MobileStatusBadge status="Active" label={`${visibleLoans.length} visible`} tone="primary" />
        </View>
        <View style={styles.actionsWrap}>
          <MobileButton
            label="New loan"
            icon={Plus}
            size="sm"
            onPress={() =>
              router.push({ pathname: '/work/route-preview', params: { routeId: 'association-admin-associations-loans-request' } } as never)
            }
          />
          <MobileButton
            label="Import"
            icon={FileDown}
            size="sm"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/work/route-preview', params: { routeId: 'association-admin-associations-loans-batch-upload' } } as never)
            }
          />
          <MobileButton
            label="Check overdue"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={processing && confirmAction === 'overdue'}
            disabled={processing}
            onPress={() => setConfirmAction('overdue')}
          />
          <MobileReportExportButton options={loanReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      <MobileSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search loans..."
        filterLabel="Sort"
        onFilterPress={() => setSortOpen(true)}
      />
      <MobileStatusTabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as LoanTab)}
        tabs={loanTabs.map((tab) => ({ value: tab.value, label: tab.label, count: tabCounts[tab.value] || 0 }))}
      />

      <View style={styles.filterRow}>
        <MobileButton
          label="Date filters"
          icon={SlidersHorizontal}
          variant="secondary"
          size="sm"
          onPress={() => {
            setDraftStartDate(startDate);
            setDraftEndDate(endDate);
            setFilterOpen(true);
          }}
        />
        {(startDate || endDate) ? <MobileStatusBadge status="Processing" label="Date filtered" tone="warning" /> : null}
      </View>

      <MobileListHeaderCard
        title="Loan records"
        subtitle={`${formatNumber(visibleLoans.length)} visible of ${formatNumber(loans.length)} loaded loans.`}
        actions={refreshing ? <MobileStatusBadge status="Processing" label="Refreshing" tone="warning" /> : null}
      />

      {visibleLoans.length > 0 ? (
        <View style={styles.list}>
          {visibleLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              processing={processing}
              onOpen={() => void openLoanDetail(loan.id)}
              onApprove={() => {
                setActionLoan(loan);
                setConfirmAction('approve');
              }}
              onDisburse={() => {
                setActionLoan(loan);
                setConfirmAction('disburse');
              }}
              onReject={() => {
                setRejectLoanRow(loan);
                setRejectReason('');
              }}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No loans found"
          description="Change the status, date range, or search term to find loan records."
          actionLabel="Reset filters"
          onAction={() => {
            setSearchTerm('');
            setActiveTab('all');
            setStartDate('');
            setEndDate('');
          }}
        />
      )}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />
      <MobileSheet visible={filterOpen} title="Loan date filters" description="Filter by request date without changing records." onClose={() => setFilterOpen(false)}>
        <MobileTextInput label="Start date" value={draftStartDate} onChangeText={setDraftStartDate} placeholder="YYYY-MM-DD" icon={CalendarDays} />
        <MobileTextInput label="End date" value={draftEndDate} onChangeText={setDraftEndDate} placeholder="YYYY-MM-DD" icon={CalendarDays} />
        <View style={styles.sheetActions}>
          <MobileButton
            label="Reset"
            variant="secondary"
            onPress={() => {
              setDraftStartDate('');
              setDraftEndDate('');
              setStartDate('');
              setEndDate('');
              setFilterOpen(false);
            }}
          />
          <MobileButton
            label="Apply"
            fullWidth
            style={styles.flex}
            onPress={() => {
              setStartDate(draftStartDate);
              setEndDate(draftEndDate);
              setFilterOpen(false);
            }}
          />
        </View>
      </MobileSheet>
      {renderActionSheets()}
    </MobileScreen>
  );

  function renderActionSheets() {
    const actionTitle =
      confirmAction === 'approve'
        ? 'Approve loan?'
        : confirmAction === 'disburse'
          ? 'Disburse loan?'
          : 'Check overdue loans?';
    const actionDescription =
      confirmAction === 'approve' && actionLoan
        ? `${shortId(actionLoan.id)} for ${memberNameFor(actionLoan)} will move to approved.`
        : confirmAction === 'disburse' && actionLoan
          ? `${shortId(actionLoan.id)} will be disbursed and schedules may be generated.`
          : 'The backend will recalculate overdue loan states for the association.';
    return (
      <>
        <MobileConfirmSheet
          visible={Boolean(confirmAction)}
          title={actionTitle}
          description={actionDescription}
          confirmLabel={confirmAction === 'overdue' ? 'Run check' : 'Confirm'}
          onCancel={() => {
            setConfirmAction(null);
            setActionLoan(null);
          }}
          onConfirm={runConfirmedAction}
        />
        <MobileSheet
          visible={Boolean(rejectLoanRow)}
          title="Reject loan?"
          description={rejectLoanRow ? `Provide a clear reason for ${shortId(rejectLoanRow.id)}.` : undefined}
          onClose={() => {
            setRejectLoanRow(null);
            setRejectReason('');
          }}
        >
          <MobileTextInput
            label="Reason"
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Explain why this request is rejected"
            icon={XCircle}
          />
          <View style={styles.sheetActions}>
            <MobileButton
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setRejectLoanRow(null);
                setRejectReason('');
              }}
            />
            <MobileButton
              label="Reject"
              variant="danger"
              fullWidth
              style={styles.flex}
              disabled={rejectReason.trim().length < 3 || processing}
              loading={processing}
              onPress={submitReject}
            />
          </View>
        </MobileSheet>
      </>
    );
  }
}

function LoanCard({
  loan,
  processing,
  onOpen,
  onApprove,
  onDisburse,
  onReject,
}: {
  loan: AssociationLoanSummary;
  processing: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onDisburse: () => void;
  onReject: () => void;
}) {
  const theme = useNaneTheme();
  const status = String(loan.status || 'Unknown');
  return (
    <MobileCard compact accent={toneForLoan(loan)}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {memberNameFor(loan)}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {memberNumberFor(loan) || 'No membership number'} · {shortId(loan.id)}
          </MobileText>
        </View>
        <MobileStatusBadge status={status} tone={loan.isOverdue ? 'danger' : statusToneFor(status)} />
      </View>
      <View style={styles.loanMoneyGrid}>
        <MoneyCell label="Requested" value={formatCurrency(toNumber(loan.requestedAmount))} color={theme.colors.text} />
        <MoneyCell label="Balance" value={formatCurrency(toNumber(loan.remainingBalance))} color={theme.colors.status.warning} />
      </View>
      <MobileInfoRow label="Requested" value={formatDate(loan.requestDate)} helper={`Due ${formatDate(loan.nextPaymentDueDate)}`} icon={CalendarDays} status={loan.isOverdue ? 'Overdue' : undefined} />
      <View style={styles.actionsWrap}>
        <MobileButton label="Details" icon={ReceiptText} size="sm" variant="secondary" onPress={onOpen} />
        {status === 'PENDING' ? (
          <>
            <MobileButton label="Reject" icon={XCircle} size="sm" variant="secondary" disabled={processing} onPress={onReject} />
            <MobileButton label="Approve" icon={CheckCircle2} size="sm" disabled={processing} onPress={onApprove} />
          </>
        ) : null}
        {status === 'APPROVED' ? <MobileButton label="Disburse" icon={WalletCards} size="sm" disabled={processing} onPress={onDisburse} /> : null}
      </View>
    </MobileCard>
  );
}

function LoanDetailView({
  loan,
  history,
  processing,
  onApprove,
  onDisburse,
  onReject,
}: {
  loan: LoanDetail;
  history: LoanHistoryRecord[];
  processing: boolean;
  onApprove: () => void;
  onDisburse: () => void;
  onReject: () => void;
}) {
  const status = String(loan.status || 'Unknown');
  const schedules = Array.isArray(loan.repaymentSchedules) ? loan.repaymentSchedules : [];
  const progress = repaymentProgress(loan);

  return (
    <>
      <MobileDetailHeader
        title={memberNameFor(loan)}
        subtitle={`${memberNumberFor(loan)} · ${shortId(loan.id)}`}
        eyebrow="Loan"
        status={loan.isOverdue ? 'Overdue' : status}
        avatarName={memberNameFor(loan)}
        avatarTone={statusToneFor(status)}
      />

      <MobileSummaryPanel
        title="Outstanding balance"
        value={formatCurrency(toNumber(loan.remainingBalance))}
        description={`${formatNumber(progress)}% repaid · requested ${formatCurrency(toNumber(loan.requestedAmount))}`}
        tone={loan.isOverdue ? 'red' : 'blue'}
        icon={TrendingDown}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Requested" value={formatCurrency(toNumber(loan.requestedAmount))} description={formatDate(loan.requestDate)} tone="blue" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total paid" value={formatCurrency(toNumber(loan.totalPaid))} description={loan.lastPaymentDate ? `Last ${formatDate(loan.lastPaymentDate)}` : 'No last payment'} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Installment" value={formatCurrency(toNumber(loan.repaymentAmount || loan.monthlyPayment))} description={`${loan.repaymentPeriod || 0} months`} tone="purple" icon={ListChecks} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Interest" value={formatCurrency(toNumber(loan.interestAmount || loan.totalInterest))} description={`${loan.interestRate || 0}% rate`} tone="orange" icon={Landmark} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {status === 'PENDING' || status === 'APPROVED' ? (
        <MobileCard compact>
          <View style={styles.actionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Review action
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Actions are permission-sensitive on the backend and require confirmation.
              </MobileText>
            </View>
          </View>
          <View style={styles.actionsWrap}>
            {status === 'PENDING' ? (
              <>
                <MobileButton label="Reject" icon={XCircle} variant="secondary" disabled={processing} onPress={onReject} />
                <MobileButton label="Approve" icon={ShieldCheck} disabled={processing} onPress={onApprove} />
              </>
            ) : null}
            {status === 'APPROVED' ? <MobileButton label="Disburse" icon={WalletCards} disabled={processing} onPress={onDisburse} /> : null}
          </View>
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Loan terms
        </MobileText>
        <MobileInfoRow label="Purpose" value={loan.purpose || 'Not specified'} icon={ReceiptText} />
        <MobileInfoRow label="Disbursed" value={loan.disbursementDate ? formatDate(loan.disbursementDate) : 'Not disbursed'} helper={formatCurrency(toNumber(loan.disbursedAmount))} icon={WalletCards} />
        <MobileInfoRow label="Insurance" value={formatCurrency(toNumber(loan.insuranceFee))} helper={loan.interestCalculationMethod || loan.calculationDescription || undefined} icon={ShieldCheck} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Repayment schedule
            </MobileText>
            <MobileText variant="small" tone="secondary">
              First {Math.min(6, schedules.length)} of {schedules.length} installments.
            </MobileText>
          </View>
        </View>
        {schedules.length > 0 ? (
          schedules.slice(0, 6).map((schedule) => <ScheduleRow key={String(schedule.id || schedule.installmentNumber)} schedule={schedule} />)
        ) : (
          <MobileEmptyState title="No schedule" description="The repayment schedule will appear after disbursement." />
        )}
      </MobileCard>

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Loan history
        </MobileText>
        {history.length > 0 ? (
          <MobileTimeline
            items={history.slice(0, 8).map((item, index) => ({
              id: String(item.id || `${item.action}-${index}`),
              title: labelFromCode(item.action),
              description: item.details || undefined,
              time: formatDate(item.actionDate || item.createdAt),
              tone: index === 0 ? 'primary' : 'neutral',
            }))}
          />
        ) : (
          <MobileEmptyState title="No history" description="Loan actions will appear here when available." />
        )}
      </MobileCard>
    </>
  );
}

function ScheduleRow({ schedule }: { schedule: LoanRepaymentSchedule }) {
  return (
    <View style={styles.scheduleRow}>
      <View style={styles.flex}>
        <MobileText variant="body" weight="bold">
          Installment {schedule.installmentNumber || '-'}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Due {formatDate(schedule.dueDate)}
        </MobileText>
      </View>
      <View style={styles.scheduleAmount}>
        <MobileText variant="body" weight="bold">
          {formatCurrency(toNumber(schedule.amountDue))}
        </MobileText>
        <MobileStatusBadge status={schedule.status || 'Pending'} />
      </View>
    </View>
  );
}

function MoneyCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.moneyCell}>
      <MobileText variant="tiny" tone="secondary" weight="bold">
        {label}
      </MobileText>
      <MobileText variant="body" weight="bold" style={{ color }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </MobileText>
    </View>
  );
}

function filterLoansByTab(loans: AssociationLoanSummary[], activeTab: LoanTab) {
  switch (activeTab) {
    case 'pending':
      return loans.filter((loan) => loan.status === 'PENDING');
    case 'approved':
      return loans.filter((loan) => loan.status === 'APPROVED');
    case 'disbursed':
      return loans.filter((loan) => ['DISBURSED', 'OVERDUE', 'DEFAULTED', 'PARTIAL'].includes(String(loan.status)));
    case 'rejected':
      return loans.filter((loan) => loan.status === 'REJECTED');
    case 'cancelled':
      return loans.filter((loan) => loan.status === 'CANCELLED');
    case 'completed':
      return loans.filter((loan) => ['COMPLETED', 'PAID'].includes(String(loan.status)));
    case 'defaulted':
      return loans.filter((loan) => loan.status === 'DEFAULTED');
    case 'all':
    default:
      return loans;
  }
}

function sortLoans(loans: AssociationLoanSummary[], sortValue: SortOption) {
  return [...loans].sort((left, right) => {
    if (sortValue === 'dateDesc') return timestamp(right.requestDate) - timestamp(left.requestDate);
    if (sortValue === 'amountDesc') return toNumber(right.requestedAmount) - toNumber(left.requestedAmount);
    if (sortValue === 'balanceDesc') return toNumber(right.remainingBalance) - toNumber(left.remainingBalance);
    if (sortValue === 'statusAsc') return String(left.status || '').localeCompare(String(right.status || ''));
    return compareMemberNumbers(left, right);
  });
}

function summarizeLoans(loans: AssociationLoanSummary[]) {
  const totals = {
    totalLoans: 0,
    totalDisbursed: 0,
    totalRepaid: 0,
    pendingCount: 0,
    pendingValue: 0,
    overdueCount: 0,
    defaultedCount: 0,
    overdueValue: 0,
    activeCount: 0,
    totalRemainingBalance: 0,
  };
  loans.forEach((loan) => {
    totals.totalLoans += 1;
    const status = String(loan.status || '');
    if (['DISBURSED', 'PARTIAL', 'OVERDUE', 'DEFAULTED', 'COMPLETED', 'PAID'].includes(status)) {
      totals.totalDisbursed += toNumber((loan as { disbursedAmount?: number | string | null }).disbursedAmount);
      totals.totalRepaid += Math.max(0, toNumber(loan.requestedAmount) - toNumber(loan.remainingBalance));
    }
    if (status === 'PENDING') {
      totals.pendingCount += 1;
      totals.pendingValue += toNumber(loan.requestedAmount);
    }
    if (status === 'DEFAULTED') totals.defaultedCount += 1;
    if (loan.isOverdue) {
      totals.overdueCount += 1;
      totals.overdueValue += toNumber(loan.remainingBalance);
    }
    if (['APPROVED', 'DISBURSED', 'PARTIAL', 'OVERDUE', 'DEFAULTED'].includes(status)) {
      totals.activeCount += 1;
      totals.totalRemainingBalance += toNumber(loan.remainingBalance);
    }
  });
  return totals;
}

function compareMemberNumbers(left: AssociationLoanSummary, right: AssociationLoanSummary) {
  const numA = memberNumberFor(left);
  const numB = memberNumberFor(right);
  const matchA = numA.match(/\/(\d+)$/);
  const matchB = numB.match(/\/(\d+)$/);
  if (matchA && matchB) {
    const valA = Number(matchA[1]);
    const valB = Number(matchB[1]);
    if (Number.isFinite(valA) && Number.isFinite(valB) && valA !== valB) return valA - valB;
  }
  if (numA !== numB) return numA.localeCompare(numB);
  return memberNameFor(left).localeCompare(memberNameFor(right));
}

function toneForLoan(loan: AssociationLoanSummary) {
  const status = String(loan.status || '').toUpperCase();
  if (loan.isOverdue || status === 'DEFAULTED') return 'red';
  if (status === 'PENDING') return 'orange';
  if (status === 'APPROVED') return 'purple';
  if (status === 'COMPLETED' || status === 'PAID') return 'green';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'slate';
  return 'blue';
}

function repaymentProgress(loan: LoanDetail) {
  const requested = toNumber(loan.requestedAmount);
  if (requested <= 0) return 0;
  const paid = toNumber(loan.totalPaid) || Math.max(0, requested - toNumber(loan.remainingBalance));
  return Math.min(100, Math.max(0, Math.round((paid / requested) * 100)));
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : 'loan';
}

function memberNameFor(loan: AssociationLoanSummary | LoanDetail) {
  return loan.memberFullName || 'Unknown member';
}

function memberNumberFor(loan: AssociationLoanSummary | LoanDetail) {
  return loan.memberMembershipNumber || (loan as LoanDetail).membershipNumber || '';
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(value?: string | null) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function labelFromCode(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  loanMoneyGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  moneyCell: {
    flex: 1,
    gap: 2,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleAmount: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
