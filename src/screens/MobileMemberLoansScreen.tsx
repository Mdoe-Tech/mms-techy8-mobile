import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Landmark,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation, isVikobaAssociation } from '@/auth/association-type';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
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
  MobileText,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getMemberLoanDetails,
  getMemberLoanHistory,
  getMemberLoans,
  type LoanDetail,
  type LoanHistoryRecord,
} from '@/services/loan-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getRouteByPath } from '@/navigation/route-registry';
import { statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type LoanTab = 'active' | 'all' | 'pending' | 'approved' | 'completed' | 'overdue' | 'closed';
type SortOption = 'dateDesc' | 'balanceDesc' | 'amountDesc' | 'dueAsc' | 'statusAsc';

const loanTabs: { value: LoanTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'closed', label: 'Closed' },
];

const sortOptions = [
  { value: 'dateDesc', label: 'Newest request', description: 'Latest requested loans first.' },
  { value: 'balanceDesc', label: 'Highest balance', description: 'Largest outstanding balances first.' },
  { value: 'amountDesc', label: 'Highest requested', description: 'Largest loan amount first.' },
  { value: 'dueAsc', label: 'Nearest due date', description: 'Upcoming payment dates first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group loans by current status.' },
];

export default function MobileMemberLoansScreen() {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const loanRequestRouteId = getRouteByPath('/member/loans/request')?.id || 'member-member-loans-request';
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<LoanTab>('active');
  const [sortValue, setSortValue] = useState<SortOption>('dateDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<LoanHistoryRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLoans = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const loadedMember = await getCurrentMemberByUserId(userId);
        const loadedLoans = await getMemberLoans(loadedMember.id);
        setMember(loadedMember);
        setLoans(Array.isArray(loadedLoans) ? loadedLoans : []);
      } catch (loadError) {
        setMember(null);
        setLoans([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadLoans());
    }
  }, [activeView, loadLoans]);

  const metrics = useMemo(() => summarizeLoans(loans), [loans]);
  const visibleLoans = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = filterLoansByTab(loans, activeTab).filter((loan) => {
      if (!query) return true;
      return [loan.id, loan.status, loan.purpose, memberNumberFor(loan), memberNameFor(loan)]
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

  const openLoan = useCallback(async (loan: LoanDetail) => {
    setSelectedLoanId(loan.id);
    setSelectedLoan(loan);
    setSelectedHistory([]);
    setDetailLoading(true);
    setError(null);
    try {
      const [details, history] = await Promise.all([getMemberLoanDetails(loan.id), getMemberLoanHistory(loan.id)]);
      setSelectedLoan(details);
      setSelectedHistory(history || details.histories || []);
    } catch (detailError) {
      setError(getApiErrorMessage(detailError));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openLoanRequest = useCallback(() => {
    router.push({ pathname: '/work/route-preview', params: { routeId: loanRequestRouteId } } as never);
  }, [loanRequestRouteId]);

  if (activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="My loans" description="This native loan register is available from the member portal workspace." />;
  }

  if (user?.associationType && !isVikobaAssociation(user.associationType) && !isSaccosAssociation(user.associationType)) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My loans"
          subtitle={user.associationName || 'Loan self-service'}
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="Loans are not enabled"
          description="The mobile loan lifecycle is available for VIKOBA and SACCOS members."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </MobileScreen>
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading your loans" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My loans"
          subtitle="Loan register unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry loans" variant="secondary" onPress={() => void loadLoans('refresh')} />}
        />
        <MobileErrorState title="Loans could not load" description={error} retryLabel="Retry" onRetry={() => void loadLoans('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="My loans"
        subtitle={member?.associationName || user?.associationName || 'Loan self-service'}
        onBack={() => router.back()}
        rightAction={
          <View style={styles.headerActions}>
            <MobileIconButton icon={Landmark} label="Request loan" variant="primary" onPress={openLoanRequest} />
            <MobileIconButton
              icon={RefreshCw}
              label="Refresh loans"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadLoans('refresh')}
            />
          </View>
        }
      />

      {error ? <MobileErrorState title="Some loan data could not refresh" description={error} retryLabel="Retry" onRetry={() => void loadLoans('refresh')} /> : null}

      <MobileStatusBadge
        status={member?.status || 'Active'}
        label={`${member?.fullLegalName || user?.fullName || 'Current member'} · ${member?.membershipNumber || 'No membership number'}`}
        tone={statusToneFor(member?.status)}
      />

      <MobileSummaryPanel
        title="Outstanding balance"
        value={formatCurrency(metrics.outstandingBalance)}
        description={`${formatNumber(metrics.activeCount)} active loan(s) from ${formatNumber(loans.length)} total record(s).`}
        tone={metrics.overdueCount ? 'red' : metrics.outstandingBalance > 0 ? 'blue' : 'green'}
        icon={TrendingDown}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={metrics.nextDue ? 'Pending' : 'Completed'} label={metrics.nextDue ? `Next due ${formatDate(metrics.nextDue)}` : 'No due date'} tone={metrics.nextDue ? 'warning' : 'success'} />
            {refreshing ? <MobileLoadingState compact message="Refreshing" /> : null}
          </View>
        }
      />

      <MobileSearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search loan id, purpose, status..."
        filterLabel="Sort"
        onFilterPress={() => setSortOpen(true)}
      />
      <MobileStatusTabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as LoanTab)}
        tabs={loanTabs.map((tab) => ({ value: tab.value, label: tab.label, count: tabCounts[tab.value] || 0 }))}
      />

      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold">
            Loan records
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {formatNumber(visibleLoans.length)} visible of {formatNumber(loans.length)} loaded.
          </MobileText>
        </View>
        {refreshing ? <MobileStatusBadge status="Processing" label="Refreshing" tone="warning" /> : null}
      </View>

      {visibleLoans.length ? (
        <View style={styles.list}>
          {visibleLoans.map((loan) => (
            <MemberLoanCard key={loan.id} loan={loan} onPress={() => void openLoan(loan)} />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No loans found"
          description={loans.length ? 'Change the search, sort, or status tab to find loan records.' : 'You do not have loan records yet.'}
          actionLabel={loans.length ? 'Reset filters' : undefined}
          onAction={() => {
            setSearchTerm('');
            setActiveTab('all');
          }}
        />
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <MobileText variant="section" weight="bold">
            Loan totals
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Supporting totals for the loaded loan register.
          </MobileText>
        </View>
      </View>
      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active loans" value={formatNumber(metrics.activeCount)} description={`${formatNumber(metrics.pendingCount)} pending`} tone="blue" icon={Landmark} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Requested" value={formatCurrency(metrics.requestedAmount)} description="Total requested" tone="purple" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Repaid" value={formatCurrency(metrics.totalPaid)} description={`${formatNumber(metrics.averageProgress)}% average`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatNumber(metrics.overdueCount)} description={formatCurrency(metrics.overdueBalance)} tone={metrics.overdueCount ? 'red' : 'slate'} icon={AlertTriangle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />
      <LoanQuickSheet
        loan={selectedLoan}
        history={selectedHistory}
        loading={detailLoading}
        visible={Boolean(selectedLoanId)}
        onClose={() => {
          setSelectedLoanId(null);
          setSelectedLoan(null);
          setSelectedHistory([]);
        }}
      />
    </MobileScreen>
  );
}

function MemberLoanCard({ loan, onPress }: { loan: LoanDetail; onPress: () => void }) {
  const theme = useNaneTheme();
  const progress = repaymentProgress(loan);
  const status = String(loan.status || 'Unknown');
  const tone = toneForLoan(loan);

  return (
    <MobileCard compact accent={tone}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {loan.purpose || 'Loan request'}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={1}>
            {shortId(loan.id)} · requested {formatDate(loan.requestDate)}
          </MobileText>
        </View>
        <MobileStatusBadge status={loan.isOverdue ? 'Overdue' : status} tone={loan.isOverdue ? 'danger' : statusToneFor(status)} />
      </View>

      <View style={styles.moneyGrid}>
        <MoneyCell label="Requested" value={formatCurrency(toNumber(loan.requestedAmount))} color={theme.colors.text} />
        <MoneyCell label="Balance" value={formatCurrency(toNumber(loan.remainingBalance))} color={theme.colors.status.warning} />
      </View>
      <MobileProgressBar value={progress} label="Repayment progress" tone={loan.isOverdue ? 'red' : progress >= 100 ? 'green' : 'blue'} />
      <MobileInfoRow
        label="Next payment"
        value={loan.nextPaymentDueDate ? formatDate(loan.nextPaymentDueDate) : 'No due date'}
        helper={`${formatCurrency(toNumber(loan.repaymentAmount || loan.monthlyPayment))} installment`}
        icon={CalendarDays}
        status={loan.isOverdue ? 'Overdue' : undefined}
      />
      <View style={styles.actionsWrap}>
        <MobileButton label="Quick view" icon={ReceiptText} size="sm" variant="secondary" onPress={onPress} />
      </View>
    </MobileCard>
  );
}

function LoanQuickSheet({
  loan,
  history,
  loading,
  visible,
  onClose,
}: {
  loan: LoanDetail | null;
  history: LoanHistoryRecord[];
  loading: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <MobileSheet
      visible={visible}
      title={loan ? loan.purpose || `Loan ${shortId(loan.id)}` : 'Loan details'}
      description={loan ? `${shortId(loan.id)} · ${loan.status || 'Unknown'}` : undefined}
      onClose={onClose}
    >
      {loading && !loan ? <MobileLoadingState message="Loading loan details" /> : null}
      {loan ? (
        <>
          <MobileSummaryPanel
            title="Outstanding balance"
            value={formatCurrency(toNumber(loan.remainingBalance))}
            description={`${formatNumber(repaymentProgress(loan))}% repaid · ${formatCurrency(toNumber(loan.totalPaid))} paid`}
            tone={loan.isOverdue ? 'red' : 'blue'}
            icon={WalletCards}
          />
          <MobileInfoRow label="Requested amount" value={formatCurrency(toNumber(loan.requestedAmount))} helper={formatDate(loan.requestDate)} icon={Banknote} />
          <MobileInfoRow label="Next payment" value={loan.nextPaymentDueDate ? formatDate(loan.nextPaymentDueDate) : 'No due date'} helper={formatCurrency(toNumber(loan.repaymentAmount || loan.monthlyPayment))} icon={Clock3} />
          <MobileInfoRow label="Interest" value={`${formatNumber(toNumber(loan.interestRate))}%`} helper={formatCurrency(toNumber(loan.interestAmount || loan.totalInterest))} icon={Landmark} />
          <MobileInfoRow label="Disbursed" value={loan.disbursementDate ? formatDate(loan.disbursementDate) : 'Not disbursed'} helper={formatCurrency(toNumber(loan.disbursedAmount))} icon={WalletCards} />
          <MobileInfoRow label="Latest action" value={history[0]?.action ? labelFromCode(history[0].action) : 'No history'} helper={history[0]?.actionDate ? formatDate(history[0].actionDate) : undefined} icon={ReceiptText} />
        </>
      ) : null}
    </MobileSheet>
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

function summarizeLoans(loans: LoanDetail[]) {
  let activeCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let requestedAmount = 0;
  let outstandingBalance = 0;
  let overdueBalance = 0;
  let totalPaid = 0;
  let progressTotal = 0;
  let progressCount = 0;
  let nextDue: string | null = null;

  loans.forEach((loan) => {
    const status = String(loan.status || '').toUpperCase();
    const balance = toNumber(loan.remainingBalance);
    requestedAmount += toNumber(loan.requestedAmount);
    totalPaid += toNumber(loan.totalPaid) || Math.max(0, toNumber(loan.requestedAmount) - balance);
    if (isActiveLoan(loan)) {
      activeCount += 1;
      outstandingBalance += balance;
      if (loan.nextPaymentDueDate && (!nextDue || timestamp(loan.nextPaymentDueDate) < timestamp(nextDue))) {
        nextDue = loan.nextPaymentDueDate;
      }
    }
    if (status === 'PENDING') pendingCount += 1;
    if (loan.isOverdue || status === 'OVERDUE' || status === 'DEFAULTED') {
      overdueCount += 1;
      overdueBalance += balance;
    }
    progressTotal += repaymentProgress(loan);
    progressCount += 1;
  });

  return {
    activeCount,
    pendingCount,
    overdueCount,
    requestedAmount,
    outstandingBalance,
    overdueBalance,
    totalPaid,
    averageProgress: progressCount ? Math.round(progressTotal / progressCount) : 0,
    nextDue,
  };
}

function filterLoansByTab(loans: LoanDetail[], activeTab: LoanTab) {
  switch (activeTab) {
    case 'active':
      return loans.filter(isActiveLoan);
    case 'pending':
      return loans.filter((loan) => String(loan.status || '').toUpperCase() === 'PENDING');
    case 'approved':
      return loans.filter((loan) => String(loan.status || '').toUpperCase() === 'APPROVED');
    case 'completed':
      return loans.filter((loan) => ['COMPLETED', 'PAID'].includes(String(loan.status || '').toUpperCase()));
    case 'overdue':
      return loans.filter((loan) => loan.isOverdue || ['OVERDUE', 'DEFAULTED'].includes(String(loan.status || '').toUpperCase()));
    case 'closed':
      return loans.filter((loan) => ['REJECTED', 'CANCELLED'].includes(String(loan.status || '').toUpperCase()));
    case 'all':
    default:
      return loans;
  }
}

function sortLoans(loans: LoanDetail[], sortValue: SortOption) {
  return [...loans].sort((left, right) => {
    if (sortValue === 'balanceDesc') return toNumber(right.remainingBalance) - toNumber(left.remainingBalance);
    if (sortValue === 'amountDesc') return toNumber(right.requestedAmount) - toNumber(left.requestedAmount);
    if (sortValue === 'dueAsc') return timestamp(left.nextPaymentDueDate) - timestamp(right.nextPaymentDueDate);
    if (sortValue === 'statusAsc') return String(left.status || '').localeCompare(String(right.status || ''));
    return timestamp(right.requestDate) - timestamp(left.requestDate);
  });
}

function isActiveLoan(loan: LoanDetail) {
  return ['APPROVED', 'DISBURSED', 'PARTIAL', 'OVERDUE', 'DEFAULTED'].includes(String(loan.status || '').toUpperCase());
}

function toneForLoan(loan: LoanDetail) {
  const status = String(loan.status || '').toUpperCase();
  if (loan.isOverdue || status === 'OVERDUE' || status === 'DEFAULTED') return 'red';
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

function memberNameFor(loan: LoanDetail) {
  return loan.memberFullName || 'Current member';
}

function memberNumberFor(loan: LoanDetail) {
  return loan.memberMembershipNumber || loan.membershipNumber || '';
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : 'loan';
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
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
  summaryFooter: {
    gap: 8,
    alignItems: 'flex-start',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  moneyGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  moneyCell: {
    flex: 1,
    gap: 2,
  },
});
